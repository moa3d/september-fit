import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
      ...[
        "/accept-invite",
        "/reset-password",
        "/verify-email",
      ].map((source) => ({
        source,
        headers: [
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
        ],
      })),
    ];
  },
};

export default nextConfig;
