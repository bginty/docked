// Production-only, provider-independent core. Never logs payloads or credentials.
export const projectUrl = "https://pojoymtniryarxxunyvz.supabase.co";
const sender = "support@docked.com.au";
const origins = [
  "https://docked-production.netlify.app",
  "https://docked.com.au",
];
const callbacks = new Set(
  origins.flatMap((origin) =>
    [
      "",
      "?next=/app/verified",
      "?next=/reset-password",
      "?next=/app/reset-password",
    ].map((query) => origin + "/auth/callback" + query),
  ),
);
const guid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const bytes = new TextEncoder();
const b64url = (value) =>
  btoa(String.fromCharCode(...new Uint8Array(value)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
function pem(value, label) {
  const match =
    typeof value === "string" &&
    value.match(
      new RegExp(
        `^\\s*-----BEGIN ${label}-----([A-Za-z0-9+/=\\r\\n]+)-----END ${label}-----\\s*$`,
      ),
    );
  if (!match) throw Error("Credential configuration invalid");
  return Uint8Array.from(atob(match[1].replace(/\s/g, "")), (c) =>
    c.charCodeAt(0),
  );
}
function email(value) {
  if (
    typeof value !== "string" ||
    value.length > 254 ||
    !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value)
  )
    throw Error("Invalid recipient");
  return value;
}
function hash(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{20,256}$/.test(value))
    throw Error("Invalid token hash");
  return value;
}
export function productionRecipientAllowed(address, env) {
  if (typeof address !== "string") return false;
  if (env.DOCKED_GRAPH_RECIPIENT_MODE === "support-test")
    return address.toLowerCase() === sender;
  if (env.DOCKED_GRAPH_RECIPIENT_MODE !== "approved-beta") return false;
  const recipients = (env.DOCKED_GRAPH_BETA_RECIPIENTS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase());
  if (
    recipients.length < 1 ||
    recipients.length > 11 ||
    new Set(recipients).size !== recipients.length
  )
    return false;
  try {
    recipients.forEach(email);
  } catch {
    return false;
  }
  return recipients.includes(address.toLowerCase());
}
/** @param {any} payload @param {{allowInvites?: boolean, betaOrigin?: string}} [options] */
export function messagesFor(
  payload,
  { allowInvites = false, betaOrigin = undefined } = {},
) {
  const allowedOrigins = [...origins];
  const allowedCallbacks = new Set(callbacks);
  if (betaOrigin !== undefined) {
    if (
      typeof betaOrigin !== "string" ||
      !/^https:\/\/docked-production-[a-z0-9-]+\.vercel\.app$/.test(betaOrigin)
    )
      throw Error("Unapproved beta Auth origin");
    allowedOrigins.push(betaOrigin);
    for (const suffix of [
      "",
      "?next=/app/verified",
      "?next=/reset-password",
      "?next=/app/reset-password",
    ])
      allowedCallbacks.add(betaOrigin + "/auth/callback" + suffix);
  }
  const { user, email_data: data } = payload ?? {};
  if (!user || !data)
    throw Object.assign(Error("Unapproved Auth origin or callback"), {
      code: "payload_shape",
    });
  // GoTrue uses its Auth service external URL in this signed payload field.
  // Keep the project exact and validate the website callback independently.
  const serviceSite = new Set([
    projectUrl,
    projectUrl + "/",
    projectUrl + "/auth/v1",
    projectUrl + "/auth/v1/",
  ]).has(data.site_url);
  if (!serviceSite && !allowedOrigins.includes(data.site_url))
    throw Object.assign(Error("Unapproved Auth origin or callback"), {
      code: "site_origin",
    });
  if (!allowedCallbacks.has(data.redirect_to))
    throw Object.assign(Error("Unapproved Auth origin or callback"), {
      code: "callback",
    });
  if (betaOrigin && new URL(data.redirect_to).origin !== betaOrigin)
    throw Object.assign(Error("Unapproved Auth origin or callback"), {
      code: "callback",
    });
  const current = email(user.email);
  const action = data.email_action_type;
  if (
    action === "invite" &&
    !serviceSite &&
    new URL(data.redirect_to).origin !== data.site_url
  )
    throw Error("Invitation origin must match Auth site origin");
  const subjects = {
    signup: "Verify your Docked email",
    recovery: "Reset your Docked password",
    magiclink: "Sign in to Docked",
    email_change: "Confirm your Docked email change",
    ...(allowInvites ? { invite: "Your Docked invitation" } : {}),
  };
  if (typeof action !== "string" || !Object.hasOwn(subjects, action))
    throw Error("Unsupported Auth email action");
  let recipients;
  if (action === "email_change") {
    // Secure email change requires both confirmations. Supabase hash names are reversed.
    recipients = [
      [current, hash(data.token_hash_new)],
      [email(user.new_email), hash(data.token_hash)],
    ];
  } else recipients = [[current, hash(data.token_hash)]];
  return recipients.map(([address, token]) => {
    // Admin invitations do not have a PKCE verifier. Use the dedicated POST
    // confirmation flow, gated separately until hosted acceptance passes.
    const url = new URL(
      action === "invite"
        ? new URL(data.redirect_to).origin + "/auth/invite"
        : projectUrl + "/auth/v1/verify",
    );
    url.searchParams.set(action === "invite" ? "token_hash" : "token", token);
    url.searchParams.set("type", action);
    if (action !== "invite")
      url.searchParams.set("redirect_to", data.redirect_to);
    return {
      subject: subjects[action],
      body: {
        contentType: "Text",
        content: `${subjects[action]}\n\nOpen this one-time link to continue:\n${url.href}\n\nIf you did not request this, ignore this email. Never share the link.\n\nDocked — Ginty United Investments Pty Ltd\nABN 78 606 187 106\nSupport and privacy: ${sender}`,
      },
      toRecipients: [{ emailAddress: { address } }],
    };
  });
}
export async function graphAssertion(env, now = Date.now()) {
  if (
    !guid.test(env.GRAPH_TENANT_ID ?? "") ||
    !guid.test(env.GRAPH_CLIENT_ID ?? "")
  )
    throw Error("Graph identity not configured");
  const endpoint = `https://login.microsoftonline.com/${env.GRAPH_TENANT_ID}/oauth2/v2.0/token`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pem(env.GRAPH_PRIVATE_KEY_PEM, "PRIVATE KEY"),
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["sign"],
  );
  if (key.algorithm.modulusLength < 2048) throw Error("RSA key too small");
  const thumbprint = b64url(
    await crypto.subtle.digest(
      "SHA-256",
      pem(env.GRAPH_CERTIFICATE_PEM, "CERTIFICATE"),
    ),
  );
  const timestamp = Math.floor(now / 1000);
  const header = b64url(
    bytes.encode(
      JSON.stringify({ alg: "PS256", typ: "JWT", "x5t#S256": thumbprint }),
    ),
  );
  const claims = b64url(
    bytes.encode(
      JSON.stringify({
        aud: endpoint,
        iss: env.GRAPH_CLIENT_ID,
        sub: env.GRAPH_CLIENT_ID,
        jti: crypto.randomUUID(),
        iat: timestamp,
        nbf: timestamp - 30,
        exp: timestamp + 300,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    key,
    bytes.encode(unsigned),
  );
  return { endpoint, assertion: `${unsigned}.${b64url(signature)}` };
}
export async function sendGraph(messages, env, fetcher = fetch) {
  if (
    env.SUPABASE_URL !== projectUrl ||
    env.DOCKED_GRAPH_MAIL_ENABLED !== "true"
  )
    throw Error("Production mail is not enabled");
  const signal = AbortSignal.timeout(4000);
  const { endpoint, assertion } = await graphAssertion(env);
  const response = await fetcher(endpoint, {
    method: "POST",
    redirect: "error",
    signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GRAPH_CLIENT_ID,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
    }),
  });
  if (!response.ok) throw Error("Graph authorization failed");
  const token = await response.json();
  if (
    typeof token.access_token !== "string" ||
    token.token_type?.toLowerCase() !== "bearer"
  )
    throw Error("Graph authorization failed");
  for (const message of messages) {
    const sent = await fetcher(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
      {
        method: "POST",
        redirect: "error",
        signal,
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, saveToSentItems: true }),
      },
    );
    if (sent.status !== 202) throw Error("Graph submission not accepted");
  }
  // 202 acknowledges submission only; inbox delivery must be verified separately.
}
export function emailHandler({
  verify,
  send,
  prepare = messagesFor,
  includeResult = false,
}) {
  return async (request) => {
    const respond = (status, message) =>
      Response.json(message ? { error: { http_code: status, message } } : {}, {
        status,
        headers: { "Cache-Control": "no-store" },
      });
    if (request.method !== "POST") return respond(405, "Method not allowed");
    if (!request.body) return respond(400, "Request body required");
    const reader = request.body.getReader();
    const parts = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 32768) {
          await reader.cancel();
          return respond(413, "Request too large");
        }
        parts.push(value);
      }
    } catch {
      return respond(400, "Invalid request body");
    }
    const all = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      all.set(part, offset);
      offset += part.length;
    }
    let payload;
    try {
      const body = new TextDecoder("utf-8", { fatal: true }).decode(all);
      await verify(body, Object.fromEntries(request.headers));
      payload = JSON.parse(body);
    } catch {
      return respond(401, "Webhook verification failed");
    }
    let messages;
    try {
      messages = prepare(payload);
    } catch (error) {
      // Fixed diagnostic vocabulary only: never log payloads, URLs, tokens,
      // recipient values or arbitrary exception messages.
      const known = new Set(["payload_shape", "site_origin", "callback"]);
      const reason = known.has(error?.code)
        ? error.code
        : error?.message === "Unsupported Auth email action"
          ? "action"
          : error?.message === "Invalid token hash"
            ? "token_shape"
            : error?.message === "Invalid recipient"
              ? "recipient_shape"
              : "validation";
      console.warn("docked_auth_email_prepare_rejected:" + reason);
      return respond(400, "Unsupported authentication email");
    }
    try {
      const result = await send(messages);
      if (includeResult)
        return Response.json(result, {
          headers: { "Cache-Control": "no-store" },
        });
    } catch {
      return respond(503, "Authentication email submission unavailable");
    }
    return respond(200);
  };
}
