import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";

const staticRoutes = [
  "",
  "/products",
  "/about",
  "/contact",
  "/faq",
  "/shipping-policy",
  "/return-refund-policy",
  "/privacy-policy",
  "/terms-and-conditions",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true, isFeatured: true },
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true, isFeatured: true },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
    }),
  ]);
  const now = new Date();

  return [
    ...staticRoutes.map((route) => ({
      url: absoluteUrl(route || "/"),
      lastModified: now,
      changeFrequency: route === "" || route === "/products" ? "weekly" as const : "monthly" as const,
      priority: route === "" ? 1 : route === "/products" ? 0.9 : 0.7,
    })),
    ...categories.map((category) => ({
      url: absoluteUrl(`/products?category=${category.slug}`),
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: category.isFeatured ? 0.85 : 0.75,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/products/${product.slug}`),
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: product.isFeatured ? 0.9 : 0.8,
    })),
  ];
}
