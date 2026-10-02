export const staffRoles = [
  "owner",
  "admin",
  "analyst",
  "editor",
  "auditor",
] as const;
export type StaffRole = (typeof staffRoles)[number];
export const operationRoles = {
  read_operations: [...staffRoles],
  publish: ["owner", "admin", "analyst"],
  edit_article: ["owner", "admin", "editor"],
  strategy_transition: ["owner", "admin"],
  correct_settlement: ["owner", "admin"],
} as const;
export function staffAllowed(
  role: string,
  aal: string,
  operation: keyof typeof operationRoles,
) {
  return (
    aal === "aal2" &&
    (operationRoles[operation] as readonly string[]).includes(role)
  );
}
/** Parse only after the exact token has been verified with Auth.getUser(token). */
export function verifiedSessionClaims(token: string, userId: string) {
  try {
    const claims = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
    if (
      claims.sub !== userId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        claims.session_id ?? "",
      ) ||
      !["aal1", "aal2"].includes(claims.aal)
    )
      return null;
    return {
      sessionId: claims.session_id as string,
      aal: claims.aal as string,
    };
  } catch {
    return null;
  }
}
