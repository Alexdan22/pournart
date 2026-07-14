import type { AuroraIntelligenceResponseDto } from "@aurora/sdk/integration";
import type { AuroraProductBinding } from "./bindings";

export type AuroraCatalogProduct = Readonly<{
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  description: string;
  story: string;
  imageUrl: string;
  inventory: number;
  adminStatus: string;
  isActive: boolean;
  archivedAt: Date | null;
  handmadeDaysMin: number;
  handmadeDaysMax: number;
  customizationFields: string;
  updatedAt: Date;
}>;

export type AuroraInitializationHealth = Readonly<{
  ok: boolean;
  sdkVersion: string;
  sdkSourceCommit: string;
  sdkSha256: string;
  bundleSha256: string;
  projectId: string;
  projectFingerprint?: string;
  issueCodes: readonly string[];
}>;

export type AuroraEvaluationView =
  | Readonly<{ state: "missing-product" | "no-binding" | "stale-binding" | "unsupported-product"; message: string; productId?: string }>
  | Readonly<{ state: "runtime-failure"; message: string; productId: string; health: AuroraInitializationHealth }>
  | Readonly<{ state: "persistence-failure"; message: string; productId: string; issueCode: string }>
  | Readonly<{ state: "idempotency-conflict"; message: string; productId: string; issueCode: "IDEMPOTENCY_CONFLICT" }>
  | Readonly<{ state: "validation-failure"; message: string; productId: string; binding: AuroraProductBinding; response: AuroraIntelligenceResponseDto }>
  | Readonly<{
      state: "success";
      productId: string;
      slug: string;
      productName: string;
      binding: AuroraProductBinding;
      response: AuroraIntelligenceResponseDto;
      health: AuroraInitializationHealth;
      evaluatedAt: string;
      evaluationId?: string;
      requestKey?: string;
      lookupSource?: "process-cache" | "database" | "runtime";
    }>;

export type AuroraCatalogState =
  | "unbound"
  | "ready"
  | "not-evaluated"
  | "success"
  | "blocking"
  | "needs-review"
  | "invalid";
