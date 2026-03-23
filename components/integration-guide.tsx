import { getPublicAppUrl } from "@/lib/env";

type EndpointExample = {
  method: "GET" | "POST";
  path: string;
  description: string;
  payload?: string;
  response: string;
};

const endpointExamples: EndpointExample[] = [
  {
    method: "POST",
    path: "/api/device/register",
    description: "Register the ESP32 when it boots.",
    payload: `{
  "deviceId": "esp32-relay-01",
  "token": "DEVICE_SECRET"
}`,
    response: `{
  "success": true,
  "deviceId": "esp32-relay-01"
}`,
  },
  {
    method: "POST",
    path: "/api/device/ping",
    description: "Send a lightweight heartbeat from the ESP32.",
    payload: `{
  "deviceId": "esp32-relay-01",
  "token": "DEVICE_SECRET",
  "ip": "192.168.1.40"
}`,
    response: `{
  "success": true,
  "serverTime": "2026-03-23T04:20:00.000Z"
}`,
  },
  {
    method: "GET",
    path: "/api/device/sync?deviceId=esp32-relay-01&token=DEVICE_SECRET",
    description: "Fetch the compact desired relay state for ESP32 polling and reboot restore.",
    response: `{
  "ok": true,
  "r26": true,
  "r27": false,
  "ts": "2026-03-23T04:20:00.000Z"
}`,
  },
  {
    method: "POST",
    path: "/api/device/report",
    description: "Report the applied relay state back to the backend.",
    payload: `{
  "deviceId": "esp32-relay-01",
  "token": "DEVICE_SECRET",
  "relay26": true,
  "relay27": false
}`,
    response: `{
  "success": true
}`,
  },
  {
    method: "POST",
    path: "/api/relay/26",
    description: "Set relay 26 manually. If scheduling is enabled, this becomes a temporary override until the next schedule change.",
    payload: `{
  "adminToken": "ADMIN_SECRET",
  "state": true
}`,
    response: `{
  "success": true,
  "relay26": true,
  "updatedAt": "2026-03-23T04:20:00.000Z",
  "source": "manual-override",
  "overrideUntil": "2026-03-23T15:30:00.000Z"
}`,
  },
  {
    method: "POST",
    path: "/api/schedule/26",
    description: "Set relay 26 daily schedule. The backend handles time windows so the ESP32 only keeps polling desired state.",
    payload: `{
  "adminToken": "ADMIN_SECRET",
  "enabled": true,
  "startTime": "18:00",
  "endTime": "21:00",
  "timezone": "Asia/Kolkata"
}`,
    response: `{
  "success": true,
  "relay": "relay26",
  "relayState": false,
  "updatedAt": "2026-03-23T04:20:00.000Z",
  "schedule": {
    "enabled": true,
    "startTime": "18:00",
    "endTime": "21:00",
    "timezone": "Asia/Kolkata",
    "updatedAt": "2026-03-23T04:20:00.000Z",
    "active": false,
    "nextTransitionAt": "2026-03-23T12:30:00.000Z",
    "overrideUntil": null,
    "controlSource": "schedule"
  }
}`,
  },
  {
    method: "POST",
    path: "/api/schedule/27",
    description: "Set relay 27 daily schedule.",
    payload: `{
  "adminToken": "ADMIN_SECRET",
  "enabled": true,
  "startTime": "18:30",
  "endTime": "22:00",
  "timezone": "Asia/Kolkata"
}`,
    response: `{
  "success": true,
  "relay": "relay27",
  "relayState": false,
  "updatedAt": "2026-03-23T04:20:00.000Z",
  "schedule": {
    "enabled": true,
    "startTime": "18:30",
    "endTime": "22:00",
    "timezone": "Asia/Kolkata",
    "updatedAt": "2026-03-23T04:20:00.000Z",
    "active": false,
    "nextTransitionAt": "2026-03-23T13:00:00.000Z",
    "overrideUntil": null,
    "controlSource": "schedule"
  }
}`,
  },
  {
    method: "GET",
    path: "/api/dashboard/state",
    description: "Read full dashboard state with the admin token in a header.",
    response: `{
  "success": true,
  "deviceId": "esp32-relay-01",
  "relay26Desired": true,
  "relay27Desired": false,
  "relay26Reported": true,
  "relay27Reported": false,
  "lastSeen": "2026-03-23T04:20:00.000Z",
  "online": true,
  "updatedAt": "2026-03-23T04:20:00.000Z",
  "reportedAt": "2026-03-23T04:20:03.000Z",
  "storageMode": "upstash",
  "relay26Source": "schedule",
  "relay27Source": "manual",
  "relay26OverrideUntil": null,
  "relay27OverrideUntil": null
}`,
  },
];

function CodeBlock({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="rounded-[24px] border border-line/80 bg-slate-950 p-4 text-sm text-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
      <p className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[13px] leading-6">
        <code>{value}</code>
      </pre>
    </div>
  );
}

export default function IntegrationGuide() {
  const baseUrl = getPublicAppUrl() || "https://your-project-name.vercel.app";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[30px] border border-line/80 bg-panel-strong/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
        <p className="text-sm uppercase tracking-[0.32em] text-foreground/45">
          ESP32 integration
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Exact endpoint URLs and firmware flow for the deployed backend.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-foreground/70">
          The backend owns timing and scheduling now. The ESP32 only registers,
          pings, syncs desired relay state, applies GPIO outputs, and reports
          what it actually did.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-line/80 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">
              Base URL
            </p>
            <p className="mt-2 break-all font-mono text-sm">{baseUrl}</p>
          </div>
          <div className="rounded-[24px] border border-line/80 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">
              Firmware file
            </p>
            <p className="mt-2 break-all font-mono text-sm">
              firmware/esp32_light_control/esp32_light_control.ino
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-line/80 bg-panel-strong/85 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Boot and power-restore flow
        </h2>
        <ol className="mt-4 grid gap-3 text-sm leading-6 text-foreground/75">
          <li className="rounded-2xl bg-background/55 px-4 py-3">
            1. Power comes back and the ESP32 boots.
          </li>
          <li className="rounded-2xl bg-background/55 px-4 py-3">
            2. It reconnects to Wi-Fi and calls <code>/api/device/register</code>.
          </li>
          <li className="rounded-2xl bg-background/55 px-4 py-3">
            3. It calls <code>/api/device/sync</code> immediately.
          </li>
          <li className="rounded-2xl bg-background/55 px-4 py-3">
            4. The backend returns the current desired state, including schedule effects.
          </li>
          <li className="rounded-2xl bg-background/55 px-4 py-3">
            5. The ESP32 reapplies relay 26 and relay 27 and reports the result.
          </li>
        </ol>
      </section>

      <section className="grid gap-4">
        {endpointExamples.map((example) => {
          const fullUrl = `${baseUrl}${example.path}`;

          return (
            <article
              key={`${example.method}-${example.path}`}
              className="rounded-[28px] border border-line/80 bg-panel-strong/85 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${
                        example.method === "GET"
                          ? "bg-sky-500/12 text-sky-700 dark:text-sky-300"
                          : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {example.method}
                    </span>
                    <p className="font-display text-xl font-semibold tracking-tight">
                      {example.path}
                    </p>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/70">
                    {example.description}
                  </p>
                </div>

                <div className="rounded-2xl bg-background/65 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">
                    Absolute URL
                  </p>
                  <p className="mt-2 max-w-xl break-all font-mono text-sm">{fullUrl}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {example.payload ? (
                  <CodeBlock label="Example request body" value={example.payload} />
                ) : (
                  <CodeBlock label="Example request" value={`${example.method} ${fullUrl}`} />
                )}
                <CodeBlock label="Example response" value={example.response} />
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
