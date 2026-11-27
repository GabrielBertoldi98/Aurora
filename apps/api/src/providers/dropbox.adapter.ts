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

const dropboxListResponseSchema = z.object({
  cursor: z.string().min(1),
  has_more: z.boolean(),
  entries: z
    .array(
      z.object({
        '.tag': z.enum(['file', 'folder']),
        id: z.string().min(1),
        name: z.string().min(1),
        path_lower: z.string().nullable().optional(),
        path_display: z.string().nullable().optional(),
        size: z.number().nonnegative().optional(),
        client_modified: z.string().optional(),
        server_modified: z.string().optional(),
        content_hash: z.string().optional(),
      }),
    )
    .default([]),
});

const dropboxMetadataSchema = z.object({
  '.tag': z.enum(['file', 'folder']),
  size: z.number().int().nonnegative().optional(),
  path_display: z.string().nullable().optional(),
});

const dropboxSessionStartSchema = z.object({ session_id: z.string().min(1) });

@Injectable()
export class DropboxAdapter implements CloudProviderAdapter {
  readonly provider = 'dropbox' as const;
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
    const accessToken = await this.connections.getDropboxAccessToken(
      input.connection.connectionId,
      input.connection.userId,
    );
    const response = input.cursor
      ? await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ cursor: input.cursor }),
        })
      : await fetch('https://api.dropboxapi.com/2/files/list_folder', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            path: input.parentRemoteId ?? '',
            recursive: false,
            include_deleted: false,
            include_mounted_folders: true,
            limit: input.pageSize ?? 100,
          }),
        });

    if (response.status === 401) {
      throw new UnauthorizedException('Dropbox connection needs to be reconnected.');
    }

    if (!response.ok) {
      throw new Error(`Dropbox listing failed with status ${response.status}.`);
    }

    const payload = dropboxListResponseSchema.parse(await response.json());

    return {
      items: payload.entries.map((entry) =>
        this.toCloudFile(entry, input.connection.connectionId, input.parentRemoteId ?? null),
      ),
      nextCursor: payload.has_more ? payload.cursor : null,
    };
  }

  async downloadFile(input: {
    readonly connectionId: string;
    readonly userId: string;
    readonly remoteId: string;
  }): Promise<DownloadedCloudFile> {
    const accessToken = await this.connections.getDropboxAccessToken(
      input.connectionId,
      input.userId,
    );
    const metadata = await this.getMetadata(input.remoteId, accessToken);

    if (metadata['.tag'] !== 'file') {
      throw new ProviderTransferError('transfer-not-supported', false);
    }

    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'dropbox-api-arg': JSON.stringify({ path: input.remoteId }),
      },
    });

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
      mimeType: response.headers.get('content-type'),
      sizeBytes: metadata.size === undefined ? null : BigInt(metadata.size),
    };
  }

  async uploadFile(input: UploadCloudFileInput): Promise<void> {
    const accessToken = await this.connections.getDropboxAccessToken(
      input.connectionId,
      input.userId,
    );
    const parentPath = await this.getDestinationPath(input.parentRemoteId, accessToken);
    const destinationPath = `${parentPath}/${input.fileName}`.replace(/^\/\//, '/');
    const sessionId = await this.startUploadSession(accessToken);
    const chunks = this.chunkStream(input.stream, 8 * 1024 * 1024);
    let pending = await chunks.next();
    let offset = 0;

    if (pending.done) {
      await this.finishUploadSession(
        accessToken,
        sessionId,
        offset,
        destinationPath,
        Buffer.alloc(0),
      );
      return;
    }

    for await (const chunk of chunks) {
      await this.appendUploadSession(accessToken, sessionId, offset, pending.value);
      offset += pending.value.length;
      pending = { value: chunk, done: false };
    }

    await this.finishUploadSession(accessToken, sessionId, offset, destinationPath, pending.value);
  }

  private async getMetadata(path: string, accessToken: string) {
    const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ path, include_media_info: false }),
    });

    if (response.status === 401) {
      throw new ProviderTransferError('authentication-required', false);
    }

    if (!response.ok) {
      throw new ProviderTransferError(
        'provider-unavailable',
        response.status >= 500 || response.status === 429,
      );
    }

    return dropboxMetadataSchema.parse(await response.json());
  }

  private async getDestinationPath(
    parentRemoteId: string | null,
    accessToken: string,
  ): Promise<string> {
    if (!parentRemoteId) {
      return '';
    }

    const metadata = await this.getMetadata(parentRemoteId, accessToken);
    if (metadata['.tag'] !== 'folder' || !metadata.path_display) {
      throw new ProviderTransferError('transfer-not-supported', false);
    }

    return metadata.path_display;
  }

  private async startUploadSession(accessToken: string): Promise<string> {
    const response = await fetch('https://content.dropboxapi.com/2/files/upload_session/start', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/octet-stream',
        'dropbox-api-arg': JSON.stringify({ close: false }),
      },
      body: Buffer.alloc(0),
    });
    this.throwForUploadResponse(response);
    return dropboxSessionStartSchema.parse(await response.json()).session_id;
  }

  private async appendUploadSession(
    accessToken: string,
    sessionId: string,
    offset: number,
    chunk: Buffer,
  ): Promise<void> {
    const response = await fetch(
      'https://content.dropboxapi.com/2/files/upload_session/append_v2',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/octet-stream',
          'dropbox-api-arg': JSON.stringify({
            cursor: { session_id: sessionId, offset },
            close: false,
          }),
        },
        body: chunk as never,
      },
    );
    this.throwForUploadResponse(response);
  }

  private async finishUploadSession(
    accessToken: string,
    sessionId: string,
    offset: number,
    path: string,
    chunk: Buffer,
  ): Promise<void> {
    const response = await fetch('https://content.dropboxapi.com/2/files/upload_session/finish', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/octet-stream',
        'dropbox-api-arg': JSON.stringify({
          cursor: { session_id: sessionId, offset },
          commit: { path, mode: 'add', autorename: false, mute: false, strict_conflict: true },
        }),
      },
      body: chunk as never,
    });
    this.throwForUploadResponse(response);
  }

  private throwForUploadResponse(response: Response): void {
    if (response.status === 401) {
      throw new ProviderTransferError('authentication-required', false);
    }

    if (!response.ok) {
      throw new ProviderTransferError(
        'provider-unavailable',
        response.status >= 500 || response.status === 429,
      );
    }
  }

  private async *chunkStream(stream: Readable, chunkSize: number): AsyncGenerator<Buffer> {
    let remainder = Buffer.alloc(0);

    for await (const value of stream) {
      remainder = Buffer.concat([remainder, Buffer.isBuffer(value) ? value : Buffer.from(value)]);
      while (remainder.length >= chunkSize) {
        yield remainder.subarray(0, chunkSize);
        remainder = remainder.subarray(chunkSize);
      }
    }

    if (remainder.length > 0) {
      yield remainder;
    }
  }

  private toCloudFile(
    entry: z.infer<typeof dropboxListResponseSchema>['entries'][number],
    connectionId: string,
    parentRemoteId: string | null,
  ): CloudFile {
    return {
      remoteId: entry.id,
      connectionId,
      provider: this.provider,
      name: entry.name,
      kind: entry['.tag'],
      mimeType: null,
      sizeBytes: entry.size ?? null,
      createdAt: entry.client_modified ? new Date(entry.client_modified) : null,
      modifiedAt: entry.server_modified ? new Date(entry.server_modified) : null,
      parentRemoteId,
      webUrl: null,
      providerMetadata: {
        contentHash: entry.content_hash ?? null,
        pathDisplay: entry.path_display ?? null,
        pathLower: entry.path_lower ?? null,
      },
    };
  }
}
