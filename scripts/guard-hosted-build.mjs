// Fail before compilation if the platform ever auto-selects a production target.
// Local builds use npm run build directly; this guard is only Vercel's entrypoint.
if (
  process.env.VERCEL !== "1" ||
  process.env.VERCEL_ENV !== "preview" ||
  process.env.APP_ENV !== "preview" ||
  process.env.SUPABASE_ENV !== "preview" ||
  process.env.DOCKED_HOSTED_PREVIEW !== "true"
) {
  console.error("Docked Preview refuses non-preview platform builds.");
  process.exit(1);
}
