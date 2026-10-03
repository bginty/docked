import { z } from "zod";
import { previewCommunityContext } from "./preview-community";
import { protectedIdentity } from "./community-social";
export const previewCapabilities = [
  "community_social",
  "public_profiles",
  "preview_market_fixtures",
  "preview_top_docked",
] as const;
export type PreviewCapability = (typeof previewCapabilities)[number];
export const previewCapabilitySchema = z.enum(previewCapabilities);
export const previewCapabilitySet = z
  .array(previewCapabilitySchema)
  .min(2)
  .max(4)
  .refine(
    (v) =>
      new Set(v).size === v.length &&
      v.includes("community_social") &&
      v.includes("public_profiles"),
  );
export function requirePreviewEnvironment(
  env: Record<string, string | undefined> = process.env,
) {
  if (previewCommunityContext(env) !== "bckkllmndoxzpzdqrevb")
    throw Error("Exact isolated hosted preview required");
}
export const signupUsername = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_]{2,23}$/)
  .refine((v) => !protectedIdentity(v));
export const previewSignupSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
  username: signupUsername,
  invitationCode: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  country: z.string().regex(/^[A-Z]{2}$/),
  state: z.string().trim().min(1).max(50),
  age: z.literal(true),
  terms: z.literal(true),
  privacy: z.literal(true),
  marketing: z.boolean().optional().default(false),
});
export const appOnboardingSchema = z.object({
  sports: z
    .array(
      z.enum([
        "football",
        "basketball",
        "nba",
        "tennis",
        "nfl",
        "horse-racing",
        "racing",
        "cricket",
        "baseball",
        "ice-hockey",
        "motorsport",
        "afl",
      ]),
    )
    .max(10)
    .transform((v) =>
      v.map((s) =>
        s === "nba" ? "basketball" : s === "racing" ? "horse-racing" : s,
      ),
    )
    .refine((v) => new Set(v).size === v.length),
  interests: z.enum(["edges", "community", "both"]),
  officialEdges: z.boolean(),
  followedMembers: z.boolean(),
  replies: z.boolean(),
  timezone: z.string().min(1).max(100),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  state: z.string().trim().min(1).max(50).optional(),
  age: z.boolean().optional(),
  terms: z.boolean().optional(),
  privacy: z.boolean().optional(),
  username: signupUsername.optional(),
});
