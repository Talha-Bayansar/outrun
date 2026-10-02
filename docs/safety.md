# Real-world safety

**Status:** Product requirements for outdoor play, not a guarantee that a selected area is safe.

## Player guidance

Before a first round, briefly tell players to respect private property, avoid dangerous/restricted areas, cross roads safely, avoid playing while driving or cycling, and look up while moving. Stop somewhere safe before checking the map or taking a photo.

Keep guidance short enough to be understood. Provide a persistent way to leave the game. The application is not an emergency communication service.

## Host responsibilities and area selection

Show the whole playing boundary before starting. Ask hosts to choose an appropriate area, explain local restrictions, and agree on a meeting point. A drawn circle may include roads, water, private property, or inaccessible terrain; GPS geometry alone does not certify safety.

Custom forbidden zones and richer area tools are future features. In the MVP, hosts must communicate hazards the radius tool cannot model.

## Interaction and mechanics

Use brief information windows, large actions, and optional haptic/audio cues to reduce continuous screen use. Avoid instructions that reward dangerous speed, road crossings, trespassing, or physical contact.

Photo capture should not require grabbing or blocking another player. Dispute handling should encourage stopping and resolving calmly rather than escalating a chase.

Boundary warnings must not suggest that the player should run across a hazard to beat a countdown. Proposed MVP uses warning-only boundaries and does not punish uncertain GPS automatically.

## Ending and interruption

The host can abort a round. Every player can leave. Cancellation clearly ends competition and location disclosure. Do not make a disconnected host the only path for a player to stop tracking.

Define the host-disconnection/absence policy before field release. Temporary disconnection alone should not unexpectedly end the game; reconnect and control recovery should be understandable.

## Field test requirements

Start with a known suitable area and a small group. Observe phone attention, missed cues, capture interaction, boundary confusion, and unexpected movement incentives. Revise rules and interface when a mechanic encourages unsafe behavior.

Physical testing complements software verification: an internally consistent game can still have poor real-world behavior.
