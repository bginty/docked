import { assertHostedPreview } from "./hosted-preview";

type Dependencies = {
  environment: () => Record<string, string | undefined>;
  eligible: () => Promise<boolean>;
  rate: (key: string, limit: number, seconds: number) => Promise<boolean>;
  defer: (work: () => Promise<void>) => void;
  process: () => Promise<unknown>;
  failure: () => Promise<void>;
};

/** Only the injected in-app batch is executable; no generic job dispatcher. */
export async function schedulePreviewInAppBatch(
  userId: string,
  d: Dependencies,
) {
  const closedPreview = () => {
    const env = d.environment();
    assertHostedPreview(env);
    return env.DOCKED_HOSTED_PREVIEW === "true";
  };
  const failure = async () => {
    try {
      await d.failure();
    } catch {
      /* A maintenance failure cannot fail a saved user action. */
    }
  };
  try {
    if (!closedPreview() || !(await d.eligible())) return;
    if (
      !(await d.rate(`preview:in-app:${userId}`, 1, 10)) ||
      !(await d.rate("preview:in-app:global", 30, 60))
    )
      return;
    d.defer(async () => {
      try {
        // Grants, sessions and environment can change after the response.
        if (closedPreview() && (await d.eligible())) await d.process();
      } catch {
        await failure();
      }
    });
  } catch {
    await failure();
  }
}
