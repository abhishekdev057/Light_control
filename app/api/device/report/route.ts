import { reportAppliedState } from "@/lib/device-state";
import { requireDeviceAuth } from "@/lib/auth";
import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/http";
import { deviceReportSchema } from "@/lib/schemas";
import type { DeviceReportRequest, SuccessResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await parseJsonBody<DeviceReportRequest>(
    request,
    deviceReportSchema,
  );

  if (!parsed.ok) {
    return parsed.response;
  }

  const auth = requireDeviceAuth(parsed.data.token);

  if (!auth.ok) {
    return auth.response;
  }

  const report = await reportAppliedState(
    parsed.data.deviceId,
    parsed.data.relay26,
    parsed.data.relay27,
  );

  if (!report.ok) {
    return errorResponse(404, report.message);
  }

  return jsonResponse<SuccessResponse>({
    success: true,
  });
}
