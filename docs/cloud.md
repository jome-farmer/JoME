# App ↔ server contract (DouSHamBE)

What the app uses from [DouSHamBE](https://github.com/jome-farmer/DouSHamBE).
The decision is [ADR 0004](adr/0004-server-first.md). The board messages
themselves are [jome-farmer/protocol](https://github.com/jome-farmer/protocol)
v1, the same as over BLE and USB.

- Base URL: `https://api.jome-farmer.ir` by default, on the web and in the
  native apps. To use a local server, set `VITE_API_URL` (e.g.
  `http://<your Mac's LAN IP>:8000`) in your own `.env.local`, which git
  ignores, so phones on the same Wi‑Fi reach it too. Every path starts with
  `/v1`. Swagger is at https://api.jome-farmer.ir/docs.
- Auth: `Authorization: Bearer <accessToken>`. Tokens last 30 days; a `401`
  means sign in again.
- Times are epoch seconds, like the protocol.

## Errors

Every error has the protocol's shape, so the app keeps one code-to-text map:

```json
{
  "error": { "code": "DEVICE_OFFLINE", "message": "The board isn't connected" }
}
```

| Code                                         | Status    | Meaning, what the app does                                      |
| -------------------------------------------- | --------- | --------------------------------------------------------------- |
| `UNAUTHORIZED`                               | 401       | No, bad or expired token. Sign out                              |
| `BAD_REQUEST`                                | 422       | A field is invalid; `message` names it                          |
| `NOT_FOUND`                                  | 404       | No such device for this account, or the board's own `NOT_FOUND` |
| `DEVICE_OFFLINE`                             | 409       | The board isn't connected. Show the cloud copy                  |
| `TIMEOUT`                                    | 504       | The board didn't answer in time. Safe reads can retry           |
| `FORBIDDEN_REMOTE`                           | 403       | Local-only command (`wifi.*`). Needs the phone nearby           |
| `UNKNOWN_CMD`                                | 422       | This firmware lacks the command (`hello.cmds`)                  |
| `CODE_INVALID`                               | 400       | Wrong or expired sign-in code                                   |
| `TOO_MANY_REQUESTS`                          | 429       | Wait before asking for another code                             |
| `SEND_FAILED` / `CHANNEL_UNAVAILABLE`        | 502 / 503 | The code couldn't be sent                                       |
| `CLAIM_REJECTED`                             | 403       | Serial or label code is wrong                                   |
| `ALREADY_CLAIMED`                            | 409       | The board belongs to another account                            |
| Board codes (`ZONE_BUSY`, `VALVE_IN_USE`, …) | 409       | Passed through from the board unchanged                         |

## Sign-in

Passwordless. The same calls sign up and sign in; `created: true` means a new
account, so the app goes on to onboarding.

| Method | Calls                                                                                                            |
| ------ | ---------------------------------------------------------------------------------------------------------------- |
| Phone  | `POST /v1/auth/otp/start` `{channel: "phone", to: "+98912…"}` → `POST /v1/auth/otp/verify` `{channel, to, code}` |
| Email  | the same with `channel: "email"`                                                                                 |
| Google | `POST /v1/auth/google` `{idToken, nonce?}`, the ID token from the Google sign-in sheet                           |

- Phone numbers are E.164 Iranian mobiles (`+989…`). The app turns `0912…`
  into `+98912…`. SMS goes through Ghasedak, which only sends inside Iran.
- Codes are 6 digits, last 5 minutes, allow 5 tries, and one can be requested
  per minute.
- Every method returns `{accessToken, tokenType, user: {id, role, name,
identities}, created}`. `GET /v1/me` returns the user.
- **Dev:** sign-in uses the real providers. A local DouSHamBE without
  Ghasedak or SMTP set up writes each code to its log instead of sending it
  (`dev: sign-in code for +98912… is 123456`, see `docker compose logs -f api`).
  Google needs a real account. Everyone signs up as a customer; staff roles come
  from the server's `doushambe role` command.

### Google sign-in setup

The app uses `@capgo/capacitor-social-login` (Google only; Facebook, Apple
and Twitter are switched off in `capacitor.config.ts`, so their SDKs aren't
bundled). It sends a fresh `nonce` with each sign-in, and the ID token carries
it. Continue with Google shows only when the client IDs are set, in development
too; the web client ID is in the committed `.env`, so dev builds have it. The
server accepts tokens whose audience is that web client.

One Google Cloud project, three OAuth clients:

| Client  | Where it goes                                                                                                                                                                                                                                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web     | `VITE_GOOGLE_WEB_CLIENT_ID`, committed in `.env` (client IDs are public). Android and the web sign in with it, and it's the ID token's audience. Authorized JavaScript origins: `https://app.jome-farmer.ir`, `http://localhost:5173`. Authorized redirect URIs (the web popup returns there): `https://app.jome-farmer.ir/signin`, `http://localhost:5173/signin`. |
| Android | Nothing in the app. Package `ir.jomefarmer.jome` + the SHA-1 of each signing key: debug, upload, and Play App Signing.                                                                                                                                                                                                                                              |
| iOS     | `VITE_GOOGLE_IOS_CLIENT_ID`, plus its reversed form (`com.googleusercontent.apps.…`) as a URL scheme in `ios/App/App/Info.plist` (`CFBundleURLTypes`).                                                                                                                                                                                                              |

Android SHA-1s registered on the Android client (add a row when one is
registered; the signing steps are in [deployment.md](deployment.md#android-release-signing)):

| Key                                            | SHA-1                                                         |
| ---------------------------------------------- | ------------------------------------------------------------- |
| Maintainer debug (`~/.android/debug.keystore`) | `4E:B9:A0:39:B9:03:F7:DA:41:0A:FE:04:73:02:BF:A1:5F:B5:4F:D0` |
| Upload key (`jome-upload.jks`)                 | _to register after the key is created (#118)_                 |
| Play App Signing                               | _to register after the app exists in Play Console (#118)_     |

Another developer who tests sign-in on a debug build registers their own
debug key's SHA-1 (`./gradlew signingReport` in `android/`).

DouSHamBE must accept the web client ID as the token audience.

## Devices

| Call                                                | Use                                                                                           |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `POST /v1/devices/claim` `{serial, code}`           | Claim a board with its label code (QR `k`). Returns broker credentials once, for `server.set` |
| `GET /v1/devices`                                   | The account's boards, each with its cloud copy                                                |
| `GET /v1/devices/{serial}`                          | One board: `{serial, name, online, lastSeen, claimedAt, state}`                               |
| `POST /v1/devices/{serial}/commands` `{cmd, args?}` | Send one protocol command. `200 {data}` is the board's `data`                                 |
| `POST /v1/devices/{serial}/sync`                    | Pull to refresh: re-read everything from the board (202)                                      |
| `GET /v1/devices/{serial}/events?limit&before`      | Event history, newest first                                                                   |
| `GET /v1/devices/{serial}/events/stream`            | Live events (SSE)                                                                             |
| `DELETE /v1/devices/{serial}`                       | Unclaim                                                                                       |

`state` is the cloud copy. Each part is the board's `data` for that read
command, with the time it was read:

```json
"state": {
  "hello":    { "data": { "proto": 1, "fw": "…", "cmds": ["…"] }, "syncedAt": 1790814067 },
  "status":   { "data": { "wifi": {}, "rainDelayUntil": null, "running": [], "nextRun": null }, "syncedAt": 1790814070 },
  "zones":    { "data": { "zones": [] }, "syncedAt": 1790814067 },
  "programs": { "data": { "programs": [] }, "syncedAt": 1790814067 },
  "sensors":  { "data": { "temperatureC": 24.5, "flowLpm": 0, "totalLiters": 12.3 }, "syncedAt": 1790814067 },
  "usage":    { "data": { "days": [], "zones": [] }, "syncedAt": 1790814067 }
}
```

The server refreshes it when the board comes online, after every successful
write, on board events, and every 5 minutes while the board is online.

### Commands

- Only commands the protocol marks _any_ are accepted. `wifi.scan` and
  `wifi.set` give `FORBIDDEN_REMOTE`.
- Args are checked against the protocol limits before anything reaches the
  board.
- The server never queues a command for an offline board. It fails at once
  with `DEVICE_OFFLINE`.

### Live events (SSE)

```
event: zone.state
data: {"data": {"zone": 1, "state": "watering", "remaining": 90, "total": 90}, "at": 1790814070.55}

event: online
data: {"data": false, "at": 1790814099.1}
```

- `event` is the protocol event name, or `online` for the board connecting
  (`true`) or dropping (`false`).
- Comment lines (`: keepalive`, every 15 s) keep the stream open. Reconnect on
  close, then read `GET /v1/devices/{serial}` to catch up.
- `EventSource` can't send a bearer header, so read it with `fetch` and a
  `ReadableStream` (`services/client.ts`).

## Platform notes

- **Native apps:** the server is `https`, so there are no cleartext, mixed
  content or ATS allowances. A plain-`http` dev server (`VITE_API_URL=http://...`)
  works from the web dev server only, not in the native apps.
- **CORS:** the server allows `capacitor://localhost`, `https://localhost`,
  `http://localhost`, `http://localhost:5173` and `https://app.jome-farmer.ir`.
