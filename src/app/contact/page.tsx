import { MessageCircle } from "lucide-react";
import { InstagramMark } from "@/components/instagram-mark";
import { defaultWhatsAppMessage } from "@/lib/constants";

export default function ContactPage() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(defaultWhatsAppMessage)}`
    : "mailto:orders@pournart.local";

  return (
    <section className="contact-page">
      <div className="section-heading">
        <span className="panel-label">Custom orders</span>
        <h1>Discuss references, colors, names, dates, and gifting timelines.</h1>
        <p>WhatsApp can be connected once the official business number is available.</p>
      </div>
      <div className="contact-actions">
        <a className="primary-button" href={whatsappHref}>
          <MessageCircle aria-hidden size={18} /> Start conversation
        </a>
        <a className="secondary-button instagram-link" href="https://www.instagram.com/pour_n_art/" target="_blank" rel="noreferrer">
          <InstagramMark aria-hidden size={18} /> Instagram
        </a>
      </div>
    </section>
  );
}
