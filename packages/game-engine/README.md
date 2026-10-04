# Game engine

The first application package implements pure TypeScript Manhunt lobby and timer rules. Run `npm test` with Node 24 or newer. Node's native TypeScript support executes the tests without build dependencies; this does not replace static type checking when the app toolchain is introduced.

Create a session, submit authenticated commands through `transition`, and call `advance` using authoritative milliseconds. Inputs are not mutated. Persist the returned state and receipts together before acknowledging a command. Adapters must serialize commands and derive `actorId` from credentials. Command receipts currently grow with the session; transport rate limits and retention belong in the future coordinator.

Implemented: 4–20 player lobby, host role assignment, readiness invalidation, start/abort authorization, command retries, preparation/head start/hunting deadlines, reveal timing, and timer-based runner victory. Preparation defaults to ten seconds for development. Other defaults follow the proposed preset; these are not field-validated production rules.

Not yet implemented: transport schemas, mobile screens, guest credentials, durable storage, device GPS collection, capture/dispute rules, forfeits, or hunter victory. The session state contains no location data. `revealWindow` returns timing metadata only and does not authorize or disclose coordinates. Readiness is a declaration here; a future device/coordinator adapter must verify permission and location status before start.

Provider and device spikes remain required. The existing browser prototype remains a separate simulated design artifact. Workspace package boundaries are introduced with the existing npm workflow; pnpm/Turborepo migration is deferred until multiple application build tasks exist.

## Location foundation

The package also exports `distanceMeters`, `observationRejection`, `assessProximity`, and `assessBoundary`. These pure helpers validate coordinates, sequence ordering, timestamp plausibility, freshness, and accuracy; compute great-circle distance; and distinguish clear proximity from ambiguous GPS uncertainty. Circular boundary assessment uses configurable hysteresis and preserves the previous clear status for uncertain or unavailable samples. Callers must inspect the reason before displaying a retained boundary status as current.

All policy thresholds are required caller inputs, with no production defaults. Observation times use milliseconds and distances use meters. Adapters must supply authenticated associations and server receipt times, keep accepted observations and sequence history private, and recheck freshness when using them. These helpers do not establish physical presence, ingest data into sessions, disclose coordinates, or authorize captures. Thresholds and the accuracy heuristic still need field validation.

## Private tracking and reveals

`createTracking` creates server-only companion state. `ingestLocation` checks session membership, gameplay phase, GPS policy, and increasing sample sequences, stamps receipt time, and retains one observation per player. Authenticate the actor in the adapter; never accept an actor ID or receipt time from a phone as authority. A reconnect must resume its sequence counter; device identity/reset negotiation remains future work.

`reconcileTracking` freezes eligible runner observations at each reveal start. Call it from the coordinator at scheduled boundaries and before incoming commands, and persist it together with `advance` session state before projecting or acknowledging. Samples received after a window starts cannot populate that window. Recovery can use retained samples received before the original start, but cannot reconstruct overwritten history; unavailable markers are omitted. Expired windows are discarded and terminal sessions clear observations and reveal snapshots. Run reconciliation after host abort as well as timer expiry.

`projectLocations` returns a fresh own marker and, for hunters only, the current frozen reveal. Hosts receive their gameplay role's view. Outsiders and terminal sessions receive no locations. Projection copies prevent callers from modifying private observations or snapshots. Never broadcast `TrackingState` or internal session storage. Clients must also expire cached markers locally using server deadlines; server filtering alone cannot erase an offline client's cache.

These are pure domain helpers, not a network service. Durable scheduling/storage, transport schemas, rate limiting, eliminated-player filtering, and mobile tracking remain future work. One latest observation per member bounds storage without retaining a movement trail; numeric policy values still require field testing.
