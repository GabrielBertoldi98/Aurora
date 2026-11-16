import type {
  CloudFile,
  CloudProviderAdapter,
  ListFilesInput,
  ListFilesResult,
} from '@cloud-hub/contracts';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';

import { CloudConnectionsService } from '../cloud-connections/cloud-connections.service.js';

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

@Injectable()
export class GoogleDriveAdapter implements CloudProviderAdapter {
  readonly provider = 'google-drive' as const;
  readonly capabilities = {
    canListFiles: true,
    canNavigateFolders: true,
    canSearch: false,
    canDownload: false,
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
