"use client";

import Image, { type ImageProps } from "next/image";
import { sportImageLoader } from "@/core/sport-image-loader";

/** The client boundary contains only image props and the compact size registry. */
export function StaticSportImage(props: Omit<ImageProps, "loader">) {
  return <Image {...props} loader={sportImageLoader} />;
}
