import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Gate the two portals. API routes do their own RBAC checks.
export async function proxy(req: NextRequest) {
  const token = req.cookies.get("cp_session")?.value;
  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SECRET_KEY || "dev-secret-change-me-dev-secret-change-me"));
      role = String(payload.role);
    } catch {
      role = null;
    }
  }
  const path = req.nextUrl.pathname;
  const wantsCitizen = path.startsWith("/citizen");
  if (!role) {
    const url = new URL("/login", req.url);
    if (wantsCitizen) url.searchParams.set("portal", "citizen");
    url.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (wantsCitizen && role !== "citizen") return NextResponse.redirect(new URL("/app", req.url));
  if (!wantsCitizen && role === "citizen") return NextResponse.redirect(new URL("/citizen", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/citizen/:path*"] };
