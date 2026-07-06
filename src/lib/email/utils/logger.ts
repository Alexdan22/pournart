import { prisma } from "@/lib/db";
import type { EmailEventName } from "@/lib/email/types";

type LogEmailInput = {
  queueId?: string;
  event: EmailEventName;
  recipient: string;
  subject: string;
  status: string;
  providerResponse?: string;
  error?: string;
};

export async function logEmail(input: LogEmailInput) {
  try {
    await prisma.emailLog.create({
      data: {
        queueId: input.queueId,
        event: input.event,
        recipient: input.recipient,
        subject: input.subject,
        status: input.status,
        providerResponse: input.providerResponse,
        error: input.error,
      },
    });
  } catch (error) {
    console.error("[email:log-failed]", error);
  }
}
