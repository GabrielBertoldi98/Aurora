import { afterEach, describe, expect, it, vi } from 'vitest';

import { DropboxAdapter } from '../src/providers/dropbox.adapter.js';

describe('DropboxAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes Dropbox folders and keeps its cursor when more results are available', async () => {
    const getDropboxAccessToken = vi.fn(async () => 'access-token');
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            cursor: 'dropbox-cursor',
            has_more: true,
            entries: [
              {
                '.tag': 'folder',
                id: 'id:folder-1',
                name: 'Documents',
                path_display: '/Documents',
                path_lower: '/documents',
              },
            ],
          }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new DropboxAdapter({ getDropboxAccessToken } as never);

    const result = await adapter.listFiles({
      connection: {
        connectionId: 'connection-1',
        userId: 'user-1',
        provider: 'dropbox',
      },
      pageSize: 20,
    });

    expect(getDropboxAccessToken).toHaveBeenCalledWith('connection-1', 'user-1');
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          kind: 'folder',
          parentRemoteId: null,
          provider: 'dropbox',
        }),
      ],
      nextCursor: 'dropbox-cursor',
    });
  });

  it('uses the Dropbox continuation endpoint for an opaque cursor', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ cursor: 'ignored', has_more: false, entries: [] })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new DropboxAdapter({
      getDropboxAccessToken: async () => 'access-token',
    } as never);

    await adapter.listFiles({
      connection: {
        connectionId: 'connection-1',
        userId: 'user-1',
        provider: 'dropbox',
      },
      cursor: 'cursor-from-dropbox',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.dropboxapi.com/2/files/list_folder/continue',
      expect.objectContaining({ body: JSON.stringify({ cursor: 'cursor-from-dropbox' }) }),
    );
  });
});
