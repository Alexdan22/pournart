"use client";

import { useActionState } from "react";
import { Star } from "lucide-react";
import { createReviewAction } from "@/app/actions/reviews";

const initialState: Awaited<ReturnType<typeof createReviewAction>> = {};

type ReviewFormProps = {
  orderId: string;
  orderItemId: string;
  productId: string;
};

export function ReviewForm({ orderId, orderItemId, productId }: ReviewFormProps) {
  const [state, formAction, pending] = useActionState(createReviewAction, initialState);

  return (
    <form className="review-form" action={formAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderItemId" value={orderItemId} />
      <input type="hidden" name="productId" value={productId} />
      <label>
        <span>Rating</span>
        <select name="rating" defaultValue="5">
          <option value="5">5 stars</option>
          <option value="4">4 stars</option>
          <option value="3">3 stars</option>
          <option value="2">2 stars</option>
          <option value="1">1 star</option>
        </select>
      </label>
      <label>
        <span>Title</span>
        <input name="title" placeholder="Beautiful finish, thoughtful packaging..." />
      </label>
      <label>
        <span>Review</span>
        <textarea name="body" placeholder="Tell us how the piece felt when it arrived." required />
        {state.fieldErrors?.body ? <small>{state.fieldErrors.body[0]}</small> : null}
      </label>
      {state.message ? <p className="form-message">{state.message}</p> : null}
      <button className="secondary-button" disabled={pending} type="submit">
        <Star aria-hidden size={16} /> {pending ? "Saving..." : "Leave Review"}
      </button>
    </form>
  );
}
