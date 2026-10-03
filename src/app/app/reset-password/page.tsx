import { AppAuthForm } from "@/components/app-auth-forms";
export default function AppResetPassword() {
  return (
    <>
      <h1>Choose a new password</h1>
      <AppAuthForm mode="reset" />
    </>
  );
}
