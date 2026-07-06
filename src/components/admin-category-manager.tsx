"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { updateCategoryAction, updateCategoryOrderAction } from "@/app/actions/admin";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  shippingFee: number;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  metaTitle: string | null;
  metaDescription: string | null;
};

function rupees(amount: number) {
  return amount / 100;
}

export function AdminCategoryManager({ categories }: { categories: Category[] }) {
  const [items, setItems] = useState(categories);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function move(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      return;
    }

    setItems((current) => {
      const from = current.findIndex((item) => item.id === draggingId);
      const to = current.findIndex((item) => item.id === targetId);
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  return (
    <div className="category-manager">
      <form className="admin-bulk-bar" action={updateCategoryOrderAction}>
        <input type="hidden" name="categoryOrder" value={items.map((item) => item.id).join(",")} />
        <button className="admin-button primary" type="submit">Save order</button>
      </form>
      <div className="category-drag-list">
        {items.map((category) => (
          <article
            draggable
            onDragStart={() => setDraggingId(category.id)}
            onDragEnter={() => move(category.id)}
            onDragEnd={() => setDraggingId(null)}
            key={category.id}
          >
            <GripVertical aria-hidden size={18} />
            <form action={updateCategoryAction}>
              <input type="hidden" name="id" value={category.id} />
              <div className="admin-form-grid">
                <label><span>Name</span><input name="name" defaultValue={category.name} required /></label>
                <label><span>Slug</span><input name="slug" defaultValue={category.slug} /></label>
                <label><span>Shipping</span><input name="shippingFee" type="number" step="0.01" defaultValue={rupees(category.shippingFee)} /></label>
                <label><span>Sort</span><input name="sortOrder" type="number" defaultValue={category.sortOrder} /></label>
                <label className="span-2"><span>Description</span><textarea name="description" defaultValue={category.description} /></label>
                <label><span>Image path</span><input name="imageUrl" defaultValue={category.imageUrl || ""} /></label>
                <label><span>SEO title</span><input name="metaTitle" defaultValue={category.metaTitle || ""} /></label>
                <label className="span-2"><span>SEO description</span><textarea name="metaDescription" defaultValue={category.metaDescription || ""} /></label>
                <label className="check-row"><input type="checkbox" name="isActive" defaultChecked={category.isActive} /><span>Visible</span></label>
                <label className="check-row"><input type="checkbox" name="isFeatured" defaultChecked={category.isFeatured} /><span>Featured</span></label>
              </div>
              <button className="admin-button" type="submit">Save category</button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
