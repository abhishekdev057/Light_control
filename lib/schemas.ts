import { z } from "zod";

import { DEFAULT_SCHEDULE_TIMEZONE } from "@/lib/constants";

const trimmedSecret = z.string().trim().min(1).max(200);
const deviceId = z.string().trim().min(1).max(100);
const optionalIp = z.string().trim().min(1).max(100).optional();
const timeValue = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
  message: "Use 24-hour HH:MM format.",
});
const timeZoneValue = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .default(DEFAULT_SCHEDULE_TIMEZONE)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
      return true;
    } catch {
      return false;
    }
  }, "Use a valid IANA timezone like Asia/Kolkata.");

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

export const relayScheduleSchema = z
  .object({
    adminToken: trimmedSecret,
    enabled: z.boolean(),
    startTime: timeValue,
    endTime: timeValue,
    timezone: timeZoneValue,
  })
  .refine((value) => value.startTime !== value.endTime, {
    message: "Start and end time must be different.",
    path: ["endTime"],
  });

export const deviceStateQuerySchema = z.object({
  deviceId,
  token: trimmedSecret,
});

export const dashboardStateQuerySchema = z.object({
  adminToken: trimmedSecret,
});
