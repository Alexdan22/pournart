import Image from "next/image";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <section className="auth-page auth-page-visual">
      <div className="auth-backdrop" aria-hidden>
        <Image src="/assets/resin-coasters-blue.png" alt="" fill sizes="100vw" priority />
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
