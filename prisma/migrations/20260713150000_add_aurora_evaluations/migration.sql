-- CreateTable
CREATE TABLE "AuroraEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestKey" TEXT NOT NULL,
    "requestIdentityJson" TEXT NOT NULL,
    "requestIdentityFingerprint" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "requestMode" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "requestedById" TEXT,
    "requestedByIdAtExecution" TEXT NOT NULL,
    "batchRequestKey" TEXT,
    "batchIdentityFingerprint" TEXT,
    "batchItemIndex" INTEGER,
    "batchSize" INTEGER,
    "productId" TEXT,
    "productIdAtExecution" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "bindingId" TEXT NOT NULL,
    "bindingFingerprint" TEXT NOT NULL,
    "bindingManifestFingerprint" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bundleFingerprint" TEXT NOT NULL,
    "bundleSha256" TEXT NOT NULL,
    "sdkVersion" TEXT NOT NULL,
    "runtimeContractsJson" TEXT NOT NULL,
    "productDnaArtifactId" TEXT NOT NULL,
    "productDnaProductId" TEXT NOT NULL,
    "productDnaFingerprint" TEXT,
    "ruleSetArtifactId" TEXT NOT NULL,
    "ruleSetDomainId" TEXT NOT NULL,
    "ruleSetFingerprint" TEXT,
    "applicationContextFingerprint" TEXT NOT NULL,
    "auroraInputFingerprint" TEXT,
    "auroraOutputFingerprint" TEXT,
    "inputSnapshotJson" TEXT NOT NULL,
    "resultJson" TEXT,
    "resultSha256" TEXT,
    "resultBytes" INTEGER,
    "status" TEXT NOT NULL,
    "failureStage" TEXT,
    "issueCodesJson" TEXT NOT NULL DEFAULT '[]',
    "durationMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuroraEvaluation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuroraEvaluation_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AuroraEvaluation_requestKey_key" ON "AuroraEvaluation"("requestKey");

-- CreateIndex
CREATE INDEX "AuroraEvaluation_productId_createdAt_idx" ON "AuroraEvaluation"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "AuroraEvaluation_productIdAtExecution_createdAt_idx" ON "AuroraEvaluation"("productIdAtExecution", "createdAt");

-- CreateIndex
CREATE INDEX "AuroraEvaluation_applicationContextFingerprint_status_createdAt_idx" ON "AuroraEvaluation"("applicationContextFingerprint", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AuroraEvaluation_bindingId_createdAt_idx" ON "AuroraEvaluation"("bindingId", "createdAt");

-- CreateIndex
CREATE INDEX "AuroraEvaluation_batchRequestKey_batchItemIndex_idx" ON "AuroraEvaluation"("batchRequestKey", "batchItemIndex");

-- CreateIndex
CREATE INDEX "AuroraEvaluation_requestedById_createdAt_idx" ON "AuroraEvaluation"("requestedById", "createdAt");
