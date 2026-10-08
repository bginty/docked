import { z } from "zod";

const roster = z
  .array(
    z
      .object({
        email: z.string().trim().email().max(254),
        country: z.literal("AU"),
      })
      .strict(),
  )
  .max(10);

/** Preparation only. No tokens, Auth users, roles or mail are created here.
 * Atomic database admission remains a separate mandatory activation gate. */
export function planBetaInvitations(input: unknown) {
  const testers = roster.parse(input).map((row) => ({
    ...row,
    email: row.email.toLowerCase(),
    role: "member" as const,
  }));
  const addresses = testers.map((row) => row.email);
  if (addresses.includes("support@docked.com.au"))
    throw Error("The designated owner is not a tester slot");
  if (new Set(addresses).size !== addresses.length)
    throw Error("Duplicate tester email");
  return {
    status: "prepared-not-authorized-for-sending" as const,
    administratorEmail: "support@docked.com.au",
    maximumInvitedTesters: 10,
    publicRegistration: false,
    testers,
  };
}
