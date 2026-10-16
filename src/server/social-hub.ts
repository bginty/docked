import "server-only";
import { withCommunityActor } from "./community-social";
import { socialInventory } from "./social-card-projection";
import { hubAction, collectionAllowed } from "../core/social-hub";
import { z } from "zod";
import { privateOfferEnabled } from "../core/private-card-offers";

export async function socialHub(handle?: string) {
  return withCommunityActor(
    "public_profiles",
    false,
    async (tx, who, profile) => {
      const [target] = handle
        ? await tx`select id,user_id,handle from private.social_profiles where handle=${handle} and private.social_profile_visible(${profile},id,true)`
        : await tx`select id,user_id,handle from private.social_profiles where id=${profile}`;
      if (!target) throw Error("Profile unavailable");
      const own = target.id === profile;
      const [settings] =
        await tx`select * from private.social_collection_settings where profile_id=${target.id}`;
      const following = !!(
        await tx`select 1 from private.social_follows where actor_id=${profile} and target_id=${target.id}`
      ).length;
      const visible = collectionAllowed(
        settings?.visibility ?? "private",
        own,
        following,
        true,
      );
      const inventory = visible
        ? await socialInventory(tx, String(target.user_id))
        : [];
      const communities =
        await tx`select c.id,c.name,c.description,c.rules,c.sport,c.status,
      (select count(*)::int from private.social_community_members m where m.community_id=c.id) members,
      exists(select 1 from private.social_community_members m where m.community_id=c.id and m.profile_id=${profile}) joined
      from private.social_communities c where c.status='active' order by c.created_at desc,c.id limit 50`;
      return {
        own,
        viewer: profile,
        handle: String(target.handle),
        visibility: settings?.visibility ?? "private",
        visible,
        cards: inventory
          .filter(
            (card) =>
              own || settings?.card_preferences?.[card.id]?.hidden !== true,
          )
          .map((card) => ({
            card,
            offers:
              card.offerEligible &&
              !!settings &&
              settings.offers !== "nobody" &&
              (settings.offers !== "followers" || following) &&
              settings.card_preferences[card.id]?.enabled === true &&
              card.tier !== "CORE",
            asking: settings?.card_preferences[card.id]?.asking ?? null,
          })),
        settings: own
          ? {
              visibility: settings?.visibility ?? "private",
              offers: settings?.offers ?? "nobody",
              minimum:
                settings?.minimum_credits === null ||
                settings?.minimum_credits === undefined
                  ? null
                  : Number(settings.minimum_credits),
              muteOffers: settings?.mute_offers ?? false,
              cards: Object.fromEntries(
                Object.entries(settings?.card_preferences ?? {}).filter(
                  ([id]) => inventory.some((c) => c.id === id),
                ),
              ) as Extract<
                z.infer<typeof hubAction>,
                { action: "collection_preferences" }
              >["cards"],
            }
          : null,
        communities,
        canManage:
          who.aal === "aal2" &&
          !!(
            await tx`select 1 from private.roles where user_id=${who.user.id} and role in ('owner','admin')`
          ).length,
        offersLive: privateOfferEnabled(process.env),
        teams: [] as never[],
        teamsMessage:
          "Fantasy teams remain private. Public team sharing is not enabled.",
      };
    },
  );
}
export type SocialHub = Awaited<ReturnType<typeof socialHub>>;

export async function mutateSocialHub(input: unknown) {
  const action = hubAction.parse(input);
  return withCommunityActor(
    "community_social",
    true,
    async (tx, who, profile) => {
      await tx`select pg_advisory_xact_lock(71820342)`;
      if (action.action === "collection_preferences") {
        const [previous] =
          await tx`select visibility from private.social_collection_settings where profile_id=${profile}`;
        if (
          (previous?.visibility ?? "private") === "private" &&
          action.visibility !== "private" &&
          !action.acknowledgeVisibility
        )
          throw Error(
            "Confirm that admitted members may see your collection before sharing it",
          );
        const owned = await socialInventory(tx, who.user.id);
        if (
          Object.keys(action.cards).some(
            (id) => !owned.some((c) => c.id === id),
          )
        )
          throw Error("Card ownership changed");
        await tx`insert into private.social_collection_settings(profile_id,visibility,offers,minimum_credits,card_preferences) values(${profile},${action.visibility},${action.offers},${action.minimum},${tx.json(action.cards)}) on conflict(profile_id) do update set visibility=excluded.visibility,offers=excluded.offers,minimum_credits=excluded.minimum_credits,card_preferences=private.social_collection_settings.card_preferences||excluded.card_preferences,updated_at=clock_timestamp()`;
        await tx`update private.social_collection_settings set mute_offers=${action.muteOffers ?? false},visibility_acknowledged_at=case when ${action.acknowledgeVisibility ?? false} then clock_timestamp() else visibility_acknowledged_at end where profile_id=${profile}`;
      } else if (action.action === "community_manage") {
        if (
          who.aal !== "aal2" ||
          !(
            await tx`select 1 from private.roles where user_id=${who.user.id} and role in ('owner','admin')`
          ).length
        )
          throw Error("Owner/admin MFA required");
        await tx`insert into private.social_communities(id,name,description,rules,sport,status,created_by) values(${action.id},${action.name},${action.description},${action.rules},${action.sport},${action.status},${profile}) on conflict(id) do update set name=excluded.name,description=excluded.description,rules=excluded.rules,sport=excluded.sport,status=excluded.status`;
      } else if (action.action === "community_join") {
        if (
          !(
            await tx`select 1 from private.social_communities where id=${action.community} and status='active'`
          ).length
        )
          throw Error("Community unavailable");
        if (action.enabled)
          await tx`insert into private.social_community_members values(${action.community},${profile},clock_timestamp()) on conflict do nothing`;
        else
          await tx`delete from private.social_community_members where community_id=${action.community} and profile_id=${profile}`;
      } else {
        if (
          !(
            await tx`select 1 from private.social_posts where id=${action.post} and player_id is not null and private.social_post_visible(${profile},id)`
          ).length
        )
          throw Error("Discussion unavailable");
        if (action.enabled)
          await tx`insert into private.social_discussion_follows values(${action.post},${profile}) on conflict do nothing`;
        else
          await tx`delete from private.social_discussion_follows where post_id=${action.post} and profile_id=${profile}`;
      }
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},${action.action},${profile},'{}')`;
      return { ok: true };
    },
    { scope: "social-hub", limit: 30, seconds: 60 },
    true,
  );
}
export const hubHandle = z.string().max(24);
