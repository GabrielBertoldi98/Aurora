import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';

import { prisma } from '../database/prisma.js';
import { ProviderTransferError } from '../providers/file-transfer.js';
import { TRANSFER_QUEUE_NAME, type TransferJobData } from './transfer-queue.service.js';
import { TransferContentService } from './transfer-content.service.js';

function getRedisConnection() {
  const value = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const url = new URL(value);

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use redis or rediss.');
  }

  return { url: url.toString() };
}

@Injectable()
export class TransfersWorkerService implements OnModuleDestroy {
  private worker: Worker<TransferJobData> | undefined;

  constructor(@Inject(TransferContentService) private readonly content: TransferContentService) {}

  start(): void {
    if (this.worker) {
      return;
    }

    this.worker = new Worker<TransferJobData>(
      TRANSFER_QUEUE_NAME,
      async (job) =>
        this.process(job.data.transferId, job.attemptsMade + 1, job.opts.attempts ?? 1),
      { connection: getRedisConnection(), concurrency: 1 },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(transferId: string, attempt: number, maxAttempts: number): Promise<void> {
    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      include: { sourceConnection: true, destinationConnection: true },
    });

    if (!transfer || transfer.status === 'cancelled' || transfer.status === 'succeeded') {
      return;
    }

    await prisma.transfer.update({
      where: { id: transfer.id },
      data: {
        status: 'running',
        startedAt: transfer.startedAt ?? new Date(),
        attemptCount: attempt,
        errorCode: null,
        logs: { create: { event: 'started', attempt } },
      },
    });

    let lastPersistedProgress = 0n;
    try {
      await this.content.transfer(transfer, (progressBytes) => {
        if (progressBytes - lastPersistedProgress < 1_048_576n) {
          return;
        }

        lastPersistedProgress = progressBytes;
        void prisma.transfer.update({
          where: { id: transfer.id },
          data: { progressBytes },
        });
      });

      await prisma.transfer.update({
        where: { id: transfer.id },
        data: {
          status: 'succeeded',
          progressBytes: transfer.sourceSizeBytes ?? lastPersistedProgress,
          completedAt: new Date(),
          errorCode: null,
          logs: { create: { event: 'succeeded', attempt } },
        },
      });
    } catch (error) {
      const providerError = error instanceof ProviderTransferError ? error : undefined;
      const retryable = providerError?.retryable ?? false;
      const errorCode = providerError?.code ?? 'transfer-failed';
      const willRetry = retryable && attempt < maxAttempts;

      await prisma.transfer.update({
        where: { id: transfer.id },
        data: {
          status: willRetry ? 'retrying' : 'failed',
          errorCode,
          logs: { create: { event: willRetry ? 'retrying' : 'failed', attempt } },
        },
      });

      if (willRetry) {
        throw error;
      }
    }
  }
}
