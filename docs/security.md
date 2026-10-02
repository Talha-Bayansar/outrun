# Security

**Status:** Product-specific security requirements and proposed controls. Provider integration details remain unverified until implementation.

## Trust boundaries

Treat phones as untrusted. Coordinates, accuracy reports, timestamps, photographs, IDs, and commands can be altered. The server validates rules and permissions, but ordinary GPS/photo checks are not proof against a determined cheater.

Important boundaries are identity issuance, lobby discovery, session membership, coordinator commands, recipient projections, media upload/viewing, database export, and host adjudication.

## Identity and membership

Guest participation still requires an authenticated identity and revocable credentials. Use scoped membership authorization for the player/session. A short join code is a lookup value, not a credential.

Permanent-account auth is proposed through Better Auth. Choose the supported storage/runtime integration when implementation begins; do not mix account sessions with game membership implicitly.

Store credentials in suitable device-secure storage. Define expiry, recovery, revocation, and concurrent-device policy. Never include credentials in public player objects, analytics, or logs. Avoid durable bearer credentials in share links.

## Authorization matrix

| Action | Permission |
| --- | --- |
| Join | Valid joinable session, capacity, identity |
| Change readiness | Own membership, lobby only |
| Change settings or assign roles | Current host, lobby only |
| Start or abort | Current host and valid phase |
| Submit location | Own membership and tracking-enabled phase |
| Attempt capture | Active hunter during active hunt |
| Accept/dispute | Target of the pending attempt |
| Resolve dispute | Authorized host/reviewer, pending dispute only |
| View photo | Relevant actor/target/reviewer while evidence is retained |
| View opponent location | Explicit definition rule and current visibility window |

Host controls do not bypass location visibility. Credential revocation must affect open WebSocket sessions as well as future HTTP requests.

## Validation and abuse limits

Validate schemas at every external entry point. Derive actor identity from authorization. Bound payload sizes, upload sizes, command rates, connection counts, location rates, and join-code attempts.

Validate supported rule variants, geographic ranges, positive units, roster limits, timestamps, and referenced entity ownership. Reject cross-session player/media IDs. Rate limits should produce usable retry information and distinguish temporary throttling from permanent rejection.

Serialize transitions and persist command receipts to prevent replayed eliminations or duplicate credit. A host cannot backdate a capture or change locked rules mid-game.

## Media and transport

Use encrypted transport and private media storage. Issue short-lived upload/view authorizations only after checking membership and purpose. Verify media content/type and size rather than trusting the filename or client declaration.

Prefer server-associated metadata and strip unnecessary embedded photo metadata. Clean up incomplete uploads and enforce deletion deadlines. Do not expose bucket listing, unrestricted object paths, or reusable public evidence URLs.

## Operational handling

Keep secrets in environment/provider secret storage, separate development and production, use least-privilege service access, and redact sensitive logs. Export retries must not leak credentials or raw movement samples.

Monitor join guessing, repeated invalid commands, unusual upload volume, and authorization failures. Retain minimal operational evidence with an explicit lifetime.

## Release verification

Verify guest isolation, cross-session references, unauthorized host commands, revoked credentials, duplicate commands, hidden-location payloads, photo viewing, malformed messages, and object cleanup. Test live transport behavior, not only UI visibility.

Sophisticated anti-cheat and image recognition are outside the MVP. Honest friendly gameplay is the first product target.
