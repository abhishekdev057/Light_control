# Light Control Dashboard

A full-stack Next.js App Router project for controlling an ESP32 with two relays on GPIO 26 and GPIO 27 over HTTP.

## What this app includes

- Responsive dashboard UI for relay 26 and relay 27
- Desired state vs. reported state tracking
- Device online/offline status using heartbeat timing
- Token-based auth for both device and admin requests
- Vercel-friendly route handlers under `app/api`
- Storage abstraction with three modes:
  - Upstash Redis via `KV_REST_API_URL` and `KV_REST_API_TOKEN`
  - Local JSON file storage during development
  - In-memory fallback when no persistent store is configured
- ESP32 integration page at `/integration`

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
- `ADMIN_SECRET` secures dashboard relay updates and dashboard state reads.
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

### Set relay 26 from dashboard

```http
POST /api/relay/26
Content-Type: application/json

{
  "adminToken": "ADMIN_SECRET",
  "state": true
}
```

### Read dashboard state

```http
GET /api/dashboard/state
x-admin-token: ADMIN_SECRET
```

## ESP32 flow

Recommended loop:

1. Connect to Wi-Fi.
2. `POST /api/device/register` once after boot.
3. `POST /api/device/ping` every few seconds.
4. `GET /api/device/sync` every 1-2 seconds.
5. Apply GPIO 26 and GPIO 27.
6. `POST /api/device/report` after applying relay state.

## Vercel deployment

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Set `DEVICE_SECRET` and `ADMIN_SECRET`.
4. Add Redis integration credentials as `KV_REST_API_URL` and `KV_REST_API_TOKEN` if you want persistent hosted state.
5. Set `NEXT_PUBLIC_APP_URL` to your production domain.
6. Deploy.

After deploy:

- Use the dashboard with the admin token.
- Open `/integration` to copy exact URLs and JSON payloads for the ESP32.

## Storage behavior

- Hosted production persistence should use `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
- Development without Redis uses `.data/device-state.json`.
- Production without Redis falls back to in-memory storage, which is not durable across cold starts.

## GitHub remote

If you are pushing manually, the intended remote is:

```bash
git remote add origin git@github.com:abhishekdev057/Light_control.git
git branch -M main
git push -u origin main
```
