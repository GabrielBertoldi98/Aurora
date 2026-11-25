import { describe, expect, it } from 'vitest';

import { DropboxAdapter } from '../src/providers/dropbox.adapter.js';
import { OneDriveAdapter } from '../src/providers/provider-adapters.js';
import { GoogleDriveAdapter } from '../src/providers/google-drive.adapter.js';
import {
  ProviderAdapterNotRegisteredError,
  ProviderAdapterRegistry,
} from '../src/providers/provider-adapter-registry.service.js';
import { ProvidersService } from '../src/providers/providers.service.js';

describe('ProvidersService', () => {
  const registry = new ProviderAdapterRegistry([new OneDriveAdapter()]);
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
        provider: 'onedrive',
      },
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        connectionId: 'connection-1',
        kind: 'folder',
        provider: 'onedrive',
      }),
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it('registers the Google Drive adapter separately from fake providers', () => {
    expect(googleRegistry.getAdapter('google-drive').capabilities.canListFiles).toBe(true);
  });

  it('registers the Dropbox adapter as a real provider adapter', () => {
    const dropboxRegistry = new ProviderAdapterRegistry([
      new DropboxAdapter({ getDropboxAccessToken: async () => 'test-access-token' } as never),
    ]);

    expect(dropboxRegistry.getAdapter('dropbox').capabilities.canNavigateFolders).toBe(true);
  });

  it('navigates by passing the parent remote identifier to the adapter', async () => {
    const result = await service.listFiles({
      connection: {
        connectionId: 'connection-1',
        userId: 'user-1',
        provider: 'onedrive',
      },
      parentRemoteId: 'onedrive-folder',
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        kind: 'file',
        parentRemoteId: 'onedrive-folder',
      }),
    ]);
  });

  it('fails explicitly when an adapter is not registered', () => {
    const incompleteRegistry = new ProviderAdapterRegistry([new OneDriveAdapter()]);

    expect(() => incompleteRegistry.getAdapter('dropbox')).toThrow(
      ProviderAdapterNotRegisteredError,
    );
  });
});
