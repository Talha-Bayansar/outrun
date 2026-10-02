# Privacy and data lifecycle

**Status:** Privacy design requirements. Exact retention periods and jurisdiction-specific obligations remain launch decisions; this document is not a legal policy.

## Core commitments

- Associate location collection with an explicit game session and disclose when tracking starts/stops.
- Collect only data needed for active gameplay and short-lived capture review.
- Deliver only the location information permitted by each recipient's rules.
- Keep capture photos private.
- Do not collect a full movement trail for a hypothetical future replay.
- Give players clear ways to leave, stop tracking, and request deletion of retained personal data.

Joining a lobby does not imply indefinite background tracking. Readiness checks can use a one-time location observation; sustained tracking starts during the disclosed game preparation/play phase.

## Data categories and proposed lifecycle

| Data | Purpose | Proposed lifecycle |
| --- | --- | --- |
| Guest identity/credential | Membership and reconnect | Session recovery period, then expiry/revocation |
| Display name and membership | Lobby, results | Defined result-retention period; removal/anonymization controls |
| Latest precise GPS | Captures and reveals | Active session plus short cleanup window |
| Short GPS buffer | Freshness and capture assessment | Bounded rolling window |
| Reveal snapshot | Authorized brief disclosure | Window expiry; clear from client cache |
| Capture photo/location evidence | Acceptance/dispute review | Bounded review period, then deletion |
| Unused upload | Temporary staging | Short upload expiry, then cleanup |
| Capture outcome/event | Results and audit | Retain minimal non-location metadata for defined period |
| Game result | Post-game summary | Defined retention with user controls |
| Operational logs | Reliability and abuse diagnosis | Short explicit retention; no raw locations or tokens |

Numeric periods must be specified before production and enforced consistently across durable storage, SQL, R2, caches, and backups. A scheduled cleanup job needs observability and retry behavior.

## Recipient disclosure

Generate authorized projections on the server. Hidden coordinates must not appear in WebSocket messages, HTTP responses, logs exposed to players, map metadata, or persisted client caches.

Approximate, bearing-only, and distance-only modes require purpose-built outputs. The app cannot receive exact coordinates and merely hide the marker.

Hosts see only their role's gameplay view, plus narrowly scoped review evidence. Results do not disclose location histories. Eliminated players do not gain broader visibility by default.

Information already shown cannot be recalled from a player's memory or screenshot. Make disclosure rules understandable rather than promising retroactive secrecy.

## Photos

Explain that captures create photographs visible to the target and authorized reviewers. Encourage avoiding uninvolved bystanders. Do not publicly share evidence by default.

Associate timestamps/session/actor in server metadata, remove unnecessary embedded metadata, bound uploads, and provide retention/deletion controls. Future sharing or replay requires a separate product choice and consent flow.

## Ending and leaving

When a player leaves or the game ends/cancels, stop collection/upload and revoke ongoing location disclosure. Clear sensitive transient caches. An offline phone must stop using cached server deadlines locally, rather than waiting indefinitely for a final message to stop tracking.

Server access revocation and mobile tracking shutdown are separate controls; implement both. Elimination-time tracking policy must be explicit: proposed MVP stops eliminated players' gameplay tracking after final confirmation.

## Deletion and history

Store short-lived sensitive evidence separately from long-lived outcome metadata. Event immutability means accepted history is not casually rewritten; it does not mean personal data is retained forever. Use references, payload minimization, deletion, and anonymization where appropriate.

Define what each participant can view after a round, how identity deletion affects multiplayer results, and how backups age out. Never claim immediate deletion from all backup copies without a supported mechanism.

## Before launch

Decide numeric retention, guest recovery lifetime, data-access/deletion workflow, children/teen participation rules, applicable regions, provider processing arrangements, and policy wording. Seek appropriate review when launch jurisdiction and audience are known.

See [security.md](security.md) for enforcement and [current-phase.md](current-phase.md) for unresolved choices.
