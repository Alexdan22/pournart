import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { InstagramMark } from "@/components/instagram-mark";
import { defaultWhatsAppMessage } from "@/lib/constants";

const footerGroups = [
  {
    title: "Shop",
    links: [
      { href: "/products", label: "Collections" },
      { href: "/orders", label: "Crafting journey" },
    ],
  },
  {
    title: "Pages",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/shipping-policy", label: "Shipping" },
      { href: "/return-refund-policy", label: "Returns" },
      { href: "/privacy-policy", label: "Privacy" },
      { href: "/terms-and-conditions", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(defaultWhatsAppMessage)}`
    : "/contact";

  return (
    <footer className="site-footer">
      <div>
        <strong className="brand-name">
          Pour <em>n</em> Art
        </strong>
        <p>Handcrafted custom gifts and signature decor inspired by memories, nature, and the ocean.</p>
      </div>
      <nav className="footer-link-groups" aria-label="Footer navigation">
        {footerGroups.map((group) => (
          <div className="footer-link-column" key={group.title}>
            <strong>{group.title}</strong>
            <div className="footer-links">
              {group.links.map((link) => (
                <Link href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
        <div className="footer-link-column">
          <strong>Connect</strong>
          <div className="footer-links">
            <a className="instagram-link" href="https://www.instagram.com/pour_n_art/" target="_blank" rel="noreferrer">
              <InstagramMark aria-hidden size={18} /> Instagram
            </a>
            <a href={whatsappHref}>
              <MessageCircle aria-hidden size={18} /> WhatsApp
            </a>
          </div>
        </div>
      </nav>
    </footer>
  );
}
