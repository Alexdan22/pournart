"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Boxes,
  ChartSpline,
  ChevronLeft,
  ChevronRight,
  FolderTree,
  Inbox,
  LayoutDashboard,
  Mail,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingBag,
  Star,
  Users,
  X,
} from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/admin";
import { adminNavItems } from "@/lib/admin-data";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  severity: string;
};

type SearchResult = {
  type: string;
  title: string;
  subtitle: string;
  href: string;
};

const iconByLabel: Record<string, React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  Dashboard: LayoutDashboard,
  Orders: ShoppingBag,
  Products: Package,
  Categories: FolderTree,
  Customers: Users,
  Inventory: Boxes,
  "Email Queue": Mail,
  Reviews: Star,
  Analytics: ChartSpline,
  Enquiries: Inbox,
  Settings,
};

export function AdminShell({
  children,
  notifications,
  adminName,
}: {
  children: React.ReactNode;
  notifications: NotificationItem[];
  adminName: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const unreadCount = notifications.length;

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`/admin/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { results: [] }))
        .then((data: { results: SearchResult[] }) => {
          setResults(data.results || []);
          setSearchOpen(true);
        })
        .catch(() => undefined);
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  const activeLabel = useMemo(() => {
    const active = [...adminNavItems].reverse().find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    return active?.label || "Dashboard";
  }, [pathname]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const first = results[0];

    if (first) {
      window.location.href = first.href;
    }
  }

  return (
    <div className={`${collapsed ? "admin-shell collapsed" : "admin-shell"} ${mobileNavOpen ? "mobile-nav-open" : ""}`}>
      {mobileNavOpen ? (
        <button
          className="admin-mobile-nav-backdrop"
          type="button"
          aria-label="Close admin navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar-brand">
          <span>PnA</span>
          <strong>Pour n Art</strong>
          <button
            className="admin-mobile-close"
            type="button"
            aria-label="Close admin navigation"
            onClick={() => setMobileNavOpen(false)}
          >
            <X aria-hidden size={17} />
          </button>
        </div>
        <nav>
          {adminNavItems.map((item) => {
            const Icon = iconByLabel[item.label] || LayoutDashboard;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link className={active ? "active" : ""} href={item.href} key={item.href} onClick={() => setMobileNavOpen(false)}>
                <Icon aria-hidden size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <button className="admin-collapse-button" type="button" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <ChevronRight aria-hidden size={16} /> : <ChevronLeft aria-hidden size={16} />}
          <span>{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <button
            className="admin-mobile-menu-button"
            type="button"
            aria-label="Open admin navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu aria-hidden size={18} />
          </button>
          <div>
            <span>Operations</span>
            <strong>{activeLabel}</strong>
          </div>
          <form className="admin-global-search" onSubmit={submitSearch}>
            <Search aria-hidden size={16} />
            <input
              aria-label="Global search"
              value={query}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
              onChange={(event) => {
                setQuery(event.target.value);
                if (event.target.value.trim().length < 2) {
                  setResults([]);
                }
              }}
              onFocus={() => setSearchOpen(results.length > 0)}
              placeholder="Search orders, products, customers, categories..."
            />
            {searchOpen && results.length > 0 ? (
              <div className="admin-search-results">
                {results.map((result) => (
                  <Link href={result.href} key={`${result.type}-${result.href}`}>
                    <small>{result.type}</small>
                    <strong>{result.title}</strong>
                    <span>{result.subtitle}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </form>
          <details className="admin-notification-center">
            <summary>
              <Bell aria-hidden size={17} />
              {unreadCount > 0 ? <span>{unreadCount}</span> : null}
            </summary>
            <div>
              <form action={markAllNotificationsReadAction}>
                <strong>Notifications</strong>
                <button type="submit">Mark all read</button>
              </form>
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <article className={`severity-${notification.severity.toLowerCase()}`} key={notification.id}>
                    <Link href={notification.href || "/admin"}>
                      <strong>{notification.title}</strong>
                      <span>{notification.body}</span>
                    </Link>
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="id" value={notification.id} />
                      <button type="submit">Done</button>
                    </form>
                  </article>
                ))
              ) : (
                <p>No active alerts.</p>
              )}
            </div>
          </details>
          <span className="admin-user-pill">{adminName}</span>
        </header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
