import { getAdminSecret, getDeviceSecret } from "@/lib/env";
import { errorResponse } from "@/lib/http";

type AuthResult = { ok: true } | { ok: false; response: ReturnType<typeof errorResponse> };

function missingSecretResponse(name: string) {
  return errorResponse(
    500,
    `${name} is not configured on the server. Add it to your environment variables.`,
  );
}

export function requireDeviceAuth(token: string): AuthResult {
  const expected = getDeviceSecret();

  if (!expected) {
    return {
      ok: false,
      response: missingSecretResponse("DEVICE_SECRET"),
    };
  }

  if (token !== expected) {
    return {
      ok: false,
      response: errorResponse(401, "Invalid device token."),
    };
  }

  return { ok: true };
}

export function requireAdminAuth(token: string): AuthResult {
  const expected = getAdminSecret();

  if (!expected) {
    return {
      ok: false,
      response: missingSecretResponse("ADMIN_SECRET"),
    };
  }

  if (token !== expected) {
    return {
      ok: false,
      response: errorResponse(401, "Invalid admin token."),
    };
  }

  return { ok: true };
}
