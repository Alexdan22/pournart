import { prisma } from "@/lib/db";
import type { EmailEventName } from "@/lib/email/types";

type LogEmailInput = {
  queueId?: string;
  orderId?: string;
  userId?: string;
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
        orderId: input.orderId,
        userId: input.userId,
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
