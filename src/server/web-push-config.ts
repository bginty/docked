import "server-only";
export function pushConfigured() {
  return (
    process.env.DOCKED_WEB_PUSH_ENABLED === "true" &&
    !!process.env.WEB_PUSH_VAPID_PUBLIC_KEY &&
    !!process.env.WEB_PUSH_VAPID_PRIVATE_KEY &&
    !!process.env.WEB_PUSH_VAPID_SUBJECT &&
    !!process.env.WEB_PUSH_WORKER_DATABASE_URL &&
    !!process.env.CRON_SECRET
  );
}
