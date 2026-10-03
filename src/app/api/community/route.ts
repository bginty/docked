import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, requireIdentity } from "@/server/auth";
import { requireCommunityAccess } from "@/server/community-policy";
import { rateLimit } from "@/server/db";
import { boundedCommunityBody } from "@/core/community-social";
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
      const value = await communityMedia(params.get("id") ?? "");
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
      view === "profile"
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
    if (length > 6 * 1024 * 1024)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const bounded = await boundedCommunityBody(request, 6 * 1024 * 1024);
      const data = await new Response(bounded, {
          headers: { "Content-Type": request.headers.get("content-type")! },
        }).formData(),
        file = data.get("file");
      if (data.get("action") !== "media_upload" || !(file instanceof File))
        throw new Error("Image required");
      return NextResponse.json(
        await uploadCommunityMedia(file, String(data.get("alt") ?? "")),
      );
    }
    if (length > 20000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const bounded = await boundedCommunityBody(request, 20000);
    return NextResponse.json(
      await mutateCommunity(JSON.parse(new TextDecoder().decode(bounded))),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Check the form fields and confirmation."
            : "Action could not be completed. Check account eligibility, permissions and current content.",
      },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
