/** Invitation eligibility is checked before Auth. Passwords are used only for
 * first creation, never for recovering an uncertain creation or overwriting an account. */
export async function customerSignup(input, deps) {
  if (
    !input ||
    typeof input.email !== "string" ||
    input.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
    !/^[a-f0-9]{64}$/.test(input.invitation ?? "") ||
    typeof input.password !== "string" ||
    input.password.length < 12 ||
    input.password.length > 128
  )
    throw Error("Invalid signup");
  const email = input.email.trim().toLowerCase();
  const userId = await deps.reserve(email, input.invitation);
  let user = await deps.lookup(userId);
  if (!user) {
    try {
      user = await deps.create(userId, email, input.password);
    } catch {
      user = await deps.lookup(userId);
    }
  }
  if (
    !user ||
    user.id !== userId ||
    user.email?.toLowerCase() !== email ||
    user.is_anonymous
  )
    throw Error("Account creation not confirmed");
  await deps.bind(userId, input.invitation);
  if (user.email_confirmed_at) return { ok: true, redirect: "/app/login" };
  await deps.verify(email);
  return { ok: true, redirect: "/app/check-email?type=verification" };
}
