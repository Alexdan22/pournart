import * as React from "react";
import type { EmailTemplateName, TemplateData } from "@/lib/email/types";
import { getOrderStatusLabel } from "@/lib/constants";
import { Button, DetailGrid, EmailLayout, OrderItems, Paragraph, renderAddress } from "@/lib/email/templates/layout";

function orderRequired(data: TemplateData) {
  if (!data.order) {
    throw new Error("Order template requires order data.");
  }

  return data.order;
}

function Welcome(data: TemplateData) {
  return (
    <EmailLayout title="Welcome to Pour N Art" {...data}>
      <Paragraph>Hi {data.customerName || "there"},</Paragraph>
      <Paragraph>
        Welcome to Pour N Art. Every piece is poured, cured, finished, and packed by hand so your gift feels personal from the first
        conversation to the final reveal.
      </Paragraph>
      <Paragraph>Explore handcrafted resin keepsakes, custom name plates, trays, coasters, and memory-led pieces made around your story.</Paragraph>
      <Button href={`${data.appUrl}/products`}>Shop Now</Button>
    </EmailLayout>
  );
}

function OrderPlaced(data: TemplateData) {
  const order = orderRequired(data);

  return (
    <EmailLayout title="Your custom order is received" {...data}>
      <Paragraph>Hi {order.customer.name || "there"}, your order details are safely with us.</Paragraph>
      <DetailGrid
        rows={[
          { label: "Order number", value: order.orderNumber },
          { label: "Payment status", value: order.paymentStatus },
          { label: "Estimated delivery", value: order.estimatedDelivery },
          { label: "Shipping address", value: renderAddress(order.shippingAddress) },
          { label: "Total", value: order.total },
        ]}
      />
      <OrderItems items={order.items} />
      <Button href={order.orderUrl}>View Order</Button>
    </EmailLayout>
  );
}

function PaymentFailed(data: TemplateData) {
  const order = orderRequired(data);

  return (
    <EmailLayout title="Payment needs another try" {...data}>
      <Paragraph>
        Hi {order.customer.name || "there"}, the payment for {order.orderNumber} did not complete. Your order details are still saved.
      </Paragraph>
      <OrderItems items={order.items} />
      <Button href={order.paymentUrl}>Retry Payment</Button>
      <Paragraph>Need help? Reply to this email and we will help you finish checkout.</Paragraph>
    </EmailLayout>
  );
}

function OrderConfirmed(data: TemplateData) {
  const order = orderRequired(data);

  return (
    <EmailLayout title="Your order is confirmed" {...data}>
      <Paragraph>Payment is confirmed and your custom piece is entering our design and production workflow.</Paragraph>
      <DetailGrid rows={[{ label: "Order number", value: order.orderNumber }, { label: "Journey step", value: order.statusLabel }, { label: "Note", value: order.note }]} />
      <Button href={order.orderUrl}>View Order</Button>
    </EmailLayout>
  );
}

function ProductionStarted(data: TemplateData) {
  const order = orderRequired(data);

  return (
    <EmailLayout title="The handcrafting has begun" {...data}>
      <Paragraph>Our artisans have started shaping your custom piece with the selected details and finish.</Paragraph>
      <DetailGrid rows={[{ label: "Order number", value: order.orderNumber }, { label: "Update", value: order.note || order.statusLabel }]} />
      <Button href={order.orderUrl}>Track Journey</Button>
    </EmailLayout>
  );
}

function ProductionProgress(data: TemplateData) {
  const order = orderRequired(data);
  const stage = data.stage ? getOrderStatusLabel(String(data.stage)) || String(data.stage).split("_").join(" ") : order.statusLabel;

  return (
    <EmailLayout title="A new crafting update" {...data}>
      <Paragraph>Your piece has moved to: <strong>{stage}</strong>.</Paragraph>
      <Paragraph>{data.message || order.note || "We will keep you posted as the piece moves through finishing and packaging."}</Paragraph>
      <Button href={order.orderUrl}>View Order</Button>
    </EmailLayout>
  );
}

function ReadyToShip(data: TemplateData) {
  const order = orderRequired(data);

  return (
    <EmailLayout title="Packed with care" {...data}>
      <Paragraph>Your custom piece has been checked, wrapped, and prepared for dispatch.</Paragraph>
      <DetailGrid rows={[{ label: "Order number", value: order.orderNumber }, { label: "Estimated dispatch", value: order.dispatchEstimate || "Soon" }]} />
      <Button href={order.orderUrl}>View Order</Button>
    </EmailLayout>
  );
}

function OrderShipped(data: TemplateData) {
  const order = orderRequired(data);

  return (
    <EmailLayout title="Your order is on the way" {...data}>
      <Paragraph>Your handcrafted piece has left our studio.</Paragraph>
      <DetailGrid
        rows={[
          { label: "Courier", value: order.courierName },
          { label: "Tracking number", value: order.courierTrackingId },
          { label: "Estimated delivery", value: order.estimatedDelivery },
        ]}
      />
      <Button href={order.courierTrackingUrl || order.orderUrl}>Track Shipment</Button>
    </EmailLayout>
  );
}

function OrderDelivered(data: TemplateData) {
  const order = orderRequired(data);

  return (
    <EmailLayout title="Delivered with love" {...data}>
      <Paragraph>Your Pour N Art piece has been delivered. Thank you for trusting us with a gift made around a memory.</Paragraph>
      <Paragraph>Care tip: keep resin art away from harsh sunlight, wipe gently with a soft dry cloth, and avoid abrasive cleaners.</Paragraph>
      <Button href={order.orderUrl}>View Order</Button>
    </EmailLayout>
  );
}

function ReviewRequest(data: TemplateData) {
  const order = orderRequired(data);

  return (
    <EmailLayout title="How did your piece feel?" {...data}>
      <Paragraph>We would love to hear how your handcrafted order turned out and see a photo in its new home.</Paragraph>
      <Button href={`${data.appUrl}/orders/${order.orderNumber}`}>Leave Review</Button>
      <Paragraph>
        You can also tag us on Instagram or share a Google review when those public links are connected.
      </Paragraph>
    </EmailLayout>
  );
}

function ContactConfirmation(data: TemplateData) {
  return (
    <EmailLayout title="We received your message" {...data}>
      <Paragraph>Hi {data.contact?.name || "there"}, thank you for writing to Pour N Art.</Paragraph>
      <Paragraph>We will review your custom request and reply with the next steps soon.</Paragraph>
    </EmailLayout>
  );
}

function ContactNotification(data: TemplateData) {
  return (
    <EmailLayout title="New contact form enquiry" {...data}>
      <DetailGrid
        rows={[
          { label: "Name", value: data.contact?.name },
          { label: "Email", value: data.contact?.email },
          { label: "Phone", value: data.contact?.phone },
          { label: "Message", value: data.contact?.message },
        ]}
      />
    </EmailLayout>
  );
}

function LowInventory(data: TemplateData) {
  return (
    <EmailLayout title="Inventory needs attention" {...data}>
      <Paragraph>{data.product?.name} has {data.product?.inventory ?? 0} pieces left.</Paragraph>
      <Button href={`${data.appUrl}/admin`}>Open Admin</Button>
    </EmailLayout>
  );
}

function AdminNotification(data: TemplateData) {
  return (
    <EmailLayout title={data.adminTitle || "Store notification"} {...data}>
      {(data.adminLines || [data.message || "A store event needs attention."]).map((line) => (
        <Paragraph key={line}>{line}</Paragraph>
      ))}
      <Button href={`${data.appUrl}/admin`}>Open Admin</Button>
    </EmailLayout>
  );
}

function CustomerMessage(data: TemplateData) {
  return (
    <EmailLayout title={data.adminTitle || "A note from Pour N Art"} {...data}>
      <Paragraph>Hi {data.order?.customer.name || data.customerName || "there"},</Paragraph>
      <Paragraph>{data.message || "The Pour N Art studio has shared an update."}</Paragraph>
      {data.order ? <Button href={data.order.orderUrl}>View Order</Button> : null}
    </EmailLayout>
  );
}

function AbandonedCart(data: TemplateData) {
  return (
    <EmailLayout title="Your handcrafted picks are waiting" {...data}>
      <Paragraph>Your cart still has pieces selected for a custom gift.</Paragraph>
      {data.cartItems ? <OrderItems items={data.cartItems} /> : null}
      <Button href={`${data.appUrl}/cart`}>Return to Cart</Button>
    </EmailLayout>
  );
}

const templates: Record<EmailTemplateName, (data: TemplateData) => React.ReactElement> = {
  Welcome,
  OrderPlaced,
  PaymentFailed,
  OrderConfirmed,
  ProductionStarted,
  ProductionProgress,
  ReadyToShip,
  OrderShipped,
  OrderDelivered,
  ReviewRequest,
  ContactConfirmation,
  ContactNotification,
  LowInventory,
  AdminNotification,
  CustomerMessage,
  AbandonedCart,
};

export async function renderEmailTemplate(template: EmailTemplateName, data: TemplateData) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const html = `<!doctype html>${renderToStaticMarkup(templates[template](data))}`;
  const text = [
    data.preheader,
    data.message,
    data.order ? `Order ${data.order.orderNumber}: ${data.order.statusLabel} - ${data.order.total}` : "",
    data.adminLines?.join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  return { html, text: text || "Pour N Art notification" };
}
