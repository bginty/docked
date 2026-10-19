import { AppShell } from "@/components/app-shell";
import { PrizesPage } from "@/components/prizes-page";
import { fantasyRequest } from "@/server/fantasy";
import { memberPrizes } from "@/server/member-release";
import { fantasyPlatformEnabled } from "@/core/fantasy-production";
import { FantasyLoadError } from "@/components/fantasy-load-error";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata = { title: "Prizes" };
export default async function Page() {
  if (!fantasyPlatformEnabled())
    return (
      <AppShell>
        <section className="fantasy-gate">
          <h1>Prizes</h1>
          <p>
            Gameplay is not enabled in this protected Preview. Public
            registration is closed.
          </p>
          <Link className="button" href="/app">
            Account access
          </Link>
        </section>
      </AppShell>
    );
  try {
    const [{ state }, schedules] = await Promise.all([
      fantasyRequest(),
      memberPrizes(),
    ]);
    const competitions = state.competitions
      .filter(
        (c) => c.sport && ["SALARY_CAP", "OPEN"].includes(String(c.rules.mode)),
      )
      .map((c) => ({
        id: c.id,
        name: c.name,
        sport: c.sport!,
        mode: String(c.rules.mode),
        season: c.season,
        week: c.round,
      }));
    return (
      <AppShell authenticated>
        <PrizesPage competitions={competitions} schedules={schedules} />
      </AppShell>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("prizes_screen_unavailable", {
      kind:
        message === "Authentication required"
          ? "authentication"
          : message === "Privileged MFA required"
            ? "mfa"
            : "service",
    });
    return (
      <FantasyLoadError
        authRequired={message === "Authentication required"}
        mfaRequired={message === "Privileged MFA required"}
      />
    );
  }
}
