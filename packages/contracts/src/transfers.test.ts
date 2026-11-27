import { describe, expect, it } from 'vitest';

import { createTransferSchema, transferStatusSchema, transferSummarySchema } from './transfers.js';

describe('transfer contracts', () => {
  it('accepts a queued transfer between connections', () => {
    expect(
      createTransferSchema.parse({
        sourceConnectionId: 'source-connection',
        sourceRemoteId: 'file-id',
        sourceName: 'report.pdf',
        sourceSizeBytes: 1024,
        destinationConnectionId: 'destination-connection',
        destinationName: 'report.pdf',
      }),
    ).toMatchObject({ sourceName: 'report.pdf', destinationName: 'report.pdf' });
  });

  it('rejects a path supplied as a destination file name', () => {
    expect(() =>
      createTransferSchema.parse({
        sourceConnectionId: 'source-connection',
        sourceRemoteId: 'file-id',
        sourceName: 'report.pdf',
        destinationConnectionId: 'destination-connection',
        destinationName: '../other-account/report.pdf',
      }),
    ).toThrow();
  });

  it('serializes byte counters as strings for JSON responses', () => {
    expect(
      transferSummarySchema.parse({
        id: 'transfer-1',
        sourceConnectionId: 'source-connection',
        sourceRemoteId: 'file-id',
        sourceName: 'report.pdf',
        destinationConnectionId: 'destination-connection',
        destinationName: 'report.pdf',
        status: transferStatusSchema.parse('queued'),
        progressBytes: '0',
        sourceSizeBytes: '1024',
        errorCode: null,
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
      }).progressBytes,
    ).toBe('0');
  });
});
