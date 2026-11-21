import { ownerWithdrawalBank } from "@/server/commercial-withdrawal-service";
import { withdrawalPost } from "@/server/commercial-withdrawal-http";
export const runtime = "nodejs";
export function POST(request: Request) {
  return withdrawalPost(request, ownerWithdrawalBank);
}
