import { recordHeartbeat } from "@/lib/device-state";
import { requireDeviceAuth } from "@/lib/auth";
import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/http";
import { deviceHeartbeatSchema } from "@/lib/schemas";
import { nowIso } from "@/lib/time";
import type { DeviceHeartbeatRequest, DeviceHeartbeatResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await parseJsonBody<DeviceHeartbeatRequest>(
    request,
    deviceHeartbeatSchema,
  );

  if (!parsed.ok) {
    return parsed.response;
  }

  const auth = requireDeviceAuth(parsed.data.token);

  if (!auth.ok) {
    return auth.response;
  }

  const heartbeat = await recordHeartbeat(parsed.data.deviceId, parsed.data.ip);

  if (!heartbeat.ok) {
    return errorResponse(404, heartbeat.message);
  }

  return jsonResponse<DeviceHeartbeatResponse>({
    success: true,
    serverTime: nowIso(),
  });
}
