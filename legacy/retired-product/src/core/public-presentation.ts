import { boardState, type GateState } from "./policy";

export function headerAccountLabel(environment: {
  production: boolean;
  registrationAvailable: boolean;
}) {
  return environment.production && !environment.registrationAvailable
    ? "Accounts"
    : "Join free";
}

/** Fresh derived status, not the original publication status, governs the teaser. */
export function activeHomepageTips<
  T extends { display_status: string; start_at: Date | string },
>(tips: T[], now = Date.now()) {
  return tips.filter(
    (tip) =>
      tip.display_status === "active" &&
      new Date(tip.start_at).getTime() > now + 600_000,
  );
}

/** An anonymous visitor has no known jurisdiction; do not label them restricted. */
export function publicBoardState(gates: GateState, authenticated: boolean) {
  const state = boardState({
    ...gates,
    region: authenticated ? gates.region : true,
  });
  if (!authenticated && state.code === "no_edge")
    return {
      code: "sign_in_required",
      title: "Sign in to view eligible Edges",
      detail:
        "Account and country/state permissions are checked before current actionable prices are shown. Research and completed public records remain separate.",
    };
  return state;
}
