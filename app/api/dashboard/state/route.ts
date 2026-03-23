import { getDashboardState } from "@/lib/device-state";
import { requireAdminAuth } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

function getAdminToken(request: Request) {
  const headerToken = request.headers.get("x-admin-token")?.trim();

  if (headerToken) {
    return headerToken;
  }

  const authHeader = request.headers.get("authorization")?.trim();

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim();
  }

  const url = new URL(request.url);
  return url.searchParams.get("adminToken")?.trim() || "";
}

export async function GET(request: Request) {
  const adminToken = getAdminToken(request);

  if (!adminToken) {
    return errorResponse(401, "Admin token is required.");
  }

  const auth = requireAdminAuth(adminToken);

  if (!auth.ok) {
    return auth.response;
  }

  return jsonResponse(await getDashboardState());
}
