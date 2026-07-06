import * as React from "react";
import type { BaseTemplateData } from "@/lib/email/types";

const colors = {
  ivory: "#f8f1e7",
  card: "#fffdf8",
  ink: "#243032",
  muted: "#6c7674",
  teal: "#0f766e",
  tealDark: "#115e59",
  gold: "#c5963f",
  border: "#eadfcc",
};

export function EmailLayout({
  title,
  preheader,
  children,
  appUrl,
  supportEmail,
  instagramUrl,
}: BaseTemplateData & {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <html>
      <body style={{ margin: 0, background: colors.ivory, color: colors.ink, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>{preheader}</div>
        <main style={{ padding: "32px 12px" }}>
          <section style={{ margin: "0 auto", maxWidth: 640 }}>
            <div style={{ textAlign: "center", padding: "8px 0 24px" }}>
              <a href={appUrl} style={{ display: "inline-block", textDecoration: "none" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Email clients need plain HTML img tags. */}
                <img
                  src={`${appUrl}/assets/brand/pour-n-art-resin-art-logo.jpg`}
                  alt="Pour N Art"
                  width="88"
                  height="88"
                  style={{
                    background: colors.card,
                    border: `1px solid ${colors.gold}`,
                    borderRadius: 999,
                    display: "block",
                    height: 88,
                    margin: "0 auto",
                    objectFit: "cover",
                    width: 88,
                  }}
                />
              </a>
            </div>
            <article
              style={{
                background: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: 24,
                boxShadow: "0 18px 40px rgba(65, 45, 22, 0.08)",
                overflow: "hidden",
              }}
            >
              <div style={{ borderTop: `6px solid ${colors.teal}`, padding: "32px 28px 12px" }}>
                <p style={{ color: colors.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1.2, margin: "0 0 10px", textTransform: "uppercase" }}>
                  Handcrafted Resin Keepsakes
                </p>
                <h1 style={{ fontFamily: "Georgia, serif", fontSize: 32, lineHeight: 1.15, margin: 0 }}>{title}</h1>
              </div>
              <div style={{ padding: "10px 28px 32px" }}>{children}</div>
            </article>
            <footer style={{ color: colors.muted, fontSize: 13, lineHeight: 1.6, padding: "24px 16px", textAlign: "center" }}>
              <p style={{ margin: "0 0 8px" }}>
                Need help? Reply to this email or write to{" "}
                <a href={`mailto:${supportEmail}`} style={{ color: colors.tealDark }}>
                  {supportEmail}
                </a>
                .
              </p>
              <p style={{ margin: "0 0 8px" }}>
                <a href={appUrl} style={{ color: colors.tealDark }}>
                  Website
                </a>{" "}
                ·{" "}
                <a href={instagramUrl} style={{ color: colors.tealDark }}>
                  Instagram
                </a>
              </p>
              <p style={{ margin: 0 }}>© {new Date().getFullYear()} Pour N Art. Made for memories, finished by hand.</p>
            </footer>
          </section>
        </main>
      </body>
    </html>
  );
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return <p style={{ color: colors.ink, fontSize: 16, lineHeight: 1.7, margin: "0 0 16px" }}>{children}</p>;
}

export function Button({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        background: colors.teal,
        borderRadius: 999,
        color: "#ffffff",
        display: "inline-block",
        fontSize: 15,
        fontWeight: 700,
        margin: "10px 0 20px",
        padding: "13px 22px",
        textDecoration: "none",
      }}
    >
      {children}
    </a>
  );
}

export function DetailGrid({ rows }: { rows: { label: string; value?: React.ReactNode }[] }) {
  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 18, margin: "20px 0", overflow: "hidden" }}>
      {rows
        .filter((row) => row.value !== undefined && row.value !== null && row.value !== "")
        .map((row) => (
          <div key={row.label} style={{ borderBottom: `1px solid ${colors.border}`, padding: "12px 16px" }}>
            <strong style={{ color: colors.tealDark, display: "block", fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" }}>
              {row.label}
            </strong>
            <span style={{ color: colors.ink, display: "block", fontSize: 15, marginTop: 4 }}>{row.value}</span>
          </div>
        ))}
    </div>
  );
}

export function OrderItems({ items }: { items: { name: string; quantity: number; unitPrice: string; lineTotal: string }[] }) {
  return (
    <div style={{ margin: "20px 0" }}>
      <h2 style={{ fontFamily: "Georgia, serif", fontSize: 22, margin: "0 0 12px" }}>Order pieces</h2>
      {items.map((item) => (
        <div key={`${item.name}-${item.quantity}`} style={{ borderTop: `1px solid ${colors.border}`, padding: "12px 0" }}>
          <strong style={{ display: "block", fontSize: 15 }}>{item.name}</strong>
          <span style={{ color: colors.muted, fontSize: 14 }}>
            Qty {item.quantity} · {item.unitPrice} · {item.lineTotal}
          </span>
        </div>
      ))}
    </div>
  );
}

export function renderAddress(address: {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}) {
  return [address.name, address.phone, address.line1, address.line2, `${address.city}, ${address.state} ${address.pincode}`, address.country || "India"]
    .filter(Boolean)
    .join(", ");
}
