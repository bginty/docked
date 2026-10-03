import type { MetadataRoute } from "next";
import { brand } from "@/brand/brand";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: `Docked — ${brand.tagline}`,
    short_name: "Docked",
    description:
      "Sports discussion and transparent verified records. No guaranteed returns.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: brand.colors.navy,
    theme_color: brand.colors.navy,
    lang: "en",
    icons: [
      {
        src: "/icons/docked-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/docked-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/docked-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
