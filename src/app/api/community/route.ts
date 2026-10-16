import { NextResponse } from "next/server";
import { socialHub, mutateSocialHub } from "@/server/social-hub";
import { hubAction } from "@/core/social-hub";
import { privateOffers } from "@/server/private-card-offers";
import { CreditsRejected } from "@/server/credits-sandbox-store";
import { z } from "zod";
import { sameOrigin, requireIdentity } from "@/server/auth";
import { requireCommunityAccess } from "@/server/community-policy";
import { rateLimit } from "@/server/db";
import { boundedCommunityBody } from "@/core/community-social";
import { communityUploadMaxBytes } from "@/core/community-media";
import { schedulePreviewNotifications } from "@/server/preview-maintenance";
import {
  communityFeed,
  communityProfile,
  communitySearch,
  communityPost,
  communityMedia,
  ownCommunityMedia,
  mutateCommunity,
  uploadCommunityMedia,
} from "@/server/community-social";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams,
    view = params.get("view") ?? "feed";
  try {
    if (view === "media") {
      const value = await communityMedia(
        params.get("id") ?? "",
        params.get("variant") === "avatar",
      );
      return new NextResponse(new Uint8Array(value.content), {
        headers: {
          "Content-Type": value.mime,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }
    const data =
      view === "offers"
        ? await privateOffers(undefined, {
            q: params.get("q") ?? undefined,
            inventoryPage: params.get("inventoryPage") ?? undefined,
          })
        : view === "hub"
          ? await socialHub(params.get("handle") ?? undefined)
          : view === "profile"
            ? await communityProfile(params.get("handle") ?? undefined, {
                cursor: params.get("cursor") ?? undefined,
                saved: params.get("saved") === "true",
              })
            : view === "search"
              ? await communitySearch(params.get("q") ?? "")
              : view === "post"
                ? await communityPost(params.get("id") ?? "")
                : view === "own_media"
                  ? await ownCommunityMedia()
                  : await communityFeed({
                      tab: z
                        .enum(["for_you", "following", "latest"])
                        .parse(params.get("tab") ?? "latest"),
                      sport: params.get("sport") ?? undefined,
                      cursor: params.get("cursor") ?? undefined,
                      playerId: params.get("player") ?? undefined,
                      communityId: params.has("community")
                        ? z.string().uuid().parse(params.get("community"))
                        : undefined,
                    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Community content is unavailable." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
export async function POST(request: Request) {
  let privateOfferRequest = false;
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  if (!process.env.DATABASE_URL)
    return NextResponse.json(
      { error: "Community preview is not configured." },
      { status: 503 },
    );
  try {
    const who = await requireIdentity();
    await requireCommunityAccess("community_social");
    if (!(await rateLimit(`social:request:${who.user.id}`, 60)))
      return NextResponse.json(
        { error: "Request rate limit" },
        { status: 429 },
      );
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > communityUploadMaxBytes)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const bounded = await boundedCommunityBody(
        request,
        communityUploadMaxBytes,
      );
      const data = await new Response(bounded, {
          headers: { "Content-Type": request.headers.get("content-type")! },
        }).formData(),
        file = data.get("file");
      if (
        !["media_upload", "avatar_upload"].includes(
          String(data.get("action")),
        ) ||
        !(file instanceof File)
      )
        throw new Error("Image required");
      return NextResponse.json(
        await uploadCommunityMedia(
          file,
          String(data.get("alt") ?? ""),
          data.get("action") === "avatar_upload"
            ? JSON.parse(String(data.get("crop")))
            : undefined,
        ),
      );
    }
    if (length > 20000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const bounded = await boundedCommunityBody(request, 20000);
    const input = JSON.parse(new TextDecoder().decode(bounded));
    privateOfferRequest = input.action === "card_offer";
    const result =
      input.action === "card_offer"
        ? await privateOffers({
            request: input.request,
            command: input.command,
          })
        : hubAction.safeParse(input).success
          ? await mutateSocialHub(input)
          : await mutateCommunity(input);
    await schedulePreviewNotifications(who);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          privateOfferRequest && error instanceof CreditsRejected
            ? error.message
            : error instanceof z.ZodError
              ? "Check the form fields and confirmation."
              : "Action could not be completed. Check account eligibility, permissions and current content.",
      },
      {
        status:
          privateOfferRequest &&
          !(error instanceof CreditsRejected) &&
          !(error instanceof z.ZodError)
            ? 503
            : 403,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
