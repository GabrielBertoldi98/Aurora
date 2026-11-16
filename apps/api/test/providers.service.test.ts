import { describe, expect, it } from 'vitest';

import { DropboxAdapter, OneDriveAdapter } from '../src/providers/provider-adapters.js';
import { GoogleDriveAdapter } from '../src/providers/google-drive.adapter.js';
import {
  ProviderAdapterNotRegisteredError,
  ProviderAdapterRegistry,
} from '../src/providers/provider-adapter-registry.service.js';
import { ProvidersService } from '../src/providers/providers.service.js';

describe('ProvidersService', () => {
  const registry = new ProviderAdapterRegistry([new DropboxAdapter(), new OneDriveAdapter()]);
  const googleRegistry = new ProviderAdapterRegistry([
    new GoogleDriveAdapter({
      getGoogleDriveAccessToken: async () => 'test-access-token',
    } as never),
  ]);
  const service = new ProvidersService(registry);

  it('selects the correct fake adapter and returns normalized files', async () => {
    const result = await service.listFiles({
      connection: {
        connectionId: 'connection-1',
        userId: 'user-1',
        provider: 'dropbox',
      },
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        connectionId: 'connection-1',
        kind: 'folder',
        provider: 'dropbox',
      }),
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it('registers the Google Drive adapter separately from fake providers', () => {
    expect(googleRegistry.getAdapter('google-drive').capabilities.canListFiles).toBe(true);
  });

  it('navigates by passing the parent remote identifier to the adapter', async () => {
    const result = await service.listFiles({
      connection: {
        connectionId: 'connection-1',
        userId: 'user-1',
        provider: 'dropbox',
      },
      parentRemoteId: 'dropbox-folder',
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        kind: 'file',
        parentRemoteId: 'dropbox-folder',
      }),
    ]);
  });

  it('fails explicitly when an adapter is not registered', () => {
    const incompleteRegistry = new ProviderAdapterRegistry([new DropboxAdapter()]);

    expect(() => incompleteRegistry.getAdapter('onedrive')).toThrow(
      ProviderAdapterNotRegisteredError,
    );
  });
});
