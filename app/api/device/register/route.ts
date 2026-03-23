import {
  registerDevice,
} from "@/lib/device-state";
import { requireDeviceAuth } from "@/lib/auth";
import { jsonResponse, parseJsonBody } from "@/lib/http";
import { deviceRegisterSchema } from "@/lib/schemas";
import type { DeviceRegisterRequest, DeviceRegisterResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await parseJsonBody<DeviceRegisterRequest>(
    request,
    deviceRegisterSchema,
  );

  if (!parsed.ok) {
    return parsed.response;
  }

  const auth = requireDeviceAuth(parsed.data.token);

  if (!auth.ok) {
    return auth.response;
  }

  const state = await registerDevice(parsed.data.deviceId);

  return jsonResponse<DeviceRegisterResponse>({
    success: true,
    deviceId: state.device.deviceId,
  });
}
