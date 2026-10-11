/** Canonical admission codes, shared by the form and server validation. */
export const australianRegions = [
  ["ACT", "Australian Capital Territory"],
  ["NSW", "New South Wales"],
  ["NT", "Northern Territory"],
  ["QLD", "Queensland"],
  ["SA", "South Australia"],
  ["TAS", "Tasmania"],
  ["VIC", "Victoria"],
  ["WA", "Western Australia"],
] as const;

export function australianRegion(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, " ").toUpperCase();
  return (
    australianRegions.find(
      ([code, name]) =>
        code === normalized || name.toUpperCase() === normalized,
    )?.[0] ?? null
  );
}
