import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAuroraApi } from "@/lib/aurora/api-access";
import { getLatestProductIntelligence } from "@/lib/aurora/adapter";
import { resolveAuroraBinding } from "@/lib/aurora/bindings";
import { auroraInitialization } from "@/lib/aurora/runtime";
import { prisma } from "@/lib/db";

const idSchema = z.string().trim().min(1).max(128);

export async function GET(_request: Request, context: { params: Promise<{ productId: string }> }) {
  const access = await authorizeAuroraApi();
  if (!access.ok) return access.response;
  const parsed = idSchema.safeParse((await context.params).productId);
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: "Invalid product ID." }, { status: 400 });
  const product = await prisma.product.findUnique({
    where: { id: parsed.data },
    select: { id: true, slug: true, name: true },
  });
  if (!product)
    return NextResponse.json({ ok: false, state: "missing-product", error: "Product not found." }, { status: 404 });
  const binding = resolveAuroraBinding(product);
  const latest = getLatestProductIntelligence(product.id);
  return NextResponse.json({
    ok: true,
    product,
    binding,
    health: auroraInitialization.health,
    latest: latest ?? null,
  });
}
