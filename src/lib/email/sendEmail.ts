import { getAdminEmail, getEmailSender } from "@/lib/email/emailSenders";
import { sendResendEmail } from "@/lib/email/resend";
import type { EmailRole, ProviderSendInput, ProviderSendResult } from "@/lib/email/types";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  role: EmailRole;
  replyTo?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<ProviderSendResult> {
  const from = getEmailSender(input.role);
  const replyTo = (input.replyTo || getAdminEmail()).trim();
  const to = input.to.trim();

  try {
    const data = await sendResendEmail({
      from,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo,
    });

    console.info("[email:resend-sent]", {
      id: data.id,
      to,
      subject: input.subject,
      role: input.role,
    });

    return {
      messageId: data.id,
      response: data.id ? `Resend id: ${data.id}` : "Resend accepted message",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[email:resend-failed]", {
      to,
      subject: input.subject,
      role: input.role,
      message,
    });
    throw error;
  }
}

export async function sendAdminEmail(input: Omit<SendEmailInput, "to">) {
  return sendEmail({
    ...input,
    to: getAdminEmail(),
  });
}

export async function sendProviderEmail(input: ProviderSendInput) {
  return sendEmail(input);
}
