-- CreateTable
CREATE TABLE "EsimDelivery" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "customerEmail" TEXT,
    "vendorReferenceId" TEXT,
    "payloadEncrypted" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EsimDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAttempt" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsimOrder" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT,
    "vendorReferenceId" TEXT NOT NULL,
    "payloadJson" JSONB,
    "payloadEncrypted" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EsimOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EsimOrder_vendorReferenceId_key" ON "EsimOrder"("vendorReferenceId");

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "EsimDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimOrder" ADD CONSTRAINT "EsimOrder_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "EsimDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
