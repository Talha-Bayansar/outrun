# Outrun

**Real-world multiplayer games powered by your phone.**

Outrun turns the real world into a multiplayer game. Players create a game, invite friends, and physically run, chase, hide, capture, photograph, explore, and compete. The phone provides the rules and game intelligence; the real world provides the gameplay.

The first release focuses on one excellent Manhunt experience for casual groups of 4–20 players on iOS and Android.

This repository contains a runnable Expo application for iOS, Android, and web, an authoritative Workers multiplayer service, a shared TypeScript game engine, and the original design prototype. Local development uses persistent Durable Object and private R2 emulation without cloud credentials.

## Application development

Use Node 24+, run `npm ci`, then `npm run dev`. Open http://localhost:8081; the API runs on port 8787. Create a game and join from separate browser sessions or phones using its six-character code. Four ready players with both roles are required to start.

`npm test` checks the engine, `npm run check` checks types, and `npm run build` bundles the Worker and exports iOS/Android/web assets. With the API running, `npm run test:integration` checks actual HTTP, WebSockets, private photos, and alarms in about 75 seconds.

For phones, run `npm run dev:api` and `npm run dev:mobile` separately and set the game server to your computer's reachable LAN URL. See [local development](docs/development.md) for permissions, recovery testing, and release limitations. Native exports are JavaScript/assets, not signed installable binaries. Production deployment, external SQL history, physical-device validation, and field play remain separate work.

## Try the prototype

Run `npm run dev:prototype` and open http://localhost:4173. The `RUN42` round is simulated and separate from the application. See [prototype notes](prototype/README.md).

## Project documentation

Start with [the documentation index](docs/README.md).

- [Product description](docs/product.md) — vision, principles, mechanics, and long-term direction.
- [MVP](docs/mvp.md) — first-release scope, user journeys, and acceptance criteria.
- [Architecture](docs/architecture.md) — system boundaries, proposed stack, and repository structure.
- [Game engine](docs/game-engine.md) — rules, state transitions, validation, and outcomes.
- [Data model](docs/data-model.md) — entities, relationships, and storage responsibilities.
- [Realtime](docs/realtime.md) — connections, synchronization, scheduling, and recovery.
- [Location](docs/location.md) — GPS quality, visibility, boundaries, and battery use.
- [Capture](docs/capture.md) — photo evidence, proximity checks, and disputes.
- [Mobile experience](docs/mobile-experience.md) — screens, permissions, and outdoor interaction.
- [Security](docs/security.md) — trust boundaries, authorization, and abuse prevention.
- [Privacy](docs/privacy.md) — location and photo handling, consent, and retention.
- [Safety](docs/safety.md) — real-world safety requirements.
- [Current phase](docs/current-phase.md) — implementation sequence and unresolved decisions.
