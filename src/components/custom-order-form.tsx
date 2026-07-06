"use client";

import { useActionState, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { createContactEnquiryAction } from "@/app/actions/contact";

const budgetRanges = ["Under Rs 1000", "Rs 1000-Rs 2500", "Rs 2500-Rs 5000", "Rs 5000+"];
const initialState: Awaited<ReturnType<typeof createContactEnquiryAction>> = {};

type CustomOrderFormProps = {
  whatsappNumber?: string;
};

export function CustomOrderForm({ whatsappNumber }: CustomOrderFormProps) {
  const [referenceFileName, setReferenceFileName] = useState("");
  const [state, formAction, pending] = useActionState(createContactEnquiryAction, initialState);

  useEffect(() => {
    if (state.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state.redirectTo]);

  return (
    <form className="custom-order-form" action={formAction}>
      <div className="form-grid two-column">
        <label>
          <span>Name</span>
          <input name="name" autoComplete="name" required />
          {state.fieldErrors?.name ? <small>{state.fieldErrors.name[0]}</small> : null}
        </label>
        <label>
          <span>Phone / WhatsApp</span>
          <input name="phone" autoComplete="tel" required />
          {state.fieldErrors?.phone ? <small>{state.fieldErrors.phone[0]}</small> : null}
        </label>
      </div>

      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" />
        {state.fieldErrors?.email ? <small>{state.fieldErrors.email[0]}</small> : null}
      </label>

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
        {state.fieldErrors?.details ? <small>{state.fieldErrors.details[0]}</small> : null}
      </label>

      <div className="form-grid two-column">
        <label>
          <span>Reference image</span>
          <input
            name="referenceImage"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => setReferenceFileName(event.target.files?.[0]?.name ?? "")}
          />
          {referenceFileName ? <small>{referenceFileName}</small> : null}
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

      {state.message ? <p className="form-message">{state.message}</p> : null}
      <button className="primary-button" disabled={pending} type="submit">
        <MessageCircle aria-hidden size={18} />
        {pending ? "Saving request..." : whatsappNumber ? "Save and Continue" : "Send Custom Request"}
      </button>
    </form>
  );
}
