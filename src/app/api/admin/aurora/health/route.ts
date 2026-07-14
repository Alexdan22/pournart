import { NextResponse } from "next/server";
import { authorizeAuroraApi } from "@/lib/aurora/api-access";
import { auroraBindingManifestHealth } from "@/lib/aurora/bindings";
import { buildAuroraHealthContract } from "@/lib/aurora/health-contract";
import { auroraDeployment, auroraInitialization } from "@/lib/aurora/runtime";

export async function GET() {
  const access = await authorizeAuroraApi();
  if (!access.ok) return access.response;
  const contract = buildAuroraHealthContract({
    initialization: auroraInitialization,
    compatibility: auroraDeployment.compatibility,
    bindingManifestHealth: auroraBindingManifestHealth,
  });
  return NextResponse.json(contract.body, { status: contract.status });
}
