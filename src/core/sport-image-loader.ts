import type { ImageLoaderProps } from "next/image";
import imageSizes from "../content/sport-image-sizes.json";

type RegisteredImage = { width: number; widths: number[] };
const registry: Readonly<Record<string, RegisteredImage>> = imageSizes;
const sportImagePath = /^\/images\/sports\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/;

/** Select a generated local asset; this never invokes the runtime image optimizer. */
export function sportImageLoader({ src, width }: ImageLoaderProps): string {
  if (
    typeof src !== "string" ||
    !sportImagePath.test(src) ||
    !Object.hasOwn(registry, src)
  ) {
    throw new Error("Sport image source must be a registered local asset");
  }
  if (!Number.isSafeInteger(width) || width <= 0) {
    throw new Error("Sport image width must be a positive safe integer");
  }
  const asset = registry[src];
  if (
    !Number.isSafeInteger(asset.width) ||
    asset.width <= 0 ||
    !Array.isArray(asset.widths) ||
    asset.widths.some(
      (size) => !Number.isSafeInteger(size) || size <= 0 || size > asset.width,
    )
  ) {
    throw new Error("Sport image size registration is invalid");
  }
  const available = [...new Set([...asset.widths, asset.width])].sort(
    (a, b) => a - b,
  );
  const selected = available.find((size) => size >= width) ?? asset.width;
  if (selected === asset.width) return src;
  const slug = src.slice("/images/sports/".length, -".webp".length);
  return `/images/sports/responsive/${slug}-${selected}.webp`;
}
