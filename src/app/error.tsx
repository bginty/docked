"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page">
      <h1>Service temporarily unavailable.</h1>
      <p>
        We could not verify the information needed for this page. New
        publication remains paused.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
