import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Search, TicketPercent, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createCouponAction, deleteCouponAction, updateCouponAction } from "@/app/actions/admin";
import { AdminSortLink } from "@/components/admin-sort-link";
import { pagination, pageCount, type AdminTableSearchParams } from "@/lib/admin-data";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";

type CouponSearchParams = AdminTableSearchParams & {
  active?: string;
  type?: string;
};

function sortDirection(value?: string): Prisma.SortOrder {
  return value === "asc" ? "asc" : "desc";
}

function couponSort(sort: string | undefined, direction: Prisma.SortOrder): Prisma.CouponOrderByWithRelationInput[] {
  if (sort === "code") {
    return [{ code: direction }];
  }

  if (sort === "type") {
    return [{ type: direction }, { updatedAt: "desc" }];
  }

  if (sort === "value") {
    return [{ value: direction }, { updatedAt: "desc" }];
  }

  if (sort === "minimum") {
    return [{ minSubtotal: direction }, { updatedAt: "desc" }];
  }

  if (sort === "usage") {
    return [{ usageLimit: direction }, { updatedAt: "desc" }];
  }

  if (sort === "active") {
    return [{ isActive: direction }, { updatedAt: "desc" }];
  }

  if (sort === "starts") {
    return [{ startsAt: direction }, { updatedAt: "desc" }];
  }

  if (sort === "ends") {
    return [{ endsAt: direction }, { updatedAt: "desc" }];
  }

  return [{ updatedAt: direction }];
}

function hrefWith(params: CouponSearchParams, overrides: Record<string, string | number>) {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      next.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    next.set(key, String(value));
  }

  return `/admin/coupons?${next.toString()}`;
}

function rupees(amount: number) {
  return amount / 100;
}

function couponValueInput(type: string, value: number) {
  return type === "FIXED" ? rupees(value) : value;
}

function couponValueLabel(type: string, value: number) {
  return type === "FIXED" ? formatINR(value) : `${value}%`;
}

function dateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<CouponSearchParams>;
}) {
  const params = await searchParams;
  const { page, take, skip } = pagination(params.page);
  const query = params.q?.trim();
  const direction = sortDirection(params.direction);
  const where: Prisma.CouponWhereInput = {
    type: params.type || undefined,
    isActive: params.active === "true" ? true : params.active === "false" ? false : undefined,
    OR: query
      ? [
          { code: { contains: query } },
          { description: { contains: query } },
        ]
      : undefined,
  };
  const [coupons, total, activeCount] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: couponSort(params.sort, direction),
      skip,
      take,
    }),
    prisma.coupon.count({ where }),
    prisma.coupon.count({ where: { isActive: true } }),
  ]);
  const pages = pageCount(total);

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Coupons</span>
          <h1>Discount operations</h1>
        </div>
      </div>

      <div className="admin-stat-row">
        <span><strong>{activeCount}</strong>Active coupons</span>
        <span><strong>{total}</strong>Coupons in this view</span>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Create Coupon</h2>
        </div>
        <form className="admin-form compact coupon-create-form" action={createCouponAction}>
          <label>
            <span>Code</span>
            <input name="code" placeholder="WELCOME10" required />
          </label>
          <label>
            <span>Description</span>
            <input name="description" placeholder="First order welcome offer" />
          </label>
          <label>
            <span>Type</span>
            <select name="type" defaultValue="PERCENT">
              <option value="PERCENT">Percent</option>
              <option value="FIXED">Fixed amount</option>
            </select>
          </label>
          <label>
            <span>Value</span>
            <input name="value" type="number" min="0" step="0.01" required />
          </label>
          <label>
            <span>Minimum subtotal</span>
            <input name="minSubtotal" type="number" min="0" step="0.01" defaultValue={0} />
          </label>
          <label>
            <span>Usage limit</span>
            <input name="usageLimit" type="number" min="0" />
          </label>
          <label>
            <span>Starts</span>
            <input name="startsAt" type="date" />
          </label>
          <label>
            <span>Ends</span>
            <input name="endsAt" type="date" />
          </label>
          <label className="admin-checkbox-label">
            <input name="isActive" type="checkbox" defaultChecked />
            <span>Active</span>
          </label>
          <button className="admin-button primary" type="submit">
            <TicketPercent aria-hidden size={15} /> Create Coupon
          </button>
        </form>
      </section>

      <form className="admin-filter-bar">
        <label>
          <Search aria-hidden size={16} />
          <input name="q" defaultValue={query} placeholder="Search code or description..." />
        </label>
        <select name="type" defaultValue={params.type || ""}>
          <option value="">All types</option>
          <option value="PERCENT">Percent</option>
          <option value="FIXED">Fixed</option>
        </select>
        <select name="active" defaultValue={params.active || ""}>
          <option value="">All states</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button className="admin-button" type="submit">Filter</button>
        <Link className="admin-button ghost" href="/admin/coupons">Clear</Link>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table coupon-admin-table">
          <thead>
            <tr>
              <th><AdminSortLink basePath="/admin/coupons" label="Code" searchParams={params} sortKey="code" defaultSort="updated" /></th>
              <th>Description</th>
              <th><AdminSortLink basePath="/admin/coupons" label="Type" searchParams={params} sortKey="type" defaultSort="updated" /></th>
              <th><AdminSortLink basePath="/admin/coupons" label="Value" searchParams={params} sortKey="value" defaultSort="updated" /></th>
              <th><AdminSortLink basePath="/admin/coupons" label="Minimum" searchParams={params} sortKey="minimum" defaultSort="updated" /></th>
              <th><AdminSortLink basePath="/admin/coupons" label="Usage" searchParams={params} sortKey="usage" defaultSort="updated" /></th>
              <th><AdminSortLink basePath="/admin/coupons" label="Active" searchParams={params} sortKey="active" defaultSort="updated" /></th>
              <th><AdminSortLink basePath="/admin/coupons" label="Starts" searchParams={params} sortKey="starts" defaultSort="updated" /></th>
              <th><AdminSortLink basePath="/admin/coupons" label="Ends" searchParams={params} sortKey="ends" defaultSort="updated" /></th>
              <th><AdminSortLink basePath="/admin/coupons" label="Updated" searchParams={params} sortKey="updated" defaultSort="updated" /></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => (
              <tr key={coupon.id}>
                <td>
                  <form id={`coupon-${coupon.id}`} action={updateCouponAction}>
                    <input type="hidden" name="id" value={coupon.id} />
                    <input name="code" defaultValue={coupon.code} aria-label="Coupon code" />
                  </form>
                </td>
                <td><input form={`coupon-${coupon.id}`} name="description" defaultValue={coupon.description} aria-label="Description" /></td>
                <td>
                  <select form={`coupon-${coupon.id}`} name="type" defaultValue={coupon.type} aria-label="Type">
                    <option value="PERCENT">Percent</option>
                    <option value="FIXED">Fixed</option>
                  </select>
                </td>
                <td>
                  <input form={`coupon-${coupon.id}`} name="value" type="number" min="0" step="0.01" defaultValue={couponValueInput(coupon.type, coupon.value)} aria-label="Value" />
                  <small>{couponValueLabel(coupon.type, coupon.value)}</small>
                </td>
                <td><input form={`coupon-${coupon.id}`} name="minSubtotal" type="number" min="0" step="0.01" defaultValue={rupees(coupon.minSubtotal)} aria-label="Minimum subtotal" /></td>
                <td><input form={`coupon-${coupon.id}`} name="usageLimit" type="number" min="0" defaultValue={coupon.usageLimit ?? ""} aria-label="Usage limit" /></td>
                <td>
                  <label className="admin-checkbox-label compact">
                    <input form={`coupon-${coupon.id}`} name="isActive" type="checkbox" defaultChecked={coupon.isActive} />
                    <span>{coupon.isActive ? "Active" : "Inactive"}</span>
                  </label>
                </td>
                <td><input form={`coupon-${coupon.id}`} name="startsAt" type="date" defaultValue={dateInput(coupon.startsAt)} aria-label="Starts at" /></td>
                <td><input form={`coupon-${coupon.id}`} name="endsAt" type="date" defaultValue={dateInput(coupon.endsAt)} aria-label="Ends at" /></td>
                <td>{coupon.updatedAt.toLocaleDateString("en-IN")}</td>
                <td>
                  <button className="icon-action" form={`coupon-${coupon.id}`} type="submit" aria-label={`Save ${coupon.code}`}>
                    <Check aria-hidden size={15} />
                  </button>
                  <form action={deleteCouponAction}>
                    <input type="hidden" name="id" value={coupon.id} />
                    <button className="icon-action danger" type="submit" aria-label={`Delete ${coupon.code}`}>
                      <Trash2 aria-hidden size={15} />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length === 0 ? <p className="admin-empty">No coupons match this view.</p> : null}
      </div>

      <div className="admin-pagination">
        <Link className={page <= 1 ? "disabled" : ""} href={hrefWith(params, { page: Math.max(1, page - 1) })}>
          <ArrowLeft aria-hidden size={15} /> Previous
        </Link>
        <span>Page {page} of {pages} / {total} coupons</span>
        <Link className={page >= pages ? "disabled" : ""} href={hrefWith(params, { page: Math.min(pages, page + 1) })}>
          Next <ArrowRight aria-hidden size={15} />
        </Link>
      </div>
    </section>
  );
}
