import {
  ownerWithdrawalView,
  ownerWithdrawalCommand,
} from "@/server/commercial-withdrawal-service";
import {
  withdrawalGet,
  withdrawalPost,
} from "@/server/commercial-withdrawal-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? undefined;
  return withdrawalGet(() => ownerWithdrawalView({ request: id }));
}
export function POST(request: Request) {
  return withdrawalPost(request, ownerWithdrawalCommand);
}
