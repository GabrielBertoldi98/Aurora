-- CreateTable
CREATE TABLE "cloud_connection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "accountEmail" TEXT,
    "accountName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cloud_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_credential" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cloud_credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "encryptedCodeVerifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cloud_connection_userId_provider_idx" ON "cloud_connection"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "cloud_connection_userId_provider_externalAccountId_key" ON "cloud_connection"("userId", "provider", "externalAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "cloud_credential_connectionId_key" ON "cloud_credential"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_transaction_stateHash_key" ON "oauth_transaction"("stateHash");

-- CreateIndex
CREATE INDEX "oauth_transaction_userId_provider_idx" ON "oauth_transaction"("userId", "provider");

-- CreateIndex
CREATE INDEX "oauth_transaction_expiresAt_idx" ON "oauth_transaction"("expiresAt");

-- AddForeignKey
ALTER TABLE "cloud_connection" ADD CONSTRAINT "cloud_connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_credential" ADD CONSTRAINT "cloud_credential_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "cloud_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_transaction" ADD CONSTRAINT "oauth_transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
