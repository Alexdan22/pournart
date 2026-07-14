-- CreateTable
CREATE TABLE "AuroraEvaluationReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "decisionId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuroraEvaluationReview_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "AuroraEvaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuroraReviewEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestKey" TEXT NOT NULL,
    "requestIdentityJson" TEXT NOT NULL,
    "requestIdentityFingerprint" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "previousState" TEXT NOT NULL,
    "newState" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "actorIdAtExecution" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuroraReviewEvent_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "AuroraEvaluationReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuroraReviewEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AuroraEvaluationReview_evaluationId_targetKey_key" ON "AuroraEvaluationReview"("evaluationId", "targetKey");

-- CreateIndex
CREATE INDEX "AuroraEvaluationReview_evaluationId_decisionId_idx" ON "AuroraEvaluationReview"("evaluationId", "decisionId");

-- CreateIndex
CREATE INDEX "AuroraEvaluationReview_state_updatedAt_idx" ON "AuroraEvaluationReview"("state", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuroraReviewEvent_requestKey_key" ON "AuroraReviewEvent"("requestKey");

-- CreateIndex
CREATE INDEX "AuroraReviewEvent_reviewId_createdAt_idx" ON "AuroraReviewEvent"("reviewId", "createdAt");

-- CreateIndex
CREATE INDEX "AuroraReviewEvent_actorId_createdAt_idx" ON "AuroraReviewEvent"("actorId", "createdAt");
