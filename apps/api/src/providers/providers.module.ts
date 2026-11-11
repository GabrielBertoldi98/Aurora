import { Module } from '@nestjs/common';

import { DropboxAdapter, GoogleDriveAdapter, OneDriveAdapter } from './provider-adapters.js';
import { PROVIDER_ADAPTERS, ProviderAdapterRegistry } from './provider-adapter-registry.service.js';
import { ProvidersService } from './providers.service.js';

@Module({
  providers: [
    GoogleDriveAdapter,
    DropboxAdapter,
    OneDriveAdapter,
    {
      provide: PROVIDER_ADAPTERS,
      inject: [GoogleDriveAdapter, DropboxAdapter, OneDriveAdapter],
      useFactory: (
        googleDriveAdapter: GoogleDriveAdapter,
        dropboxAdapter: DropboxAdapter,
        oneDriveAdapter: OneDriveAdapter,
      ) => [googleDriveAdapter, dropboxAdapter, oneDriveAdapter],
    },
    ProviderAdapterRegistry,
    ProvidersService,
  ],
  exports: [ProvidersService],
})
export class ProvidersModule {}
