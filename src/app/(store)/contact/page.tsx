import { MessageCircle } from "lucide-react";
import { CustomOrderForm } from "@/components/custom-order-form";
import { InstagramMark } from "@/components/instagram-mark";
import { defaultWhatsAppMessage } from "@/lib/constants";

export default function ContactPage() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(defaultWhatsAppMessage)}`
    : "mailto:pournart@gmail.com";

  return (
    <section className="contact-page">
      <div className="section-heading">
        <span className="panel-label">Custom orders</span>
        <h1>Create a handcrafted piece around your memory.</h1>
        <p>Share the occasion, details, budget, and any names, dates, florals, shells, or colors you want preserved.</p>
      </div>
      <div className="contact-grid">
        <CustomOrderForm whatsappNumber={whatsappNumber} />
        <aside className="contact-panel">
          <h2>Prefer a quick message?</h2>
          <p>Start with WhatsApp or Instagram and we will shape the piece around your story, timeline, and budget.</p>
          <div className="contact-actions">
            <a className="primary-button" href={whatsappHref}>
              <MessageCircle aria-hidden size={18} /> Start conversation
            </a>
            <a className="secondary-button instagram-link" href="https://www.instagram.com/pour_n_art/" target="_blank" rel="noreferrer">
              <InstagramMark aria-hidden size={18} /> Instagram
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}
