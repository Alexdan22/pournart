"use client";

import Link from "next/link";
import { Gift, Home, LayoutDashboard, Menu, PackageCheck, ShoppingBag, ShoppingCart, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type MobileNavLink = {
  href: string;
  label: string;
  featured?: boolean;
};

const iconByHref = {
  "/": Home,
  "/products": ShoppingBag,
  "/contact": Gift,
  "/cart": ShoppingCart,
  "/orders": PackageCheck,
  "/account": UserRound,
  "/admin": LayoutDashboard,
};

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNavMenu({ links }: { links: MobileNavLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={open ? "mobile-nav-menu is-open" : "mobile-nav-menu"}>
      <button
        aria-controls="mobile-nav-panel"
        aria-expanded={open}
        aria-label={open ? "Close navigation" : "Open navigation"}
        className="mobile-nav-toggle"
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        <Menu className="mobile-nav-open-icon" aria-hidden size={20} />
        <X className="mobile-nav-close-icon" aria-hidden size={20} />
      </button>

      {open ? (
        <button
          aria-label="Close navigation"
          className="mobile-nav-scrim"
          onClick={() => setOpen(false)}
          type="button"
        />
      ) : null}

      <nav className="mobile-nav-panel" hidden={!open} id="mobile-nav-panel" ref={panelRef} aria-label="Mobile navigation">
        {links.map((link) => {
          const Icon = iconByHref[link.href as keyof typeof iconByHref] ?? Home;
          const active = isActive(pathname, link.href);
          const className = [link.featured ? "nav-featured" : "", active ? "is-active" : ""].filter(Boolean).join(" ");

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={className || undefined}
              href={link.href}
              key={link.href}
              onClick={() => setOpen(false)}
            >
              <Icon aria-hidden size={18} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
