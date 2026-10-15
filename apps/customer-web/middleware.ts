import {
  NextRequest,
  NextResponse,
} from "next/server";

const API_BASE =
  process.env.FIT_API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000/v1";

export async function middleware(
  request: NextRequest,
) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/s/")) {
    return NextResponse.next();
  }

  const token = pathname.split("/s/")[1]?.split("/")[0];
  const parentOrigin =
    request.nextUrl.searchParams.get("parent_origin");

  const response = NextResponse.next();

  response.headers.set(
    "Referrer-Policy",
    "no-referrer",
  );

  if (!token || !parentOrigin) {
    response.headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
    );
    return response;
  }

  try {
    const policy = await fetch(
      `${API_BASE}/public/fit-sessions/${encodeURIComponent(
        token,
      )}/embed-policy?parent_origin=${encodeURIComponent(
        parentOrigin,
      )}`,
      {
        cache: "no-store",
      },
    );

    const body = await policy.json();

    if (policy.ok && body?.allowed && body?.origin) {
      response.headers.set(
        "Content-Security-Policy",
        `frame-ancestors 'self' ${body.origin}; object-src 'none'; base-uri 'self'`,
      );
    } else {
      response.headers.set(
        "Content-Security-Policy",
        "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
      );
    }
  } catch {
    response.headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
    );
  }

  return response;
}

export const config = {
  matcher: ["/s/:path*"],
};
