import type {
  CloudFile,
  CloudProviderAdapter,
  ListFilesInput,
  ListFilesResult,
} from '@cloud-hub/contracts';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';

import { CloudConnectionsService } from '../cloud-connections/cloud-connections.service.js';

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

@Injectable()
export class DropboxAdapter implements CloudProviderAdapter {
  readonly provider = 'dropbox' as const;
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
