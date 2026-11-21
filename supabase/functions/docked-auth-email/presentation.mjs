// Presentation only. Callers validate the recipient, action and destination first.
const brandOrigin = "https://docked.com.au";
const support = "support@docked.com.au";
const copy = {
  signup: {
    introduction:
      "Confirm your email address to finish setting up your Docked account.",
    button: "Verify email address",
  },
  recovery: {
    introduction:
      "Use the secure link below to choose a new password for your Docked account.",
    button: "Reset password",
  },
  magiclink: {
    introduction:
      "Use the secure link below to sign in to your Docked account.",
    button: "Sign in to Docked",
  },
  email_change: {
    introduction:
      "Confirm this email address to continue changing your Docked sign-in email. For your security, confirmation is required from both email addresses.",
    button: "Confirm email change",
  },
  invite: {
    introduction:
      "You have been invited to Docked. Use the secure link below to accept your invitation.",
    button: "Accept invitation",
  },
};
const entities = {
  "&": "&amp;",
  '"': "&quot;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};
const escapeHtml = (value) =>
  String(value).replace(/[&"'<>]/g, (character) => entities[character]);

/** Render the already-validated URL without changing its path, token or query. */
export function authEmailBody(action, subject, url) {
  if (typeof action !== "string" || !Object.hasOwn(copy, action))
    throw Error("Unsupported Auth email action");
  const { introduction, button } = copy[action];
  const safeUrl = escapeHtml(url);
  const safeSubject = escapeHtml(subject);
  return {
    contentType: "HTML",
    content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${safeSubject}</title>
  <style>@media only screen and (max-width: 480px) { .outer { padding: 16px 8px !important; } .content { padding: 28px 22px !important; } }</style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;color:#0b0f1a;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(introduction)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#f1f5f9;">
    <tr><td class="outer" align="center" style="padding:32px 16px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:separate;border-spacing:0;background-color:#ffffff;border:1px solid #dbe3ee;border-radius:16px;text-align:left;">
        <tr><td style="padding:24px 32px;background-color:#0b0f1a;border-radius:15px 15px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
            <td width="56" style="vertical-align:middle;"><img src="${brandOrigin}/brand/docked/icons/docked-icon-192.png" width="56" height="56" alt="Docked logo" style="display:block;width:56px;height:56px;border:0;border-radius:12px;"></td>
            <td style="padding-left:14px;vertical-align:middle;color:#ffffff;font-size:25px;font-weight:700;letter-spacing:3px;line-height:32px;">DOCKED</td>
          </tr></table>
        </td></tr>
        <tr><td class="content" style="padding:36px 32px;">
          <h1 style="margin:0 0 18px;font-size:28px;line-height:36px;font-weight:700;color:#0b0f1a;">${safeSubject}</h1>
          <p style="margin:0 0 26px;font-size:16px;line-height:26px;color:#475569;">${escapeHtml(introduction)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr><td bgcolor="#1a2aff" style="background-color:#1a2aff;border-radius:8px;text-align:center;">
            <a data-docked-auth-link="true" href="${safeUrl}" style="display:inline-block;padding:14px 22px;border:1px solid #1a2aff;border-radius:8px;color:#ffffff;font-size:16px;font-weight:700;line-height:24px;text-decoration:none;">${escapeHtml(button)}</a>
          </td></tr></table>
          <p style="margin:28px 0 8px;font-size:13px;line-height:21px;color:#475569;">If the button does not work, copy and paste this one-time link into your browser:</p>
          <p style="margin:0 0 24px;font-size:13px;line-height:21px;word-break:break-all;overflow-wrap:anywhere;"><a href="${safeUrl}" style="color:#1749c7;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${safeUrl}</a></p>
          <p style="margin:0 0 28px;font-size:13px;line-height:21px;color:#475569;">If you did not request this, you can ignore this email. Never share this link.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid #dbe3ee;"><tr><td style="padding-top:22px;">
            <p style="margin:0 0 6px;font-size:16px;font-weight:700;line-height:24px;color:#0b0f1a;">The Docked team</p>
            <p style="margin:0;font-size:14px;line-height:23px;"><a href="mailto:${support}" style="color:#1749c7;text-decoration:underline;">${support}</a><br><a href="${brandOrigin}" style="color:#1749c7;text-decoration:underline;">docked.com.au</a></p>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #dbe3ee;background-color:#f8fafc;border-radius:0 0 15px 15px;">
          <p style="margin:0;font-size:12px;line-height:20px;color:#475569;">Docked is operated by Ginty United Investments Pty Ltd · ABN 78 606 187 106</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`,
  };
}

/** Read only our serialized CTA, or the pre-branding plain-text link, for queue identity. */
export function authenticationLink(body) {
  const content = body?.content;
  if (typeof content !== "string") throw Error("Missing authentication link");
  let candidate;
  if (body.contentType?.toLowerCase() === "text") {
    const links = content
      .split("\n")
      .filter((line) => line.startsWith("https://"));
    if (links.length !== 1) throw Error("Missing authentication link");
    candidate = links[0];
  } else if (body.contentType?.toLowerCase() === "html") {
    const links = [
      ...content.matchAll(/<a data-docked-auth-link="true" href="([^"]+)"/g),
    ];
    if (
      links.length !== 1 ||
      content.split("data-docked-auth-link=").length !== 2
    )
      throw Error("Missing authentication link");
    // Generated URLs only need ampersand decoding. A round trip rejects other
    // entities or unescaped markup, instead of interpreting arbitrary HTML.
    candidate = links[0][1].replaceAll("&amp;", "&");
    if (escapeHtml(candidate) !== links[0][1])
      throw Error("Missing authentication link");
  } else throw Error("Missing authentication link");
  const url = new URL(candidate);
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw Error("Missing authentication link");
  return url;
}
