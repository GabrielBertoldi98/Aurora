import type { CreateTransfer, TransferSummary } from '@cloud-hub/contracts';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { CloudConnectionsService } from '../cloud-connections/cloud-connections.service.js';
import { prisma } from '../database/prisma.js';
import { TransferQueueService } from './transfer-queue.service.js';

const SUPPORTED_PROVIDERS = new Set(['google-drive', 'dropbox']);

@Injectable()
export class TransfersService {
  constructor(
    @Inject(CloudConnectionsService) private readonly connections: CloudConnectionsService,
    @Inject(TransferQueueService) private readonly queue: TransferQueueService,
  ) {}

  async create(userId: string, input: CreateTransfer): Promise<TransferSummary> {
    const [source, destination] = await Promise.all([
      this.connections.getConnectionForUser(input.sourceConnectionId, userId),
      this.connections.getConnectionForUser(input.destinationConnectionId, userId),
    ]);

    if (
      !SUPPORTED_PROVIDERS.has(source.provider) ||
      !SUPPORTED_PROVIDERS.has(destination.provider)
    ) {
      throw new BadRequestException('This provider does not support file transfers.');
    }

    const [sourceReady, destinationReady] = await Promise.all([
      this.connections.canTransferContent(source.id, userId),
      this.connections.canTransferContent(destination.id, userId),
    ]);
    if (!sourceReady || !destinationReady) {
      throw new ConflictException('Reconnect both cloud accounts to authorize file transfers.');
    }

    const transfer = await prisma.transfer.create({
      data: {
        userId,
        sourceConnectionId: input.sourceConnectionId,
        sourceRemoteId: input.sourceRemoteId,
        sourceName: input.sourceName,
        sourceMimeType: input.sourceMimeType ?? null,
        sourceSizeBytes:
          input.sourceSizeBytes === null || input.sourceSizeBytes === undefined
            ? null
            : BigInt(input.sourceSizeBytes),
        destinationConnectionId: input.destinationConnectionId,
        destinationParentRemoteId: input.destinationParentRemoteId ?? null,
        destinationName: input.destinationName,
        logs: { create: { event: 'queued' } },
      },
    });

    try {
      await this.queue.enqueue(transfer.id);
    } catch {
      await prisma.transfer.update({
        where: { id: transfer.id },
        data: { status: 'failed', errorCode: 'queue-unavailable' },
      });
      await prisma.transferLog.create({
        data: { transferId: transfer.id, event: 'queue-unavailable' },
      });
      throw new ServiceUnavailableException('Transfers are temporarily unavailable.');
    }

    return this.toSummary(transfer);
  }

  async list(userId: string): Promise<TransferSummary[]> {
    const transfers = await prisma.transfer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return transfers.map((transfer) => this.toSummary(transfer));
  }

  async get(userId: string, transferId: string): Promise<TransferSummary> {
    const transfer = await prisma.transfer.findFirst({ where: { id: transferId, userId } });

    if (!transfer) {
      throw new BadRequestException('Transfer was not found.');
    }

    return this.toSummary(transfer);
  }

  async cancel(userId: string, transferId: string): Promise<TransferSummary> {
    const transfer = await prisma.transfer.findFirst({ where: { id: transferId, userId } });

    if (!transfer) {
      throw new BadRequestException('Transfer was not found.');
    }

    if (transfer.status !== 'queued' && transfer.status !== 'retrying') {
      throw new ConflictException('Only a queued transfer can be cancelled.');
    }

    await this.queue.remove(transfer.id);
    const cancelled = await prisma.transfer.update({
      where: { id: transfer.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        logs: { create: { event: 'cancelled' } },
      },
    });

    return this.toSummary(cancelled);
  }

  private toSummary(transfer: {
    id: string;
    sourceConnectionId: string;
    sourceRemoteId: string;
    sourceName: string;
    destinationConnectionId: string;
    destinationName: string;
    status: string;
    progressBytes: bigint;
    sourceSizeBytes: bigint | null;
    errorCode: string | null;
    queuedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
  }): TransferSummary {
    return {
      id: transfer.id,
      sourceConnectionId: transfer.sourceConnectionId,
      sourceRemoteId: transfer.sourceRemoteId,
      sourceName: transfer.sourceName,
      destinationConnectionId: transfer.destinationConnectionId,
      destinationName: transfer.destinationName,
      status: transfer.status as TransferSummary['status'],
      progressBytes: transfer.progressBytes.toString(),
      sourceSizeBytes: transfer.sourceSizeBytes?.toString() ?? null,
      errorCode: transfer.errorCode,
      queuedAt: transfer.queuedAt,
      startedAt: transfer.startedAt,
      completedAt: transfer.completedAt,
      cancelledAt: transfer.cancelledAt,
    };
  }
}
