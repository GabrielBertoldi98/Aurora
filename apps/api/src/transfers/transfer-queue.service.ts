import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

export const TRANSFER_QUEUE_NAME = 'cloud-transfers';

export interface TransferJobData {
  readonly transferId: string;
}

function getRedisConnection() {
  const value = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const url = new URL(value);

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use redis or rediss.');
  }

  return { url: url.toString() };
}

@Injectable()
export class TransferQueueService implements OnModuleDestroy {
  private readonly queue = new Queue<TransferJobData>(TRANSFER_QUEUE_NAME, {
    connection: getRedisConnection(),
  });

  async enqueue(transferId: string): Promise<void> {
    await this.queue.add(
      'transfer-file',
      { transferId },
      {
        jobId: transferId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    );
  }

  async remove(transferId: string): Promise<void> {
    const job = await this.queue.getJob(transferId);

    if (job) {
      await job.remove();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
