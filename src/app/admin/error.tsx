"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[admin-route-error]", error);
  }, [error]);

  return (
    <section className="admin-route">
      <div className="admin-empty">
        <h1>Dashboard could not load.</h1>
        <p>Retry the request or return to the admin overview.</p>
        <div className="admin-heading-actions">
          <button className="admin-button primary" onClick={() => unstable_retry()} type="button">
            <RefreshCw aria-hidden size={15} />
            Try again
          </button>
          <Link className="admin-button" href="/admin">
            Admin home
          </Link>
        </div>
      </div>
    </section>
  );
}
