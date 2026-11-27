CREATE TABLE "transfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceConnectionId" TEXT NOT NULL,
    "sourceRemoteId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceMimeType" TEXT,
    "sourceSizeBytes" BIGINT,
    "destinationConnectionId" TEXT NOT NULL,
    "destinationParentRemoteId" TEXT,
    "destinationName" TEXT NOT NULL,
    "conflictStrategy" TEXT NOT NULL DEFAULT 'fail',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progressBytes" BIGINT NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transfer_log" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "attempt" INTEGER,
    "bytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transfer_userId_status_createdAt_idx" ON "transfer"("userId", "status", "createdAt");
CREATE INDEX "transfer_sourceConnectionId_idx" ON "transfer"("sourceConnectionId");
CREATE INDEX "transfer_destinationConnectionId_idx" ON "transfer"("destinationConnectionId");
CREATE INDEX "transfer_log_transferId_createdAt_idx" ON "transfer_log"("transferId", "createdAt");

ALTER TABLE "transfer" ADD CONSTRAINT "transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_sourceConnectionId_fkey" FOREIGN KEY ("sourceConnectionId") REFERENCES "cloud_connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_destinationConnectionId_fkey" FOREIGN KEY ("destinationConnectionId") REFERENCES "cloud_connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfer_log" ADD CONSTRAINT "transfer_log_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
