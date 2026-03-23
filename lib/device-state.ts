import { DEFAULT_DEVICE_ID } from "@/lib/constants";
import {
  buildScheduleSummary,
  getNextScheduleTransitionAt,
  isManualControlLocked,
  resolveRelayValue,
} from "@/lib/schedule";
import { getStorageMode, readDeviceState, writeDeviceState } from "@/lib/storage";
import { isDeviceOnline, nowIso } from "@/lib/time";
import type {
  DashboardStateResponse,
  PersistedDeviceState,
  RelayKey,
  RelayScheduleConfig,
} from "@/lib/types";

type ResolvedRelaySnapshot = {
  relay26: boolean;
  relay27: boolean;
  relay26Source: DashboardStateResponse["relay26Source"];
  relay27Source: DashboardStateResponse["relay27Source"];
  relay26OverrideUntil: string | null;
  relay27OverrideUntil: string | null;
  updatedAt: string;
};

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

function getRelayUpdateTimestamp(
  state: PersistedDeviceState,
  relay: RelayKey,
  now = new Date(),
) {
  const resolved = resolveRelayValue(
    state.desired[relay],
    state.schedules[relay],
    state.overrides[relay],
    now,
  );

  if (resolved.controlSource === "manual-override") {
    return state.overrides[relay].updatedAt ?? state.desired.updatedAt;
  }

  if (resolved.controlSource === "schedule") {
    return state.schedules[relay].updatedAt;
  }

  return state.desired.updatedAt;
}

function getLatestIso(values: Array<string | null | undefined>) {
  const validValues = values.filter(Boolean) as string[];

  if (!validValues.length) {
    return nowIso();
  }

  return validValues.reduce((latest, current) => {
    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
  });
}

function resolveEffectiveRelays(
  state: PersistedDeviceState,
  now = new Date(),
): ResolvedRelaySnapshot {
  const relay26 = resolveRelayValue(
    state.desired.relay26,
    state.schedules.relay26,
    state.overrides.relay26,
    now,
  );
  const relay27 = resolveRelayValue(
    state.desired.relay27,
    state.schedules.relay27,
    state.overrides.relay27,
    now,
  );

  return {
    relay26: relay26.value,
    relay27: relay27.value,
    relay26Source: relay26.controlSource,
    relay27Source: relay27.controlSource,
    relay26OverrideUntil:
      relay26.controlSource === "manual-override"
        ? state.overrides.relay26.expiresAt
        : null,
    relay27OverrideUntil:
      relay27.controlSource === "manual-override"
        ? state.overrides.relay27.expiresAt
        : null,
    updatedAt: getLatestIso([
      getRelayUpdateTimestamp(state, "relay26", now),
      getRelayUpdateTimestamp(state, "relay27", now),
    ]),
  };
}

function createClearedOverride() {
  return {
    state: null,
    expiresAt: null,
    updatedAt: null,
  };
}

function getManualLockMessage(relay: RelayKey) {
  return `${
    relay === "relay26" ? "Relay 26" : "Relay 27"
  } is currently inside its active schedule window. Disable the schedule before using manual buttons.`;
}

function createOverrideForRelay(
  relay: RelayKey,
  state: PersistedDeviceState,
  value: boolean,
  timestamp: string,
) {
  const schedule = state.schedules[relay];

  if (!schedule.enabled) {
    return createClearedOverride();
  }

  const expiresAt = getNextScheduleTransitionAt(schedule, new Date(timestamp));

  return {
    state: value,
    expiresAt,
    updatedAt: timestamp,
  };
}

function buildDashboardPayload(
  state: PersistedDeviceState,
  now = new Date(),
): DashboardStateResponse {
  const resolved = resolveEffectiveRelays(state, now);

  return {
    success: true,
    deviceId: state.device.deviceId,
    relay26Desired: resolved.relay26,
    relay27Desired: resolved.relay27,
    relay26Reported: state.reported.relay26,
    relay27Reported: state.reported.relay27,
    lastSeen: state.device.lastSeen,
    online: isDeviceOnline(state.device.lastSeen),
    updatedAt: resolved.updatedAt,
    reportedAt: state.reported.updatedAt,
    storageMode: getStorageMode(),
    relay26Source: resolved.relay26Source,
    relay27Source: resolved.relay27Source,
    relay26OverrideUntil: resolved.relay26OverrideUntil,
    relay27OverrideUntil: resolved.relay27OverrideUntil,
    relay26Schedule: buildScheduleSummary(
      state.schedules.relay26,
      state.overrides.relay26,
      now,
    ),
    relay27Schedule: buildScheduleSummary(
      state.schedules.relay27,
      state.overrides.relay27,
      now,
    ),
  };
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

  const resolved = resolveEffectiveRelays(current);

  return {
    ok: true as const,
    deviceId: current.device.deviceId,
    relay26: resolved.relay26,
    relay27: resolved.relay27,
    updatedAt: resolved.updatedAt,
  };
}

export async function setDesiredRelay(relay: RelayKey, value: boolean) {
  const timestamp = nowIso();
  const current = await readDeviceState();
  const now = new Date(timestamp);

  if (isManualControlLocked(current.schedules[relay], now)) {
    return {
      ok: false as const,
      message: getManualLockMessage(relay),
    };
  }

  const nextState: PersistedDeviceState = {
    ...current,
    desired: {
      ...current.desired,
      [relay]: value,
      updatedAt: timestamp,
    },
    overrides: {
      ...current.overrides,
      [relay]: createOverrideForRelay(relay, current, value, timestamp),
    },
  };

  await writeDeviceState(nextState);

  const resolved = resolveEffectiveRelays(nextState, now);

  return {
    ok: true as const,
    state: nextState,
    resolved,
  };
}

export async function setDesiredRelays(relay26: boolean, relay27: boolean) {
  const timestamp = nowIso();
  const current = await readDeviceState();
  const now = new Date(timestamp);
  const lockedRelays: RelayKey[] = [];

  if (isManualControlLocked(current.schedules.relay26, now)) {
    lockedRelays.push("relay26");
  }

  if (isManualControlLocked(current.schedules.relay27, now)) {
    lockedRelays.push("relay27");
  }

  if (lockedRelays.length > 0) {
    return {
      ok: false as const,
      message:
        lockedRelays.length === 1
          ? getManualLockMessage(lockedRelays[0])
          : "One or more relays are inside an active schedule window. Disable those schedules before using group controls.",
    };
  }

  const nextState: PersistedDeviceState = {
    ...current,
    desired: {
      relay26,
      relay27,
      updatedAt: timestamp,
    },
    overrides: {
      relay26: createOverrideForRelay("relay26", current, relay26, timestamp),
      relay27: createOverrideForRelay("relay27", current, relay27, timestamp),
    },
  };

  await writeDeviceState(nextState);

  const resolved = resolveEffectiveRelays(nextState, now);

  return {
    ok: true as const,
    state: nextState,
    resolved,
  };
}

export async function setRelaySchedule(
  relay: RelayKey,
  schedule: Omit<RelayScheduleConfig, "updatedAt">,
) {
  const timestamp = nowIso();
  const current = await readDeviceState();
  const nextState: PersistedDeviceState = {
    ...current,
    schedules: {
      ...current.schedules,
      [relay]: {
        ...schedule,
        updatedAt: timestamp,
      },
    },
    overrides: {
      ...current.overrides,
      [relay]: createClearedOverride(),
    },
  };

  await writeDeviceState(nextState);

  return {
    state: nextState,
    dashboard: buildDashboardPayload(nextState, new Date(timestamp)),
  };
}

export async function getDashboardState(): Promise<DashboardStateResponse> {
  return buildDashboardPayload(await readDeviceState());
}
