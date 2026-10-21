import { createRoot } from "react-dom/client";
import { CollectibleFace } from "../../src/components/collectible-face";
const examples = [
  { sport: "afl", city: "Melbourne", position: "MID" },
  { sport: "nrl", city: "Sydney", position: "HLF" },
  { sport: "basketball", city: "Boston", position: "PG" },
  { sport: "football", city: "London", position: "MID" },
];
createRoot(document.getElementById("fixture-root")!).render(
  <main style={{ padding: 16 }}>
    <h1>Fictional QA · City and colour rendering</h1>
    <p>Renderer verification only. No real players or member cards.</p>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
        gap: 24,
      }}
    >
      {examples.map((example) => (
        <section key={example.sport} data-sport={example.sport}>
          <h2>{example.sport}</h2>
          <div
            style={{
              width: "100%",
              maxWidth: 260,
              margin: "auto",
              aspectRatio: "2 / 3",
            }}
          >
            <CollectibleFace
              card={{
                ...example,
                name: "Fictional QA Player",
                team: "qa-only",
                colour: "#123456",
                accentColour: "#ffcc00",
                verifiedJerseyNumber: 7,
                tier: "RARE",
                serial: 1,
                max_supply: 1000,
              }}
            />
          </div>
        </section>
      ))}
    </div>
  </main>,
);
