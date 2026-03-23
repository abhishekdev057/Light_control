import { requireAdminAuth } from "@/lib/auth";
import { setRelaySchedule } from "@/lib/device-state";
import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/http";
import { relayScheduleSchema } from "@/lib/schemas";
import type {
  RelayKey,
  RelayScheduleRequest,
  RelayScheduleResponse,
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
    return errorResponse(404, "Schedule route not found.");
  }

  const parsed = await parseJsonBody<RelayScheduleRequest>(
    request,
    relayScheduleSchema,
  );

  if (!parsed.ok) {
    return parsed.response;
  }

  const auth = requireAdminAuth(parsed.data.adminToken);

  if (!auth.ok) {
    return auth.response;
  }

  const result = await setRelaySchedule(relayKey, {
    enabled: parsed.data.enabled,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    timezone: parsed.data.timezone,
  });

  const schedule =
    relayKey === "relay26"
      ? result.dashboard.relay26Schedule
      : result.dashboard.relay27Schedule;
  const relayState =
    relayKey === "relay26"
      ? result.dashboard.relay26Desired
      : result.dashboard.relay27Desired;

  return jsonResponse<RelayScheduleResponse>({
    success: true,
    relay: relayKey,
    relayState,
    updatedAt: result.dashboard.updatedAt,
    schedule,
  });
}
