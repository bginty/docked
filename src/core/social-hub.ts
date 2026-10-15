import { z } from "zod";
import { safeSocialText } from "./community-social";
export const collectionVisibility = z.enum(["private", "followers", "members"]);
const minimum = z.number().int().min(1).max(1000000000).nullable();
export const cardOfferPreference = z
  .object({ enabled: z.boolean(), minimum, asking: minimum })
  .strict();
export const hubAction = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("collection_preferences"),
      visibility: collectionVisibility,
      offers: z.enum(["nobody", "followers", "everyone"]),
      minimum,
      cards: z
        .record(z.string().max(150), cardOfferPreference)
        .refine((v) => Object.keys(v).length <= 100),
    })
    .strict(),
  z
    .object({
      action: z.literal("community_join"),
      community: z.string().uuid(),
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("community_manage"),
      id: z.string().uuid(),
      name: z.string().trim().min(3).max(80).refine(safeSocialText),
      description: z.string().trim().max(500).refine(safeSocialText),
      rules: z.string().trim().min(10).max(4000).refine(safeSocialText),
      sport: z.enum(["nfl", "football"]).nullable(),
      status: z.enum(["active", "closed"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("discussion_follow"),
      post: z.string().uuid(),
      enabled: z.boolean(),
    })
    .strict(),
]);
export function collectionAllowed(
  visibility: string,
  own: boolean,
  following: boolean,
  visible: boolean,
) {
  return (
    own ||
    (visible &&
      (visibility === "members" || (visibility === "followers" && following)))
  );
}
