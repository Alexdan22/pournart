import "dotenv/config";
import { enqueueEmail, processEmailQueue } from "@/lib/email/queue";
import type { EmailJobInput, EmailOrderSummary, EmailProductSummary } from "@/lib/email/types";

const recipient = process.argv[2] || process.env.EMAIL_ADMIN || "pournart@gmail.com";
const appUrl = (process.env.EMAIL_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const supportEmail = process.env.EMAIL_ADMIN || "pournart@gmail.com";
const instagramUrl = "https://www.instagram.com/pour_n_art/";

const order: EmailOrderSummary = {
  id: "preview",
  orderNumber: "PNA-PREVIEW-1001",
  customer: { email: recipient, name: "Alex" },
  items: [
    {
      name: "Personalized Resin Name Plate",
      quantity: 1,
      unitPrice: "₹1,799",
      lineTotal: "₹1,799",
    },
    {
      name: "Gift Coaster Set",
      quantity: 1,
      unitPrice: "₹700",
      lineTotal: "₹700",
    },
  ],
  subtotal: "₹2,499",
  shippingFee: "₹0",
  discount: "₹0",
  total: "₹2,499",
  paymentStatus: "Paid",
  status: "CRAFTING",
  statusLabel: "Being Handcrafted",
  note: "Your piece is being poured and layered with the selected colors.",
  shippingAddress: {
    name: "Alex",
    phone: "+91 99999 99999",
    line1: "Preview Address",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    country: "India",
  },
  estimatedDelivery: "18 Jul 2026",
  orderUrl: `${appUrl}/orders/PNA-PREVIEW-1001`,
  paymentUrl: `${appUrl}/checkout/payment/PNA-PREVIEW-1001`,
  courierName: "Preview Courier",
  courierTrackingId: "TRK-PREVIEW-1001",
  courierTrackingUrl: "https://example.com/track/PNA-PREVIEW-1001",
  dispatchEstimate: "15 Jul 2026",
};

const product: EmailProductSummary = {
  id: "preview-product",
  name: "Personalized Resin Name Plate",
  slug: "personalized-resin-name-plate",
  imageUrl: `${appUrl}/assets/resin-nameplate.png`,
  inventory: 2,
};

const common = { appUrl, supportEmail, instagramUrl };
const jobs: EmailJobInput[] = [
  {
    event: "USER_CREATED",
    to: recipient,
    subject: "PREVIEW - Welcome to Pour N Art",
    template: "Welcome",
    role: "studio",
    data: { ...common, customerName: "Alex" },
  },
  {
    event: "ORDER_PLACED",
    to: recipient,
    subject: `PREVIEW - Custom gift order received: ${order.orderNumber}`,
    template: "OrderPlaced",
    role: "orders",
    data: { ...common, order },
  },
  {
    event: "PAYMENT_CONFIRMED",
    to: recipient,
    subject: `PREVIEW - Payment confirmed: ${order.orderNumber}`,
    template: "OrderConfirmed",
    role: "orders",
    data: { ...common, order },
  },
  {
    event: "PAYMENT_FAILED",
    to: recipient,
    subject: `PREVIEW - Payment needs another try: ${order.orderNumber}`,
    template: "PaymentFailed",
    role: "orders",
    data: { ...common, order },
  },
  {
    event: "ORDER_SHIPPED",
    to: recipient,
    subject: `PREVIEW - Your order is on the way: ${order.orderNumber}`,
    template: "OrderShipped",
    role: "orders",
    data: { ...common, order },
  },
  {
    event: "ORDER_DELIVERED",
    to: recipient,
    subject: `PREVIEW - Delivered: ${order.orderNumber}`,
    template: "OrderDelivered",
    role: "orders",
    data: { ...common, order },
  },
  {
    event: "LOW_INVENTORY",
    to: recipient,
    subject: `PREVIEW - Low inventory: ${product.name}`,
    template: "LowInventory",
    role: "contact",
    data: { ...common, product },
  },
];

async function main() {
  for (const job of jobs) {
    await enqueueEmail(job);
  }

  await processEmailQueue();
  console.log(`Queued and processed ${jobs.length} preview emails for ${recipient}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
