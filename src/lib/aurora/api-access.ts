import "server-only";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { currentAuroraAccess } from "./access";

export async function authorizeAuroraApi() {
  const session = await getSession();
  const access = currentAuroraAccess(session);
  if (!access.ok)
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Aurora pilot access is unavailable.", code: access.code },
        { status: access.status },
      ),
    };
  return { ok: true as const, session: session! };
}
