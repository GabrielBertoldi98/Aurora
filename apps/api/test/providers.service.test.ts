import { describe, expect, it } from 'vitest';

import {
  DropboxAdapter,
  GoogleDriveAdapter,
  OneDriveAdapter,
} from '../src/providers/provider-adapters.js';
import {
  ProviderAdapterNotRegisteredError,
  ProviderAdapterRegistry,
} from '../src/providers/provider-adapter-registry.service.js';
import { ProvidersService } from '../src/providers/providers.service.js';

describe('ProvidersService', () => {
  const registry = new ProviderAdapterRegistry([
    new GoogleDriveAdapter(),
    new DropboxAdapter(),
    new OneDriveAdapter(),
  ]);
  const service = new ProvidersService(registry);

  it('selects the correct adapter and returns normalized fake files', async () => {
    const result = await service.listFiles({
      connection: {
        connectionId: 'connection-1',
        userId: 'user-1',
        provider: 'google-drive',
      },
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        connectionId: 'connection-1',
        kind: 'folder',
        provider: 'google-drive',
      }),
    ]);
    expect(result.nextCursor).toBeNull();
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
    const incompleteRegistry = new ProviderAdapterRegistry([new GoogleDriveAdapter()]);

    expect(() => incompleteRegistry.getAdapter('onedrive')).toThrow(
      ProviderAdapterNotRegisteredError,
    );
  });
});
