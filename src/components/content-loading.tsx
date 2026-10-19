export function ContentLoading({
  label = "Loading Docked…",
}: {
  label?: string;
}) {
  return (
    <section className="app-screen-loading" aria-busy="true" aria-label={label}>
      <p role="status">{label}</p>
      <div className="app-skeleton" aria-hidden="true" />
      <div className="app-skeleton" aria-hidden="true" />
      <div className="app-skeleton" aria-hidden="true" />
    </section>
  );
}
