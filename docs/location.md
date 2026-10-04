# Location mechanics

**Status:** Observation validation, geometry/proximity/boundary helpers, private member ingestion, frozen reveals, durable scheduling, and Expo collection adapters are implemented locally. Numeric trial thresholds are documented in [development](development.md); physical background tracking and GPS calibration require device/field measurements.

## Separate responsibilities

1. **Collection:** The phone samples its own position.
2. **Ingestion:** The server validates and retains bounded observations.
3. **Gameplay assessment:** The engine uses observations for captures and boundaries.
4. **Disclosure:** The server projects only authorized location information.

Collecting a runner's position does not imply broadcasting it to hunters.

## Observation contract

A sample contains latitude, longitude, reported horizontal accuracy in meters, observed timestamp, and monotonically increasing device sample sequence. The server adds receipt time and authenticated player/session identity.

Validate finite coordinates, legal ranges, nonnegative accuracy, timestamp plausibility, sample order, game status, and membership. Device time and coordinates remain untrusted observations; server association does not prove a player was physically there.

Freshness checks use both observed time and server receipt time. Reject future, delayed, or poor-quality samples according to a documented policy. Uploading an old observation must not reset its age.

## Accuracy-aware proximity proposal

Calculate geodesic distance between recent hunter and runner samples. Report uncertainty rather than treating GPS as exact.

An initial conservative policy can use `u = hunterAccuracy + runnerAccuracy`, with an estimated range from `max(0, distance - u)` to `distance + u`:

- Clear in-range: the upper estimate is within the configured radius/tolerance.
- Clear out-of-range: the lower estimate exceeds it.
- Ambiguous: the range overlaps the limit; request better readings or apply the explicit host-review policy.

Reported accuracy is not a mathematical guarantee. This policy is an engineering heuristic to evaluate outdoors, not a proof of distance. Never turn unbounded bad accuracy into unlimited capture tolerance.

Define maximum accuracy, maximum sample age, allowed inter-sample time difference, and bounded tolerance before release. Display a clear reason when a capture cannot proceed.

## MVP visibility

Show own location and the playing boundary. Hunters see a frozen snapshot of eligible runner locations for the configured periodic window. Do not assume teammate live tracking is in scope; it needs an explicit visibility rule.

Skip runners without recent acceptable samples during a reveal and indicate unavailable information without inventing a position. The coordinator chooses the samples once per reveal window.

Future modes include live, last known, approximate area, bearing, distance, and hidden. Projection functions must remove unused coordinates from payloads. Approximate modes also need to prevent repeated samples from trivially reconstructing exact positions.

## Playing area

MVP geometry is a center coordinate and radius in meters. The host chooses current position or places a center on the map. Validate geometry and show the area before readiness.

Use GPS-quality-aware boundary assessment and hysteresis to reduce repeated enter/leave alerts at the edge. Proposed MVP response is warning only; automatic elimination and penalties are deferred until field testing.

Polygon boundaries, multiple allowed areas, forbidden zones, and game-effect zones are future features.

## Tracking and battery

Potential profiles: high intensity every 2–5 seconds, normal every 10–20 seconds, low power every 30–60 seconds. These are target cadences, not guarantees from mobile operating systems.

Adapt collection to game phase, motion, battery, and location age. Separate upload frequency from collection and disclosure. Stop tracking after leaving, cancellation, or game end; show tracking state clearly.

Background tracking and lock-screen behavior require real iOS/Android development-build testing. If an operating system prevents reliable tracking, communicate stale location rather than implying the player is continuously tracked.

## Retention

Default to recent observations and a bounded capture-evidence window. No permanent full movement history or replay collection in the MVP. See [privacy.md](privacy.md).
