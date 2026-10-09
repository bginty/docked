import { notFound, redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function EdgeAlias({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound();
  redirect(`/tips/${id}`);
}
