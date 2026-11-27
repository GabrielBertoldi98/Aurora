import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { TransfersWorkerService } from './transfers.worker.service.js';
import { WorkerModule } from './worker.module.js';

const application = await NestFactory.createApplicationContext(WorkerModule, {
  logger: ['log', 'warn', 'error'],
});
application.get(TransfersWorkerService).start();

const shutdown = async () => {
  await application.close();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
