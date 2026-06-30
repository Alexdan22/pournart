import "server-only";

import crypto from "node:crypto";
import Razorpay from "razorpay";

export function isRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getPublicRazorpayKey() {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
}

export function getRazorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

export function verifyCheckoutSignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signature);

  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret || !signature) {
    return false;
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signature);

  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
