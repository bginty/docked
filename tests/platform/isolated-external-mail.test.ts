import test from "node:test";
import assert from "node:assert/strict";
import {
  messagesFor,
  isolatedMailContext,
  emailHandler,
  sendGraph,
} from "../../supabase/functions/docked-auth-email/mail.mjs";
const env = {
  SUPABASE_URL: "https://bckkllmndoxzpzdqrevb.supabase.co",
  DOCKED_ISOLATED_EMAIL_ENABLED: "true",
  DOCKED_ISOLATED_EMAIL_UNTIL: new Date(Date.now() + 3600000).toISOString(),
  DOCKED_ISOLATED_EMAIL_ORIGIN:
    "https://docked-preview-s24-briant-ginty.vercel.app",
  DOCKED_ISOLATED_EMAIL_RECIPIENT: "authorised@example.test",
};
const payload = {
  user: { email: env.DOCKED_ISOLATED_EMAIL_RECIPIENT },
  email_data: {
    site_url: env.SUPABASE_URL,
    redirect_to:
      env.DOCKED_ISOLATED_EMAIL_ORIGIN + "/auth/callback?next=/app/verified",
    email_action_type: "signup",
    token_hash: "a".repeat(64),
  },
};
test("shared mail keeps Production pinned; exact Preview requires a separate expiring signed hook", async () => {
  assert.throws(() => messagesFor(payload));
  const messages = messagesFor(payload, { isolatedEnv: env });
  assert.match(messages[0].body.content, /\/auth\/verify\?token_hash=/);
  assert.equal(
    messages[0].toRecipients[0].emailAddress.address,
    env.DOCKED_ISOLATED_EMAIL_RECIPIENT,
  );
  for (const patch of [
    { SUPABASE_URL: "https://pojoymtniryarxxunyvz.supabase.co" },
    { DOCKED_ISOLATED_EMAIL_ENABLED: "false" },
    { DOCKED_ISOLATED_EMAIL_UNTIL: "2000-01-01" },
    { DOCKED_ISOLATED_EMAIL_ORIGIN: "https://docked.com.au" },
  ])
    assert.throws(() => isolatedMailContext({ ...env, ...patch }));
  assert.throws(() =>
    messagesFor(
      { ...payload, user: { email: "stranger@example.test" } },
      { isolatedEnv: env },
    ),
  );
  for (const action of ["invite", "magiclink", "email_change"])
    assert.throws(() =>
      messagesFor(
        {
          ...payload,
          email_data: { ...payload.email_data, email_action_type: action },
        },
        { isolatedEnv: env },
      ),
    );
  let sent = 0;
  const h = emailHandler({
    verify: () => {
      throw Error("unsigned");
    },
    prepare: (p: unknown) => messagesFor(p, { isolatedEnv: env }),
    send: async () => {
      sent++;
    },
  });
  assert.equal(
    (
      await h(
        new Request("https://example.test", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      )
    ).status,
    401,
  );
  assert.equal(sent, 0);
  await assert.rejects(
    sendGraph(
      messages,
      { ...env, DOCKED_GRAPH_MAIL_ENABLED: "false" },
      fetch,
      true,
    ),
  );
  await assert.rejects(
    sendGraph(
      [
        {
          ...messages[0],
          toRecipients: [
            { emailAddress: { address: "stranger@example.test" } },
          ],
        },
      ],
      env,
      fetch,
      true,
    ),
  );
});
