export function LedgerChart({
  curve,
}: {
  curve: { date: string; units: string }[];
}) {
  if (!curve.length)
    return (
      <div className="chart-empty">
        Cumulative units will appear when a settled live record exists.
      </div>
    );
  const values = [0, ...curve.map((p) => Number(p.units))],
    low = Math.min(...values),
    high = Math.max(...values),
    span = high - low || 1;
  const y = (v: number) => 170 - ((v - low) / span) * 140;
  const points = values
    .map((v, i) => `${40 + (i / (values.length - 1)) * 720},${y(v)}`)
    .join(" ");
  return (
    <figure>
      <figcaption>
        Cumulative net units · complete filtered settled record
      </figcaption>
      <svg
        role="img"
        aria-label={`Cumulative units from zero to ${values.at(-1)}. Minimum ${low}; maximum ${high}.`}
        viewBox="0 0 800 200"
        style={{ width: "100%", maxHeight: 280 }}
      >
        <line
          x1="40"
          y1={y(0)}
          x2="760"
          y2={y(0)}
          stroke="var(--border-control)"
          strokeDasharray="4 4"
        />
        <polyline
          points={points}
          fill="none"
          stroke="var(--brand-blue)"
          strokeWidth="2.5"
        />
        <text x="0" y="25" fill="var(--muted)" fontSize="12">
          {high.toFixed(2)}
        </text>
        <text x="0" y="175" fill="var(--muted)" fontSize="12">
          {low.toFixed(2)}
        </text>
      </svg>
    </figure>
  );
}
