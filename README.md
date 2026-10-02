# Outrun

**Real-world multiplayer games powered by your phone.**

Outrun turns the real world into a multiplayer game. Players create a game, invite friends, and physically run, chase, hide, capture, photograph, explore, and compete. The phone provides the rules and game intelligence; the real world provides the gameplay.

The first release focuses on one excellent Manhunt experience for casual groups of 4–20 players on iOS and Android.

This repository contains planning documentation, a runnable browser prototype, and the first shared TypeScript game-engine package. Mobile and multiplayer infrastructure are not implemented yet.

## Application development

Run `npm test` with Node 24 or newer to verify the [game engine](packages/game-engine/README.md). It implements lobby membership, roles, readiness, authorized start/abort, command retries, round deadlines, reveal timing, and timer-based results without device or network dependencies.

## Try the prototype

Run `npm run dev` and open http://localhost:4173. Create a Manhunt game or join with `RUN42`, ready up, and explore a simulated round. See [prototype notes](prototype/README.md) for demo controls and layout options.

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
