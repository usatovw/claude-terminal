import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  const { pathname } = request.nextUrl;

  // Intercept *.md URLs → redirect to dashboard with file param
  if (pathname.endsWith(".md") && !pathname.startsWith("/api/") && !pathname.startsWith("/dashboard") && !pathname.startsWith("/_next/")) {
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    const filePath = pathname.replace(/^\/+/, "");
    const url = new URL("/dashboard", request.url);
    url.searchParams.set("file", filePath);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/:path*.md"],
};
