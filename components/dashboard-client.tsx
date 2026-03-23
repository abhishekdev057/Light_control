"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/constants";
import {
  fetchDashboardState,
  postRelaySchedule,
  postRelayState,
} from "@/lib/client/dashboard-api";
import type {
  DashboardStateResponse,
  RelayScheduleSummary,
} from "@/lib/types";

type RelayNumber = "26" | "27";

type ScheduleDraft = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
};

type ScheduleDraftState = Record<RelayNumber, ScheduleDraft>;

const fallbackSnapshot: DashboardStateResponse = {
  success: true,
  deviceId: "esp32-relay-01",
  relay26Desired: false,
  relay27Desired: false,
  relay26Reported: null,
  relay27Reported: null,
  lastSeen: null,
  online: false,
  updatedAt: "",
  reportedAt: null,
  storageMode: "memory",
  relay26Source: "manual",
  relay27Source: "manual",
  relay26OverrideUntil: null,
  relay27OverrideUntil: null,
  relay26Schedule: {
    enabled: false,
    startTime: "18:00",
    endTime: "21:00",
    timezone: "Asia/Kolkata",
    updatedAt: "",
    active: false,
    nextTransitionAt: null,
    overrideUntil: null,
    controlSource: "manual",
    manualLocked: false,
  },
  relay27Schedule: {
    enabled: false,
    startTime: "18:00",
    endTime: "21:00",
    timezone: "Asia/Kolkata",
    updatedAt: "",
    active: false,
    nextTransitionAt: null,
    overrideUntil: null,
    controlSource: "manual",
    manualLocked: false,
  },
};

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

function buildScheduleDrafts(
  snapshot: DashboardStateResponse,
  fallbackTimeZone: string,
): ScheduleDraftState {
  return {
    "26": {
      enabled: snapshot.relay26Schedule.enabled,
      startTime: snapshot.relay26Schedule.startTime || "18:00",
      endTime: snapshot.relay26Schedule.endTime || "21:00",
      timezone: snapshot.relay26Schedule.timezone || fallbackTimeZone,
    },
    "27": {
      enabled: snapshot.relay27Schedule.enabled,
      startTime: snapshot.relay27Schedule.startTime || "18:00",
      endTime: snapshot.relay27Schedule.endTime || "21:00",
      timezone: snapshot.relay27Schedule.timezone || fallbackTimeZone,
    },
  };
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No data";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "No heartbeat";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absoluteDiff = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (absoluteDiff < 60) {
    return rtf.format(diffSeconds, "second");
  }

  const diffMinutes = Math.round(diffSeconds / 60);

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }

  return rtf.format(Math.round(diffHours / 24), "day");
}

function describeSource(source: DashboardStateResponse["relay26Source"]) {
  if (source === "manual-override") {
    return "Manual override";
  }

  if (source === "schedule") {
    return "Scheduled";
  }

  return "Manual";
}

function describeReported(value: boolean | null) {
  if (value === null) {
    return "No report";
  }

  return value ? "ON" : "OFF";
}

function cardClass(extra = "") {
  return `rounded-[26px] border border-line/80 bg-panel-strong/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur ${extra}`;
}

function statusBadgeClass(active: boolean) {
  return active
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "bg-slate-500/12 text-slate-700 dark:text-slate-300";
}

function StatTile({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="rounded-2xl border border-line/70 bg-background/65 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-foreground/45">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function BulbIcon({ isOn }: Readonly<{ isOn: boolean }>) {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      {isOn ? (
        <div className="absolute inset-2 rounded-full bg-amber-300/40 blur-2xl" />
      ) : null}
      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border ${
          isOn
            ? "border-amber-400/70 bg-amber-100/80 text-amber-500"
            : "border-line/80 bg-background/80 text-foreground/45"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8"
          fill={isOn ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1.1 2H15c.1-.8.5-1.5 1.1-2A7 7 0 0 0 12 2Z" />
        </svg>
      </div>
    </div>
  );
}

function ControlButton({
  active,
  children,
  disabled,
  onClick,
  tone = "neutral",
}: Readonly<{
  active: boolean;
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  tone?: "neutral" | "accent";
}>) {
  const activeClass =
    tone === "accent"
      ? "bg-accent text-white border-accent"
      : "bg-foreground text-background border-foreground";
  const inactiveClass =
    tone === "accent"
      ? "bg-accent/10 text-accent border-accent/20 hover:bg-accent/15"
      : "bg-background/75 text-foreground border-line hover:bg-background";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? activeClass : inactiveClass
      }`}
    >
      {children}
    </button>
  );
}

function RelayCard({
  relay,
  desired,
  reported,
  source,
  schedule,
  draft,
  disabled,
  onToggle,
  onDraftChange,
  onSaveSchedule,
}: Readonly<{
  relay: RelayNumber;
  desired: boolean;
  reported: boolean | null;
  source: DashboardStateResponse["relay26Source"];
  schedule: RelayScheduleSummary;
  draft: ScheduleDraft;
  disabled: boolean;
  onToggle: (nextState: boolean) => void;
  onDraftChange: (patch: Partial<ScheduleDraft>) => void;
  onSaveSchedule: () => void;
}>) {
  const manualLocked = schedule.manualLocked;
  const hasMismatch = reported !== null && reported !== desired;

  return (
    <section className={cardClass("flex flex-col gap-5")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <BulbIcon isOn={desired} />
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-foreground/45">
              Relay {relay}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">
              Bulb {relay}
            </h2>
            <p
              className={`mt-2 text-sm font-semibold ${
                desired ? "text-amber-600 dark:text-amber-300" : "text-foreground/60"
              }`}
            >
              {desired ? "ON" : "OFF"}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(!hasMismatch)}`}>
            {hasMismatch ? "Sync pending" : "In sync"}
          </span>
          <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-foreground/70 dark:bg-white/8">
            {describeSource(source)}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Desired" value={desired ? "ON" : "OFF"} />
        <StatTile label="Reported" value={describeReported(reported)} />
        <StatTile
          label="Schedule"
          value={schedule.enabled ? `${schedule.startTime} - ${schedule.endTime}` : "Off"}
        />
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Manual control</p>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              manualLocked
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {manualLocked ? "Locked by schedule" : "Available"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ControlButton
            active={!desired}
            disabled={disabled || manualLocked}
            onClick={() => onToggle(false)}
          >
            Turn OFF
          </ControlButton>
          <ControlButton
            active={desired}
            tone="accent"
            disabled={disabled || manualLocked}
            onClick={() => onToggle(true)}
          >
            Turn ON
          </ControlButton>
        </div>

        {manualLocked ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            Schedule is currently active. Disable the schedule to use manual buttons.
          </div>
        ) : schedule.enabled ? (
          <div className="rounded-2xl border border-line/70 bg-background/60 px-4 py-3 text-sm text-foreground/65">
            Manual changes are allowed right now and will be replaced at the next schedule time.
          </div>
        ) : null}
      </div>

      <div className="h-px bg-line/80" />

      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Schedule</p>
          <label className="inline-flex items-center gap-3 rounded-full border border-line/80 bg-background/65 px-3 py-2 text-sm font-medium">
            <span>{draft.enabled ? "Enabled" : "Disabled"}</span>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => onDraftChange({ enabled: event.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.22em] text-foreground/45">
              Start
            </span>
            <input
              type="time"
              value={draft.startTime}
              onChange={(event) => onDraftChange({ startTime: event.target.value })}
              className="rounded-2xl border border-line bg-background/70 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.22em] text-foreground/45">
              End
            </span>
            <input
              type="time"
              value={draft.endTime}
              onChange={(event) => onDraftChange({ endTime: event.target.value })}
              className="rounded-2xl border border-line bg-background/70 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.22em] text-foreground/45">
            Timezone
          </span>
          <input
            type="text"
            value={draft.timezone}
            onChange={(event) => onDraftChange({ timezone: event.target.value })}
            placeholder="Asia/Kolkata"
            className="rounded-2xl border border-line bg-background/70 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            label="Next change"
            value={formatDateTime(schedule.nextTransitionAt)}
          />
          <StatTile label="Zone" value={schedule.timezone} />
        </div>

        <button
          type="button"
          onClick={onSaveSchedule}
          disabled={disabled}
          className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save schedule
        </button>
      </div>
    </section>
  );
}

export default function DashboardClient() {
  const [browserTimeZone] = useState(getBrowserTimeZone);
  const [adminToken, setAdminToken] = useState("");
  const [snapshot, setSnapshot] = useState<DashboardStateResponse | null>(null);
  const [scheduleDrafts, setScheduleDrafts] = useState<ScheduleDraftState>(
    buildScheduleDrafts(fallbackSnapshot, browserTimeZone),
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [isPending, startTransition] = useTransition();

  const displaySnapshot = snapshot ?? fallbackSnapshot;
  const hasSnapshot = Boolean(snapshot);
  const isBusy = Boolean(actionLabel) || isPending;

  function applySnapshot(nextSnapshot: DashboardStateResponse) {
    startTransition(() => {
      setSnapshot(nextSnapshot);
    });
    setScheduleDrafts(buildScheduleDrafts(nextSnapshot, browserTimeZone));
  }

  useEffect(() => {
    const savedToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
    setAdminToken(savedToken);

    if (!savedToken) {
      return;
    }

    void (async () => {
      try {
        const nextSnapshot = await fetchDashboardState(savedToken);
        startTransition(() => {
          setSnapshot(nextSnapshot);
        });
        setScheduleDrafts(buildScheduleDrafts(nextSnapshot, browserTimeZone));
        setError("");
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load dashboard state.",
        );
      }
    })();
  }, [browserTimeZone]);

  async function loadDashboard(tokenOverride?: string, silent = false) {
    const token = (tokenOverride ?? adminToken).trim();

    if (!token) {
      if (!silent) {
        setError("Enter the admin token.");
      }
      return null;
    }

    if (!silent) {
      setActionLabel("Refreshing");
    }

    try {
      const nextSnapshot = await fetchDashboardState(token);
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
      applySnapshot(nextSnapshot);
      setError("");

      if (!silent) {
        setNotice("Updated");
      }

      return nextSnapshot;
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load dashboard state.",
      );
      return null;
    } finally {
      if (!silent) {
        setActionLabel("");
      }
    }
  }

  async function updateRelay(relay: RelayNumber, nextState: boolean) {
    if (!snapshot) {
      setError("Load the dashboard first.");
      return;
    }

    const token = adminToken.trim();

    if (!token) {
      setError("Enter the admin token.");
      return;
    }

    const schedule =
      relay === "26" ? snapshot.relay26Schedule : snapshot.relay27Schedule;

    if (schedule.manualLocked) {
      setError("This relay is locked by an active schedule. Disable the schedule first.");
      return;
    }

    setActionLabel(`Relay ${relay}`);
    setError("");
    setNotice("");

    try {
      await postRelayState(relay, token, nextState);
      await loadDashboard(token, true);
      setNotice(`Relay ${relay} ${nextState ? "ON" : "OFF"}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to update relay ${relay}.`,
      );
    } finally {
      setActionLabel("");
    }
  }

  async function saveSchedule(relay: RelayNumber) {
    const token = adminToken.trim();

    if (!token) {
      setError("Enter the admin token.");
      return;
    }

    const draft = scheduleDrafts[relay];

    if (!draft.startTime || !draft.endTime) {
      setError("Start time and end time are required.");
      return;
    }

    if (draft.startTime === draft.endTime) {
      setError("Start time and end time must be different.");
      return;
    }

    if (!draft.timezone.trim()) {
      setError("Timezone is required.");
      return;
    }

    setActionLabel(`Saving ${relay}`);
    setError("");
    setNotice("");

    try {
      await postRelaySchedule(
        relay,
        token,
        draft.enabled,
        draft.startTime,
        draft.endTime,
        draft.timezone.trim(),
      );
      await loadDashboard(token, true);
      setNotice(`Relay ${relay} schedule saved`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to save schedule for relay ${relay}.`,
      );
    } finally {
      setActionLabel("");
    }
  }

  function clearToken() {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setAdminToken("");
    setSnapshot(null);
    setScheduleDrafts(buildScheduleDrafts(fallbackSnapshot, browserTimeZone));
    setNotice("");
    setError("");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <header className={cardClass("flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between")}>
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-foreground/45">
            Light Control
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Relay Dashboard
          </h1>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                displaySnapshot.online
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              }`}
            >
              {displaySnapshot.online ? "Online" : "Offline"}
            </span>
            <Link
              href="/integration"
              className="rounded-full border border-line/80 bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
            >
              Integration
            </Link>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <input
              type="password"
              autoComplete="off"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder="Admin token"
              className="min-w-[240px] rounded-2xl border border-line bg-background/75 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={isBusy}
              className="rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLabel || "Refresh"}
            </button>
            <button
              type="button"
              onClick={clearToken}
              className="rounded-2xl border border-line bg-background/75 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <StatTile label="Device" value={displaySnapshot.deviceId} />
        <StatTile label="Last seen" value={formatRelativeTime(displaySnapshot.lastSeen)} />
        <StatTile label="Last report" value={formatRelativeTime(displaySnapshot.reportedAt)} />
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {!error && notice ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <RelayCard
          relay="26"
          desired={displaySnapshot.relay26Desired}
          reported={displaySnapshot.relay26Reported}
          source={displaySnapshot.relay26Source}
          schedule={displaySnapshot.relay26Schedule}
          draft={scheduleDrafts["26"]}
          disabled={!hasSnapshot || isBusy}
          onToggle={(nextState) => void updateRelay("26", nextState)}
          onDraftChange={(patch) =>
            setScheduleDrafts((current) => ({
              ...current,
              "26": {
                ...current["26"],
                ...patch,
              },
            }))
          }
          onSaveSchedule={() => void saveSchedule("26")}
        />

        <RelayCard
          relay="27"
          desired={displaySnapshot.relay27Desired}
          reported={displaySnapshot.relay27Reported}
          source={displaySnapshot.relay27Source}
          schedule={displaySnapshot.relay27Schedule}
          draft={scheduleDrafts["27"]}
          disabled={!hasSnapshot || isBusy}
          onToggle={(nextState) => void updateRelay("27", nextState)}
          onDraftChange={(patch) =>
            setScheduleDrafts((current) => ({
              ...current,
              "27": {
                ...current["27"],
                ...patch,
              },
            }))
          }
          onSaveSchedule={() => void saveSchedule("27")}
        />
      </section>
    </main>
  );
}
