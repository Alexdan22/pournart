-- Add Shiprocket fulfillment metadata without replacing legacy courier fields.
ALTER TABLE "Order" ADD COLUMN "shippingCharge" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "shiprocketOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN "shiprocketShipmentId" TEXT;
ALTER TABLE "Order" ADD COLUMN "awbCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "courierCompanyId" INTEGER;
ALTER TABLE "Order" ADD COLUMN "pickupPincode" TEXT;
ALTER TABLE "Order" ADD COLUMN "estimatedDelivery" DATETIME;
ALTER TABLE "Order" ADD COLUMN "shipmentStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN "trackingUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "trackingEvents" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Order" ADD COLUMN "pickupGenerated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "shipmentError" TEXT;

UPDATE "Order"
SET "shippingCharge" = "shippingFee"
WHERE "shippingCharge" = 0;

CREATE INDEX "Order_shiprocketShipmentId_idx" ON "Order"("shiprocketShipmentId");
CREATE INDEX "Order_awbCode_idx" ON "Order"("awbCode");
CREATE INDEX "Order_shipmentStatus_idx" ON "Order"("shipmentStatus");
