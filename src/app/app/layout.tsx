import type { Metadata } from "next";
import { AppAuthShell } from "@/components/app-auth-shell";
export const metadata: Metadata = {
  title: "Docked app",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function AppAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppAuthShell>{children}</AppAuthShell>;
}
