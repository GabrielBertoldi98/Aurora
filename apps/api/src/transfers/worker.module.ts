import { Module } from '@nestjs/common';

import { TransfersModule } from './transfers.module.js';

@Module({ imports: [TransfersModule] })
export class WorkerModule {}
