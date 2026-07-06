export type ResendSendInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string;
};

type ResendSendSuccess = {
  id?: string;
};

type ResendSendError = {
  message?: string;
  name?: string;
};

export async function sendResendEmail(input: ResendSendInput): Promise<ResendSendSuccess> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo,
    }),
  });

  const result = (await response.json().catch(() => ({}))) as ResendSendSuccess | ResendSendError;

  if (!response.ok) {
    throw new Error("message" in result && result.message ? result.message : `Resend API failed with HTTP ${response.status}`);
  }

  return result as ResendSendSuccess;
}
