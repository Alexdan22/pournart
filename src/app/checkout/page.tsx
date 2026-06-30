import { CheckoutClient } from "@/components/checkout-client";
import { requireUser } from "@/lib/session";

export default async function CheckoutPage() {
  const session = await requireUser();

  return <CheckoutClient userName={session.name} />;
}
