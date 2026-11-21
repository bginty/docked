import {
  memberWithdrawalView,
  memberWithdrawalCommand,
} from "@/server/commercial-withdrawal-service";
import {
  withdrawalGet,
  withdrawalPost,
} from "@/server/commercial-withdrawal-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  return withdrawalGet(memberWithdrawalView);
}
export function POST(request: Request) {
  return withdrawalPost(request, memberWithdrawalCommand);
}
