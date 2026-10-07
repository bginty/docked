import { request } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import type { CommunityFeed } from "../src/core/community-social";
const origin = "https://docked-preview-s24-briant-ginty.vercel.app";
async function main() {
  if (process.argv[2] !== "--confirm-preview")
    throw Error("Preview scope required");
  const a = await request.newContext({
    storageState: "private-data/fantasy/browser-0.json",
  });
  const b = await request.newContext({
    storageState: "private-data/fantasy/browser-1.json",
  });
  const checks: string[] = [];
  const post = async (c: typeof a, data: object) =>
    c.post(origin + "/api/community", { data, headers: { Origin: origin } });
  const feed = async (c: typeof a): Promise<CommunityFeed> => {
    const r = await c.get(origin + "/api/community?view=feed&tab=latest");
    assert.equal(r.status(), 200);
    return r.json();
  };
  try {
    const marker = `Preview cross-client social check ${randomUUID().slice(0, 8)}`;
    assert.equal(
      (
        await post(a, {
          action: "post",
          kind: "discussion",
          body: marker,
          idempotencyKey: randomUUID(),
        })
      ).status(),
      200,
    );
    const p = (await feed(b)).posts.find((x) => x.body === marker)!;
    assert.ok(p);
    checks.push("desktop-post-visible-mobile-session");
    assert.equal(
      (
        await post(b, { action: "react", postId: p.id, enabled: true })
      ).status(),
      200,
    );
    assert.equal(
      (
        await post(b, {
          action: "comment",
          postId: p.id,
          body: "Seen from the other Preview client.",
          idempotencyKey: randomUUID(),
        })
      ).status(),
      200,
    );
    const seen = (await feed(a)).posts.find((x) => x.id === p.id)!;
    assert.ok(seen.reactionCount === 1 && seen.commentCount === 1);
    checks.push("mobile-like-comment-visible-desktop-session");
    assert.equal(
      (
        await post(b, {
          action: "follow",
          profileId: p.author.id,
          enabled: true,
          notifications: false,
        })
      ).status(),
      200,
    );
    assert.ok(
      (await feed(b)).posts.find((x) => x.id === p.id)?.author.isFollowing,
    );
    checks.push("shared-follow-state");
    assert.notEqual(
      (await post(b, { action: "delete_post", postId: p.id })).status(),
      200,
    );
    checks.push("other-author-delete-denied");
    await writeFile(
      "docs/qa/fantasy/social-check.json",
      JSON.stringify(
        {
          status: "PASS",
          checks,
          actualAndroid: false,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS: four cross-client social checks using genuine sessions.",
    );
  } finally {
    await a.dispose();
    await b.dispose();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
