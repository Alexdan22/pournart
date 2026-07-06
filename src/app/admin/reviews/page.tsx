import { Search, Star } from "lucide-react";
import { updateReviewAction } from "@/app/actions/admin";
import { pagination, pageCount, type AdminTableSearchParams } from "@/lib/admin-data";
import { prisma } from "@/lib/db";

export default async function AdminReviewsPage({
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
          { body: { contains: query } },
          { title: { contains: query } },
          { product: { name: { contains: query } } },
          { user: { name: { contains: query } } },
        ]
      : undefined,
  };
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { product: true, user: true, order: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.review.count({ where }),
  ]);
  const pages = pageCount(total);

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Reviews</span>
          <h1>Moderation</h1>
        </div>
      </div>
      <form className="admin-filter-bar">
        <label><Search aria-hidden size={16} /><input name="q" defaultValue={query} placeholder="Review, product, customer..." /></label>
        <select name="status" defaultValue={params.status || ""}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button className="admin-button" type="submit">Filter</button>
      </form>
      <div className="review-moderation-list">
        {reviews.map((review) => (
          <article className="admin-panel" key={review.id}>
            <div className="admin-panel-heading">
              <h2>{review.product.name}</h2>
              <span className="status-pill">{review.status}</span>
            </div>
            <p className="review-stars">{Array.from({ length: review.rating }).map((_, index) => <Star fill="currentColor" size={14} key={index} />)}</p>
            <h3>{review.title || "Untitled review"}</h3>
            <p>{review.body}</p>
            <small>{review.user.name} / {review.order?.orderNumber || "No order"} / {review.createdAt.toLocaleString("en-IN")}</small>
            <form className="admin-form compact" action={updateReviewAction}>
              <input type="hidden" name="id" value={review.id} />
              <div className="admin-form-grid">
                <label>
                  <span>Status</span>
                  <select name="status" defaultValue={review.status}>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approve</option>
                    <option value="REJECTED">Reject</option>
                  </select>
                </label>
                <label className="check-row"><input type="checkbox" name="isFeatured" defaultChecked={review.isFeatured} /><span>Feature</span></label>
                <label className="span-2"><span>Reply</span><textarea name="reply" defaultValue={review.reply || ""} /></label>
              </div>
              <button className="admin-button primary" type="submit">Save moderation</button>
            </form>
          </article>
        ))}
      </div>
      <div className="admin-pagination"><span>Page {page} of {pages} / {total} reviews</span></div>
    </section>
  );
}
