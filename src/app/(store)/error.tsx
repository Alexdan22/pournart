"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function StoreError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[store-route-error]", error);
  }, [error]);

  return (
    <section className="route-error">
      <span className="panel-label">Something needs a second pour</span>
      <h1>We could not load this page.</h1>
      <p>Please try again, or return to the shop while the studio catches up.</p>
      <div>
        <button className="primary-button" onClick={() => unstable_retry()} type="button">
          <RefreshCw aria-hidden size={18} />
          Try again
        </button>
        <Link className="secondary-button" href="/products">
          Back to shop
        </Link>
      </div>
    </section>
  );
}
