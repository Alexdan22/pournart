import Link from "next/link";
import Image from "next/image";
import { KeyRound, UserRound } from "lucide-react";
import { CartLink } from "@/components/cart-link";
import { getSession } from "@/lib/session";

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="site-header">
      <Link className="brand-mark" href="/" aria-label="Pour n Art home">
        <span className="brand-emblem">
          <Image src="/assets/brand/pour-n-art-logo-transparent.png" alt="" width={68} height={76} priority />
        </span>
        <span>
          <strong className="brand-name">
            Pour <em>n</em> Art
          </strong>
          <small>Custom resin art</small>
        </span>
      </Link>

      <nav className="site-nav" aria-label="Primary navigation">
        <Link href="/products">Shop</Link>
        <Link href="/orders">Track</Link>
        <Link href="/account">Account</Link>
        {session?.role === "ADMIN" ? <Link href="/admin">Admin</Link> : null}
      </nav>

      <div className="header-actions">
        <CartLink />
        {session ? (
          <Link className="icon-link" href="/account" aria-label="Account">
            <UserRound aria-hidden size={20} />
          </Link>
        ) : (
          <Link className="icon-link login-icon-link" href="/login" aria-label="Login">
            <KeyRound aria-hidden size={19} />
          </Link>
        )}
      </div>
    </header>
  );
}
