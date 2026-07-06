import { emailProvider } from "@/lib/email/providers";
import { renderEmailTemplate } from "@/lib/email/templates";
import type { EmailJobInput, ProviderSendResult } from "@/lib/email/types";

export class EmailService {
  static async sendEmail(input: EmailJobInput & { queueId?: string }): Promise<ProviderSendResult> {
    const rendered = await renderEmailTemplate(input.template, input.data);

    return emailProvider.sendEmail({
      to: input.to,
      subject: input.subject,
      html: rendered.html,
      text: rendered.text,
      role: input.role || "studio",
      replyTo: input.replyTo,
      metadata: {
        event: input.event,
        queueId: input.queueId,
      },
    });
  }
}
