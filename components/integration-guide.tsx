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
    description: "Fetch the compact desired relay state for ESP32 polling.",
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
  "storageMode": "upstash"
}`,
  },
  {
    method: "POST",
    path: "/api/relay/26",
    description: "Set the desired state for relay 26 from the dashboard.",
    payload: `{
  "adminToken": "ADMIN_SECRET",
  "state": true
}`,
    response: `{
  "success": true,
  "relay26": true,
  "updatedAt": "2026-03-23T04:20:00.000Z"
}`,
  },
  {
    method: "POST",
    path: "/api/relay/27",
    description: "Set the desired state for relay 27 from the dashboard.",
    payload: `{
  "adminToken": "ADMIN_SECRET",
  "state": false
}`,
    response: `{
  "success": true,
  "relay27": false,
  "updatedAt": "2026-03-23T04:20:00.000Z"
}`,
  },
  {
    method: "POST",
    path: "/api/relay/all",
    description: "Update both desired relay states in a single request.",
    payload: `{
  "adminToken": "ADMIN_SECRET",
  "relay26": true,
  "relay27": true
}`,
    response: `{
  "success": true,
  "relay26": true,
  "relay27": true,
  "updatedAt": "2026-03-23T04:20:00.000Z"
}`,
  },
  {
    method: "POST",
    path: "/api/device/heartbeat",
    description: "Alias for device ping if you prefer the original endpoint name.",
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
    path: "/api/device/state?deviceId=esp32-relay-01&token=DEVICE_SECRET",
    description: "Verbose state endpoint if you want full field names on the device.",
    response: `{
  "success": true,
  "deviceId": "esp32-relay-01",
  "relay26": true,
  "relay27": false,
  "updatedAt": "2026-03-23T04:20:00.000Z"
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
          Exact endpoint URLs and payloads for the deployed backend.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-foreground/70">
          Keep the dashboard on relative URLs inside the app, but use the absolute
          deployment URL below when wiring the ESP32 firmware and any external
          integration tests.
        </p>

        <div className="mt-6 rounded-[24px] border border-line/80 bg-background/60 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">
            Base URL
          </p>
          <p className="mt-2 break-all font-mono text-sm">{baseUrl}</p>
        </div>
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
                  <CodeBlock
                    label="Example request"
                    value={`${example.method} ${fullUrl}`}
                  />
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
