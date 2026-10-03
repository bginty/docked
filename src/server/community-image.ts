import sharp from "sharp";

/** Static import is traced into standalone builds; no dynamically resolved module IDs. */
export async function encodeCommunityImage(input: Buffer) {
  if (!input.length || input.length > 5 * 1024 * 1024)
    throw new Error("Image byte limit");
  const options = { limitInputPixels: 16_000_000, failOn: "warning" as const };
  const metadata = await sharp(input, options).metadata();
  if (
    !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
    (metadata.pages ?? 1) > 1
  )
    throw new Error("Static raster image required");
  // Default Sharp output strips source metadata; rotate applies orientation first.
  return sharp(input, options)
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
}
