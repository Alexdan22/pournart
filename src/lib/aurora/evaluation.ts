import type { AuroraCatalogProduct, AuroraEvaluationView } from "./types";

export async function loadAndEvaluateProduct(
  productId: string,
  load: (id: string) => Promise<AuroraCatalogProduct | null>,
  evaluate: (product: AuroraCatalogProduct) => AuroraEvaluationView,
): Promise<AuroraEvaluationView> {
  const product = await load(productId);
  if (!product) return { state: "missing-product", message: "Product not found.", productId };
  return evaluate(product);
}
