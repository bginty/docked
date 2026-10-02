import type { MetadataRoute } from "next";
import { articles } from "@/content/articles";
export default function sitemap(): MetadataRoute.Sitemap {
  const root = process.env.SITE_URL ?? "http://localhost:3000";
  return [
    "",
    "/learn",
    "/methodology",
    "/research",
    "/results",
    "/about",
    "/contact",
    "/safer-gambling",
    ...articles.map((a) => `/learn/${a.slug}`),
  ].map((p) => ({
    url: root + p,
    changeFrequency: "monthly",
    priority: p ? 0.6 : 1,
  }));
}
