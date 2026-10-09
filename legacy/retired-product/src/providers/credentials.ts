/** Server callers only. Never include the returned credential in logs or public status. */
export function oddsApiCredential(
  env: Record<string, string | undefined>,
): string | undefined {
  const modern = env.THE_ODDS_API_KEY?.trim(),
    legacy = env.ODDS_API_KEY?.trim();
  if (modern && legacy && modern !== legacy)
    throw new Error(
      "Conflicting The Odds API credentials; select one reviewed configuration",
    );
  return modern || legacy || undefined;
}
