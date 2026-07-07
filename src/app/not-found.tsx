import Link from "next/link";

export default function NotFound() {
  return (
    <section className="route-error">
      <span className="panel-label">Page not found</span>
      <h1>This piece is not on the shelf.</h1>
      <p>The page may have moved, or the product may no longer be available.</p>
      <div>
        <Link className="primary-button" href="/products">
          Browse products
        </Link>
        <Link className="secondary-button" href="/contact">
          Contact studio
        </Link>
      </div>
    </section>
  );
}
