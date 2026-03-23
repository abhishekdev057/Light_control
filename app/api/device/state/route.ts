import { getDesiredRelayState } from "@/lib/device-state";
import { requireDeviceAuth } from "@/lib/auth";
import { errorResponse, jsonResponse, parseSearchParams } from "@/lib/http";
import { deviceStateQuerySchema } from "@/lib/schemas";
import type { DeviceStateResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseSearchParams(url.searchParams, deviceStateQuerySchema);

  if (!parsed.ok) {
    return parsed.response;
  }

  const auth = requireDeviceAuth(parsed.data.token);

  if (!auth.ok) {
    return auth.response;
  }

  const desiredState = await getDesiredRelayState(parsed.data.deviceId);

  if (!desiredState.ok) {
    return errorResponse(404, desiredState.message);
  }

  return jsonResponse<DeviceStateResponse>({
    success: true,
    deviceId: desiredState.deviceId,
    relay26: desiredState.relay26,
    relay27: desiredState.relay27,
    updatedAt: desiredState.updatedAt,
  });
}
