import { z } from "zod";

const trimmedSecret = z.string().trim().min(1).max(200);
const deviceId = z.string().trim().min(1).max(100);
const optionalIp = z.string().trim().min(1).max(100).optional();

export const deviceRegisterSchema = z.object({
  deviceId,
  token: trimmedSecret,
});

export const deviceHeartbeatSchema = z.object({
  deviceId,
  token: trimmedSecret,
  ip: optionalIp,
});

export const deviceReportSchema = z.object({
  deviceId,
  token: trimmedSecret,
  relay26: z.boolean(),
  relay27: z.boolean(),
});

export const relayCommandSchema = z.object({
  adminToken: trimmedSecret,
  state: z.boolean(),
});

export const relayAllCommandSchema = z.object({
  adminToken: trimmedSecret,
  relay26: z.boolean(),
  relay27: z.boolean(),
});

export const deviceStateQuerySchema = z.object({
  deviceId,
  token: trimmedSecret,
});

export const dashboardStateQuerySchema = z.object({
  adminToken: trimmedSecret,
});
