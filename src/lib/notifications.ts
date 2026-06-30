import "server-only";

import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { orderStatusLabel } from "@/lib/constants";

type NotificationKind =
  | "ORDER_PLACED"
  | "PAYMENT_SUCCESS"
  | "STATUS_UPDATED"
  | "ORDER_CANCELLED";

function getTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function subjectFor(kind: NotificationKind, orderNumber: string) {
  const labels: Record<NotificationKind, string> = {
    ORDER_PLACED: "Order placed",
    PAYMENT_SUCCESS: "Payment received",
    STATUS_UPDATED: "Order update",
    ORDER_CANCELLED: "Order cancelled",
  };

  return `${labels[kind]}: ${orderNumber}`;
}

export async function sendOrderNotification(kind: NotificationKind, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      items: true,
      timeline: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!order) {
    return;
  }

  const latest = order.timeline[0];
  const status = orderStatusLabel[order.status as keyof typeof orderStatusLabel] ?? order.status;
  const itemList = order.items
    .map((item) => `${item.quantity} x ${item.productName} (${formatINR(item.unitPrice)})`)
    .join("\n");
  const trackingLine = order.courierTrackingUrl
    ? `\nTracking: ${order.courierTrackingUrl}`
    : "";
  const text = [
    `Order ${order.orderNumber}`,
    `Status: ${status}`,
    `Total: ${formatINR(order.total)}`,
    latest ? `Update: ${latest.note}` : "",
    trackingLine,
    "",
    itemList,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1d2528">
      <h2 style="margin:0 0 12px">Pour n Art order ${order.orderNumber}</h2>
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Total:</strong> ${formatINR(order.total)}</p>
      ${latest ? `<p><strong>Update:</strong> ${latest.note}</p>` : ""}
      ${order.courierTrackingUrl ? `<p><a href="${order.courierTrackingUrl}">Track courier</a></p>` : ""}
      <hr />
      <ul>${order.items
        .map((item) => `<li>${item.quantity} x ${item.productName} (${formatINR(item.unitPrice)})</li>`)
        .join("")}</ul>
    </div>
  `;

  const transport = getTransport();
  const recipients = [order.user.email, process.env.ADMIN_EMAIL].filter(Boolean) as string[];

  if (!transport || recipients.length === 0) {
    console.info("[mail:dry-run]", {
      kind,
      recipients,
      subject: subjectFor(kind, order.orderNumber),
      text,
    });
    return;
  }

  await transport.sendMail({
    from: process.env.MAIL_FROM || "Pour n Art <orders@pournart.local>",
    to: recipients,
    subject: subjectFor(kind, order.orderNumber),
    text,
    html,
  });
}
