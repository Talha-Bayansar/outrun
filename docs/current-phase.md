# Current phase

**Updated:** 2026-10-04
**Phase:** Domain foundation implementation started.

## Current state

The founding brief is documented in [product.md](product.md), with a separate [MVP boundary](mvp.md) and focused design documents. This repository has no implemented mobile application, backend, database, or deployed infrastructure yet.

The first shared TypeScript package now implements lobby membership, role assignment, readiness, start/abort authorization, idempotent command receipts, round deadlines, reveal timing, and timer-based runner results. Run `npm test`; see [implementation notes](../packages/game-engine/README.md) for boundaries. Pure location validation, great-circle geometry, accuracy-aware proximity, and circular boundary warning helpers are also implemented with caller-supplied policy thresholds. Private member location ingestion, frozen runner reveals, recipient projections, and terminal tracking cleanup are now implemented as pure helpers. Capture submission, target responses, host dispute review, response/review deadlines, elimination, and hunter victory are now implemented with caller-configured policy. Transport contracts, private capture projections, forfeits, and durable integration remain unfinished, so milestone 2 is not complete. The browser prototype is still a separate simulated design artifact.

The stack is proposed. Detailed behavior marked as proposed is available for review and must be finalized before the relevant implementation.

## Implementation milestones

### 1. Resolve critical behavior and run device/provider spikes

Settle timer semantics, capture adjudication, GPS quality thresholds, guest recovery, host absence, and retention. Verify iOS/Android background location and camera behavior, map integration, Durable Object scheduling/recovery, and database/media integration using current official documentation when implementation starts.

Exit when the largest device/platform constraints are understood and the first field rules are explicit.

### 2. Build the domain foundation

Introduce the monorepo, validated contracts, a pure engine, Manhunt preset, and geometry functions. Cover lifecycle, reveal windows, capture outcomes, duplicate commands, privacy projections, and terminal-state invariants.

Exit when deterministic scenarios can run from lobby to results without device or network dependencies.

### 3. Establish identities and authoritative sessions

Implement guest credentials, create/join, membership authorization, Durable Object persistence, roster/readiness, host controls, connection protocol, snapshots, and recovery.

Exit when several clients can start/reconnect to the same durable session and receive only authorized state.

### 4. Connect mobile gameplay

Build lobby, role briefing, map boundary, location collection, timers, head start, and periodic reveals on both platforms. Test on physical devices and with the screen locked.

Exit when hunters/runners experience synchronized phases and expired markers disappear reliably.

### 5. Complete capture and results

Implement private media upload/viewing, proximity checks, capture response/review, elimination, automatic ending, result export, and evidence cleanup.

Exit when a full round ends correctly despite retried commands, temporary connection loss, and coordinator recovery.

### 6. Run a real field game

Play with 6–10 people, assess setup time, clarity, reliability, battery use, safety, and desire for another round. Fix problems in the core loop before adding modes or social features.

Exit when the group completes a fun round with little host intervention and wants to play again.

## Decision register

| Decision | Current proposal / unresolved question |
| --- | --- |
| Hunting duration | Excludes runner head start; confirm wording and defaults. |
| First reveal | One full interval after hunter release; frozen samples for the window. |
| Preparation countdown | Included; exact length remains open. |
| Captures | Pending target-response window, auto-confirm if undisputed, host review on dispute. |
| Dispute timeout | Expire unresolved disputes; choose response/review durations. |
| Deadline boundary | Process game expiry first; unresolved captures do not postpone game end. |
| Host conflict | Friendly host adjudication with recorded decisions; decide secondary reviewer need. |
| Host absence | Credential recovery, control transfer, and abandoned-session expiry remain open. |
| Explicit leave | Proposed forfeit; temporary disconnect is separate. Confirm all-hunters-left behavior. |
| Late joining | Disabled after start; existing members may reconnect. |
| GPS | Set accuracy, age, sample-skew, and bounded tolerance thresholds from field data. |
| Boundaries | Circular area, warning only initially; choose warning/hysteresis settings. |
| Tracking | Decide background permissions and supported behavior on both operating systems. |
| Eliminated players | Stop gameplay tracking; restricted spectator view. |
| Map provider | MapLibre vs Mapbox pending integration/licensing evaluation. |
| Auth | Guest identity/credential design first; Better Auth for optional accounts. |
| Persistence | Durable live authority and idempotent SQL export; verify provider adapter details. |
| Retention | Numeric lifetimes and deletion/backups workflow must be set before production. |
| Notifications | Helpful cue channel, not authority; native/local behavior needs device tests. |
| Config limits | Choose numeric duration/radius/reveal limits and validate combinations. |

## Keeping this file current

Update the phase and implemented status as milestones complete. Record accepted decisions in their owning documents and remove ambiguity here. Do not label a feature complete until its relevant recovery, authorization, and physical-device behavior has been checked.
