import { Ban, RefreshCw, Search } from "lucide-react";
import { cancelEmailAction, retryEmailAction } from "@/app/actions/admin";
import { pagination, pageCount, type AdminTableSearchParams } from "@/lib/admin-data";
import { prisma } from "@/lib/db";

export default async function AdminEmailQueuePage({
  searchParams,
}: {
  searchParams: Promise<AdminTableSearchParams & { order?: string }>;
}) {
  const params = await searchParams;
  const { page, take, skip } = pagination(params.page);
  const query = params.q?.trim();
  const where = {
    status: params.status || undefined,
    orderId: params.order || undefined,
    OR: query
      ? [
          { recipient: { contains: query } },
          { subject: { contains: query } },
          { event: { contains: query } },
        ]
      : undefined,
  };
  const [items, total, stats] = await Promise.all([
    prisma.emailQueue.findMany({
      where,
      include: { logs: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.emailQueue.count({ where }),
    prisma.emailQueue.groupBy({ by: ["status"], _count: { status: true } }),
  ]);
  const pages = pageCount(total);

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Email Queue</span>
          <h1>Delivery operations</h1>
        </div>
      </div>
      <div className="admin-stat-row">
        {stats.map((stat) => (
          <span key={stat.status}><strong>{stat._count.status}</strong>{stat.status}</span>
        ))}
      </div>
      <form className="admin-filter-bar">
        <label><Search aria-hidden size={16} /><input name="q" defaultValue={query} placeholder="Recipient, subject, event..." /></label>
        <select name="status" defaultValue={params.status || ""}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button className="admin-button" type="submit">Filter</button>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Status</th><th>Retries</th><th>Recipient</th><th>Subject</th><th>Event</th><th>Time</th><th>Payload & Log</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><span className={`status-pill email-${item.status.toLowerCase()}`}>{item.status}</span></td>
                <td>{item.attempts}/{item.maxAttempts}</td>
                <td>{item.recipient}</td>
                <td>{item.subject}</td>
                <td>{item.event}</td>
                <td>{item.createdAt.toLocaleString("en-IN")}</td>
                <td>
                  <details className="admin-inline-details">
                    <summary>View</summary>
                    <pre>{item.payload}</pre>
                    {item.logs.map((log) => (
                      <p key={log.id}>{log.status}: {log.error || log.providerResponse || "ok"}</p>
                    ))}
                  </details>
                </td>
                <td>
                  <form className="table-action-row" action={retryEmailAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <button className="icon-action" type="submit" aria-label="Retry email"><RefreshCw aria-hidden size={15} /></button>
                  </form>
                  <form className="table-action-row" action={cancelEmailAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <button className="icon-action danger" type="submit" aria-label="Cancel email"><Ban aria-hidden size={15} /></button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-pagination"><span>Page {page} of {pages} / {total} email jobs</span></div>
    </section>
  );
}
