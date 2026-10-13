"use client";
import { useEffect, useState } from "react";
export default function Loading() {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 12000);
    return () => clearTimeout(t);
  }, []);
  return (
    <section className="fantasy-gate" aria-busy={!late}>
      <h1>Docked</h1>
      <p role="status">
        {late
          ? "This is taking longer than expected. Check your connection and retry. No purchase or team change is being repeated."
          : "Loading your Docked screen…"}
      </p>
      {late && (
        <>
          <button onClick={() => window.location.reload()}>
            Retry loading
          </button>
          <p>
            <a href="/app/login">Sign in again</a> ·{" "}
            <a href="/fantasy/play">Return to Play</a>
          </p>
        </>
      )}
    </section>
  );
}
