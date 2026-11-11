import { describe, expect, it } from 'vitest';

import { cloudFileSchema, listFilesInputSchema } from '../index.js';

describe('cloud provider contracts', () => {
  it('accepts a normalized file with optional provider data', () => {
    const file = cloudFileSchema.parse({
      remoteId: 'drive-file-1',
      connectionId: 'connection-1',
      provider: 'google-drive',
      name: 'project-plan.pdf',
      kind: 'file',
      mimeType: 'application/pdf',
      sizeBytes: 128,
      createdAt: null,
      modifiedAt: null,
      parentRemoteId: null,
      webUrl: null,
      providerMetadata: { starred: false },
    });

    expect(file.provider).toBe('google-drive');
  });

  it('rejects a page size outside the adapter contract', () => {
    expect(() =>
      listFilesInputSchema.parse({
        connection: {
          connectionId: 'connection-1',
          userId: 'user-1',
          provider: 'dropbox',
        },
        pageSize: 101,
      }),
    ).toThrow();
  });
});
