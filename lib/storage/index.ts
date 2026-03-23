import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_DEVICE_ID,
  DEFAULT_SCHEDULE_TIMEZONE,
  DEVICE_STATE_KEY,
} from "@/lib/constants";
import { getKvCredentials } from "@/lib/env";
import { nowIso } from "@/lib/time";
import type { PersistedDeviceState } from "@/lib/types";

export type StorageMode = "upstash" | "file" | "memory";

interface StorageAdapter {
  mode: StorageMode;
  read(): Promise<PersistedDeviceState>;
  write(state: PersistedDeviceState): Promise<void>;
}

const fallbackFilePath = path.join(process.cwd(), ".data", "device-state.json");

function createDefaultState(): PersistedDeviceState {
  const timestamp = nowIso();

  return {
    desired: {
      relay26: false,
      relay27: false,
      updatedAt: timestamp,
    },
    reported: {
      relay26: null,
      relay27: null,
      updatedAt: null,
    },
    device: {
      deviceId: DEFAULT_DEVICE_ID,
      registeredAt: null,
      lastSeen: null,
      lastIp: null,
    },
    schedules: {
      relay26: {
        enabled: false,
        startTime: "18:00",
        endTime: "21:00",
        timezone: DEFAULT_SCHEDULE_TIMEZONE,
        updatedAt: timestamp,
      },
      relay27: {
        enabled: false,
        startTime: "18:00",
        endTime: "21:00",
        timezone: DEFAULT_SCHEDULE_TIMEZONE,
        updatedAt: timestamp,
      },
    },
    overrides: {
      relay26: {
        state: null,
        expiresAt: null,
        updatedAt: null,
      },
      relay27: {
        state: null,
        expiresAt: null,
        updatedAt: null,
      },
    },
  };
}

function normalizeState(candidate: PersistedDeviceState | null | undefined) {
  if (!candidate) {
    return createDefaultState();
  }

  const base = createDefaultState();

  return {
    desired: {
      relay26: candidate.desired?.relay26 ?? base.desired.relay26,
      relay27: candidate.desired?.relay27 ?? base.desired.relay27,
      updatedAt: candidate.desired?.updatedAt ?? base.desired.updatedAt,
    },
    reported: {
      relay26: candidate.reported?.relay26 ?? base.reported.relay26,
      relay27: candidate.reported?.relay27 ?? base.reported.relay27,
      updatedAt: candidate.reported?.updatedAt ?? base.reported.updatedAt,
    },
    device: {
      deviceId: candidate.device?.deviceId || base.device.deviceId,
      registeredAt: candidate.device?.registeredAt ?? base.device.registeredAt,
      lastSeen: candidate.device?.lastSeen ?? base.device.lastSeen,
      lastIp: candidate.device?.lastIp ?? base.device.lastIp,
    },
    schedules: {
      relay26: {
        enabled: candidate.schedules?.relay26?.enabled ?? base.schedules.relay26.enabled,
        startTime:
          candidate.schedules?.relay26?.startTime ?? base.schedules.relay26.startTime,
        endTime: candidate.schedules?.relay26?.endTime ?? base.schedules.relay26.endTime,
        timezone:
          candidate.schedules?.relay26?.timezone ?? base.schedules.relay26.timezone,
        updatedAt:
          candidate.schedules?.relay26?.updatedAt ?? base.schedules.relay26.updatedAt,
      },
      relay27: {
        enabled: candidate.schedules?.relay27?.enabled ?? base.schedules.relay27.enabled,
        startTime:
          candidate.schedules?.relay27?.startTime ?? base.schedules.relay27.startTime,
        endTime: candidate.schedules?.relay27?.endTime ?? base.schedules.relay27.endTime,
        timezone:
          candidate.schedules?.relay27?.timezone ?? base.schedules.relay27.timezone,
        updatedAt:
          candidate.schedules?.relay27?.updatedAt ?? base.schedules.relay27.updatedAt,
      },
    },
    overrides: {
      relay26: {
        state: candidate.overrides?.relay26?.state ?? base.overrides.relay26.state,
        expiresAt:
          candidate.overrides?.relay26?.expiresAt ?? base.overrides.relay26.expiresAt,
        updatedAt:
          candidate.overrides?.relay26?.updatedAt ?? base.overrides.relay26.updatedAt,
      },
      relay27: {
        state: candidate.overrides?.relay27?.state ?? base.overrides.relay27.state,
        expiresAt:
          candidate.overrides?.relay27?.expiresAt ?? base.overrides.relay27.expiresAt,
        updatedAt:
          candidate.overrides?.relay27?.updatedAt ?? base.overrides.relay27.updatedAt,
      },
    },
  } satisfies PersistedDeviceState;
}

class UpstashStorageAdapter implements StorageAdapter {
  mode: StorageMode = "upstash";
  private readonly redis: Redis;

  constructor() {
    const credentials = getKvCredentials();

    if (!credentials) {
      throw new Error("Missing KV credentials");
    }

    this.redis = new Redis(credentials);
  }

  async read() {
    const state = await this.redis.get<PersistedDeviceState>(DEVICE_STATE_KEY);
    return normalizeState(state);
  }

  async write(state: PersistedDeviceState) {
    await this.redis.set(DEVICE_STATE_KEY, state);
  }
}

class FileStorageAdapter implements StorageAdapter {
  mode: StorageMode = "file";

  async read() {
    try {
      const file = await readFile(fallbackFilePath, "utf8");
      return normalizeState(JSON.parse(file) as PersistedDeviceState);
    } catch {
      const initialState = createDefaultState();
      await this.write(initialState);
      return initialState;
    }
  }

  async write(state: PersistedDeviceState) {
    await mkdir(path.dirname(fallbackFilePath), { recursive: true });
    await writeFile(fallbackFilePath, JSON.stringify(state, null, 2));
  }
}

class MemoryStorageAdapter implements StorageAdapter {
  mode: StorageMode = "memory";

  async read() {
    const store = globalThis as typeof globalThis & {
      __lightControlState?: PersistedDeviceState;
    };

    if (!store.__lightControlState) {
      store.__lightControlState = createDefaultState();
    }

    return normalizeState(store.__lightControlState);
  }

  async write(state: PersistedDeviceState) {
    const store = globalThis as typeof globalThis & {
      __lightControlState?: PersistedDeviceState;
    };

    store.__lightControlState = state;
  }
}

let adapter: StorageAdapter | null = null;

function createAdapter(): StorageAdapter {
  if (getKvCredentials()) {
    return new UpstashStorageAdapter();
  }

  if (process.env.NODE_ENV === "development") {
    return new FileStorageAdapter();
  }

  return new MemoryStorageAdapter();
}

function getAdapter() {
  adapter ??= createAdapter();
  return adapter;
}

export async function readDeviceState() {
  return getAdapter().read();
}

export async function writeDeviceState(state: PersistedDeviceState) {
  return getAdapter().write(normalizeState(state));
}

export function getStorageMode(): StorageMode {
  return getAdapter().mode;
}
