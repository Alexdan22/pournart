import { prisma } from "@/lib/db";
import { EmailService } from "@/lib/email/services/email.service";
import { logEmail } from "@/lib/email/utils/logger";
import type { EmailJobInput } from "@/lib/email/types";

const maxBatchSize = 10;
const retryDelayMs = 1000 * 60 * 5;
const sendThrottleMs = 650;

const globalForEmailQueue = globalThis as unknown as {
  pourNArtEmailQueueProcessing?: boolean;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }

  return String(error);
}

export async function enqueueEmail(input: EmailJobInput) {
  const queueItem = await prisma.emailQueue.create({
    data: {
      event: input.event,
      recipient: input.to.trim(),
      subject: input.subject,
      template: input.template,
      payload: JSON.stringify({
        data: input.data,
        role: input.role,
        replyTo: input.replyTo,
      }),
      scheduledAt: input.scheduledAt || new Date(),
    },
  });

  void processEmailQueue().catch((error) => {
    console.error("[email:queue-background-failed]", error);
  });

  return queueItem;
}

export async function processEmailQueue() {
  if (globalForEmailQueue.pourNArtEmailQueueProcessing) {
    return;
  }

  globalForEmailQueue.pourNArtEmailQueueProcessing = true;

  try {
    while (true) {
      const jobs = await prisma.emailQueue.findMany({
        where: {
          status: { in: ["PENDING", "FAILED"] },
          scheduledAt: { lte: new Date() },
          attempts: { lt: 3 },
        },
        orderBy: { scheduledAt: "asc" },
        take: maxBatchSize,
      });

      if (jobs.length === 0) {
        break;
      }

      for (const job of jobs) {
        await prisma.emailQueue.update({
          where: { id: job.id },
          data: {
            status: "PROCESSING",
            attempts: { increment: 1 },
          },
        });

        try {
          const payload = parsePayload(job.payload);
          const result = await EmailService.sendEmail({
            to: job.recipient,
            subject: job.subject,
            template: job.template as EmailJobInput["template"],
            data: payload.data,
            event: job.event as EmailJobInput["event"],
            queueId: job.id,
            role: payload.role,
            replyTo: payload.replyTo,
          });

          await prisma.emailQueue.update({
            where: { id: job.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
              lastError: null,
            },
          });
          await logEmail({
            queueId: job.id,
            event: job.event as EmailJobInput["event"],
            recipient: job.recipient.trim(),
            subject: job.subject,
            status: "SENT",
            providerResponse: result.response || result.messageId,
          });
        } catch (error) {
          const errorText = serializeError(error);
          const attempts = job.attempts + 1;
          const permanentlyFailed = attempts >= job.maxAttempts;

          await prisma.emailQueue.update({
            where: { id: job.id },
            data: {
              status: permanentlyFailed ? "FAILED" : "PENDING",
              lastError: errorText,
              scheduledAt: permanentlyFailed ? job.scheduledAt : new Date(Date.now() + retryDelayMs),
            },
          });
          await logEmail({
            queueId: job.id,
            event: job.event as EmailJobInput["event"],
            recipient: job.recipient.trim(),
            subject: job.subject,
            status: permanentlyFailed ? "FAILED" : "RETRY_SCHEDULED",
            error: errorText,
          });
          await enqueueInternalFailure(job.event, job.recipient, job.subject, errorText);
        }

        await wait(sendThrottleMs);
      }
    }
  } finally {
    globalForEmailQueue.pourNArtEmailQueueProcessing = false;
  }
}

function parsePayload(payload: string): Pick<EmailJobInput, "data" | "role" | "replyTo"> {
  const parsed = JSON.parse(payload) as EmailJobInput["data"] | Pick<EmailJobInput, "data" | "role" | "replyTo">;

  if ("data" in parsed) {
    return {
      data: parsed.data,
      role: parsed.role,
      replyTo: parsed.replyTo,
    };
  }

  return {
    data: parsed,
  };
}

async function enqueueInternalFailure(event: string, recipient: string, subject: string, error: string) {
  const adminEmail = process.env.EMAIL_ADMIN?.trim();

  if (!adminEmail || event === "EMAIL_PROVIDER_FAILURE" || event === "INTERNAL_EMAIL_FAILURE") {
    return;
  }

  await prisma.emailQueue.create({
    data: {
      event: "INTERNAL_EMAIL_FAILURE",
      recipient: adminEmail,
      subject: "Pour N Art email delivery failed",
      template: "AdminNotification",
      payload: JSON.stringify({
        role: "contact",
        data: {
          appUrl: process.env.EMAIL_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          supportEmail: process.env.EMAIL_ADMIN?.trim() || "pournart@gmail.com",
          instagramUrl: "https://www.instagram.com/pour_n_art/",
          adminTitle: "Email delivery failed",
          adminLines: [
            `Event: ${event}`,
            `Recipient: ${recipient}`,
            `Subject: ${subject}`,
            `Error: ${error.slice(0, 600)}`,
          ],
        },
      }),
    },
  });
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
