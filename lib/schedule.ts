import { DEFAULT_SCHEDULE_TIMEZONE } from "@/lib/constants";
import type {
  RelayManualOverride,
  RelayScheduleConfig,
  RelayScheduleSummary,
  RelaySource,
} from "@/lib/types";

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  const cacheKey = timeZone || DEFAULT_SCHEDULE_TIMEZONE;

  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(
      cacheKey,
      new Intl.DateTimeFormat("en-US", {
        timeZone: cacheKey,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }),
    );
  }

  return formatterCache.get(cacheKey)!;
}

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(
  parts: ZonedDateParts,
  timeZone: string,
) {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  const firstPass = utcGuess - getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const secondPass =
    utcGuess - getTimeZoneOffsetMs(new Date(firstPass), timeZone);

  return new Date(secondPass);
}

function addDays(parts: ZonedDateParts, dayOffset: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function parseTimeValue(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return {
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
  };
}

function safeDateValue(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isScheduleActive(schedule: RelayScheduleConfig, now = new Date()) {
  if (!schedule.enabled) {
    return false;
  }

  const start = parseTimeValue(schedule.startTime).minutesOfDay;
  const end = parseTimeValue(schedule.endTime).minutesOfDay;
  const current = getZonedDateParts(now, schedule.timezone);
  const currentMinutes = current.hour * 60 + current.minute;

  if (start < end) {
    return currentMinutes >= start && currentMinutes < end;
  }

  return currentMinutes >= start || currentMinutes < end;
}

export function isManualControlLocked(
  schedule: RelayScheduleConfig,
  now = new Date(),
) {
  return schedule.enabled && isScheduleActive(schedule, now);
}

export function getNextScheduleTransitionAt(
  schedule: RelayScheduleConfig,
  now = new Date(),
) {
  if (!schedule.enabled) {
    return null;
  }

  const zonedNow = getZonedDateParts(now, schedule.timezone);
  const candidateTimes = [schedule.startTime, schedule.endTime];
  const candidates: Date[] = [];

  for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
    const day = addDays(zonedNow, dayOffset);

    for (const candidate of candidateTimes) {
      const parsedTime = parseTimeValue(candidate);
      const utcDate = zonedDateTimeToUtc(
        {
          ...day,
          hour: parsedTime.hour,
          minute: parsedTime.minute,
          second: 0,
        },
        schedule.timezone,
      );

      if (utcDate.getTime() > now.getTime()) {
        candidates.push(utcDate);
      }
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((left, right) => left.getTime() - right.getTime());
  return candidates[0].toISOString();
}

export function isOverrideActive(
  override: RelayManualOverride,
  now = new Date(),
) {
  if (override.state === null || !override.expiresAt) {
    return false;
  }

  const expiresAt = safeDateValue(override.expiresAt);

  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() > now.getTime();
}

export function resolveRelaySource(
  schedule: RelayScheduleConfig,
  override: RelayManualOverride,
  now = new Date(),
): RelaySource {
  if (schedule.enabled && isOverrideActive(override, now)) {
    return "manual-override";
  }

  if (schedule.enabled) {
    return "schedule";
  }

  return "manual";
}

export function resolveRelayValue(
  manualState: boolean,
  schedule: RelayScheduleConfig,
  override: RelayManualOverride,
  now = new Date(),
) {
  const controlSource = resolveRelaySource(schedule, override, now);

  if (controlSource === "manual-override") {
    return {
      value: override.state ?? manualState,
      controlSource,
    };
  }

  if (controlSource === "schedule") {
    return {
      value: isScheduleActive(schedule, now),
      controlSource,
    };
  }

  return {
    value: manualState,
    controlSource,
  };
}

export function buildScheduleSummary(
  schedule: RelayScheduleConfig,
  override: RelayManualOverride,
  now = new Date(),
): RelayScheduleSummary {
  const active = isScheduleActive(schedule, now);

  return {
    ...schedule,
    active,
    nextTransitionAt: getNextScheduleTransitionAt(schedule, now),
    overrideUntil: isOverrideActive(override, now) ? override.expiresAt : null,
    controlSource: resolveRelaySource(schedule, override, now),
    manualLocked: schedule.enabled && active,
  };
}
