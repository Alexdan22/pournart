"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

function safeReturnPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function toggleWishlistAction(formData: FormData) {
  const productId = String(formData.get("productId") || "");
  const returnTo = safeReturnPath(String(formData.get("returnTo") || "/"));

  if (!productId) {
    return;
  }

  const session = await getSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  const existing = await prisma.wishlistItem.findUnique({
    where: {
      userId_productId: {
        userId: session.id,
        productId,
      },
    },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
  } else {
    await prisma.wishlistItem.create({
      data: {
        userId: session.id,
        productId,
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/wishlist");
  revalidatePath(returnTo);
}
