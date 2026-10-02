# MVP

**Goal:** A group of 6–10 people can play a complete, enjoyable Manhunt round without the host manually managing gameplay. Expected supported group size: 4–20.

## Included scope

- iOS and Android mobile application.
- Guest identity with a display name and a recoverable session credential.
- Create Manhunt, configure rules, and choose a circular playing area.
- Join by code; share an invitation link and QR code that resolve to the same lobby.
- Lobby roster, host controls, hunter/runner assignment, and readiness.
- Clear role instructions, start countdown, and runner head start.
- Own-position map, playing boundary, GPS collection, and periodic runner reveals for hunters.
- Server-controlled game timer, photo capture, proximity validation, and elimination.
- A small capture dispute/host-resolution flow because GPS can be ambiguous.
- Realtime state, reconnect handling, automatic ending, and basic results.
- Session-scoped location disclosure and private capture evidence.
- Short safety guidance and permission explanations.

QR/link invitations and dispute handling support the supplied core journey. They do not imply public discovery, a social system, or automatic image recognition.

## Excluded scope

No public discovery, matchmaking, friends system, social feed, rankings, achievements, advanced profiles, marketplace, visual rule builder, additional playable modes, AI photo recognition, advanced anti-cheat, custom polygon editor, complex zones, respawns, replay, or advanced movement statistics.

Keep extensible engine boundaries without implementing every future rule primitive.

## Proposed first preset

| Setting | Initial proposal |
| --- | --- |
| Players | 4–20; at least one hunter and one runner |
| Duration | 45 minutes of hunting |
| Hunters | 2, configurable within valid roster limits |
| Playing area | Center plus 1 km radius |
| Head start | 3 minutes |
| Reveal | Every 3 minutes, visible for 10 seconds |
| Capture radius | 25 m |
| Evidence | Photo required |
| Capture consequence | Elimination following final confirmation |
| Respawn | Disabled |
| Boundary response | Warning only for the first field release |
| Winner | Hunters if all runners are eliminated; runners if any remain at deadline |

These are starting defaults, not settled balancing decisions. Numeric configuration limits, capture quality thresholds, dispute deadlines, and boundary grace settings remain open.

Proposed timer semantics: head start precedes the configured hunting duration. Display both clearly in setup. Start the reveal schedule at hunt release, with the first reveal after one full interval. Freeze each reveal's sample positions for its visibility window. See [game engine](game-engine.md).

## Host journey

1. Enter a display name and choose Create Game.
2. Review Manhunt rules and configure duration, hunters, radius, head start, reveal interval/window, and capture radius.
3. Place the playing-area center and review the boundary.
4. Create the lobby and share its code, invitation link, or QR.
5. Assign hunters/runners and review readiness.
6. Start after all required players are ready and have acceptable location/permission status.
7. Play with the same role-specific interface as other players; host privileges do not grant hidden locations.
8. Resolve a disputed capture if necessary.
9. Review the final result and create another round.

## Player journey

1. Open an invitation or enter the code, enter a name, and join.
2. Review rules, role, area, safety guidance, and permissions.
3. Mark ready.
4. Follow RUN! or the hunter head-start countdown.
5. Play using brief reveals and a large capture action.
6. Accept/dispute a capture when applicable; show final elimination clearly.
7. See the winner and basic survival/capture results.

## Acceptance criteria

| Area | Required behavior |
| --- | --- |
| Joining | A new guest joins a private lobby within a few minutes without a permanent account. |
| Setup | Invalid team counts, timer combinations, or geometry cannot start a game. |
| Lobby | All participants converge on the same roster and role assignments. |
| Start | One authorized start creates one common set of server deadlines. |
| Head start | Hunters cannot capture or receive runner reveals before release. |
| Visibility | Hidden runner coordinates never reach unauthorized client payloads. |
| Reveal | Connected hunters receive the permitted snapshot and countdown; expired reveals disappear. |
| Capture | Evidence and recent acceptable GPS are required; retries cannot eliminate twice. |
| Disputes | Only authorized reviewers resolve; a decision is recorded once. |
| Connection loss | A player can reconnect, recover their identity, and receive current authoritative state. |
| Recovery | A coordinator restart preserves accepted captures, timers, and outcomes. |
| Ending | All runners captured or timer expiration produces one final result. |
| Privacy | Tracking stops on leaving/ending; precise evidence is accessible only to permitted reviewers. |
| Field play | 6–10 people complete a round and can understand their roles without explanation. |

## Evaluation

Measure time to lobby/start, unclear instructions, missed reveals, invalid capture reasons, reconnect frequency, dispute frequency, battery impact, and whether players ask for another round. Use aggregate measurements without retaining movement trails by default.

The product success criterion is **“Again.”** Technical completion is necessary, but it is not proof of fun.
