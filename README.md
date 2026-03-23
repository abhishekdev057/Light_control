# Light Control Dashboard

A full-stack Next.js App Router project for controlling an ESP32 with two relays on GPIO 26 and GPIO 27 over HTTP.

## What this app includes

- Responsive dashboard UI for relay 26 and relay 27
- Desired state vs. reported state tracking
- Device online/offline status using heartbeat timing
- Token-based auth for both device and admin requests
- Daily per-relay scheduling with admin-set start time, end time, and timezone
- Manual relay buttons with locking during active schedule windows
- Power-restore-safe ESP32 flow where the board fetches desired state again after boot
- Vercel-friendly route handlers under `app/api`
- Storage abstraction with three modes:
  - Upstash Redis via `KV_REST_API_URL` and `KV_REST_API_TOKEN`
  - Local JSON file storage during development
  - In-memory fallback when no persistent store is configured
- ESP32 integration page at `/integration`
- Single-file ESP32 firmware at `firmware/esp32_light_control/esp32_light_control.ino`

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Zod validation
- Upstash Redis for Vercel KV-compatible REST storage

## Environment variables

Create a local `.env.local` file from `.env.example`:

```bash
DEVICE_SECRET=your_device_secret_here
ADMIN_SECRET=your_admin_secret_here
KV_REST_API_URL=
KV_REST_API_TOKEN=
NEXT_PUBLIC_APP_URL=https://your-project-name.vercel.app
```

Notes:

- `DEVICE_SECRET` secures ESP32 endpoints.
- `ADMIN_SECRET` secures dashboard relay updates and schedule changes.
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` enable persistent hosted storage on Vercel-compatible Redis.
- If Redis credentials are missing, local development uses `.data/device-state.json`.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## API endpoints

### Device endpoints

- `POST /api/device/register`
- `POST /api/device/heartbeat`
- `POST /api/device/ping`
- `GET /api/device/state`
- `GET /api/device/sync`
- `POST /api/device/report`

### Dashboard and admin endpoints

- `GET /api/dashboard/state`
- `POST /api/relay/26`
- `POST /api/relay/27`
- `POST /api/relay/all`
- `POST /api/schedule/26`
- `POST /api/schedule/27`

## Scheduling behavior

Each relay now has its own daily schedule:

- `enabled`
- `startTime`
- `endTime`
- `timezone`

When a schedule is enabled:

- Inside the schedule window, the relay target becomes `ON`
- Outside the schedule window, the relay target becomes `OFF`
- During the active schedule window, manual buttons are locked until the schedule is disabled
- Outside the active schedule window, manual button changes are allowed until the next schedule transition

Examples:

- Schedule `18:00` to `21:00`: relay turns on at 6:00 PM and turns off at 9:00 PM
- Admin turns it on at 4:00 PM: it stays on until 6:00 PM, then the schedule window takes over
- At 7:30 PM, manual buttons are locked because the schedule window is active

## Request examples

### Register device

```http
POST /api/device/register
Content-Type: application/json

{
  "deviceId": "esp32-relay-01",
  "token": "DEVICE_SECRET"
}
```

### Ping device

```http
POST /api/device/ping
Content-Type: application/json

{
  "deviceId": "esp32-relay-01",
  "token": "DEVICE_SECRET",
  "ip": "192.168.1.40"
}
```

### Sync relay state for ESP32

```http
GET /api/device/sync?deviceId=esp32-relay-01&token=DEVICE_SECRET
```

Response:

```json
{
  "ok": true,
  "r26": true,
  "r27": false,
  "ts": "2026-03-23T04:20:00.000Z"
}
```

### Report applied state

```http
POST /api/device/report
Content-Type: application/json

{
  "deviceId": "esp32-relay-01",
  "token": "DEVICE_SECRET",
  "relay26": true,
  "relay27": false
}
```

### Set relay 26 manually

```http
POST /api/relay/26
Content-Type: application/json

{
  "adminToken": "ADMIN_SECRET",
  "state": true
}
```

### Save relay 26 schedule

```http
POST /api/schedule/26
Content-Type: application/json

{
  "adminToken": "ADMIN_SECRET",
  "enabled": true,
  "startTime": "18:00",
  "endTime": "21:00",
  "timezone": "Asia/Kolkata"
}
```

### Read dashboard state

```http
GET /api/dashboard/state
x-admin-token: ADMIN_SECRET
```

## ESP32 firmware

The firmware file is:

- `firmware/esp32_light_control/esp32_light_control.ino`

What it does:

1. Connects to Wi-Fi
2. Registers with `/api/device/register`
3. Immediately calls `/api/device/sync` after boot
4. Applies relay 26 and relay 27 state
5. Reports the applied state back
6. Keeps pinging and syncing in the loop

Important:

- The firmware expects `BASE_URL` to be your deployed Vercel domain
- It uses HTTPS with `WiFiClientSecure`
- Set `RELAY_ACTIVE_HIGH` to `false` if your relay board is active LOW

## Power cut and restore behavior

State is preserved because the backend stores:

- manual desired state
- schedule configuration
- temporary manual overrides outside active schedule windows
- device reported state

After ESP32 power returns:

1. The board boots
2. It reconnects to Wi-Fi
3. It requests `/api/device/sync`
4. The backend returns the current desired relay state
5. The board applies it again

That means the relays come back to the backend-controlled state even after a power cut.

## Vercel deployment

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Set `DEVICE_SECRET` and `ADMIN_SECRET`.
4. Add Redis integration credentials as `KV_REST_API_URL` and `KV_REST_API_TOKEN` if you want persistent hosted state.
5. Set `NEXT_PUBLIC_APP_URL` to your production domain.
6. Deploy.

After deploy:

- Use the dashboard with the admin token
- Open `/integration` to copy exact URLs and JSON payloads for the ESP32
- Update the firmware `BASE_URL` value to your real deployed domain

## Storage behavior

- Hosted production persistence should use `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- Development without Redis uses `.data/device-state.json`
- Production without Redis falls back to in-memory storage, which is not durable across cold starts

## GitHub remote

The configured remote is:

```bash
git remote add origin git@github.com:abhishekdev057/Light_control.git
git branch -M main
git push -u origin main
```
