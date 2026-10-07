"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="fantasy-gate">
      <h1>Preview temporarily unavailable</h1>
      <p>Your saved cards and transactions remain on the server.</p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
