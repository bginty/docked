import { ApiForm, Field } from "../../src/components/forms";

/** Actual shared form, independently of a deployment's account availability. */
export function AuthFormHydrationView() {
  return (
    <>
      <h1>Isolated account form security</h1>
      <p>Fictional credentials only. All requests are intercepted locally.</p>
      <ApiForm endpoint="/api/auth" action="login" submit="Log in">
        <Field label="Email address" name="email" type="email" required />
        <Field label="Password" name="password" type="password" required />
      </ApiForm>
    </>
  );
}
