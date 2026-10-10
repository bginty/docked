import "server-only";
import { redirect } from "next/navigation";
import { config } from "./config";
import { identity } from "./auth";
export async function appViewer() {
  const c = config();
  const who = c.database && c.auth ? await identity() : null;
  if (who?.mfaRequired && who.aal !== "aal2") redirect("/mfa");
  return {
    configured: c.database && c.auth,
    who,
  };
}
