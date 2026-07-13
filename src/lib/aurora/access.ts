export type AuroraAccessSession = Readonly<{ id: string; email: string; role: string }>;

export type AuroraAccessResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: 401 | 403 | 404; readonly code: "DISABLED" | "UNAUTHENTICATED" | "NOT_ADMIN" | "NOT_ALLOWLISTED" };

export function parseAuroraAllowlist(value: string | undefined): ReadonlySet<string> {
  return new Set((value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
}

export function evaluateAuroraAccess(input: { enabled: boolean; allowlist: ReadonlySet<string>; session: AuroraAccessSession | null }): AuroraAccessResult {
  if (!input.enabled) return { ok: false, status: 404, code: "DISABLED" };
  if (!input.session) return { ok: false, status: 401, code: "UNAUTHENTICATED" };
  if (input.session.role !== "ADMIN") return { ok: false, status: 403, code: "NOT_ADMIN" };
  if (!input.allowlist.has(input.session.id.toLowerCase()) && !input.allowlist.has(input.session.email.toLowerCase()))
    return { ok: false, status: 403, code: "NOT_ALLOWLISTED" };
  return { ok: true };
}

export function currentAuroraAccess(session: AuroraAccessSession | null): AuroraAccessResult {
  return evaluateAuroraAccess({
    enabled: process.env.AURORA_PILOT_ENABLED === "true",
    allowlist: parseAuroraAllowlist(process.env.AURORA_PILOT_ADMIN_ALLOWLIST),
    session,
  });
}
