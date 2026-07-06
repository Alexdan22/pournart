ALTER TABLE "Address" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Address_userId_isDefault_idx" ON "Address"("userId", "isDefault");
