import { Module } from '@nestjs/common';

import { CloudConnectionsModule } from '../cloud-connections/cloud-connections.module.js';
import { DropboxAdapter } from './dropbox.adapter.js';
import { GoogleDriveAdapter } from './google-drive.adapter.js';
import { OneDriveAdapter } from './provider-adapters.js';
import { PROVIDER_ADAPTERS, ProviderAdapterRegistry } from './provider-adapter-registry.service.js';
import { ProvidersService } from './providers.service.js';

@Module({
  imports: [CloudConnectionsModule],
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
