import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
export async function verifySocialAccess(
  contexts: APIRequestContext[],
  code: string,
) {
  const post = async (i: number, data: unknown) => {
    const r = await contexts[i].post("/api/community", { data });
    return { status: r.status(), body: await r.json() };
  };
  const community = {
    action: "community_manage",
    id: randomUUID(),
    name: "QA community " + randomUUID().slice(0, 8),
    description: "Isolated acceptance community",
    rules: "Be respectful. No private member details. QA only.",
    sport: "nfl",
    status: "active",
  };
  assert.notEqual((await post(3, community)).status, 200, "Owner AAL1 denied");
  const mfa = await contexts[3].post("/api/auth", {
    data: { action: "mfa_verify", code, next: "/fantasy/social" },
  });
  assert.equal(mfa.status(), 200, await mfa.text());
  let hub = await contexts[3].get("/api/community?view=hub");
  if (hub.status() !== 200) {
    const profile = await post(3, {
      action: "profile",
      handle: "localowner",
      displayName: "Local QA owner",
      bio: "Local test owner",
      visibility: "members",
    });
    assert.equal(profile.status, 200, JSON.stringify(profile.body));
    hub = await contexts[3].get("/api/community?view=hub");
  }
  assert.equal(hub.status(), 200);
  assert.equal((await hub.json()).canManage, true);
  const made = await post(3, community);
  assert.equal(made.status, 200, JSON.stringify(made.body));
  assert.notEqual(
    (
      await post(1, {
        ...community,
        rules: "Forged ordinary-member edit must fail",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(1, {
        action: "community_join",
        community: community.id,
        enabled: true,
      })
    ).status,
    200,
  );
  const ownResponse = await contexts[1].get("/api/community?view=hub");
  assert.equal(ownResponse.status(), 200);
  const own = await ownResponse.json();
  const card = own.cards[0].card;
  const payload = {
    action: "post",
    kind: "discussion",
    body: "Local player discussion " + randomUUID(),
    sport: "nfl",
    mediaIds: [],
    cardIds: [],
    playerId: card.player_id,
    communityId: community.id,
    idempotencyKey: randomUUID(),
  };
  const discussion = await post(1, payload);
  assert.equal(discussion.status, 200, JSON.stringify(discussion.body));
  assert.notEqual(
    (
      await post(1, {
        ...payload,
        playerId: "nonexistent-player",
        body: "Rejected unknown player",
        idempotencyKey: randomUUID(),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(2, {
        action: "discussion_follow",
        post: discussion.body.id,
        enabled: true,
      })
    ).status,
    200,
  );
  const reply = await post(2, {
    action: "comment",
    postId: discussion.body.id,
    body: "Local discussion reply " + randomUUID(),
    idempotencyKey: randomUUID(),
  });
  assert.equal(reply.status, 200, JSON.stringify(reply.body));
  const feed = await contexts[2].get(
    "/api/community?view=feed&player=" + encodeURIComponent(card.player_id),
  );
  assert.equal(feed.status(), 200);
  assert.ok(
    (await feed.json()).posts.some((p: any) => p.id === discussion.body.id),
  );
  assert.equal((await post(3, { ...community, status: "closed" })).status, 200);
  const closed = await contexts[2].get(
    "/api/community?view=feed&community=" + community.id,
  );
  assert.equal(closed.status(), 200);
  assert.equal((await closed.json()).posts.length, 0);
  assert.notEqual(
    (
      await post(1, {
        ...payload,
        body: "Cannot post in closed community",
        idempotencyKey: randomUUID(),
      })
    ).status,
    200,
  );
  assert.notEqual(
    (await contexts[4].get("/api/community?view=hub")).status(),
    200,
    "Unadmitted identity denied",
  );
  return [
    "Actual owner AAL1 denied; real GoTrue MFA permits community creation/closure; ordinary member cannot manage",
    "Actual catalogue player discussion, follow and reply; unknown player rejected; closed community hidden and rejects new posts",
    "Unadmitted direct collection API denied",
  ];
}
