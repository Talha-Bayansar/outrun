# Local development

Updated 2026-10-04. The project owner confirmed **local development and runnable builds** as this implementation's validation target. Production deployment and physical field testing are separate release work.

## Run and verify

Use Node 24+, `npm ci`, then `npm run dev`. The web app is at http://localhost:8081 and API at http://localhost:8787. Individual commands: `npm run dev:api`, `npm run dev:web`, `npm run dev:mobile`, and `npm run dev:prototype` (simulated design on port 4173).

Run `npm test` (37 deterministic engine tests), `npm run check`, and `npm run build` (Worker dry-run plus web/Android/iOS exports). With the API running, `npm run test:integration` exercises four-client membership, authorization, private GPS, retry receipts, authenticated WebSockets, photos, disputes, elimination, results, deletion, and actual reveal/expiry/end alarms. The alarm test takes one minute.

For recovery: `node services/api/test/recovery.mjs prepare`, stop/restart the API, then `node services/api/test/recovery.mjs verify`. This verifies roster, original deadlines, and a durable start receipt without printing credentials. Persistent local state and its private test fixture are in ignored `services/api/.wrangler/`.

For phones, use the computer's LAN URL in the game-server field; localhost on a phone refers to the phone. `apps/mobile/.env.example` documents `EXPO_PUBLIC_API_URL`. Screen-locked location requires a native development build and permissions. Exported assets are not installable native binaries: native build/signing tools and device validation are still needed. Android production map tiles need provider configuration. Browser location/camera require a secure context; localhost qualifies, plain HTTP LAN pages generally do not. Configure extra browser origins in `ALLOWED_ORIGINS` and run `npm run types -w @outrun/api` after binding changes.

## Implemented behavior

Create/join uses private six-character invitations, QR/link sharing, named guests, configurable timers/area/capture radius, host role assignment, timer edits, and readiness. Four ready players, both roles, and acceptable GPS checks in the last 60 seconds are needed to start. Explicitly ready lobby checks refresh every 20 seconds and retain only a quality-check timestamp; turning off readiness stops them.

Server deadlines control preparation, head start, hunting, frozen reveals, capture response/review, and results. Photo/GPS captures are accepted only during hunting and require conservative in-range proximity. Targets have 30 seconds to accept/dispute; disputes give the host 120 seconds to review. Undisputed attempts auto-confirm; unresolved disputes expire. Game expiry takes precedence over unresolved captures.

Opaque guest credentials are scoped to one game, expire after 24 hours, and are stored as SHA-256 digests by the coordinator. Native clients use SecureStore; web development uses per-tab session storage. Reload/restart recovers the same guest. Cross-device identity transfer and permanent accounts are not implemented.

HTTP commands retry transport failures once with the original ID. Protocol-1 recipient snapshots arrive over authenticated hibernating WebSockets with five-second HTTP recovery. Opponent markers expire locally using server-clock offset. New captures require connectivity. Native maps use `react-native-maps`; web uses a north-up boundary overview. GPS, camera, permission settings, optional background tracking, haptic phase cues, private evidence response/review, basic results, JSON result sharing, play again, and local tracking shutdown are implemented.

Leaving stops local collection and clears saved membership immediately. A server leave forfeits active play, revokes views, clears tracking, expires involved attempts, and transfers host control to the earliest remaining member. All hunters leaving cancels. An offline leave cannot notify the server immediately; temporary disconnect does not forfeit. The connected deletion action anonymizes a player and revokes their credential while preserving multiplayer outcome metadata.

## Local policies and limits

Games, codes, and credentials expire 24 hours after creation. Alarms erase live records and photos; provider backup/PITR lifetimes are separate. Unused photos expire after five minutes; terminal cleanup deletes all photos. Resolved evidence access is revoked immediately. Uploads are capped at 4 MiB/two megapixels, decoded and re-encoded to remove metadata, and trusted only after completed storage. Limits: 180 requests/member/minute, six staged photos/hunter, 40 sockets/game, 2048 recorded commands/game (leave/abort remain available). Receipts last the game lifetime.

Trial GPS thresholds: accuracy ≤35 m, age ≤30 seconds, future skew ≤5 seconds, sample skew ≤15 seconds. Capture compares distance plus both accuracies to its radius; ambiguity requests better GPS. Boundaries warn without penalties. These policies need field calibration.

Timer limits: preparation 0–60 seconds, head start 0–15 minutes, hunting 1–180 minutes, reveal interval ≥15 seconds and ≤hunting duration, window 1–60 seconds and ≤interval. Area radius 100–5000 m; capture radius 10–100 m.

## Release work

Physical-device permissions/camera/maps, screen-lock recovery, battery use, map provider setup/licensing, native signing, and a real field game remain unverified. The app has no deployed infrastructure or external Neon/Drizzle history export. Add edge limits for create/code-guessing, review provider photo-processing CPU limits, and finalize launch retention/backups policies before public deployment. The selected Expo toolchain currently reports npm audit advisories; the suggested forced Expo downgrade is incompatible with this SDK. This local build is not a production-readiness claim.

Official references: [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), [durable storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [hibernating WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [Expo location](https://docs.expo.dev/versions/latest/sdk/location/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/), and [JPEG codec](https://github.com/jpeg-js/jpeg-js).
