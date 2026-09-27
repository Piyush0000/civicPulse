import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Gate the dashboard. API routes do their own RBAC checks.
export async function proxy(req: NextRequest) {
  const token = req.cookies.get("cp_session")?.value;
  let ok = false;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SECRET_KEY || "dev-secret-change-me-dev-secret-change-me"));
      ok = true;
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
