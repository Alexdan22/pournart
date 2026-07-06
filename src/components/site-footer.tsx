import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { InstagramMark } from "@/components/instagram-mark";
import { defaultWhatsAppMessage } from "@/lib/constants";

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
      <div className="footer-links">
        <Link href="/products">Collections</Link>
        <Link href="/orders">Crafting journey</Link>
        <a className="instagram-link" href="https://www.instagram.com/pour_n_art/" target="_blank" rel="noreferrer">
          <InstagramMark aria-hidden size={18} /> Instagram
        </a>
        <a href={whatsappHref}>
          <MessageCircle aria-hidden size={18} /> WhatsApp
        </a>
      </div>
    </footer>
  );
}
