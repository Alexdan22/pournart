import { NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/email";

function isAuthorized(request: Request) {
  const configuredSecret = process.env.EMAIL_QUEUE_SECRET?.trim();

  if (!configuredSecret && process.env.NODE_ENV !== "production") {
    return true;
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";

  return Boolean(configuredSecret && token === configuredSecret);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await processEmailQueue();

  return NextResponse.json({ ok: true });
}
