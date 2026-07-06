import Image from "next/image";
import Link from "next/link";
import { Archive, ArrowLeft, ArrowRight, Check, Search, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { bulkProductAction, quickUpdateProductAction } from "@/app/actions/admin";
import { AdminSortLink } from "@/components/admin-sort-link";
import { pagination, pageCount, type AdminTableSearchParams } from "@/lib/admin-data";
import { prisma } from "@/lib/db";

function rupees(amount: number) {
  return amount / 100;
}

function sortDirection(value?: string): Prisma.SortOrder {
  return value === "asc" ? "asc" : "desc";
}

function productSort(sort: string | undefined, direction: Prisma.SortOrder): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === "name") {
    return [{ name: direction }];
  }

  if (sort === "category") {
    return [{ category: { name: direction } }, { updatedAt: "desc" }];
  }

  if (sort === "price") {
    return [{ price: direction }, { updatedAt: "desc" }];
  }

  if (sort === "inventory") {
    return [{ inventory: direction }, { updatedAt: "desc" }];
  }

  if (sort === "status") {
    return [{ adminStatus: direction }, { updatedAt: "desc" }];
  }

  return [{ updatedAt: direction }];
}

function hrefWith(params: AdminTableSearchParams, overrides: Record<string, string | number>) {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      next.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    next.set(key, String(value));
  }

  return `/admin/products?${next.toString()}`;
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<AdminTableSearchParams>;
}) {
  const params = await searchParams;
  const { page, take, skip } = pagination(params.page);
  const query = params.q?.trim();
  const direction = sortDirection(params.direction);
  const where: Prisma.ProductWhereInput = {
    adminStatus: params.status ? params.status : undefined,
    OR: query
      ? [
          { name: { contains: query } },
          { slug: { contains: query } },
          { category: { name: { contains: query } } },
        ]
      : undefined,
  };
  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: productSort(params.sort, direction),
      skip,
      take,
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const pages = pageCount(total);

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Products</span>
          <h1>Catalog operations</h1>
        </div>
        <Link className="admin-button primary" href="/admin/products/new">Add Product</Link>
      </div>

      <form className="admin-filter-bar">
        <label>
          <Search aria-hidden size={16} />
          <input name="q" defaultValue={query} placeholder="Search products..." />
        </label>
        <select name="status" defaultValue={params.status || ""}>
          <option value="">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button className="admin-button" type="submit">Filter</button>
        <Link className="admin-button ghost" href="/admin/products">Clear</Link>
      </form>

      <form className="admin-bulk-bar" id="bulk-products" action={bulkProductAction}>
        <select name="bulkAction" defaultValue="archive">
          <option value="archive">Archive</option>
          <option value="publish">Publish</option>
          <option value="draft">Draft</option>
          <option value="delete">Delete</option>
        </select>
        <button className="admin-button" type="submit">
          <Archive aria-hidden size={15} /> Apply bulk action
        </button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table product-admin-table">
          <thead>
            <tr>
              <th><span className="sr-only">Select</span></th>
              <th>Image</th>
              <th><AdminSortLink basePath="/admin/products" label="Name" searchParams={params} sortKey="name" defaultSort="updated" /></th>
              <th><AdminSortLink basePath="/admin/products" label="Category" searchParams={params} sortKey="category" defaultSort="updated" /></th>
              <th><AdminSortLink basePath="/admin/products" label="Price" searchParams={params} sortKey="price" defaultSort="updated" /></th>
              <th><AdminSortLink basePath="/admin/products" label="Inventory" searchParams={params} sortKey="inventory" defaultSort="updated" /></th>
              <th><AdminSortLink basePath="/admin/products" label="Status" searchParams={params} sortKey="status" defaultSort="updated" /></th>
              <th><AdminSortLink basePath="/admin/products" label="Updated" searchParams={params} sortKey="updated" defaultSort="updated" /></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td><input form="bulk-products" type="checkbox" name="productId" value={product.id} /></td>
                <td><Image src={product.imageUrl} alt="" width={52} height={52} /></td>
                <td>
                  <form id={`product-${product.id}`} action={quickUpdateProductAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <input name="name" defaultValue={product.name} aria-label="Product name" />
                  </form>
                </td>
                <td>
                  <select form={`product-${product.id}`} name="categoryId" defaultValue={product.categoryId} aria-label="Category">
                    {categories.map((category) => (
                      <option value={category.id} key={category.id}>{category.name}</option>
                    ))}
                  </select>
                </td>
                <td><input form={`product-${product.id}`} name="price" type="number" step="0.01" defaultValue={rupees(product.price)} aria-label="Price" /></td>
                <td>
                  <div className="inventory-inline">
                    <input form={`product-${product.id}`} name="inventory" type="number" defaultValue={product.inventory} aria-label="Inventory" />
                    <input form={`product-${product.id}`} name="lowStockThreshold" type="number" defaultValue={product.lowStockThreshold} aria-label="Low stock threshold" />
                  </div>
                </td>
                <td>
                  <select form={`product-${product.id}`} name="adminStatus" defaultValue={product.adminStatus} aria-label="Status">
                    <option value="PUBLISHED">Published</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </td>
                <td>{product.updatedAt.toLocaleDateString("en-IN")}</td>
                <td>
                  <button className="icon-action" form={`product-${product.id}`} type="submit" aria-label="Save product">
                    <Check aria-hidden size={15} />
                  </button>
                  <form action={bulkProductAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="bulkAction" value="delete" />
                    <button className="icon-action danger" type="submit" aria-label="Delete or archive product">
                      <Trash2 aria-hidden size={15} />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-pagination">
        <Link className={page <= 1 ? "disabled" : ""} href={hrefWith(params, { page: Math.max(1, page - 1) })}>
          <ArrowLeft aria-hidden size={15} /> Previous
        </Link>
        <span>Page {page} of {pages} / {total} products</span>
        <Link className={page >= pages ? "disabled" : ""} href={hrefWith(params, { page: Math.min(pages, page + 1) })}>
          Next <ArrowRight aria-hidden size={15} />
        </Link>
      </div>
    </section>
  );
}
