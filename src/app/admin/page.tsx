import Image from "next/image";
import { AlertCircle, Eye, ImageIcon, Trash2, UploadCloud } from "lucide-react";
import {
  createCategoryAction,
  createCouponAction,
  createProductAction,
  deleteProductPhotoAction,
  removeProductAction,
  updateBannerAction,
  updateCategoryAction,
  updateOrderAction,
  updateProductAction,
} from "@/app/actions/admin";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  manualOrderStatuses,
  orderStatusLabel,
  paymentStatusLabel,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import type { CustomizationField } from "@/lib/types";

const defaultProductImage = "/assets/resin-hero.png";
const manualOrderStatusSet = new Set<string>(manualOrderStatuses);
const defaultCustomizationFields: CustomizationField[] = [
  { name: "size", label: "Preferred size", type: "text", placeholder: "Example: 6 inch / 8 inch" },
  { name: "colors", label: "Preferred colors", type: "text", placeholder: "Example: teal, gold, white" },
  { name: "personalization", label: "Name/date/text", type: "text", placeholder: "Exact text if needed" },
  { name: "notes", label: "Customization notes", type: "textarea", placeholder: "Flowers, shells, finish, theme" },
];

function rupees(amountInPaise: number | null) {
  return amountInPaise ? amountInPaise / 100 : "";
}

function productFields(product?: {
  id?: string;
  name?: string;
  slug?: string;
  categoryId?: string;
  description?: string;
  story?: string;
  price?: number;
  compareAtPrice?: number | null;
  imageUrl?: string;
  inventory?: number;
  isFeatured?: boolean;
  isActive?: boolean;
  handmadeDaysMin?: number;
  handmadeDaysMax?: number;
  customizationFields?: string;
}) {
  return {
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    categoryId: product?.categoryId ?? "",
    description: product?.description ?? "",
    story: product?.story ?? "",
    price: rupees(product?.price ?? null),
    compareAtPrice: rupees(product?.compareAtPrice ?? null),
    imageUrl: product?.imageUrl ?? defaultProductImage,
    inventory: product?.inventory ?? 0,
    isFeatured: product?.isFeatured ?? false,
    isActive: product?.isActive ?? true,
    handmadeDaysMin: product?.handmadeDaysMin ?? 5,
    handmadeDaysMax: product?.handmadeDaysMax ?? 12,
    customizationFields: product?.customizationFields ?? "",
  };
}

function parseAdminCustomizationFields(value?: string) {
  if (!value) {
    return defaultCustomizationFields;
  }

  try {
    const fields = JSON.parse(value) as CustomizationField[];

    return Array.isArray(fields) && fields.length ? fields : defaultCustomizationFields;
  } catch {
    return defaultCustomizationFields;
  }
}

function customizationRows(value?: string) {
  const rows: CustomizationField[] = [...parseAdminCustomizationFields(value)];

  while (rows.length < 5) {
    rows.push({ name: "", label: "", type: "text", placeholder: "" });
  }

  return rows;
}

function needsManualAction(status: string) {
  return manualOrderStatusSet.has(status);
}

export default async function AdminPage() {
  await requireAdmin();

  const orderInclude = { user: true, items: true } as const;
  const [products, categories, manualOrders, recentOrders, users, coupons, banner] = await Promise.all([
    prisma.product.findMany({
      include: { category: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.order.findMany({
      where: { status: { in: [...manualOrderStatuses] } },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: { status: { notIn: [...manualOrderStatuses] } },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.banner.findFirst({ where: { id: "home-hero" } }),
  ]);
  const orders = [...manualOrders, ...recentOrders];

  const paidRevenue = orders
    .filter((order) => order.paymentStatus === "PAID")
    .reduce((total, order) => total + order.total, 0);
  const pendingOrders = orders.filter((order) => order.status !== "DELIVERED" && order.status !== "CANCELLED").length;

  return (
    <section className="admin-page">
      <div className="section-heading">
        <span className="panel-label">Admin dashboard</span>
        <h1>Pour n Art operations</h1>
        <p>Manage handmade catalog data, orders, delivery statuses, coupons, and homepage content.</p>
      </div>

      <div className="admin-stats">
        <div>
          <span>Paid revenue</span>
          <strong>{formatINR(paidRevenue)}</strong>
        </div>
        <div>
          <span>Open orders</span>
          <strong>{pendingOrders}</strong>
        </div>
        <div>
          <span>Products</span>
          <strong>{products.length}</strong>
        </div>
        <div>
          <span>Customers</span>
          <strong>{users.filter((user) => user.role !== "ADMIN").length}</strong>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>Homepage banner</h2>
          <span>Update the first viewport signal.</span>
        </div>
        <form className="admin-form" action={updateBannerAction}>
          <input type="hidden" name="id" value={banner?.id ?? "home-hero"} />
          <label>
            <span>Title</span>
            <input name="title" defaultValue={banner?.title ?? "Custom resin art, hand-poured for gifting moments"} />
          </label>
          <label>
            <span>Subtitle</span>
            <textarea name="subtitle" defaultValue={banner?.subtitle ?? ""} />
          </label>
          <div className="form-grid">
            <label>
              <span>CTA label</span>
              <input name="ctaLabel" defaultValue={banner?.ctaLabel ?? "Explore the collection"} />
            </label>
            <label>
              <span>CTA link</span>
              <input name="ctaHref" defaultValue={banner?.ctaHref ?? "/products"} />
            </label>
            <label>
              <span>Image path</span>
              <input name="imageUrl" defaultValue={banner?.imageUrl ?? "/assets/resin-hero.png"} />
            </label>
          </div>
          <label className="check-row">
            <input type="checkbox" name="isActive" defaultChecked={banner?.isActive ?? true} />
            <span>Active</span>
          </label>
          <button className="primary-button" type="submit">
            Save banner
          </button>
        </form>
      </section>

      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>Products</h2>
          <span>Add, edit, or remove handmade items.</span>
        </div>

        <details className="admin-create" open>
          <summary>Add product</summary>
          <ProductForm categories={categories} action={createProductAction} />
        </details>

        <div className="admin-list">
          {products.map((product) => (
            <details className="admin-item" key={product.id}>
              <summary>
                <Image src={product.imageUrl} alt={product.name} width={56} height={56} />
                <span>
                  <strong>{product.name}</strong>
                  <small>
                    {product.category.name} · {formatINR(product.price)} · {product.isActive ? "Active" : "Inactive"}
                  </small>
                </span>
              </summary>
              <ProductForm product={product} categories={categories} action={updateProductAction} />
              <form action={removeProductAction}>
                <input type="hidden" name="id" value={product.id} />
                <button className="danger-button" type="submit">
                  Remove from storefront
                </button>
              </form>
            </details>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>Categories</h2>
          <span>Configure category-based shipping and storefront filters.</span>
        </div>
        <details className="admin-create">
          <summary>Add category</summary>
          <CategoryForm action={createCategoryAction} />
        </details>
        <div className="admin-list">
          {categories.map((category) => (
            <details className="admin-item" key={category.id}>
              <summary>
                <span>
                  <strong>{category.name}</strong>
                  <small>
                    {formatINR(category.shippingFee)} shipping · {category.isActive ? "Active" : "Inactive"}
                  </small>
                </span>
              </summary>
              <CategoryForm category={category} action={updateCategoryAction} />
            </details>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>Orders</h2>
          <span>Manual statuses until dispatch, courier tracking after shipping.</span>
        </div>
        <div className="admin-list">
          {orders.map((order) => {
            const actionNeeded = needsManualAction(order.status);

            return (
            <details className={`admin-item ${actionNeeded ? "admin-item-action" : ""}`} key={order.id}>
              <summary>
                <span>
                  <strong>{order.orderNumber}</strong>
                  <small>
                    {order.user.name} · {formatINR(order.total)} ·{" "}
                    {orderStatusLabel[order.status as keyof typeof orderStatusLabel] ?? order.status}
                  </small>
                </span>
                {actionNeeded ? (
                  <em className="action-chip">
                    <AlertCircle aria-hidden size={14} /> Action needed
                  </em>
                ) : null}
              </summary>
              <form className="admin-form" action={updateOrderAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <div className="form-grid">
                  <label>
                    <span>Status</span>
                    <select name="status" defaultValue={order.status}>
                      {ORDER_STATUSES.map((status) => (
                        <option value={status} key={status}>
                          {orderStatusLabel[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Payment</span>
                    <select name="paymentStatus" defaultValue={order.paymentStatus}>
                      {PAYMENT_STATUSES.map((status) => (
                        <option value={status} key={status}>
                          {paymentStatusLabel[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Courier</span>
                    <input name="courierName" defaultValue={order.courierName ?? ""} />
                  </label>
                  <label>
                    <span>Tracking ID</span>
                    <input name="courierTrackingId" defaultValue={order.courierTrackingId ?? ""} />
                  </label>
                  <label>
                    <span>Tracking URL</span>
                    <input name="courierTrackingUrl" defaultValue={order.courierTrackingUrl ?? ""} />
                  </label>
                </div>
                <label>
                  <span>Customer update note</span>
                  <textarea name="note" placeholder="Short delivery/status update for email and tracking timeline" />
                </label>
                <button className="primary-button" type="submit">
                  Update order
                </button>
              </form>
            </details>
            );
          })}
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>Coupons</h2>
          <span>Launch offers and future promotions.</span>
        </div>
        <form className="admin-form" action={createCouponAction}>
          <div className="form-grid">
            <label>
              <span>Code</span>
              <input name="code" placeholder="HANDMADE10" />
            </label>
            <label>
              <span>Type</span>
              <select name="type" defaultValue="PERCENT">
                <option value="PERCENT">Percent</option>
                <option value="FIXED">Fixed</option>
              </select>
            </label>
            <label>
              <span>Value</span>
              <input name="value" type="number" />
            </label>
            <label>
              <span>Minimum subtotal</span>
              <input name="minSubtotal" type="number" />
            </label>
            <label>
              <span>Usage limit</span>
              <input name="usageLimit" type="number" />
            </label>
          </div>
          <label>
            <span>Description</span>
            <input name="description" />
          </label>
          <label className="check-row">
            <input type="checkbox" name="isActive" defaultChecked />
            <span>Active</span>
          </label>
          <button className="primary-button" type="submit">
            Add coupon
          </button>
        </form>
        <div className="coupon-row">
          {coupons.map((coupon) => (
            <span key={coupon.id}>
              {coupon.code} · {coupon.type === "PERCENT" ? `${coupon.value}%` : formatINR(coupon.value)}
            </span>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>Customers</h2>
          <span>Recent accounts and admin readiness.</span>
        </div>
        <div className="customer-table">
          {users.map((user) => (
            <div key={user.id}>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <small>{user.role}</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function ProductForm({
  product,
  categories,
  action,
}: {
  product?: Parameters<typeof productFields>[0];
  categories: { id: string; name: string }[];
  action: (formData: FormData) => Promise<void>;
}) {
  const values = productFields(product);
  const rows = customizationRows(values.customizationFields);
  const canDeletePhoto = Boolean(product?.id && values.imageUrl !== defaultProductImage);

  return (
    <form className="admin-form product-admin-form" action={action}>
      {product?.id ? <input type="hidden" name="id" value={product.id} /> : null}
      <input type="hidden" name="imageUrl" value={values.imageUrl} />
      <input type="hidden" name="currentImageUrl" value={values.imageUrl} />

      <div className="admin-form-panel">
        <h3>Basics</h3>
        <div className="form-grid">
          <label>
            <span>Name</span>
            <input name="name" defaultValue={values.name} required />
          </label>
          <label>
            <span>Slug</span>
            <input name="slug" defaultValue={values.slug} />
          </label>
          <label>
            <span>Category</span>
            <select name="categoryId" defaultValue={values.categoryId} required>
              <option value="">Choose category</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Price</span>
            <input name="price" type="number" step="0.01" defaultValue={values.price} required />
          </label>
          <label>
            <span>Compare price</span>
            <input name="compareAtPrice" type="number" step="0.01" defaultValue={values.compareAtPrice} />
          </label>
          <label>
            <span>Inventory</span>
            <input name="inventory" type="number" defaultValue={values.inventory} />
          </label>
          <label>
            <span>Min days</span>
            <input name="handmadeDaysMin" type="number" defaultValue={values.handmadeDaysMin} />
          </label>
          <label>
            <span>Max days</span>
            <input name="handmadeDaysMax" type="number" defaultValue={values.handmadeDaysMax} />
          </label>
        </div>
      </div>

      <div className="admin-form-panel photo-manager">
        <div className="photo-preview">
          <Image src={values.imageUrl} alt={values.name || "Product photo"} width={220} height={220} />
        </div>
        <div className="photo-controls">
          <h3>
            <ImageIcon aria-hidden size={18} /> Product photo
          </h3>
          <a className="text-link" href={values.imageUrl} target="_blank" rel="noreferrer">
            <Eye aria-hidden size={16} /> View current photo
          </a>
          <label className="file-upload-field">
            <span>
              <UploadCloud aria-hidden size={16} /> Upload new photo
            </span>
            <input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" />
          </label>
          <small>JPG, PNG, or WebP up to 8MB. Saving the product applies the upload.</small>
          {product?.id ? (
            <button className="danger-button" type="submit" formAction={deleteProductPhotoAction} disabled={!canDeletePhoto}>
              <Trash2 aria-hidden size={16} /> Delete photo
            </button>
          ) : null}
        </div>
      </div>

      <div className="admin-form-panel">
        <h3>Description</h3>
        <label>
          <span>Short description</span>
          <textarea name="description" defaultValue={values.description} />
        </label>
        <label>
          <span>Story</span>
          <textarea name="story" defaultValue={values.story} />
        </label>
      </div>

      <details className="admin-form-panel custom-fields-builder">
        <summary>Customization questions</summary>
        <p>These fields appear on the product page before a customer adds the item to cart.</p>
        <div className="custom-field-list">
          {rows.map((field, index) => (
            <div className="custom-field-row" key={`${field.name || "new"}-${index}`}>
              <input type="hidden" name="customFieldName" value={field.name} />
              <label>
                <span>Question label</span>
                <input name="customFieldLabel" defaultValue={field.label} placeholder="Example: Preferred colors" />
              </label>
              <label>
                <span>Answer type</span>
                <select name="customFieldType" defaultValue={field.type === "textarea" ? "textarea" : "text"}>
                  <option value="text">Short text</option>
                  <option value="textarea">Long note</option>
                </select>
              </label>
              <label>
                <span>Placeholder</span>
                <input name="customFieldPlaceholder" defaultValue={field.placeholder ?? ""} placeholder="Example answer" />
              </label>
            </div>
          ))}
        </div>
      </details>

      <div className="admin-form-panel product-flags">
        <div className="check-grid">
          <label className="check-row">
            <input type="checkbox" name="isFeatured" defaultChecked={values.isFeatured} />
            <span>Featured</span>
          </label>
          <label className="check-row">
            <input type="checkbox" name="isActive" defaultChecked={values.isActive} />
            <span>Active</span>
          </label>
        </div>
      </div>
      <button className="primary-button" type="submit">
        Save product
      </button>
    </form>
  );
}

function CategoryForm({
  category,
  action,
}: {
  category?: {
    id?: string;
    name?: string;
    slug?: string;
    description?: string;
    imageUrl?: string | null;
    shippingFee?: number;
    sortOrder?: number;
    isActive?: boolean;
  };
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form className="admin-form" action={action}>
      {category?.id ? <input type="hidden" name="id" value={category.id} /> : null}
      <div className="form-grid">
        <label>
          <span>Name</span>
          <input name="name" defaultValue={category?.name ?? ""} required />
        </label>
        <label>
          <span>Slug</span>
          <input name="slug" defaultValue={category?.slug ?? ""} />
        </label>
        <label>
          <span>Shipping fee</span>
          <input name="shippingFee" type="number" step="0.01" defaultValue={rupees(category?.shippingFee ?? null)} />
        </label>
        <label>
          <span>Sort order</span>
          <input name="sortOrder" type="number" defaultValue={category?.sortOrder ?? 0} />
        </label>
      </div>
      <label>
        <span>Description</span>
        <textarea name="description" defaultValue={category?.description ?? ""} />
      </label>
      <label>
        <span>Image path</span>
        <input name="imageUrl" defaultValue={category?.imageUrl ?? "/assets/resin-hero.png"} />
      </label>
      <label className="check-row">
        <input type="checkbox" name="isActive" defaultChecked={category?.isActive ?? true} />
        <span>Active</span>
      </label>
      <button className="primary-button" type="submit">
        Save category
      </button>
    </form>
  );
}
