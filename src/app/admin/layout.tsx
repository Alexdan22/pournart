import { AdminShell } from "@/components/admin-shell";
import { getUnreadNotifications } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/session";

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
