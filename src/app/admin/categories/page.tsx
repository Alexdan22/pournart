import { createCategoryAction } from "@/app/actions/admin";
import { AdminCategoryManager } from "@/components/admin-category-manager";
import { prisma } from "@/lib/db";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Categories</span>
          <h1>Category architecture</h1>
        </div>
      </div>
      <details className="admin-panel admin-disclosure">
        <summary>Add category</summary>
        <form className="admin-form" action={createCategoryAction}>
          <div className="admin-form-grid">
            <label><span>Name</span><input name="name" required /></label>
            <label><span>Slug</span><input name="slug" /></label>
            <label><span>Shipping</span><input name="shippingFee" type="number" step="0.01" defaultValue="0" /></label>
            <label><span>Sort order</span><input name="sortOrder" type="number" defaultValue="0" /></label>
            <label className="span-2"><span>Description</span><textarea name="description" /></label>
            <label><span>Image path</span><input name="imageUrl" defaultValue="/assets/resin-hero.png" /></label>
            <label><span>SEO title</span><input name="metaTitle" /></label>
            <label className="span-2"><span>SEO description</span><textarea name="metaDescription" /></label>
            <label className="check-row"><input name="isActive" type="checkbox" defaultChecked /><span>Visible</span></label>
            <label className="check-row"><input name="isFeatured" type="checkbox" /><span>Featured</span></label>
          </div>
          <button className="admin-button primary" type="submit">Create category</button>
        </form>
      </details>
      <AdminCategoryManager categories={categories} />
    </section>
  );
}
