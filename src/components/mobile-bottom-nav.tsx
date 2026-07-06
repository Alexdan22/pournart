"use client";

import Link from "next/link";
import { Gift, Home, PackageCheck, ShoppingBag, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/products", label: "Shop", icon: ShoppingBag },
  { href: "/contact", label: "Custom Gifts", icon: Gift },
  { href: "/orders", label: "Orders", icon: PackageCheck },
  { href: "/account", label: "Account", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const isProductDetail = /^\/products\/[^/]+/.test(pathname);

  if (pathname.startsWith("/admin") || isProductDetail) {
    return null;
  }

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? "mobile-bottom-nav-link active" : "mobile-bottom-nav-link"}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden size={20} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
