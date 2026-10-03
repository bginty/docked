type Environment = Record<string, string | undefined>;

/** Explicit public facts only; missing values are never inferred from the old store. */
export function operatorPresentation(env: Environment = process.env) {
  const name = env.DOCKED_LEGAL_NAME?.trim() || null;
  const abn = env.DOCKED_ABN?.trim() || null;
  const email = env.DOCKED_SUPPORT_EMAIL?.trim() || null;
  let supportUrl: string | null = null;
  try {
    const url = new URL(env.DOCKED_SUPPORT_URL ?? "");
    if (url.protocol === "https:" && !url.username && !url.password)
      supportUrl = url.href;
  } catch {
    /* No fabricated support destination. */
  }
  return {
    legalName: name && name.length <= 200 ? name : null,
    abn: abn && /^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$/.test(abn) ? abn : null,
    supportEmail:
      email &&
      /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) &&
      email.length <= 254
        ? email
        : null,
    supportUrl,
  };
}
