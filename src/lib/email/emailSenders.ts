import type { EmailRole } from "@/lib/email/types";

const fallbackSenders: Record<EmailRole, string> = {
  studio: "Pour n Art Studio <studio@pournart.in>",
  orders: "Pour n Art Orders <orders@pournart.in>",
  support: "Pour n Art Support <support@pournart.in>",
  contact: "Pour n Art <contact@pournart.in>",
};

const senderEnv: Record<EmailRole, string | undefined> = {
  studio: process.env.EMAIL_STUDIO,
  orders: process.env.EMAIL_ORDERS,
  support: process.env.EMAIL_SUPPORT,
  contact: process.env.EMAIL_CONTACT,
};

export function getEmailSender(role: EmailRole) {
  return (senderEnv[role] || fallbackSenders[role]).trim();
}

export function getSenderAddress(sender: string) {
  const match = sender.trim().match(/<([^>]+)>/);

  return (match?.[1] || sender).trim();
}

export function getAdminEmail() {
  return (process.env.EMAIL_ADMIN || "pournart@gmail.com").trim();
}
