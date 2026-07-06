import Link from "next/link";
import { Search } from "lucide-react";
import { updateContactEnquiryAction } from "@/app/actions/admin";
import { pagination, pageCount, type AdminTableSearchParams } from "@/lib/admin-data";
import { prisma } from "@/lib/db";

export default async function AdminContactEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<AdminTableSearchParams>;
}) {
  const params = await searchParams;
  const { page, take, skip } = pagination(params.page);
  const query = params.q?.trim();
  const where = {
    status: params.status || undefined,
    OR: query
      ? [
          { name: { contains: query } },
          { email: { contains: query } },
          { phone: { contains: query } },
          { productType: { contains: query } },
          { message: { contains: query } },
        ]
      : undefined,
  };
  const [enquiries, total] = await Promise.all([
    prisma.contactEnquiry.findMany({
      where,
      include: { internalNotes: { include: { author: true }, orderBy: { createdAt: "desc" } }, emailQueue: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.contactEnquiry.count({ where }),
  ]);
  const pages = pageCount(total);

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Enquiries</span>
          <h1>Custom order enquiries</h1>
        </div>
      </div>
      <form className="admin-filter-bar">
        <label><Search aria-hidden size={16} /><input name="q" defaultValue={query} placeholder="Name, phone, product, message..." /></label>
        <select name="status" defaultValue={params.status || ""}>
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="QUOTED">Quoted</option>
          <option value="CONVERTED">Converted</option>
          <option value="CLOSED">Closed</option>
        </select>
        <button className="admin-button" type="submit">Filter</button>
      </form>
      <div className="enquiry-list">
        {enquiries.map((enquiry) => (
          <article className="admin-panel" key={enquiry.id}>
            <div className="admin-panel-heading">
              <h2>{enquiry.name}</h2>
              <span className="status-pill">{enquiry.status}</span>
            </div>
            <dl className="admin-definition-list">
              <dt>Phone</dt><dd>{enquiry.phone}</dd>
              <dt>Email</dt><dd>{enquiry.email || "Not provided"}</dd>
              <dt>Occasion</dt><dd>{enquiry.occasion}</dd>
              <dt>Product</dt><dd>{enquiry.productType}</dd>
              <dt>Budget</dt><dd>{enquiry.budget}</dd>
              <dt>Reference</dt><dd>{enquiry.referenceFileUrl ? <Link href={enquiry.referenceFileUrl}>Open file</Link> : "None"}</dd>
            </dl>
            <p>{enquiry.message}</p>
            <form className="admin-form compact" action={updateContactEnquiryAction}>
              <input type="hidden" name="id" value={enquiry.id} />
              <label>
                <span>Status</span>
                <select name="status" defaultValue={enquiry.status}>
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="QUOTED">Quoted</option>
                  <option value="CONVERTED">Converted</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </label>
              <label><span>Note</span><textarea name="note" placeholder="Follow-up note" /></label>
              <button className="admin-button primary" type="submit">Update enquiry</button>
            </form>
          </article>
        ))}
      </div>
      <div className="admin-pagination"><span>Page {page} of {pages} / {total} enquiries</span></div>
    </section>
  );
}
