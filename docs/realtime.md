# Realtime and connection recovery

**Status:** Protocol 1 is implemented locally with HTTP intentions, recipient snapshots, authenticated hibernating WebSockets, durable receipts/alarms, and restart recovery. External SQL export remains proposed.

Endpoints: `POST /games`, `POST /games/:code/join`; authenticated `GET /sessions/:id`, `POST /sessions/:id/commands`, `POST /sessions/:id/locations`, `POST /sessions/:id/evidence`, `GET /sessions/:id/evidence/:evidenceId`, and `DELETE /sessions/:id/membership`. `/sessions/:id/realtime` upgrades to WebSocket; its first message must be `{type: "handshake", protocol: 1, token}` within ten seconds. Tokens never appear in invitation or WebSocket URLs. Commands use HTTP with original-ID retries; snapshot delivery includes five-second HTTP recovery.

## Authority and connections

Each session uses one Durable Object coordinator. Clients connect through an authenticated WebSocket scoped to their player membership. A game code discovers a lobby; it does not authorize a connection.

The coordinator receives validated commands, processes due deadlines, serializes mutations, persists the resulting transition, and sends recipient-specific updates. Presence does not alter elimination state.

## Message categories

| Message | Direction | Purpose |
| --- | --- | --- |
| Handshake | Client → server | Protocol version and session credential |
| Snapshot | Server → client | Complete authorized view, state version, server time |
| Command | Client → server | Unique command ID and validated intention |
| Receipt | Server → client | Accepted/rejected outcome and relevant state version |
| Update | Server → client | Authorized changes or replacement view |
| Time sync / heartbeat | Both | Clock offset estimate and connection health |
| Error | Server → client | Typed recoverable or terminal failure |

Use one contract version across HTTP and WebSocket entry points. Bound message size and frequency, validate runtime payloads, and derive actor/session authorization from credentials.

## Ordering and idempotency

Internal events have a per-session sequence. Public views have a state version. An internal version jump does not imply that the client is entitled to the intervening events.

The MVP should prefer a fresh authorized snapshot after reconnect or detected desynchronization. If patches are used, include their required base version. Never replay the raw event log to clients.

Unique command IDs and durable receipts make a lost acknowledgement safe to retry. Retain receipts for the supported retry horizon. An expired receipt horizon must not permit an old capture to be applied again.

## Timers

Server deadlines control countdowns, hunting time, reveal windows, and capture-response windows. Clients display estimated countdowns from server time, but cannot trigger authoritative outcomes.

Persist deadlines and reconcile them on coordinator activation, alarms, and incoming commands. Delayed alarms must advance the game to the correct current state; they must not shift deadlines or reopen expired reveals.

## Privacy projections

Every snapshot/update is built for its recipient. Hunters receive runner positions only during an allowed reveal. Runners and eliminated players receive only their configured view. Host authorization does not grant an omniscient map.

Include disclosure expiry with location markers and remove them locally at expiry even if the hide message is lost. A disconnect cannot extend a reveal. The server cannot make a player forget a position they already saw; expiry limits continuing app disclosure.

## Offline behavior

- Cache non-sensitive rules, roster, own position, and authoritative status with an age indicator.
- Clear expired opponent markers from cache and rendering.
- Show connection loss and reconnect automatically with backoff and jitter.
- Keep only a bounded recent buffer of own samples; stale locations cannot become fresh by uploading later.
- Retry acknowledged-safe commands with their original IDs.
- Require live connectivity for new capture attempts in the MVP; a local photo is not a confirmed capture.
- Rejoin with the same membership credential and fetch an authoritative snapshot.

Do not queue arbitrary gameplay actions for later retroactive execution. A proposal to support offline capture requires its own time/evidence/cheating policy.

## Recovery and persistence

Restore state, scheduled deadlines, capture statuses, receipts, and pending persistence exports from durable storage. Re-evaluate due transitions, then build current recipient projections.

Write export records alongside committed transitions and deliver them to SQL idempotently. Do not announce accepted outcomes before their live transition is durable. Process restart and database-export outage should have separate observable failure states.

## Verification

Check reconnect during head start/reveal/dispute, lost acknowledgement, duplicated commands, two competing captures, delayed alarms, coordinator restart, SQL outage, and expired credentials. Include network payload inspection to demonstrate that hidden positions are absent.
