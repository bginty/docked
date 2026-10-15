import sharp from "sharp";
import { communityImageMaxBytes } from "@/core/community-media";
import { avatarRegion } from "@/core/avatar-crop";

export async function encodeCommunityAvatar(input: Buffer, crop: unknown) {
  if (!input.length || input.length > communityImageMaxBytes)
    throw Error("Image byte limit");
  const options = { limitInputPixels: 16_000_000, failOn: "warning" as const };
  const metadata = await sharp(input, options).metadata();
  if (
    !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
    (metadata.pages ?? 1) > 1
  )
    throw Error("Static JPEG, PNG or WebP required");
  const oriented = await sharp(input, options)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const region = avatarRegion(oriented.info.width, oriented.info.height, crop);
  return sharp(oriented.data, options)
    .extract(region)
    .resize(256, 256)
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true });
}

export async function avatarThumbnail(input: Buffer) {
  return sharp(input, { limitInputPixels: 16_000_000, failOn: "warning" })
    .rotate()
    .resize(256, 256, { fit: "cover" })
    .webp({ quality: 84 })
    .toBuffer();
}

/** Static import is traced into standalone builds; no dynamically resolved module IDs. */
export async function encodeCommunityImage(input: Buffer) {
  if (!input.length || input.length > communityImageMaxBytes)
    throw new Error("Image byte limit");
  const options = { limitInputPixels: 16_000_000, failOn: "warning" as const };
  const metadata = await sharp(input, options).metadata();
  if (
    !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
    (metadata.pages ?? 1) > 1
  )
    throw new Error("Static raster image required");
  // Default Sharp output strips source metadata; rotate applies orientation first.
  const encoded = await sharp(input, options)
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  if (encoded.data.length > communityImageMaxBytes)
    throw new Error("Encoded image byte limit");
  return encoded;
}
