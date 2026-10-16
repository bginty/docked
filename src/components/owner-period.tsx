"use client";
export function OwnerPeriod({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => {
        const url = new URL(window.location.href);
        url.searchParams.set("period", event.target.value);
        url.searchParams.delete("start");
        url.searchParams.delete("end");
        window.location.assign(url.pathname + url.search);
      }}
    >
      {!["7", "30", "90", "365"].includes(value) && (
        <option value={value}>Custom period</option>
      )}
      <option value="7">Last 7 days</option>
      <option value="30">Last 30 days</option>
      <option value="90">Last 90 days</option>
      <option value="365">Last 365 days</option>
    </select>
  );
}
