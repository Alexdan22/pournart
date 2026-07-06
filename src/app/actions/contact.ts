"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { defaultWhatsAppMessage } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { dispatchEmailEvent } from "@/lib/email";
import type { ActionState } from "@/lib/types";

type ContactActionState = ActionState & {
  redirectTo?: string;
};

const contactUploadPath = "/uploads/contact";
const contactUploadDir = path.join(process.cwd(), "public", "uploads", "contact");
const maxReferenceBytes = 8 * 1024 * 1024;

const contactSchema = z.object({
  name: z.string().min(2, "Enter a name."),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  phone: z.string().min(8, "Enter a phone or WhatsApp number."),
  occasion: z.string().min(2),
  productType: z.string().min(2),
  budget: z.string().min(2),
  details: z.string().min(10, "Share a few details about the custom piece."),
});

function imageExtension(file: File) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  return extensions[file.type] ?? null;
}

function isReferenceFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

async function saveReferenceFile(value: FormDataEntryValue | null) {
  if (!isReferenceFile(value)) {
    return null;
  }

  const extension = imageExtension(value);

  if (!extension) {
    throw new Error("Reference files must be JPG, PNG, GIF, or WebP images.");
  }

  if (value.size > maxReferenceBytes) {
    throw new Error("Reference files must be smaller than 8MB.");
  }

  await mkdir(contactUploadDir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await value.arrayBuffer());

  await writeFile(path.join(contactUploadDir, fileName), bytes);

  return `${contactUploadPath}/${fileName}`;
}

function redirectHref(form: z.infer<typeof contactSchema>, referenceFileUrl: string | null) {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const message = [
    defaultWhatsAppMessage,
    `Name: ${form.name}`,
    `Phone / WhatsApp: ${form.phone}`,
    form.email ? `Email: ${form.email}` : "",
    `Occasion: ${form.occasion}`,
    `Product type: ${form.productType}`,
    `Preferred budget: ${form.budget}`,
    `Personalization details: ${form.details}`,
    referenceFileUrl ? `Reference image: ${referenceFileUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : `mailto:pournart@gmail.com?subject=${encodeURIComponent("Custom Pour n Art order")}&body=${encodeURIComponent(message)}`;
}

export async function createContactEnquiryAction(
  _state: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || "",
    phone: formData.get("phone"),
    occasion: formData.get("occasion"),
    productType: formData.get("productType"),
    budget: formData.get("budget"),
    details: formData.get("details"),
  });

  if (!parsed.success) {
    return {
      message: "Please check the enquiry details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const referenceFileUrl = await saveReferenceFile(formData.get("referenceImage"));
    const enquiry = await prisma.contactEnquiry.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone,
        occasion: parsed.data.occasion,
        productType: parsed.data.productType,
        budget: parsed.data.budget,
        message: parsed.data.details,
        referenceFileUrl,
      },
    });

    await prisma.notification.create({
      data: {
        type: "CONTACT_ENQUIRY",
        title: `New enquiry: ${enquiry.name}`,
        body: `${enquiry.productType} / ${enquiry.budget}`,
        href: "/admin/contact-enquiries",
        severity: "INFO",
        sourceType: "ContactEnquiry",
        sourceId: enquiry.id,
      },
    });
    await dispatchEmailEvent("CONTACT_RECEIVED", { contactEnquiryId: enquiry.id });

    return {
      ok: true,
      message: "Your custom request was saved.",
      redirectTo: redirectHref(parsed.data, referenceFileUrl),
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Could not save your custom request.",
    };
  }
}
