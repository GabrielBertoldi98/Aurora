import { Module } from '@nestjs/common';

import { CloudConnectionsModule } from '../cloud-connections/cloud-connections.module.js';
import { DropboxAdapter } from '../providers/dropbox.adapter.js';
import { GoogleDriveAdapter } from '../providers/google-drive.adapter.js';
import { TransferContentService } from './transfer-content.service.js';
import { TransferQueueService } from './transfer-queue.service.js';
import { TransfersController } from './transfers.controller.js';
import { TransfersService } from './transfers.service.js';
import { TransfersWorkerService } from './transfers.worker.service.js';

@Module({
  imports: [CloudConnectionsModule],
  controllers: [TransfersController],
  providers: [
    DropboxAdapter,
    GoogleDriveAdapter,
    TransferContentService,
    TransferQueueService,
    TransfersService,
    TransfersWorkerService,
  ],
  exports: [TransfersWorkerService],
})
export class TransfersModule {}
