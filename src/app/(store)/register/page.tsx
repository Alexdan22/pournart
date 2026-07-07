import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Create Account",
  description: "Create a Pour n Art account for checkout and order tracking.",
  path: "/register",
  noIndex: true,
});

export default function RegisterPage() {
  return (
    <section className="auth-page auth-page-visual">
      <div className="auth-backdrop" aria-hidden>
        <Image src="/assets/optimized/resin-coasters-blue-home.webp" alt="" fill sizes="100vw" priority />
      </div>
      <div className="auth-copy">
        <span className="panel-label">Customer account</span>
        <h1>Create an account before placing handmade orders.</h1>
        <p>Checkout requires login so every custom note, payment, and delivery update stays trackable.</p>
      </div>
      <div className="auth-panel">
        <AuthForm mode="register" />
        <p>
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </div>
    </section>
  );
}
