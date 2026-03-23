export function getDeviceSecret() {
  return process.env.DEVICE_SECRET?.trim() || "";
}

export function getAdminSecret() {
  return process.env.ADMIN_SECRET?.trim() || "";
}

export function getKvCredentials() {
  const url = process.env.KV_REST_API_URL?.trim() || "";
  const token = process.env.KV_REST_API_TOKEN?.trim() || "";

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
}
