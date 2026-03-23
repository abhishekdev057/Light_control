import { setDesiredRelays } from "@/lib/device-state";
import { requireAdminAuth } from "@/lib/auth";
import { jsonResponse, parseJsonBody } from "@/lib/http";
import { relayAllCommandSchema } from "@/lib/schemas";
import type { RelayAllCommandRequest, RelayAllResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await parseJsonBody<RelayAllCommandRequest>(
    request,
    relayAllCommandSchema,
  );

  if (!parsed.ok) {
    return parsed.response;
  }

  const auth = requireAdminAuth(parsed.data.adminToken);

  if (!auth.ok) {
    return auth.response;
  }

  const state = await setDesiredRelays(parsed.data.relay26, parsed.data.relay27);

  return jsonResponse<RelayAllResponse>({
    success: true,
    relay26: state.desired.relay26,
    relay27: state.desired.relay27,
    updatedAt: state.desired.updatedAt,
  });
}
