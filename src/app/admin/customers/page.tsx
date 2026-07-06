import Link from "next/link";
import { Eye, Search } from "lucide-react";
import { pagination, pageCount, type AdminTableSearchParams } from "@/lib/admin-data";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<AdminTableSearchParams>;
}) {
  const params = await searchParams;
  const { page, take, skip } = pagination(params.page);
  const query = params.q?.trim();
  const where = {
    role: { not: "ADMIN" },
    OR: query
      ? [
          { name: { contains: query } },
          { email: { contains: query } },
          { phone: { contains: query } },
        ]
      : undefined,
  };
  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { orders: true, addresses: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);
  const pages = pageCount(total);

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Customers</span>
          <h1>Customer profiles</h1>
        </div>
      </div>
      <form className="admin-filter-bar">
        <label>
          <Search aria-hidden size={16} />
          <input name="q" defaultValue={query} placeholder="Search name, email, phone..." />
        </label>
        <button className="admin-button" type="submit">Search</button>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Lifetime Spend</th><th>Average Order</th><th>Actions</th></tr></thead>
          <tbody>
            {customers.map((customer) => {
              const paidOrders = customer.orders.filter((order) => order.paymentStatus === "PAID");
              const spend = paidOrders.reduce((total, order) => total + order.total, 0);
              const average = paidOrders.length ? spend / paidOrders.length : 0;

              return (
                <tr key={customer.id}>
                  <td><strong>{customer.name}</strong></td>
                  <td>{customer.email}</td>
                  <td>{customer.phone || "Not set"}</td>
                  <td>{customer.orders.length}</td>
                  <td>{formatINR(spend)}</td>
                  <td>{formatINR(average)}</td>
                  <td><Link className="icon-action" href={`/admin/customers/${customer.id}`}><Eye aria-hidden size={15} /></Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="admin-pagination"><span>Page {page} of {pages} / {total} customers</span></div>
    </section>
  );
}
