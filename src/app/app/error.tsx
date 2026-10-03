"use client";
export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="app-auth-state">
      <h1>Let’s reconnect</h1>
      <p>Your account could not be checked. Reconnect and try again.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
