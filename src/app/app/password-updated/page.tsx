import Link from "next/link";
export default function AppPasswordUpdated() {
  return (
    <div className="app-auth-state">
      <h1>Password updated</h1>
      <p>Use your new password the next time you sign in.</p>
      <Link className="button" href="/app">
        Continue to Docked
      </Link>
    </div>
  );
}
