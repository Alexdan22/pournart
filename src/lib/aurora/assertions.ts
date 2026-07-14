import type { RuntimeExplicitReference } from "@aurora/sdk";
import type { AuroraProductBinding } from "./bindings";
import type { AuroraCatalogProduct } from "./types";
import { buildEvaluationContextIdentity } from "./identity";

type CatalogCheck = Readonly<{ complete: boolean; leadTimeValid: boolean; customizationSchemaValid: boolean }>;

export function inspectCatalogProduct(product: AuroraCatalogProduct): CatalogCheck {
  const leadTimeValid =
    Number.isInteger(product.handmadeDaysMin) &&
    Number.isInteger(product.handmadeDaysMax) &&
    product.handmadeDaysMin >= 0 &&
    product.handmadeDaysMax >= product.handmadeDaysMin;
  const customizationSchemaValid = validCustomizationSchema(product.customizationFields);
  return {
    leadTimeValid,
    customizationSchemaValid,
    complete: Boolean(
      product.categoryId.trim() &&
        product.description.trim() &&
        product.story.trim() &&
        product.imageUrl.trim() &&
        leadTimeValid &&
        customizationSchemaValid,
    ),
  };
}

export function buildAuroraExplicitReferences(
  product: AuroraCatalogProduct,
  binding: AuroraProductBinding,
): readonly RuntimeExplicitReference[] {
  const check = inspectCatalogProduct(product);
  const relevantInputFingerprint = buildEvaluationContextIdentity(product, binding).relevantInputFingerprint;
  const ids: string[] = [];
  if (product.adminStatus === "PUBLISHED") ids.push("catalog.product.published");
  if (product.isActive && product.archivedAt === null) ids.push("catalog.product.active");
  if (product.inventory > 0) ids.push("catalog.inventory.available");
  if (check.leadTimeValid) ids.push("catalog.lead-time.valid");
  if (check.customizationSchemaValid) ids.push("catalog.customization-schema.valid");
  ids.push(check.complete ? "catalog.information.complete" : "catalog.information.incomplete");

  const catalogReferences = ids.map((id) => ({
    kind: "domain-concept" as const,
    id,
    sourceKind: "pour-n-art-product",
    sourceId: product.id,
    sourceVersion: relevantInputFingerprint,
    fieldPath: catalogFieldPath(id),
    sourceValue: true,
  }));
  const approvedReferences = binding.approvedExplicitFacts.map((id) => ({
    kind: "domain-concept" as const,
    id,
    sourceKind: "pour-n-art-binding",
    sourceId: binding.bindingId,
    fieldPath: `approvedExplicitFacts.${id}`,
    sourceValue: true,
  }));
  return Object.freeze(
    [...catalogReferences, ...approvedReferences].map((item) => Object.freeze(item)),
  ) as readonly RuntimeExplicitReference[];
}

function catalogFieldPath(id: string) {
  const paths: Record<string, string> = {
    "catalog.product.published": "adminStatus",
    "catalog.product.active": "isActive|archivedAt",
    "catalog.inventory.available": "inventory",
    "catalog.lead-time.valid": "handmadeDaysMin|handmadeDaysMax",
    "catalog.customization-schema.valid": "customizationFields",
    "catalog.information.complete": "catalogCompleteness",
    "catalog.information.incomplete": "catalogCompleteness",
  };
  return paths[id] ?? "catalog";
}

function validCustomizationSchema(value: string) {
  try {
    const fields = JSON.parse(value) as unknown;
    return (
      Array.isArray(fields) &&
      fields.every(
        (field) =>
          typeof field === "object" &&
          field !== null &&
          typeof (field as Record<string, unknown>).name === "string" &&
          typeof (field as Record<string, unknown>).label === "string" &&
          ["text", "textarea", "select"].includes(String((field as Record<string, unknown>).type)),
      )
    );
  } catch {
    return false;
  }
}
