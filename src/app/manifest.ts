import type { MetadataRoute } from "next";
import { brand } from "@/brand/brand";
import { fantasyTagline } from "@/core/fantasy";
import {
  fantasyPlatformEnabled as fantasyEnabled,
  fantasyProductionEnabled,
} from "@/core/fantasy-production";
import { fantasyAssets } from "@/brand/fantasy-assets";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: `Docked — ${fantasyEnabled() ? fantasyTagline : brand.tagline}`,
    short_name: "Docked",
    description: fantasyEnabled()
      ? fantasyProductionEnabled()
        ? "Fantasy Cards. Free Starter packs and daily gameplay rewards."
        : "Fantasy Cards Preview. Test credits only."
      : "Sports discussion and transparent verified records. No guaranteed returns.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: brand.colors.navy,
    theme_color: brand.colors.navy,
    lang: "en",
    icons: [
      {
        src: fantasyEnabled() ? fantasyAssets.icon192 : "/icons/docked-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: fantasyEnabled() ? fantasyAssets.icon512 : "/icons/docked-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: fantasyEnabled()
          ? fantasyAssets.maskable
          : "/icons/docked-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
