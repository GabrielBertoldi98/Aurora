import type {
  CloudFile,
  CloudProviderAdapter,
  ListFilesInput,
  ListFilesResult,
} from '@cloud-hub/contracts';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { z } from 'zod';

import { CloudConnectionsService } from '../cloud-connections/cloud-connections.service.js';
import {
  ProviderTransferError,
  type DownloadedCloudFile,
  type UploadCloudFileInput,
} from './file-transfer.js';

const googleDriveListResponseSchema = z.object({
  nextPageToken: z.string().optional(),
  files: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        mimeType: z.string().optional(),
        size: z.string().optional(),
        createdTime: z.string().optional(),
        modifiedTime: z.string().optional(),
        parents: z.array(z.string()).optional(),
        webViewLink: z.string().url().optional(),
      }),
    )
    .default([]),
});

const GOOGLE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_WORKSPACE_MIME_PREFIX = 'application/vnd.google-apps.';

const googleTransferMetadataSchema = z.object({
  id: z.string().min(1),
  mimeType: z.string().optional(),
  size: z.string().regex(/^\d+$/).optional(),
});

@Injectable()
export class GoogleDriveAdapter implements CloudProviderAdapter {
  readonly provider = 'google-drive' as const;
  readonly capabilities = {
    canListFiles: true,
    canNavigateFolders: true,
    canSearch: false,
    canDownload: true,
  } as const;

  constructor(
    @Inject(CloudConnectionsService) private readonly connections: CloudConnectionsService,
  ) {}

  async listFiles(input: ListFilesInput): Promise<ListFilesResult> {
    const accessToken = await this.connections.getGoogleDriveAccessToken(
      input.connection.connectionId,
      input.connection.userId,
    );
    const parentRemoteId = input.parentRemoteId ?? 'root';
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set(
      'q',
      `'${parentRemoteId.replaceAll("'", "\\'")}' in parents and trashed = false`,
    );
    url.searchParams.set('pageSize', String(input.pageSize ?? 100));
    url.searchParams.set(
      'fields',
      'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink)',
    );
    url.searchParams.set('orderBy', 'folder,name');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');

    if (input.cursor) {
      url.searchParams.set('pageToken', input.cursor);
    }

    const response = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401) {
      throw new UnauthorizedException('Google Drive connection needs to be reconnected.');
    }

    if (!response.ok) {
      throw new Error(`Google Drive listing failed with status ${response.status}.`);
    }

    const payload = googleDriveListResponseSchema.parse(await response.json());

    return {
      items: payload.files.map((file) => this.toCloudFile(file, input.connection.connectionId)),
      nextCursor: payload.nextPageToken ?? null,
    };
  }

  async downloadFile(input: {
    readonly connectionId: string;
    readonly userId: string;
    readonly remoteId: string;
  }): Promise<DownloadedCloudFile> {
    const accessToken = await this.connections.getGoogleDriveAccessToken(
      input.connectionId,
      input.userId,
    );
    const metadata = await this.getTransferMetadata(input.remoteId, accessToken);

    if (metadata.mimeType?.startsWith(GOOGLE_WORKSPACE_MIME_PREFIX)) {
      throw new ProviderTransferError('transfer-not-supported', false);
    }

    const url = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.remoteId)}`,
    );
    url.searchParams.set('alt', 'media');
    url.searchParams.set('supportsAllDrives', 'true');
    const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });

    if (response.status === 401) {
      throw new ProviderTransferError('authentication-required', false);
    }

    if (!response.ok || !response.body) {
      throw new ProviderTransferError(
        'provider-unavailable',
        response.status >= 500 || response.status === 429,
      );
    }

    return {
      stream: Readable.fromWeb(response.body as never),
      mimeType: response.headers.get('content-type') ?? metadata.mimeType ?? null,
      sizeBytes: metadata.size ? BigInt(metadata.size) : null,
    };
  }

  async uploadFile(input: UploadCloudFileInput): Promise<void> {
    const accessToken = await this.connections.getGoogleDriveAccessToken(
      input.connectionId,
      input.userId,
    );
    const startUrl = new URL('https://www.googleapis.com/upload/drive/v3/files');
    startUrl.searchParams.set('uploadType', 'resumable');
    startUrl.searchParams.set('supportsAllDrives', 'true');
    const startResponse = await fetch(startUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        ...(input.mimeType ? { 'x-upload-content-type': input.mimeType } : {}),
        ...(input.sizeBytes !== null
          ? { 'x-upload-content-length': input.sizeBytes.toString() }
          : {}),
      },
      body: JSON.stringify({
        name: input.fileName,
        ...(input.parentRemoteId ? { parents: [input.parentRemoteId] } : {}),
      }),
    });

    if (startResponse.status === 401) {
      throw new ProviderTransferError('authentication-required', false);
    }

    if (!startResponse.ok) {
      throw new ProviderTransferError(
        'provider-unavailable',
        startResponse.status >= 500 || startResponse.status === 429,
      );
    }

    const uploadUrlValue = startResponse.headers.get('location');
    if (!uploadUrlValue) {
      throw new ProviderTransferError('provider-unavailable', true);
    }

    const uploadUrl = new URL(uploadUrlValue);
    if (uploadUrl.protocol !== 'https:' || uploadUrl.hostname !== 'www.googleapis.com') {
      throw new ProviderTransferError('provider-unavailable', false);
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'content-type': input.mimeType ?? 'application/octet-stream',
        ...(input.sizeBytes !== null ? { 'content-length': input.sizeBytes.toString() } : {}),
      },
      body: input.stream as never,
      duplex: 'half',
    } as RequestInit);

    if (!uploadResponse.ok) {
      throw new ProviderTransferError(
        'provider-unavailable',
        uploadResponse.status >= 500 || uploadResponse.status === 429,
      );
    }
  }

  private async getTransferMetadata(remoteId: string, accessToken: string) {
    const url = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(remoteId)}`,
    );
    url.searchParams.set('fields', 'id,mimeType,size');
    url.searchParams.set('supportsAllDrives', 'true');
    const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });

    if (response.status === 401) {
      throw new ProviderTransferError('authentication-required', false);
    }

    if (!response.ok) {
      throw new ProviderTransferError(
        'provider-unavailable',
        response.status >= 500 || response.status === 429,
      );
    }

    return googleTransferMetadataSchema.parse(await response.json());
  }

  private toCloudFile(
    file: z.infer<typeof googleDriveListResponseSchema>['files'][number],
    connectionId: string,
  ): CloudFile {
    return {
      remoteId: file.id,
      connectionId,
      provider: this.provider,
      name: file.name,
      kind: file.mimeType === GOOGLE_FOLDER_MIME_TYPE ? 'folder' : 'file',
      mimeType: file.mimeType ?? null,
      sizeBytes: file.size ? Number(file.size) : null,
      createdAt: file.createdTime ? new Date(file.createdTime) : null,
      modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : null,
      parentRemoteId: file.parents?.[0] ?? null,
      webUrl: file.webViewLink ?? null,
      providerMetadata: {},
    };
  }
}
