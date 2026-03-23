import { setDesiredRelays } from "@/lib/device-state";
import { requireAdminAuth } from "@/lib/auth";
import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/http";
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

  if (!state.ok) {
    return errorResponse(409, state.message);
  }

  return jsonResponse<RelayAllResponse>({
    success: true,
    relay26: state.resolved.relay26,
    relay27: state.resolved.relay27,
    updatedAt: state.resolved.updatedAt,
    relay26Source: state.resolved.relay26Source,
    relay27Source: state.resolved.relay27Source,
    relay26OverrideUntil: state.resolved.relay26OverrideUntil,
    relay27OverrideUntil: state.resolved.relay27OverrideUntil,
  });
}
