import type { Metadata } from "next";
import { AdminShell } from "@/components/admin-shell";
import { getUnreadNotifications } from "@/lib/admin-data";
import { createMetadata } from "@/lib/seo";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = createMetadata({
  title: "Admin",
  description: "Private Pour n Art admin dashboard.",
  path: "/admin",
  noIndex: true,
});

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await requireAdmin();
  const notifications = await getUnreadNotifications();

  return (
    <AdminShell
      adminName={admin.name}
      notifications={notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        href: notification.href,
        severity: notification.severity,
      }))}
    >
      {children}
    </AdminShell>
  );
}
