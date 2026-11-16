import { afterEach, describe, expect, it, vi } from 'vitest';

import { GoogleDriveAdapter } from '../src/providers/google-drive.adapter.js';

describe('GoogleDriveAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes a Google Drive API response and preserves its page token', async () => {
    const getGoogleDriveAccessToken = vi.fn(async () => 'access-token');
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            nextPageToken: 'next-page',
            files: [
              {
                id: 'folder-1',
                name: 'Documents',
                mimeType: 'application/vnd.google-apps.folder',
                parents: ['root'],
              },
            ],
          }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new GoogleDriveAdapter({ getGoogleDriveAccessToken } as never);

    const result = await adapter.listFiles({
      connection: {
        connectionId: 'connection-1',
        userId: 'user-1',
        provider: 'google-drive',
      },
      pageSize: 20,
    });

    expect(getGoogleDriveAccessToken).toHaveBeenCalledWith('connection-1', 'user-1');
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          kind: 'folder',
          parentRemoteId: 'root',
          provider: 'google-drive',
        }),
      ],
      nextCursor: 'next-page',
    });
  });
});
