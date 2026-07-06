import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requireAdmin } from "@/lib/session";

export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const [orders, products, customers, categories] = await Promise.all([
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: query } },
          { deliveryPhone: { contains: query } },
          { user: { name: { contains: query } } },
          { user: { email: { contains: query } } },
        ],
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.product.findMany({
      where: {
        OR: [{ name: { contains: query } }, { slug: { contains: query } }],
      },
      include: { category: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.user.findMany({
      where: {
        OR: [{ name: { contains: query } }, { email: { contains: query } }, { phone: { contains: query } }],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.category.findMany({
      where: {
        OR: [{ name: { contains: query } }, { slug: { contains: query } }],
      },
      take: 5,
    }),
  ]);

  return NextResponse.json({
    results: [
      ...orders.map((order) => ({
        type: "Order",
        title: order.orderNumber,
        subtitle: `${order.user.name} / ${formatINR(order.total)}`,
        href: `/admin/orders/${order.orderNumber}`,
      })),
      ...products.map((product) => ({
        type: "Product",
        title: product.name,
        subtitle: `${product.category.name} / ${formatINR(product.price)}`,
        href: `/admin/products?q=${encodeURIComponent(product.name)}`,
      })),
      ...customers.map((customer) => ({
        type: "Customer",
        title: customer.name,
        subtitle: customer.email,
        href: `/admin/customers/${customer.id}`,
      })),
      ...categories.map((category) => ({
        type: "Category",
        title: category.name,
        subtitle: category.slug,
        href: "/admin/categories",
      })),
    ].slice(0, 12),
  });
}
