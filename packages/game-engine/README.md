# Game engine

The first application package implements pure TypeScript Manhunt lobby and timer rules. Run `npm test` with Node 24 or newer. Node's native TypeScript support executes the tests without build dependencies; this does not replace static type checking when the app toolchain is introduced.

Create a session, submit authenticated commands through `transition`, and call `advance` using authoritative milliseconds. Inputs are not mutated. Persist the returned state and receipts together before acknowledging a command. Adapters must serialize commands and derive `actorId` from credentials. Command receipts currently grow with the session; transport rate limits and retention belong in the future coordinator.

Implemented: 4–20 player lobby, host role assignment, readiness invalidation, start/abort authorization, command retries, preparation/head start/hunting deadlines, reveal timing, and timer-based runner victory. Preparation defaults to ten seconds for development. Other defaults follow the proposed preset; these are not field-validated production rules.

Not yet implemented: transport schemas, mobile screens, guest credentials, durable storage, GPS ingestion, frozen location snapshots, capture/dispute rules, forfeits, or hunter victory. The engine contains no location data. `revealWindow` returns timing metadata only and does not authorize or disclose coordinates. Readiness is a declaration here; a future device/coordinator adapter must verify permission and location status before start.

Provider and device spikes remain required. The existing browser prototype remains a separate simulated design artifact. Workspace package boundaries are introduced with the existing npm workflow; pnpm/Turborepo migration is deferred until multiple application build tasks exist.
