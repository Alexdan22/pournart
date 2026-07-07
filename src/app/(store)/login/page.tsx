import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Login",
  description: "Login to your Pour n Art account.",
  path: "/login",
  noIndex: true,
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <section className="auth-page auth-page-visual">
      <div className="auth-backdrop" aria-hidden>
        <Image src="/assets/optimized/resin-hero-home.webp" alt="" fill sizes="100vw" priority />
      </div>
      <div className="auth-copy">
        <span className="panel-label">Welcome back</span>
        <h1>Login to checkout and track custom orders.</h1>
        <p>Admin users are routed to the dashboard automatically.</p>
      </div>
      <div className="auth-panel">
        <AuthForm mode="login" next={params.next} />
        <p>
          New to Pour n Art? <Link href="/register">Create an account</Link>
        </p>
      </div>
    </section>
  );
}
