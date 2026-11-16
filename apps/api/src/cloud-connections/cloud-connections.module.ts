import { Module } from '@nestjs/common';

import { CloudConnectionsService } from './cloud-connections.service.js';
import { TokenEncryptionService } from './token-encryption.service.js';

@Module({
  providers: [CloudConnectionsService, TokenEncryptionService],
  exports: [CloudConnectionsService],
})
export class CloudConnectionsModule {}
