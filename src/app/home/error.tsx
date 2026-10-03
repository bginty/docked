"use client";
export default function ErrorShell({ reset }: { reset: () => void }) {
  return (
    <div className="community-public">
      <section className="app-empty">
        <h1>Your feed couldn’t load.</h1>
        <p>
          No records or prices have been substituted. Please retry when the
          service is available.
        </p>
        <button className="button" onClick={reset}>
          Try again
        </button>
      </section>
    </div>
  );
}
