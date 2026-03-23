import { setDesiredRelay } from "@/lib/device-state";
import { requireAdminAuth } from "@/lib/auth";
import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/http";
import { relayCommandSchema } from "@/lib/schemas";
import type {
  RelayCommandRequest,
  RelaySingleResponse,
  RelayKey,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function resolveRelay(relaySegment: string): RelayKey | null {
  if (relaySegment === "26") {
    return "relay26";
  }

  if (relaySegment === "27") {
    return "relay27";
  }

  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ relay: string }> },
) {
  const { relay } = await context.params;
  const relayKey = resolveRelay(relay);

  if (!relayKey) {
    return errorResponse(404, "Relay route not found.");
  }

  const parsed = await parseJsonBody<RelayCommandRequest>(request, relayCommandSchema);

  if (!parsed.ok) {
    return parsed.response;
  }

  const auth = requireAdminAuth(parsed.data.adminToken);

  if (!auth.ok) {
    return auth.response;
  }

  const state = await setDesiredRelay(relayKey, parsed.data.state);

  return jsonResponse<RelaySingleResponse>({
    success: true,
    ...(relayKey === "relay26"
      ? { relay26: state.resolved.relay26 }
      : { relay27: state.resolved.relay27 }),
    updatedAt: state.resolved.updatedAt,
    source:
      relayKey === "relay26"
        ? state.resolved.relay26Source
        : state.resolved.relay27Source,
    overrideUntil:
      relayKey === "relay26"
        ? state.resolved.relay26OverrideUntil
        : state.resolved.relay27OverrideUntil,
  });
}
