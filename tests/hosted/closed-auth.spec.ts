import { test } from "@playwright/test";
import { account, check, fixture, login, api, ORIGIN } from "./helpers";
test("closed registration preserves existing login and denies unsupported email changes", async ({
  page,
  request,
}) => {
  await fixture();
  const reserved = await account("memberB");
  const signup = await request.post(`${ORIGIN}/api/auth`, {
    headers: { Origin: ORIGIN },
    data: {
      action: "signup",
      email: reserved.email,
      password: reserved.password,
      country: "AU",
      state: "NSW",
      age: true,
      terms: true,
    },
  });
  check(signup.status() === 503, "closed-capture-rejects-signup-before-auth");
  await login(page, "memberB");
  const unsupported = await api(page, "/api/auth", {
    action: "email_change",
    email: "docked-preview-unapproved@example.invalid",
  });
  check(unsupported.status === 400, "unsupported-email-change-denied");
  check(
    (await api(page, "/api/member")).status === 200,
    "existing-account-retains-private-access",
  );
});
