# Mobile experience

**Status:** Interaction requirements for the first release; visual designs are not yet created.

## Design principles

Outrun should feel energetic, adventurous, modern, social, slightly tactical, and playful. Prioritize large controls, strong contrast, short instructions, and outdoor readability.

The primary interaction loop is **look at phone → receive information → put phone away → act**. Avoid interfaces that reward staring continuously at the map.

## Screen map

| Screen | Primary content and action |
| --- | --- |
| Welcome | Display name, Create Game, Join Game |
| Create Manhunt | Duration, hunter count, head start, reveal timing, capture radius |
| Playing area | Choose center, radius, review map boundary |
| Join | Code entry or invitation handling; clear expired/full-game errors |
| Lobby | Code/share/QR, roster, teams/roles, rules, permission status, readiness |
| Host lobby controls | Assign roles, change settings, start/cancel |
| Role briefing | Runner/hunter objective and capture/reveal rules |
| Preparation countdown | Shared starting countdown and instructions |
| Runner head start | RUN! and time until hunters are released |
| Hunter head start | Hunt begins in…; no runner markers or capture |
| Active game | Remaining time, own position, boundary, next reveal, Capture for hunters |
| Reveal | Brief authorized runner snapshot with expiry countdown |
| Capture | Camera, target selection, submission and validation result |
| Capture response | Evidence summary, Accept, Dispute, remaining response time |
| Host review | Disputed photo/summary, approve/reject |
| Eliminated | Clear status, no capture action, wait for final result |
| Results | Winner, survivor outcomes, confirmed capture counts, play again |

Eliminated players do not automatically receive an omniscient spectator map. Sharing a lobby does not reveal a private game publicly.

## Permissions and readiness

Explain why location is needed before asking. Request camera access when capture requires it; runners do not need camera permission merely to participate. Notifications are an enhancement, not an assumed channel for authoritative state.

Expose denied permission, stale GPS, and poor connection clearly in the lobby. Prevent readiness/start where a required capability is missing. Reset readiness after material rule or role changes so players acknowledge the new setup.

Background location requirements must be decided and tested during the device spike. Provide a clear path to system settings after a denied permission. Do not imply a background capability exists before verifying it on both platforms.

## Gameplay interaction

Timers use server-derived deadlines. Show connection and GPS quality concisely. Mark stale cached information. Remove expired markers immediately.

Use haptic/audio cues for role release, approaching reveals, captures, boundaries, and game end where supported and user-enabled. These cues should reduce screen attention; do not rely on sound, color, or notifications alone.

Capture should require few taps, but should encourage stopping safely before taking a photo. Do not make players read a long rules page while running.

## Error and recovery states

- Invalid, expired, full, or already-started game.
- Name validation and duplicate display-name ambiguity.
- Permission denied or unavailable camera.
- Poor/stale GPS and unavailable target samples.
- Connection lost, reconnecting, and membership recovery failure.
- Upload failed with a retry that preserves the attempt's identity.
- Attempt rejected with a concrete reason.
- Game cancelled or finished while the app was offline.

Never show an optimistic final capture or winner before server confirmation. A locally cached active screen must yield to a terminal server snapshot on reconnect.

## Accessibility and field evaluation

Support legible scalable text, strong contrast, platform-appropriate touch targets, screen-reader labels, and non-color status indicators. Test direct sunlight, gloves/wet fingers where relevant, lock/unlock, low battery, and walking/running attention load.

The first field study should ask whether players understood their role, noticed reveals without constant checking, and could capture with minimal distraction.
