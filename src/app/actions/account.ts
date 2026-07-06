"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

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
  revalidatePath("/account");
  revalidatePath("/checkout");
}
