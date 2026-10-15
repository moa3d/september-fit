import type { NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

function upstreamBase() {
  const value =
    process.env.API_PROXY_TARGET ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3000/v1";

  return value.replace(/\/+$/, "");
}

async function proxy(
  request: NextRequest,
  context: RouteContext,
) {
  const { path } = await context.params;
  const suffix = path.map(encodeURIComponent).join("/");
  const target =
    `${upstreamBase()}/${suffix}${request.nextUrl.search}`;

  const headers = new Headers();

  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();

    if (
      lower === "host" ||
      lower === "connection" ||
      lower === "content-length"
    ) {
      continue;
    }

    headers.set(key, value);
  }

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    const responseHeaders = new Headers();

    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      responseHeaders.set("content-type", contentType);
    }

    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) {
      responseHeaders.set("cache-control", cacheControl);
    }

    const requestId = upstream.headers.get("x-request-id");
    if (requestId) {
      responseHeaders.set("x-request-id", requestId);
    }

    // Critical: the browser now receives this cookie from the dashboard
    // origin, so it is no longer treated as a third-party API cookie.
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) {
      responseHeaders.set("set-cookie", setCookie);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Dashboard API proxy failed", error);

    return Response.json(
      {
        message: "Dashboard API proxy unavailable.",
      },
      {
        status: 502,
      },
    );
  }
}

export const dynamic = "force-dynamic";

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
};
