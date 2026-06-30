import { prisma } from "@/lib/db";
import type { CustomizationField } from "@/lib/types";

export function parseCustomizationFields(value: string): CustomizationField[] {
  try {
    const fields = JSON.parse(value);
    return Array.isArray(fields) ? fields : [];
  } catch {
    return [];
  }
}

export async function getActiveCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getFeaturedProducts() {
  return prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    include: { category: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: { category: true },
  });
}
