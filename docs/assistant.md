# AI assistant: app ↔ agent contract (draft)

This is the contract between the app and the JoME agent backend. It is a
**proposal**: adapt the transport details to the backend's real API, but keep
the tool split and the safety rules from [ADR 0002](adr/0002-ai-assistant.md).

## Flow

```
User types ──► app ──POST /chat (SSE)──► agent
                                          │ knowledge tools run server-side
        ◄── text.delta / source ──────────┤
        ◄── tool.call (device tool) ──────┘
app: validate → [read/stop: run now | act: action card → user confirms]
     → DeviceClient.request(...) over BLE/USB
app ──POST /chat/{turnId}/tool-result──► agent ──► continues streaming
```

## Endpoints (proposed)

`POST /v1/chat` returns `text/event-stream`:

```json
{
  "conversationId": "c_81f…",          // omitted for a new chat
  "message": { "text": "Rain is coming tonight, what should I do?" },
  "context": {
    "device": { "serial": "JM-2024-0001", "name": "Front garden", "fw": "1.4.2" },
    "status": { "running": [], "rainDelayUntil": null },
    "zones":  [{ "zone": 1, "name": "Front lawn", "enabled": true, "defaultSeconds": 1200 }],
    "programs": [ /* Program[] from device-protocol.md */ ],
    "locale": "en", "timezone": "Asia/Tehran"
  }
}
```

The `context` is a fresh snapshot, so the model reasons about the real board
and not a stale memory of it.

SSE events:

| event | data |
|---|---|
| `turn` | `{conversationId, turnId}` (first event) |
| `text.delta` | `{text}` |
| `source` | `{id, title, publisher, url?}`, a citation from a knowledge tool |
| `tool.call` | `{callId, name, args}`, a **device tool** for the app to execute |
| `status` | `{text}`, a short progress line such as "Checking the forecast…" |
| `done` | `{}` |
| `error` | `{code, message}` |

`POST /v1/chat/{turnId}/tool-result` takes one of these bodies:

```json
{ "callId": "t1", "ok": true, "data": { } }
{ "callId": "t1", "ok": false, "error": { "code": "USER_DECLINED", "message": "User tapped Cancel" } }
```

The agent keeps streaming on the open SSE connection after it receives the
result.

Auth: a bearer token from the JoME account. **Open question:** there are no
accounts yet (see the roadmap).

## Device tools

Every tool maps one-to-one to a command in
[device-protocol.md](device-protocol.md). The app refuses any tool name that
isn't listed here.

| Tool | Protocol command | Tier | App-side limits |
|---|---|---|---|
| `get_status` | `status` | read | — |
| `list_zones` | `zones.list` | read | — |
| `list_programs` | `programs.list` | read | — |
| `stop_zone` | `zone.stop` | stop | — |
| `stop_all` | `stop.all` | stop | — |
| `run_zone` | `zone.run` | **act** | zone exists and is enabled, 1–60 min |
| `set_rain_delay` | `rain.delay` | **act** | 0–168 h |
| `update_zone` | `zone.update` | **act** | name up to 32 chars, default 1–60 min, valve free and in range |
| `save_program` | `program.save` | **act** | ≤ 16 steps, each 1–60 min, valid days and time |
| `delete_program` | `program.delete` | **act** | — |

Tiers:
- **read** runs immediately and shows a quiet "Checked zones" line in the chat.
- **stop** runs immediately and shows a result card, because closing water is
  always safe.
- **act** shows an **action card**: a plain-language summary, a before→after
  diff for program changes, and *Cancel* / *Confirm* buttons. If the user
  declines, the app returns `USER_DECLINED`. A card left alone for 2 minutes
  expires and returns `TIMEOUT`.

## Where this lives in the app

`src/features/assistant/tools.ts` is the safety boundary: the tool allow-list,
the tiers and the limits above, with tests for every refusal. `useChat.ts` runs
read and stop tools on their own and holds act tools behind an action card.
Until the real agent is connected (#22), a scripted **preview agent** speaks
the same contract so the screens can be used. It's labelled *Preview* in the
UI and uses only the controller's own data.

## App-side rules

- Tool calls run one at a time, in the order they arrive.
- Each result sent back is the board's real response, never an optimistic guess.
- If no board is connected, device tools return `NO_DEVICE`, and the chat shows
  *Connect to your JoME to let me do that*.
- Conversations are stored on the backend. The app keeps only the current
  `conversationId` per device.
- The first time the assistant is opened, a consent sheet explains what is
  sent (garden data, location or time zone, messages) and links the privacy
  policy.

## Open questions for the agent team

1. What is the real API shape: this SSE proposal, an OpenAI-compatible
   `/chat/completions` with tools, or something else?
2. Does the model accept photos (for example of leaf disease)? If so, the
   composer gets a camera button (`@capacitor/camera`).
3. Should the agent be able to show proactive insights ("6 mm rain tonight,
   delay?") on the Home screen? That needs push notifications or polling.
4. Which languages does the fine-tuned model support: Persian, English, both?
5. Is voice input wanted? Gloved or muddy hands make it valuable outdoors.
