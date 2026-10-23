import { redirect } from "next/navigation";
import { packShopHref, packTab } from "@/core/pack-presentation";

export default async function PacksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["packs", "tab"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  redirect(
    packShopHref(
      typeof params.sport === "string" ? params.sport : undefined,
      packTab(query.toString()),
    ),
  );
}
