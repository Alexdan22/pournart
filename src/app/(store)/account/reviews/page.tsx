import Link from "next/link";
import { ArrowRight, MessageSquareReply, PackageCheck, Star } from "lucide-react";
import { AccountNav } from "@/components/account-nav";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

function reviewStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pending review",
    APPROVED: "Approved",
    REJECTED: "Needs revision",
  };

  return labels[status] ?? status;
}

export default async function AccountReviewsPage() {
  const session = await requireUser();
  const reviews = await prisma.review.findMany({
    where: { userId: session.id },
    include: {
      product: { select: { name: true, slug: true } },
      order: { select: { orderNumber: true } },
      orderItem: { select: { productName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="account-page">
      <div className="section-heading heading-row">
        <div>
          <span className="panel-label">Reviews</span>
          <h1>Your submitted reviews.</h1>
          <p>Track moderation status and studio replies for the reviews you have shared.</p>
        </div>
        <Link className="secondary-button" href="/orders">
          Review delivered orders <ArrowRight aria-hidden size={18} />
        </Link>
      </div>

      <AccountNav active="Reviews" />

      {reviews.length > 0 ? (
        <div className="review-account-list">
          {reviews.map((review) => (
            <article className="account-panel review-account-card" key={review.id}>
              <div className="review-account-card-heading">
                <div>
                  <span className={`status-pill review-${review.status.toLowerCase()}`}>{reviewStatusLabel(review.status)}</span>
                  <h2>{review.title || review.product.name}</h2>
                </div>
                <div className="review-stars" aria-label={`${review.rating} star review`}>
                  {Array.from({ length: review.rating }).map((_, index) => (
                    <Star aria-hidden fill="currentColor" size={16} key={index} />
                  ))}
                </div>
              </div>
              <p>{review.body}</p>
              <div className="review-account-meta">
                <Link href={`/products/${review.product.slug}`}>{review.product.name}</Link>
                {review.order ? (
                  <Link href={`/orders/${review.order.orderNumber}`}>
                    <PackageCheck aria-hidden size={15} /> {review.order.orderNumber}
                  </Link>
                ) : null}
                <span>{review.createdAt.toLocaleDateString("en-IN")}</span>
              </div>
              {review.reply ? (
                <div className="studio-reply">
                  <MessageSquareReply aria-hidden size={17} />
                  <p>{review.reply}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="account-panel review-empty-card">
          <Star aria-hidden size={34} />
          <div>
            <span className="panel-label">No reviews yet</span>
            <h2>No reviews submitted yet.</h2>
            <p>When a delivered order is ready for feedback, you can leave a review from the order detail page.</p>
          </div>
          <Link className="primary-button" href="/orders">
            Open orders <ArrowRight aria-hidden size={18} />
          </Link>
        </div>
      )}
    </section>
  );
}
