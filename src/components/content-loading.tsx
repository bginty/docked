import { LightSweep } from "./startup-loading";
export function ContentLoading({
  label = "Getting Docked ready…",
}: {
  label?: string;
}) {
  return (
    <LightSweep compact label={label} />
  );
}
