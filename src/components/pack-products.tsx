import Link from "next/link";
export function PackProducts() {
  return (
    <section className="fantasy-section" aria-label="Docked packs">
      <h2>Docked packs</h2>
      <p>
        Standard and Premium test packs each contain nine NFL cards. Purchases
        use Docked Credits only.
      </p>
      <p>
        Real-money purchases are unavailable. Free starter packs and existing
        entitlements keep their original terms.
      </p>
      <Link className="fantasy-button" href="/fantasy/test-wallet">
        Explore test packs
      </Link>
      <p>
        Scoring follows each competition’s published rules. Salary Cap budgets
        are separate from your wallet.
      </p>
    </section>
  );
}
