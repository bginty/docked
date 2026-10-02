import type { NextConfig } from "next";
const retired = [
  "/shipping-returns.html",
  "/warranty.html",
  "/safety.html",
  "/thank-you.html",
  "/products/cruise-d2",
  "/products/docked-cruise-d2",
  "/cart",
  "/checkout",
];
const config: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  async redirects() {
    return [
      ...retired.map((source) => ({
        source,
        destination: "/legacy-support",
        permanent: true,
      })),
      ...["contact", "privacy", "terms"].map((p) => ({
        source: `/${p}.html`,
        destination: `/${p}`,
        permanent: true,
      })),
      { source: "/index.html", destination: "/", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};
export default config;
