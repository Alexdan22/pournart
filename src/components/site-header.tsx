import Link from "next/link";
import Image from "next/image";
import { Heart, KeyRound, Menu, UserRound, X } from "lucide-react";
import { CartLink } from "@/components/cart-link";
import { getSession } from "@/lib/session";

export async function SiteHeader() {
  const session = await getSession();
  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Shop" },
    { href: "/contact", label: "Custom Gifts", featured: true },
    { href: "/cart", label: "Cart" },
    { href: "/orders", label: "Track Order" },
    { href: "/account", label: "Account" },
    ...(session?.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="site-header">
      <details className="mobile-nav-menu">
        <summary className="mobile-nav-toggle" aria-label="Toggle navigation">
          <Menu className="mobile-nav-open-icon" aria-hidden size={20} />
          <X className="mobile-nav-close-icon" aria-hidden size={20} />
        </summary>
        <nav className="mobile-nav-panel" aria-label="Mobile navigation">
          {navLinks.map((link) => (
            <Link className={link.featured ? "nav-featured" : undefined} href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </details>

      <Link className="brand-mark" href="/" aria-label="Pour n Art home">
        <span className="brand-emblem">
          <Image src="/assets/brand/pour-n-art-resin-art-logo.jpg" alt="" width={76} height={76} priority />
        </span>
        <span>
          <strong className="brand-name">
            Pour <em>n</em> Art
          </strong>
          <small>Handcrafted custom gifts</small>
        </span>
      </Link>

      <nav className="site-nav" aria-label="Primary navigation">
        {navLinks.map((link) => (
          <Link className={link.featured ? "nav-featured" : undefined} href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="header-actions">
        <Link className="icon-link mobile-wishlist-link" href="/wishlist" aria-label="Wishlist">
          <Heart aria-hidden size={20} />
        </Link>
        <CartLink />
        {session ? (
          <Link className="icon-link account-icon-link" href="/account" aria-label="Account">
            <UserRound aria-hidden size={20} />
          </Link>
        ) : (
          <Link className="icon-link login-icon-link account-icon-link" href="/login" aria-label="Login">
            <KeyRound aria-hidden size={19} />
          </Link>
        )}
      </div>
    </header>
  );
}
