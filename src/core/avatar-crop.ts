import { z } from "zod";
export const avatarCrop = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    zoom: z.number().min(1).max(3),
  })
  .strict();
export function avatarRegion(width: number, height: number, input: unknown) {
  const crop = avatarCrop.parse(input);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    Math.min(width, height) < 64 ||
    width * height > 16_000_000
  )
    throw Error(
      "Image dimensions must be at least 64 pixels and at most 16 megapixels",
    );
  const side = Math.floor(Math.min(width, height) / crop.zoom);
  return {
    left: Math.round((width - side) * crop.x),
    top: Math.round((height - side) * crop.y),
    width: side,
    height: side,
  };
}
