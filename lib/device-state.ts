import { DEFAULT_DEVICE_ID } from "@/lib/constants";
import { getStorageMode, readDeviceState, writeDeviceState } from "@/lib/storage";
import { isDeviceOnline, nowIso } from "@/lib/time";
import type {
  DashboardStateResponse,
  PersistedDeviceState,
  RelayKey,
} from "@/lib/types";

function ensureDeviceId(state: PersistedDeviceState, deviceId: string) {
  if (!state.device.registeredAt) {
    return {
      ...state,
      device: {
        ...state.device,
        deviceId,
      },
    };
  }

  return state;
}

function assertKnownDevice(state: PersistedDeviceState, deviceId: string) {
  const knownDeviceId = state.device.deviceId || DEFAULT_DEVICE_ID;

  if (state.device.registeredAt && knownDeviceId !== deviceId) {
    return {
      ok: false as const,
      message: `Device "${deviceId}" is not registered on this backend.`,
    };
  }

  return { ok: true as const };
}

export async function registerDevice(deviceId: string, ip?: string) {
  const timestamp = nowIso();
  const current = await readDeviceState();
  const nextState: PersistedDeviceState = {
    ...current,
    device: {
      deviceId,
      registeredAt: current.device.registeredAt ?? timestamp,
      lastSeen: timestamp,
      lastIp: ip ?? current.device.lastIp,
    },
  };

  await writeDeviceState(nextState);
  return nextState;
}

export async function recordHeartbeat(deviceId: string, ip?: string) {
  const current = ensureDeviceId(await readDeviceState(), deviceId);
  const knownDevice = assertKnownDevice(current, deviceId);

  if (!knownDevice.ok) {
    return knownDevice;
  }

  const timestamp = nowIso();
  const nextState: PersistedDeviceState = {
    ...current,
    device: {
      ...current.device,
      deviceId,
      registeredAt: current.device.registeredAt ?? timestamp,
      lastSeen: timestamp,
      lastIp: ip ?? current.device.lastIp,
    },
  };

  await writeDeviceState(nextState);
  return { ok: true as const, state: nextState };
}

export async function reportAppliedState(
  deviceId: string,
  relay26: boolean,
  relay27: boolean,
) {
  const current = ensureDeviceId(await readDeviceState(), deviceId);
  const knownDevice = assertKnownDevice(current, deviceId);

  if (!knownDevice.ok) {
    return knownDevice;
  }

  const timestamp = nowIso();
  const nextState: PersistedDeviceState = {
    ...current,
    reported: {
      relay26,
      relay27,
      updatedAt: timestamp,
    },
    device: {
      ...current.device,
      deviceId,
      registeredAt: current.device.registeredAt ?? timestamp,
      lastSeen: timestamp,
    },
  };

  await writeDeviceState(nextState);
  return { ok: true as const, state: nextState };
}

export async function getDesiredRelayState(deviceId: string) {
  const current = ensureDeviceId(await readDeviceState(), deviceId);
  const knownDevice = assertKnownDevice(current, deviceId);

  if (!knownDevice.ok) {
    return knownDevice;
  }

  return {
    ok: true as const,
    state: current,
  };
}

export async function setDesiredRelay(relay: RelayKey, value: boolean) {
  const timestamp = nowIso();
  const current = await readDeviceState();
  const nextState: PersistedDeviceState = {
    ...current,
    desired: {
      ...current.desired,
      [relay]: value,
      updatedAt: timestamp,
    },
  };

  await writeDeviceState(nextState);
  return nextState;
}

export async function setDesiredRelays(relay26: boolean, relay27: boolean) {
  const timestamp = nowIso();
  const current = await readDeviceState();
  const nextState: PersistedDeviceState = {
    ...current,
    desired: {
      relay26,
      relay27,
      updatedAt: timestamp,
    },
  };

  await writeDeviceState(nextState);
  return nextState;
}

export async function getDashboardState(): Promise<DashboardStateResponse> {
  const current = await readDeviceState();

  return {
    success: true,
    deviceId: current.device.deviceId,
    relay26Desired: current.desired.relay26,
    relay27Desired: current.desired.relay27,
    relay26Reported: current.reported.relay26,
    relay27Reported: current.reported.relay27,
    lastSeen: current.device.lastSeen,
    online: isDeviceOnline(current.device.lastSeen),
    updatedAt: current.desired.updatedAt,
    reportedAt: current.reported.updatedAt,
    storageMode: getStorageMode(),
  };
}
