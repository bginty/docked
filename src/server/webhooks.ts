import { Webhook } from "svix";
import { z } from "zod";
export function verifyEmailWebhook(
  body: string,
  headers: Record<string, string>,
  secret: string,
) {
  new Webhook(secret).verify(body, headers);
  return z
    .object({ type: z.string(), data: z.object({ email_id: z.string() }) })
    .parse(JSON.parse(body));
}
