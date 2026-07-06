"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, requireUser } from "@/lib/session";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(24).optional().or(z.literal("")),
});

const addressSchema = z.object({
  addressId: z.string().optional(),
  label: z.string().trim().min(2).max(30),
  line1: z.string().trim().min(5).max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().min(4).max(12),
  country: z.string().trim().min(2).max(80),
  isDefault: z.boolean(),
});

function revalidateAccount() {
  revalidatePath("/account");
  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
}

async function ensureDefaultAddress(userId: string) {
  const defaultAddress = await prisma.address.findFirst({
    where: { userId, isDefault: true },
    select: { id: true },
  });

  if (defaultAddress) {
    return;
  }

  const fallback = await prisma.address.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (fallback) {
    await prisma.address.update({ where: { id: fallback.id }, data: { isDefault: true } });
  }
}

export async function updateProfileAction(formData: FormData) {
  const session = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
  });

  if (!parsed.success) {
    redirect("/account?profile=invalid");
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && existing.id !== session.id) {
    redirect("/account?profile=email-taken");
  }

  const user = await prisma.user.update({
    where: { id: session.id },
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone || null,
    },
  });

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  revalidatePath("/account");
}

export async function saveAddressAction(formData: FormData) {
  const session = await requireUser();
  const parsed = addressSchema.safeParse({
    addressId: String(formData.get("addressId") || "") || undefined,
    label: formData.get("label"),
    line1: formData.get("line1"),
    line2: formData.get("line2") || "",
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
    country: formData.get("country") || "India",
    isDefault: formData.get("isDefault") === "on",
  });

  if (!parsed.success) {
    redirect("/account/addresses?address=invalid");
  }

  const addressCount = await prisma.address.count({ where: { userId: session.id } });
  const shouldDefault = parsed.data.isDefault || addressCount === 0;

  if (parsed.data.addressId) {
    const address = await prisma.address.findFirst({
      where: { id: parsed.data.addressId, userId: session.id },
      select: { id: true },
    });

    if (!address) {
      redirect("/account/addresses");
    }

    await prisma.$transaction([
      ...(shouldDefault
        ? [
            prisma.address.updateMany({
              where: { userId: session.id },
              data: { isDefault: false },
            }),
          ]
        : []),
      prisma.address.update({
        where: { id: address.id },
        data: {
          label: parsed.data.label,
          line1: parsed.data.line1,
          line2: parsed.data.line2 || null,
          city: parsed.data.city,
          state: parsed.data.state,
          pincode: parsed.data.pincode,
          country: parsed.data.country,
          isDefault: shouldDefault,
        },
      }),
    ]);
  } else {
    await prisma.$transaction([
      ...(shouldDefault
        ? [
            prisma.address.updateMany({
              where: { userId: session.id },
              data: { isDefault: false },
            }),
          ]
        : []),
      prisma.address.create({
        data: {
          userId: session.id,
          label: parsed.data.label,
          line1: parsed.data.line1,
          line2: parsed.data.line2 || null,
          city: parsed.data.city,
          state: parsed.data.state,
          pincode: parsed.data.pincode,
          country: parsed.data.country,
          isDefault: shouldDefault,
        },
      }),
    ]);
  }

  await ensureDefaultAddress(session.id);
  revalidateAccount();
}

export async function setDefaultAddressAction(formData: FormData) {
  const session = await requireUser();
  const addressId = String(formData.get("addressId") || "");

  if (!addressId) {
    return;
  }

  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: session.id },
    select: { id: true },
  });

  if (!address) {
    return;
  }

  await prisma.$transaction([
    prisma.address.updateMany({
      where: { userId: session.id },
      data: { isDefault: false },
    }),
    prisma.address.update({
      where: { id: address.id },
      data: { isDefault: true },
    }),
  ]);

  revalidateAccount();
}

export async function deleteAddressAction(formData: FormData) {
  const session = await requireUser();
  const addressId = String(formData.get("addressId") || "");

  if (!addressId) {
    return;
  }

  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: session.id },
  });

  if (!address) {
    return;
  }

  await prisma.address.delete({ where: { id: address.id } });
  await ensureDefaultAddress(session.id);
  revalidateAccount();
}
