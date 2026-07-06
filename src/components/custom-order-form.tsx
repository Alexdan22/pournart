"use client";

import { FormEvent, useState } from "react";
import { MessageCircle } from "lucide-react";
import { defaultWhatsAppMessage } from "@/lib/constants";

const budgetRanges = ["Under ₹1000", "₹1000-₹2500", "₹2500-₹5000", "₹5000+"];

type CustomOrderFormProps = {
  whatsappNumber?: string;
};

export function CustomOrderForm({ whatsappNumber }: CustomOrderFormProps) {
  const [referenceFileName, setReferenceFileName] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const message = [
      defaultWhatsAppMessage,
      `Name: ${formData.get("name") || ""}`,
      `Phone / WhatsApp: ${formData.get("phone") || ""}`,
      `Occasion: ${formData.get("occasion") || ""}`,
      `Product type: ${formData.get("productType") || ""}`,
      `Preferred budget: ${formData.get("budget") || ""}`,
      `Personalization details: ${formData.get("details") || ""}`,
      referenceFileName ? `Reference image: ${referenceFileName} (to be shared separately)` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const href = whatsappNumber
      ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
      : `mailto:pournart@gmail.com?subject=${encodeURIComponent("Custom Pour n Art order")}&body=${encodeURIComponent(message)}`;

    window.location.href = href;
  }

  return (
    <form className="custom-order-form" onSubmit={handleSubmit}>
      <div className="form-grid two-column">
        <label>
          <span>Name</span>
          <input name="name" autoComplete="name" required />
        </label>
        <label>
          <span>Phone / WhatsApp</span>
          <input name="phone" autoComplete="tel" required />
        </label>
      </div>

      <div className="form-grid two-column">
        <label>
          <span>Occasion</span>
          <select name="occasion" defaultValue="Birthday Gifts" required>
            <option>Birthday Gifts</option>
            <option>Anniversary Gifts</option>
            <option>Wedding Gifts</option>
            <option>Housewarming Gifts</option>
            <option>Personalized Pieces</option>
          </select>
        </label>
        <label>
          <span>Product type</span>
          <select name="productType" defaultValue="Personalized Piece" required>
            <option>Personalized Piece</option>
            <option>Gift Coaster Set</option>
            <option>Memory Tray</option>
            <option>Name Plate</option>
            <option>Everyday Gift</option>
            <option>Statement Decor</option>
          </select>
        </label>
      </div>

      <label>
        <span>Personalization details</span>
        <textarea
          name="details"
          placeholder="Names, dates, initials, flowers, shells, colors, memory, or gifting timeline"
          required
        />
      </label>

      <div className="form-grid two-column">
        <label>
          <span>Reference image</span>
          <input
            name="referenceImage"
            type="file"
            accept="image/*"
            onChange={(event) => setReferenceFileName(event.target.files?.[0]?.name ?? "")}
          />
        </label>
        <label>
          <span>Preferred budget range</span>
          <select name="budget" defaultValue={budgetRanges[1]} required>
            {budgetRanges.map((range) => (
              <option key={range}>{range}</option>
            ))}
          </select>
        </label>
      </div>

      <button className="primary-button" type="submit">
        <MessageCircle aria-hidden size={18} />
        Request a Custom Order
      </button>
    </form>
  );
}
