import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      ...(process.env.APP_ENV === "production"
        ? {
            allow: "/",
            disallow: [
              "/admin",
              "/dashboard",
              "/api/",
              "/demo",
              "/login",
              "/join",
              "/recover",
              "/reset-password",
              "/mfa",
              "/unsubscribe",
              "/auth/",
              "/tips/",
              "/app",
              "/feed",
              "/following",
              "/points",
              "/my-edge",
              "/profile",
              "/compose",
              "/notifications",
              "/search",
              "/community/",
            ],
          }
        : { disallow: "/" }),
    },
    sitemap: `${process.env.SITE_URL ?? "http://localhost:3000"}/sitemap.xml`,
  };
}
