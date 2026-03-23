"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/constants";
import {
  fetchDashboardState,
  postRelayGroup,
  postRelayState,
} from "@/lib/client/dashboard-api";
import type { DashboardStateResponse } from "@/lib/types";

type RelayNumber = "26" | "27";

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
};

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
  disabled,
  onToggle,
}: Readonly<{
  relay: RelayNumber;
  desired: boolean;
  reported: boolean | null;
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

      <div className="rounded-[24px] border border-line/80 bg-background/55 p-3">
        <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">
          Toggle state
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

export default function DashboardClient() {
  const [adminToken, setAdminToken] = useState("");
  const [snapshot, setSnapshot] = useState<DashboardStateResponse | null>(null);
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
  }, []);

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
      await loadDashboard(token, true);
      setNotice(`Relay ${relay} updated successfully.`);
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
      await loadDashboard(token, true);
      setNotice("Both relay states were updated.");
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

  function clearToken() {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setAdminToken("");
    setSnapshot(null);
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
                    HTTP relay control for an ESP32, ready for Vercel.
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/70">
                    Use the dashboard to set the desired state for GPIO 26 and 27,
                    let the ESP32 poll the backend, and compare desired versus
                    reported relay state in one place.
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
                <StatePill
                  label="Device"
                  value={displaySnapshot.deviceId}
                  tone="neutral"
                />
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
          disabled={!hasSnapshot || isBusy}
          onToggle={(nextState) => void updateSingleRelay("26", nextState)}
        />

        <RelayCard
          relay="27"
          desired={displaySnapshot.relay27Desired}
          reported={displaySnapshot.relay27Reported}
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
              Recommended ESP32 flow
            </h2>
          </div>

          <ol className="grid gap-3 text-sm leading-6 text-foreground/75">
            <li className="rounded-2xl bg-background/55 px-4 py-3">
              1. Register once after Wi-Fi connects.
            </li>
            <li className="rounded-2xl bg-background/55 px-4 py-3">
              2. Ping every few seconds so the dashboard stays online.
            </li>
            <li className="rounded-2xl bg-background/55 px-4 py-3">
              3. Poll <code>/api/device/sync</code> every 1-2 seconds.
            </li>
            <li className="rounded-2xl bg-background/55 px-4 py-3">
              4. Apply GPIO 26 and GPIO 27, then call <code>/api/device/report</code>.
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
    </main>
  );
}
