"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/constants";
import {
  fetchDashboardState,
  postRelayGroup,
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
    return "Waiting for device activity";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid timestamp";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "No heartbeat yet";
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

function describeRelay(value: boolean | null) {
  if (value === null) {
    return "Not reported";
  }

  return value ? "ON" : "OFF";
}

function describeSource(source: DashboardStateResponse["relay26Source"]) {
  if (source === "manual-override") {
    return "Manual override";
  }

  if (source === "schedule") {
    return "Schedule";
  }

  return "Manual";
}

function SurfaceCard({
  children,
  className = "",
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <section
      className={`rounded-[28px] border border-line/80 bg-panel-strong/85 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur ${className}`}
    >
      {children}
    </section>
  );
}

function StatusBadge({ online }: Readonly<{ online: boolean }>) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${
        online
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      }`}
    >
      {online ? "Online" : "Offline"}
    </span>
  );
}

function StatePill({
  label,
  value,
  tone = "neutral",
}: Readonly<{
  label: string;
  value: string;
  tone?: "neutral" | "accent" | "warn";
}>) {
  const toneClass =
    tone === "accent"
      ? "bg-accent/12 text-accent"
      : tone === "warn"
        ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
        : "bg-black/5 text-foreground/75 dark:bg-white/8";

  return (
    <div className={`rounded-2xl px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.24em] text-foreground/55">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function RelayCard({
  relay,
  desired,
  reported,
  source,
  schedule,
  disabled,
  onToggle,
}: Readonly<{
  relay: RelayNumber;
  desired: boolean;
  reported: boolean | null;
  source: DashboardStateResponse["relay26Source"];
  schedule: RelayScheduleSummary;
  disabled: boolean;
  onToggle: (nextState: boolean) => void;
}>) {
  const mismatch = reported !== null && desired !== reported;

  return (
    <SurfaceCard className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-foreground/45">
            Relay {relay}
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
            GPIO {relay}
          </h2>
        </div>
        {mismatch ? (
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            Awaiting sync
          </span>
        ) : (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Stable
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatePill label="Desired" value={desired ? "ON" : "OFF"} tone="accent" />
        <StatePill
          label="Reported"
          value={describeRelay(reported)}
          tone={mismatch ? "warn" : "neutral"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatePill label="Control source" value={describeSource(source)} tone="neutral" />
        <StatePill
          label="Schedule"
          value={
            schedule.enabled
              ? `${schedule.startTime} - ${schedule.endTime}`
              : "Disabled"
          }
          tone={schedule.enabled ? "accent" : "neutral"}
        />
      </div>

      <div className="rounded-[24px] border border-line/80 bg-background/55 p-3">
        <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">
          Toggle state
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground/65">
          When scheduling is enabled, these buttons create a manual override until
          the next schedule transition.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggle(false)}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              !desired
                ? "bg-foreground text-background"
                : "bg-black/5 text-foreground hover:bg-black/10 dark:bg-white/8 dark:hover:bg-white/14"
            } disabled:cursor-not-allowed disabled:opacity-55`}
          >
            Turn OFF
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggle(true)}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              desired
                ? "bg-accent text-white"
                : "bg-accent/12 text-accent hover:bg-accent/18"
            } disabled:cursor-not-allowed disabled:opacity-55`}
          >
            Turn ON
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
}

function ScheduleEditorCard({
  relay,
  draft,
  schedule,
  disabled,
  onDraftChange,
  onSave,
}: Readonly<{
  relay: RelayNumber;
  draft: ScheduleDraft;
  schedule: RelayScheduleSummary;
  disabled: boolean;
  onDraftChange: (patch: Partial<ScheduleDraft>) => void;
  onSave: () => void;
}>) {
  return (
    <SurfaceCard className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-foreground/45">
            Relay {relay} schedule
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
            Admin timer window
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${
            schedule.enabled
              ? schedule.active
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-sky-500/12 text-sky-700 dark:text-sky-300"
              : "bg-black/5 text-foreground/65 dark:bg-white/8"
          }`}
        >
          {schedule.enabled ? (schedule.active ? "Window active" : "Window idle") : "Disabled"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatePill
          label="Next transition"
          value={formatDateTime(schedule.nextTransitionAt)}
          tone={schedule.enabled ? "accent" : "neutral"}
        />
        <StatePill
          label="Override until"
          value={formatDateTime(schedule.overrideUntil)}
          tone={schedule.overrideUntil ? "warn" : "neutral"}
        />
      </div>

      <div className="grid gap-4 rounded-[24px] border border-line/80 bg-background/55 p-4">
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-panel/80 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Enable daily schedule</p>
            <p className="text-xs text-foreground/60">
              Relay follows this time window automatically.
            </p>
          </div>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => onDraftChange({ enabled: event.target.checked })}
            className="h-5 w-5 accent-[var(--accent)]"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground/70">Start time</span>
            <input
              type="time"
              value={draft.startTime}
              onChange={(event) => onDraftChange({ startTime: event.target.value })}
              className="rounded-2xl border border-line bg-background/70 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground/70">End time</span>
            <input
              type="time"
              value={draft.endTime}
              onChange={(event) => onDraftChange({ endTime: event.target.value })}
              className="rounded-2xl border border-line bg-background/70 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground/70">Timezone</span>
          <input
            type="text"
            value={draft.timezone}
            onChange={(event) => onDraftChange({ timezone: event.target.value })}
            placeholder="Asia/Kolkata"
            className="rounded-2xl border border-line bg-background/70 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatePill label="Current source" value={describeSource(schedule.controlSource)} />
          <StatePill label="Saved window" value={`${schedule.startTime} - ${schedule.endTime}`} />
          <StatePill label="Saved zone" value={schedule.timezone} />
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={disabled}
          className="rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save relay {relay} schedule
        </button>
      </div>
    </SurfaceCard>
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

  useEffect(() => {
    const savedToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
    setAdminToken(savedToken);

    if (savedToken) {
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
    }
  }, [browserTimeZone]);

  async function loadDashboard(tokenOverride?: string, silent = false) {
    const token = (tokenOverride ?? adminToken).trim();

    if (!token) {
      if (!silent) {
        setError("Enter the ADMIN_SECRET to unlock the dashboard.");
      }
      return null;
    }

    if (!silent) {
      setActionLabel("Refreshing dashboard");
    }

    try {
      const nextSnapshot = await fetchDashboardState(token);
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
      startTransition(() => {
        setSnapshot(nextSnapshot);
      });
      setScheduleDrafts(buildScheduleDrafts(nextSnapshot, browserTimeZone));
      setError("");

      if (!silent) {
        setNotice("Dashboard synced with the backend.");
      }

      return nextSnapshot;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load dashboard state.";
      setError(message);
      return null;
    } finally {
      if (!silent) {
        setActionLabel("");
      }
    }
  }

  async function updateSingleRelay(relay: RelayNumber, nextState: boolean) {
    if (!snapshot) {
      setError("Load the dashboard first so the current device state is available.");
      return;
    }

    const token = adminToken.trim();

    if (!token) {
      setError("Enter the ADMIN_SECRET to send relay commands.");
      return;
    }

    const previous = snapshot;

    startTransition(() => {
      setSnapshot({
        ...previous,
        ...(relay === "26"
          ? { relay26Desired: nextState }
          : { relay27Desired: nextState }),
        updatedAt: new Date().toISOString(),
      });
    });

    setActionLabel(`Sending relay ${relay} command`);
    setError("");
    setNotice("");

    try {
      await postRelayState(relay, token, nextState);
      const refreshed = await loadDashboard(token, true);
      setNotice(
        refreshed &&
          ((relay === "26" && refreshed.relay26Source === "manual-override") ||
            (relay === "27" && refreshed.relay27Source === "manual-override"))
          ? `Relay ${relay} updated. That manual state will hold until the next schedule change.`
          : `Relay ${relay} updated successfully.`,
      );
    } catch (caughtError) {
      startTransition(() => {
        setSnapshot(previous);
      });
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to update relay ${relay}.`,
      );
    } finally {
      setActionLabel("");
    }
  }

  async function updateAllRelays(nextRelay26: boolean, nextRelay27: boolean) {
    if (!snapshot) {
      setError("Load the dashboard first so the current device state is available.");
      return;
    }

    const token = adminToken.trim();

    if (!token) {
      setError("Enter the ADMIN_SECRET to send relay commands.");
      return;
    }

    const previous = snapshot;

    startTransition(() => {
      setSnapshot({
        ...previous,
        relay26Desired: nextRelay26,
        relay27Desired: nextRelay27,
        updatedAt: new Date().toISOString(),
      });
    });

    setActionLabel("Sending group command");
    setError("");
    setNotice("");

    try {
      await postRelayGroup(token, nextRelay26, nextRelay27);
      const refreshed = await loadDashboard(token, true);
      setNotice(
        refreshed &&
          (refreshed.relay26Source === "manual-override" ||
            refreshed.relay27Source === "manual-override")
          ? "Both relays updated. Scheduled relays are now manually overridden until their next time boundary."
          : "Both relay states were updated.",
      );
    } catch (caughtError) {
      startTransition(() => {
        setSnapshot(previous);
      });
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update both relays.",
      );
    } finally {
      setActionLabel("");
    }
  }

  async function saveSchedule(relay: RelayNumber) {
    const token = adminToken.trim();

    if (!token) {
      setError("Enter the ADMIN_SECRET to save schedules.");
      return;
    }

    const draft = scheduleDrafts[relay];
    const timezone = draft.timezone.trim();

    if (!timezone) {
      setError("Timezone is required. Try Asia/Kolkata.");
      return;
    }

    if (!draft.startTime || !draft.endTime) {
      setError("Both schedule times are required.");
      return;
    }

    if (draft.startTime === draft.endTime) {
      setError("Start time and end time must be different.");
      return;
    }

    setActionLabel(`Saving relay ${relay} schedule`);
    setError("");
    setNotice("");

    try {
      await postRelaySchedule(
        relay,
        token,
        draft.enabled,
        draft.startTime,
        draft.endTime,
        timezone,
      );
      await loadDashboard(token, true);
      setNotice(
        draft.enabled
          ? `Relay ${relay} schedule saved. The backend will now switch it automatically between ${draft.startTime} and ${draft.endTime}.`
          : `Relay ${relay} schedule disabled. Manual control is active now.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to save relay ${relay} schedule.`,
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
    setNotice("Stored admin token cleared from this browser.");
    setError("");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-4 lg:grid-cols-[1.3fr_.9fr]">
        <SurfaceCard className="overflow-hidden">
          <div className="relative">
            <div className="absolute inset-y-0 right-0 hidden w-40 rounded-full bg-accent/10 blur-3xl lg:block" />
            <div className="relative flex flex-col gap-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-sm uppercase tracking-[0.32em] text-foreground/45">
                    Light Control Backend
                  </p>
                  <h1 className="mt-3 max-w-xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                    HTTP relay control, daily scheduling, and reboot-safe sync for ESP32.
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/70">
                    The backend now drives relay timing centrally. Your ESP32 only
                    polls the API, applies GPIO 26 and 27, and restores the saved
                    state immediately after power comes back.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/integration"
                    className="rounded-full border border-line/80 bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
                  >
                    ESP32 integration
                  </Link>
                  <button
                    type="button"
                    onClick={() => void loadDashboard()}
                    disabled={isBusy || !adminToken.trim()}
                    className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLabel || "Refresh"}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatePill label="Device" value={displaySnapshot.deviceId} tone="neutral" />
                <StatePill
                  label="Desired updated"
                  value={formatRelativeTime(displaySnapshot.updatedAt || null)}
                  tone="accent"
                />
                <StatePill
                  label="Reported updated"
                  value={formatRelativeTime(displaySnapshot.reportedAt)}
                  tone="neutral"
                />
              </div>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-foreground/45">
                Admin access
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
                Unlock controls
              </h2>
            </div>
            <StatusBadge online={displaySnapshot.online} />
          </div>

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void loadDashboard();
            }}
          >
            <label className="text-sm font-medium text-foreground/70" htmlFor="admin-token">
              Admin token
            </label>
            <input
              id="admin-token"
              type="password"
              autoComplete="off"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder="Paste ADMIN_SECRET"
              className="w-full rounded-2xl border border-line bg-background/70 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isBusy}
                className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Load dashboard
              </button>
              <button
                type="button"
                onClick={clearToken}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground/80 transition hover:bg-background/80"
              >
                Clear token
              </button>
            </div>
          </form>

          <p className="text-sm leading-6 text-foreground/62">
            The token stays only in this browser&apos;s local storage so you can
            refresh without re-entering it each time.
          </p>
        </SurfaceCard>
      </section>

      {error ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <SurfaceCard className="flex h-full flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-foreground/45">
                Device status
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
                {displaySnapshot.deviceId}
              </h2>
            </div>
            <StatusBadge online={displaySnapshot.online} />
          </div>

          <div className="grid gap-3">
            <StatePill
              label="Last seen"
              value={formatRelativeTime(displaySnapshot.lastSeen)}
              tone={displaySnapshot.online ? "accent" : "warn"}
            />
            <StatePill
              label="Heartbeat clock"
              value={formatDateTime(displaySnapshot.lastSeen)}
              tone="neutral"
            />
            <StatePill
              label="Storage mode"
              value={displaySnapshot.storageMode}
              tone="neutral"
            />
          </div>
        </SurfaceCard>

        <RelayCard
          relay="26"
          desired={displaySnapshot.relay26Desired}
          reported={displaySnapshot.relay26Reported}
          source={displaySnapshot.relay26Source}
          schedule={displaySnapshot.relay26Schedule}
          disabled={!hasSnapshot || isBusy}
          onToggle={(nextState) => void updateSingleRelay("26", nextState)}
        />

        <RelayCard
          relay="27"
          desired={displaySnapshot.relay27Desired}
          reported={displaySnapshot.relay27Reported}
          source={displaySnapshot.relay27Source}
          schedule={displaySnapshot.relay27Schedule}
          disabled={!hasSnapshot || isBusy}
          onToggle={(nextState) => void updateSingleRelay("27", nextState)}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <SurfaceCard className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-foreground/45">
                Combined control
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
                Set both relays together
              </h2>
            </div>
            <div className="flex gap-2 text-sm font-semibold">
              <span className="rounded-full bg-black/5 px-3 py-1 dark:bg-white/8">
                26: {displaySnapshot.relay26Desired ? "ON" : "OFF"}
              </span>
              <span className="rounded-full bg-black/5 px-3 py-1 dark:bg-white/8">
                27: {displaySnapshot.relay27Desired ? "ON" : "OFF"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              disabled={!hasSnapshot || isBusy}
              onClick={() => void updateAllRelays(true, true)}
              className="rounded-[24px] bg-accent px-4 py-4 text-left text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              <p className="text-xs uppercase tracking-[0.26em] text-white/70">Scene</p>
              <p className="mt-2 text-lg font-semibold">All ON</p>
              <p className="mt-1 text-sm text-white/75">Drive both outputs high.</p>
            </button>

            <button
              type="button"
              disabled={!hasSnapshot || isBusy}
              onClick={() => void updateAllRelays(false, false)}
              className="rounded-[24px] bg-foreground px-4 py-4 text-left text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <p className="text-xs uppercase tracking-[0.26em] text-background/70">
                Scene
              </p>
              <p className="mt-2 text-lg font-semibold">All OFF</p>
              <p className="mt-1 text-sm text-background/75">
                Return both outputs to idle.
              </p>
            </button>

            <button
              type="button"
              disabled={!hasSnapshot || isBusy}
              onClick={() =>
                void updateAllRelays(
                  !displaySnapshot.relay26Desired,
                  !displaySnapshot.relay27Desired,
                )
              }
              className="rounded-[24px] border border-line bg-background/65 px-4 py-4 text-left transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              <p className="text-xs uppercase tracking-[0.26em] text-foreground/45">
                Scene
              </p>
              <p className="mt-2 text-lg font-semibold">Invert both</p>
              <p className="mt-1 text-sm text-foreground/70">
                Flip each desired relay state.
              </p>
            </button>
          </div>
        </SurfaceCard>

        <SurfaceCard className="flex flex-col gap-5">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-foreground/45">
              Device loop
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
              Power restore behavior
            </h2>
          </div>

          <ol className="grid gap-3 text-sm leading-6 text-foreground/75">
            <li className="rounded-2xl bg-background/55 px-4 py-3">
              1. ESP32 boots with both relays in a safe default state.
            </li>
            <li className="rounded-2xl bg-background/55 px-4 py-3">
              2. It reconnects to Wi-Fi and registers again if needed.
            </li>
            <li className="rounded-2xl bg-background/55 px-4 py-3">
              3. It fetches <code>/api/device/sync</code> immediately after boot.
            </li>
            <li className="rounded-2xl bg-background/55 px-4 py-3">
              4. The saved desired state is applied again, so manual or scheduled
              state comes back after a power cut.
            </li>
          </ol>

          <Link
            href="/integration"
            className="rounded-full border border-line px-4 py-3 text-center text-sm font-semibold text-foreground transition hover:bg-background/80"
          >
            Open full endpoint examples
          </Link>
        </SurfaceCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ScheduleEditorCard
          relay="26"
          draft={scheduleDrafts["26"]}
          schedule={displaySnapshot.relay26Schedule}
          disabled={!hasSnapshot || isBusy}
          onDraftChange={(patch) =>
            setScheduleDrafts((current) => ({
              ...current,
              "26": {
                ...current["26"],
                ...patch,
              },
            }))
          }
          onSave={() => void saveSchedule("26")}
        />

        <ScheduleEditorCard
          relay="27"
          draft={scheduleDrafts["27"]}
          schedule={displaySnapshot.relay27Schedule}
          disabled={!hasSnapshot || isBusy}
          onDraftChange={(patch) =>
            setScheduleDrafts((current) => ({
              ...current,
              "27": {
                ...current["27"],
                ...patch,
              },
            }))
          }
          onSave={() => void saveSchedule("27")}
        />
      </section>
    </main>
  );
}
