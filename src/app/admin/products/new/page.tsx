import { createProductAction } from "@/app/actions/admin";
import { prisma } from "@/lib/db";

export default async function AdminNewProductPage() {
  const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Products</span>
          <h1>Add product</h1>
        </div>
      </div>
      <form className="admin-panel admin-form" action={createProductAction}>
        <input type="hidden" name="imageUrl" value="/assets/resin-hero.png" />
        <input type="hidden" name="currentImageUrl" value="/assets/resin-hero.png" />
        <div className="admin-form-grid">
          <label><span>Name</span><input name="name" required /></label>
          <label><span>Slug</span><input name="slug" /></label>
          <label>
            <span>Category</span>
            <select name="categoryId" required>
              <option value="">Choose category</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label><span>Price</span><input name="price" type="number" step="0.01" required /></label>
          <label><span>Compare price</span><input name="compareAtPrice" type="number" step="0.01" /></label>
          <label><span>Inventory</span><input name="inventory" type="number" defaultValue="0" /></label>
          <label><span>Low stock warning</span><input name="lowStockThreshold" type="number" defaultValue="3" /></label>
          <label><span>Image</span><input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" /></label>
          <label className="span-2"><span>Description</span><textarea name="description" /></label>
          <label className="span-2"><span>Story</span><textarea name="story" /></label>
          <label><span>Min days</span><input name="handmadeDaysMin" type="number" defaultValue="5" /></label>
          <label><span>Max days</span><input name="handmadeDaysMax" type="number" defaultValue="12" /></label>
          <label className="check-row"><input name="isFeatured" type="checkbox" /><span>Featured</span></label>
          <label className="check-row"><input name="isActive" type="checkbox" defaultChecked /><span>Published</span></label>
        </div>
        <button className="admin-button primary" type="submit">Create product</button>
      </form>
    </section>
  );
}
