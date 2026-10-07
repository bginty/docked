import { fantasyAssets } from "@/brand/fantasy-assets";
export default function Loading() {
  return (
    <section className="fantasy-gate" aria-busy="true">
      <img
        src={fantasyAssets.splash}
        width={768}
        height={524}
        alt="Docked. Collect. Build. Compete."
      />
      <p>Loading your collection…</p>
    </section>
  );
}
