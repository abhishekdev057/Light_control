export type RelayKey = "relay26" | "relay27";
export type RelaySource = "manual" | "manual-override" | "schedule";

export interface DesiredRelayState {
  relay26: boolean;
  relay27: boolean;
  updatedAt: string;
}

export interface ReportedRelayState {
  relay26: boolean | null;
  relay27: boolean | null;
  updatedAt: string | null;
}

export interface DevicePresence {
  deviceId: string;
  registeredAt: string | null;
  lastSeen: string | null;
  lastIp: string | null;
}

export interface RelayScheduleConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
  updatedAt: string;
}

export interface RelayScheduleState {
  relay26: RelayScheduleConfig;
  relay27: RelayScheduleConfig;
}

export interface RelayManualOverride {
  state: boolean | null;
  expiresAt: string | null;
  updatedAt: string | null;
}

export interface RelayOverrideState {
  relay26: RelayManualOverride;
  relay27: RelayManualOverride;
}

export interface RelayScheduleSummary extends RelayScheduleConfig {
  active: boolean;
  nextTransitionAt: string | null;
  overrideUntil: string | null;
  controlSource: RelaySource;
  manualLocked: boolean;
}

export interface PersistedDeviceState {
  desired: DesiredRelayState;
  reported: ReportedRelayState;
  device: DevicePresence;
  schedules: RelayScheduleState;
  overrides: RelayOverrideState;
}

export interface SuccessResponse {
  success: true;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: Record<string, string[]> | string[];
}

export interface DeviceRegisterRequest {
  deviceId: string;
  token: string;
}

export interface DeviceRegisterResponse extends SuccessResponse {
  deviceId: string;
}

export interface DeviceHeartbeatRequest {
  deviceId: string;
  token: string;
  ip?: string;
}

export interface DeviceHeartbeatResponse extends SuccessResponse {
  serverTime: string;
}

export interface DeviceReportRequest {
  deviceId: string;
  token: string;
  relay26: boolean;
  relay27: boolean;
}

export interface DeviceStateResponse extends SuccessResponse {
  deviceId: string;
  relay26: boolean;
  relay27: boolean;
  updatedAt: string;
}

export interface DeviceSyncResponse {
  ok: true;
  r26: boolean;
  r27: boolean;
  ts: string;
}

export interface RelayCommandRequest {
  adminToken: string;
  state: boolean;
}

export interface RelayAllCommandRequest {
  adminToken: string;
  relay26: boolean;
  relay27: boolean;
}

export interface RelaySingleResponse extends SuccessResponse {
  relay26?: boolean;
  relay27?: boolean;
  updatedAt: string;
  source: RelaySource;
  overrideUntil: string | null;
}

export interface RelayAllResponse extends SuccessResponse {
  relay26: boolean;
  relay27: boolean;
  updatedAt: string;
  relay26Source: RelaySource;
  relay27Source: RelaySource;
  relay26OverrideUntil: string | null;
  relay27OverrideUntil: string | null;
}

export interface RelayScheduleRequest {
  adminToken: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface RelayScheduleResponse extends SuccessResponse {
  relay: RelayKey;
  relayState: boolean;
  updatedAt: string;
  schedule: RelayScheduleSummary;
}

export interface DashboardStateResponse extends SuccessResponse {
  deviceId: string;
  relay26Desired: boolean;
  relay27Desired: boolean;
  relay26Reported: boolean | null;
  relay27Reported: boolean | null;
  lastSeen: string | null;
  online: boolean;
  updatedAt: string;
  reportedAt: string | null;
  storageMode: "upstash" | "file" | "memory";
  relay26Source: RelaySource;
  relay27Source: RelaySource;
  relay26OverrideUntil: string | null;
  relay27OverrideUntil: string | null;
  relay26Schedule: RelayScheduleSummary;
  relay27Schedule: RelayScheduleSummary;
}
