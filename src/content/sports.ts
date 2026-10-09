/** Sport choices are not a claim of implemented fantasy scoring for each sport. */
export const sports = [
  {
    slug: "football",
    title: "Football",
  },
  {
    slug: "basketball",
    title: "Basketball",
  },
  {
    slug: "tennis",
    title: "Tennis",
  },
  {
    slug: "nfl",
    title: "American football",
  },
  {
    slug: "horse-racing",
    title: "Horse racing",
  },
  {
    slug: "cricket",
    title: "Cricket",
  },
  {
    slug: "baseball",
    title: "Baseball",
  },
  {
    slug: "ice-hockey",
    title: "Ice hockey",
  },
  {
    slug: "motorsport",
    title: "Motorsport",
  },
  {
    slug: "afl",
    title: "Australian rules",
  },
] as const;
export type SportSlug = (typeof sports)[number]["slug"];
