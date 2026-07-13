import { NextResponse } from "next/server";
import { authorizeAuroraApi } from "@/lib/aurora/api-access";
import { auroraDeployment, auroraInitialization } from "@/lib/aurora/runtime";

export async function GET() {
  const access = await authorizeAuroraApi();
  if (!access.ok) return access.response;
  return NextResponse.json(
    {
      ok: auroraInitialization.ok,
      health: auroraInitialization.health,
      compatibility: auroraDeployment.compatibility,
    },
    { status: auroraInitialization.ok ? 200 : 503 },
  );
}
