# Game engine

The first application package implements pure TypeScript Manhunt lobby and timer rules. Run `npm test` with Node 24 or newer. Node's native TypeScript support executes the tests without build dependencies; this does not replace static type checking when the app toolchain is introduced.

Create a session, submit authenticated commands through `transition`, and call `advance` using authoritative milliseconds. Inputs are not mutated. Persist the returned state and receipts together before acknowledging a command. Adapters must serialize commands and derive `actorId` from credentials. Command receipts currently grow with the session; transport rate limits and retention belong in the future coordinator.

Implemented: 4–20 player lobby, host role assignment, readiness invalidation, start/abort authorization, command retries, preparation/head start/hunting deadlines, reveal timing, and timer-based runner victory. Preparation defaults to ten seconds for development. Other defaults follow the proposed preset; these are not field-validated production rules.

Not yet implemented: complete transport protocol, mobile screens, guest credentials, durable storage, device GPS collection, private photo uploads, forfeits, or durable capture scheduling. The session state contains no location data. `revealWindow` returns timing metadata only and does not authorize or disclose coordinates. Readiness is a declaration here; a future device/coordinator adapter must verify permission and location status before start.

Provider and device spikes remain required. The existing browser prototype remains a separate simulated design artifact. Workspace package boundaries are introduced with the existing npm workflow; pnpm/Turborepo migration is deferred until multiple application build tasks exist.

## Client command validation

`parseClientCommand(payload, authenticatedActorId)` validates a JSON-decoded command before `transition`. Clients send `id`, `type`, and only that command's fields. Actor identity comes from credentials; client actor IDs, server timestamps, context, unknown fields, missing fields, and coerced values are rejected. IDs and names are nonblank strings bounded to 80 characters. Reconstructed commands have stable property order, so reordered JSON retries produce the same engine receipt fingerprint. Authentication, JSON decoding, request size/rate limits, protocol versioning, and response envelopes still belong to the future transport. Validation does not replace engine authorization or trusted capture context.

`parseClientLocation(payload, authenticatedActorId)` accepts exactly five numeric fields: `latitude`, `longitude`, `accuracyMeters`, `observedAt`, and `sequence`. Coordinates must be within geographic bounds, accuracy finite and nonnegative, and timestamps/sequences nonnegative safe integers. Identity, session association, and receipt time come from the server. Missing/extra fields and coercions reject with `invalid_sample`; invalid actor identity rejects with `invalid_actor`. Parsing returns a copied sample. Freshness, accuracy policy, sequence ordering, and membership remain ingestion checks.

For example, a device sends `{ "latitude": 50, "longitude": 4, "accuracyMeters": 2, "observedAt": 40, "sequence": 1 }`. Times are milliseconds; sequence counters must continue across reconnects. Location retries with an already accepted sequence reject as `out_of_order` rather than creating command receipts. JSON decoding and byte limits must precede these parsers; they are intended for decoded JSON objects, not arbitrary executable objects.

## Location foundation

The package also exports `distanceMeters`, `observationRejection`, `assessProximity`, and `assessBoundary`. These pure helpers validate coordinates, sequence ordering, timestamp plausibility, freshness, and accuracy; compute great-circle distance; and distinguish clear proximity from ambiguous GPS uncertainty. Circular boundary assessment uses configurable hysteresis and preserves the previous clear status for uncertain or unavailable samples. Callers must inspect the reason before displaying a retained boundary status as current.

All policy thresholds are required caller inputs, with no production defaults. Observation times use milliseconds and distances use meters. Adapters must supply authenticated associations and server receipt times, keep accepted observations and sequence history private, and recheck freshness when using them. These helpers do not establish physical presence, ingest data into sessions, disclose coordinates, or authorize captures. Thresholds and the accuracy heuristic still need field validation.

## Private tracking and reveals

`createTracking` creates server-only companion state. `ingestLocation` checks session membership, gameplay phase, GPS policy, and increasing sample sequences, stamps receipt time, and retains one observation per player. Authenticate the actor in the adapter; never accept an actor ID or receipt time from a phone as authority. A reconnect must resume its sequence counter; device identity/reset negotiation remains future work.

`reconcileTracking` freezes eligible runner observations at each reveal start. Call it from the coordinator at scheduled boundaries and before incoming commands, and persist it together with `advance` session state before projecting or acknowledging. Samples received after a window starts cannot populate that window. Recovery can use retained samples received before the original start, but cannot reconstruct overwritten history; unavailable markers are omitted. Expired windows are discarded and terminal sessions clear observations and reveal snapshots. Run reconciliation after host abort as well as timer expiry.

`projectLocations` returns a fresh own marker and, for hunters only, the current frozen reveal. Hosts receive their gameplay role's view. Outsiders and terminal sessions receive no locations. Projection copies prevent callers from modifying private observations or snapshots. Never broadcast `TrackingState` or internal session storage. Clients must also expire cached markers locally using server deadlines; server filtering alone cannot erase an offline client's cache.

These are pure domain helpers, not a network service. Durable scheduling/storage, transport schemas, rate limiting, and mobile tracking remain future work. One latest observation per member bounds storage without retaining a movement trail; numeric policy values still require field testing.

## Capture lifecycle

`transition` accepts `capture`, `accept_capture`, `dispute_capture`, and `review_capture`. Supply trusted `CaptureContext` for submission: private server observations, verified completed-upload metadata bound to session/owner, location policy, radius, and positive response/review durations. Context is adapter data, not a client payload. No default capture thresholds or deadlines are production-approved. Evidence IDs cannot be reused for another attempt.

An eligible attempt stays pending without elimination. The target can accept or dispute before its deadline; otherwise `advance` auto-confirms. Only the host can approve/reject disputes; unresolved disputes expire. Confirmation eliminates once and expires competing attempts on that runner. Capturing every runner ends with hunter victory. Command retries use existing session receipts. Game expiry takes priority over unresolved attempts, even during delayed recovery; abort expires pending attempts too.

Reconcile and persist tracking after capture transitions. Eliminated players lose collection/disclosure eligibility and disappear from frozen markers. Capture records contain private evidence references: do not broadcast raw session state. A future transport must verify actual uploads, schedule all deadlines, and clean up evidence. Domain tests do not establish device or backend readiness.

## Client session views

`projectSession` reconciles time and returns a copied member view of roster, settings, deadlines, results, and permitted captures. Outsiders receive no view. Command receipts and internal review policy are omitted. Hunters and targets see their attempts; hosts additionally see current disputes. Other members learn elimination through the roster without receiving private attempts.

Evidence references appear only during active, unresolved attempts. `canViewCaptureEvidence` rechecks the same authorization for every media request, including deadline expiry. Hosts receive review evidence only for disputes. Final decisions and terminal sessions revoke evidence access under this initial policy; post-game evidence retention/access remains a product decision. An evidence ID is not a signed URL or credential. The media adapter must authenticate membership, enforce this check, and avoid issuing URLs that outlive authorization. Persist advanced session state before delivery; projection alone does not persist deadline effects. Location delivery still uses `projectLocations` separately.

## Scheduling boundaries

`nextWakeAt(state, now)` returns the earliest strictly future gameplay boundary after reconciling server time: runner release, hunter release, reveal start/expiry, capture response/review deadline, or round end. Lobby and terminal sessions return `undefined`. Recovery skips expired windows and resolved attempts; game expiry retains its priority over captures. Continuous reveal windows and windows truncated by game end are supported.

This helper does not schedule or persist anything. On each alarm or incoming operation, the coordinator must advance session state, reconcile tracking, persist both before delivery, and then replace its alarm with `nextWakeAt` (or remove it when undefined). Recompute after every command because captures, disputes, and early victory change the next boundary. Scheduled reveals must freeze tracking before same-time location ingestion. Durable alarm reliability, persistence transactions, cleanup deadlines, and provider integration remain future work.

## Coordinated operations

`SessionAggregate` groups private session and tracking storage. `reconcileSession` handles alarms, recovery, and reads; `coordinateCommand` parses client commands with an authenticated actor and supplies capture context from the aggregate; `coordinateLocation` validates unknown device payloads before ingestion. Each returns an aggregate and `wakeAt`. Reconciliation occurs before processing, including rejected commands, malformed locations, and retries, and after commands so elimination or abort immediately removes private tracking. Reveals freeze before same-time samples arrive.

Serialize operations per session, atomically persist the returned aggregate, replace or remove the alarm, then acknowledge and deliver `projectSessionAggregate` views. The projection uses the aggregate's recorded time; reads must reconcile and persist first. Never deliver the aggregate itself. Capture policy and completed-upload evidence are trusted adapter inputs; decoding, byte/rate limits, authentication, concurrency control, durable storage, and alarm delivery remain adapter responsibilities. These pure operations do not perform I/O or establish backend readiness.
