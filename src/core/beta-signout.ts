/** Beta logout revokes only the current provider session. Its DB role deliberately
 * cannot DELETE shared Auth sessions; official sessions must remain untouched. */
export async function signOutBetaSession(auth: {
  signOut(options: { scope: "local" }): Promise<{ error: unknown }>;
}) {
  const { error } = await auth.signOut({ scope: "local" });
  if (error) throw new Error("Beta sign-out could not be confirmed");
}
