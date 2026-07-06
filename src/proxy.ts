import { NextResponse, type NextRequest } from "next/server";

const canonicalHost = "pournart.in";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase().split(":")[0] ?? "";
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const url = request.nextUrl.clone();
  const shouldCanonicalizeHost = host === "www.pournart.in";
  const shouldForceHttps = forwardedProto === "http";

  if (shouldCanonicalizeHost || shouldForceHttps) {
    url.protocol = "https:";
    url.hostname = canonicalHost;
    url.port = "";

    return NextResponse.redirect(url, 308);
  }

  const response = NextResponse.next();
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|assets|favicon.ico|sitemap.xml|robots.txt).*)"],
};
