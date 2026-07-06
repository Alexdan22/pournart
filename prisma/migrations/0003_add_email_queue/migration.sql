-- CreateTable
CREATE TABLE "EmailQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "scheduledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queueId" TEXT,
    "event" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "smtpResponse" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "EmailQueue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EmailQueue_status_scheduledAt_idx" ON "EmailQueue"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "EmailQueue_event_idx" ON "EmailQueue"("event");

-- CreateIndex
CREATE INDEX "EmailQueue_recipient_idx" ON "EmailQueue"("recipient");

-- CreateIndex
CREATE INDEX "EmailLog_queueId_idx" ON "EmailLog"("queueId");

-- CreateIndex
CREATE INDEX "EmailLog_event_idx" ON "EmailLog"("event");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
