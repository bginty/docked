import type { CSSProperties } from "react";
/** Shared presentation effect for pack reveals and completed marketplace purchases. */
export function IconCelebration() {
  return (
    <div className="pack-icon-celebration" aria-hidden="true">
      <span className="icon-halo" />
      {[0, 1, 2].map((burst) => (
        <span className={`icon-firework icon-firework-${burst}`} key={burst}>
          {Array.from({ length: 10 }, (_, ray) => (
            <i
              key={ray}
              style={{ "--ray": `${ray * 36}deg` } as CSSProperties}
            />
          ))}
        </span>
      ))}
    </div>
  );
}
