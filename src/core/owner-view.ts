import { createHash } from "node:crypto";

// A preference associated with one verified login. It grants no authority.
export const ownerViewCookie = "docked-owner-customer-view";
export function ownerViewBinding(userId: string, sessionId: string) {
  return createHash("sha256")
    .update(userId + ":" + sessionId)
    .digest("hex");
}
export function activeOwnerCustomerView(
  publicMode: boolean,
  retained: boolean,
  aal: string,
  binding: string,
  preference?: string,
) {
  return publicMode && retained && aal === "aal2" && preference === binding;
}
