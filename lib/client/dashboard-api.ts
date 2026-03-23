import type {
  DashboardStateResponse,
  ErrorResponse,
  RelayAllResponse,
  RelaySingleResponse,
} from "@/lib/types";

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function getErrorMessage(response: Response) {
  try {
    const payload = await readJson<ErrorResponse>(response);
    return payload.error;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export async function fetchDashboardState(adminToken: string) {
  const response = await fetch("/api/dashboard/state", {
    method: "GET",
    headers: {
      "x-admin-token": adminToken,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return readJson<DashboardStateResponse>(response);
}

export async function postRelayState(
  relay: "26" | "27",
  adminToken: string,
  state: boolean,
) {
  const response = await fetch(`/api/relay/${relay}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      adminToken,
      state,
    }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return readJson<RelaySingleResponse>(response);
}

export async function postRelayGroup(
  adminToken: string,
  relay26: boolean,
  relay27: boolean,
) {
  const response = await fetch("/api/relay/all", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      adminToken,
      relay26,
      relay27,
    }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return readJson<RelayAllResponse>(response);
}
