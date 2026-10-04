# Current phase

**Updated:** 2026-10-04
**Phase:** Local application implemented and verified; deployment and field validation remain separate release work.

## Current state

The project owner confirmed local development and runnable builds as the validation target. The repository now contains an Expo iOS/Android/web app, Workers API, persistent SQLite-backed Durable Object sessions, private R2 photos, typed transport, and the shared rules engine. No cloud infrastructure is deployed. External SQL history/export and physical-device field validation remain outstanding.

Implemented: create/join/recovery, roles/readiness/timer edits, server-controlled phases, frozen reveals and privacy projections, conservative photo/GPS capture, target response/host review, deadline confirmation/expiry, elimination/forfeits, host transfer, immutable results, data deletion, and tracking cleanup. Client screens cover the full round and optional native background collection. The original browser prototype remains a separate simulated design artifact.

Verification passed: 37 deterministic engine tests; three live local integration tests including actual alarm-driven reveal/expiry/ending, media authorization, disputes, deletion, and multiplayer membership; process-restart recovery of roster/deadlines/start receipts; TypeScript checks; Worker bundle and web/iOS/Android exports. Browser UI creation reached a real connected lobby with QR, roster, role controls, readiness, and permissions explanations.

Durable state/alarm writes are transactional and session operations serialized. HTTP commands and authenticated hibernating WebSockets use protocol 1; five-second HTTP recovery complements socket delivery. Credentials are membership-scoped and hashed server-side. Photos are private, decoded/re-encoded, and trusted only after complete upload. Numeric local GPS, timing, media, and retention policies are documented in [development](development.md).

Native exports do not establish physical permission, background/lock-screen, camera, map-provider, battery, or field behavior. Deployment, external SQL export, edge abuse limits, launch retention/backups policy, and dependency-advisory review remain release requirements. The local implementation is not a production-readiness claim.

Milestone 2 and the local coordinator portion of milestone 3 are implemented. Milestones 4–6 retain their device, external persistence, and physical field exit criteria. Local implementation choices supersede proposals only where recorded in [architecture](architecture.md) and [development](development.md).

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
| Host absence | Same-installation credential recovery; explicit leave transfers host; disconnect preserves host; local sessions expire in 24 hours. Field evaluation remains. |
| Explicit leave | Implemented forfeit; temporary disconnect is separate; all hunters leaving cancels. |
| Late joining | Disabled after start; existing members may reconnect. |
| GPS | Local trial: 35 m accuracy, 30 s age, 5 s future skew, 15 s sample skew. Calibrate from field data. |
| Boundaries | Circular area, warning only initially; choose warning/hysteresis settings. |
| Tracking | Decide background permissions and supported behavior on both operating systems. |
| Eliminated players | Stop gameplay tracking; restricted spectator view. |
| Map provider | react-native-maps native adapter and browser boundary overview implemented; production configuration/licensing and devices unverified. |
| Auth | Guest identity/credential design first; Better Auth for optional accounts. |
| Persistence | Durable live authority and idempotent SQL export; verify provider adapter details. |
| Retention | Local sessions/credentials 24 hours; unused photos five minutes; terminal media cleanup and connected deletion implemented. Launch backups/retention policy needs review. |
| Notifications | Helpful cue channel, not authority; native/local behavior needs device tests. |
| Config limits | Numeric limits and combinations implemented for local trials; see development.md. |

## Keeping this file current

Update the phase and implemented status as milestones complete. Record accepted decisions in their owning documents and remove ambiguity here. Do not label a feature complete until its relevant recovery, authorization, and physical-device behavior has been checked.
