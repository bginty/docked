import "server-only";
import {
  ingestionHealth,
  type IngestionHealth,
} from "../core/multisport-health";
import { feedRequest } from "./multisport-feed-http";
export async function multisportFeedHealth(): Promise<IngestionHealth> {
  const origin = process.env.DOCKED_MULTI_FEED_ORIGIN,
    key = process.env.DOCKED_MULTI_FEED_ADMIN_KEY;
  if (!origin || !key) return { state: "disabled" };
  try {
    return {
      state: "connected",
      ...ingestionHealth.parse(
        await feedRequest({ origin, key }, "/admin/multisport/status"),
      ),
    };
  } catch {
    return { state: "unavailable" };
  }
}
