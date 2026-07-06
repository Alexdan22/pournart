import { CheckoutClient } from "@/components/checkout-client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function CheckoutPage() {
  const session = await requireUser();
  const [user, savedAddresses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, phone: true },
    }),
    prisma.address.findMany({
      where: { userId: session.id },
      select: {
        id: true,
        label: true,
        line1: true,
        line2: true,
        city: true,
        state: true,
        pincode: true,
        country: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <CheckoutClient
      user={{ name: user?.name ?? session.name, phone: user?.phone ?? "" }}
      savedAddresses={savedAddresses}
    />
  );
}
