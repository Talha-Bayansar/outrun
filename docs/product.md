# Outrun

## Real-World Multiplayer Games Powered by Your Phone

**Working name:** Outrun  
**Product type:** Location-based multiplayer mobile game platform  
**Platforms:** iOS and Android  
**Core concept:** Turn the real world into the game map.

This document captures the founding product description. It includes both MVP requirements and future ideas; [mvp.md](mvp.md) defines what to build first.

## 1. Product vision

Outrun is a mobile platform for playing real-world multiplayer games using players' physical locations, movement, cameras, phones, and surroundings.

Instead of controlling a virtual character on a screen, **the player is the character**. The city, park, neighborhood, school campus, forest, event site, or other physical environment becomes the game map.

Players create or join game sessions where rules determine:

- Where players may move.
- Which players or teams can see each other.
- When locations become visible.
- How players capture or eliminate each other.
- How photos are used.
- Where safe zones and objectives are located.
- How points are earned.
- When players respawn.
- How long the game lasts.
- How a winner is determined.

The phone acts as the game's companion, referee, map, camera, timer, communication system, and game-state tracker.

Outrun should eventually become a **platform for creating real-world games**, rather than merely being one specific game.

> Create a game. Invite your friends. Go outside. The real world becomes the map.

## 2. Product principles

### Real world first

Players should spend more time looking at their surroundings and interacting with other players than looking at their phones. The phone enhances the game rather than becoming the game.

Instead of continuously displaying an opponent's exact GPS position, a game might reveal their approximate location, direction, distance, last known position, or position for only five seconds. This encourages players to search, chase, hide, navigate, communicate, and strategize.

### Easy to start

Starting a game with friends should take only a few minutes:

**Create Game → Choose Mode → Configure Rules → Share Code → Players Join → Start**

Players should eventually be able to participate as guests without creating permanent accounts. A player receives a link or QR code, opens Outrun, enters a name, and joins the lobby.

### Flexible rules

Game modes should not be deeply hardcoded. Outrun should contain a generic rules engine from which different games can be constructed.

Example Manhunt configuration:

- 2 hunters and 8 runners.
- 60 minutes.
- Five-minute runner head start.
- Runner locations appear every three minutes.
- Capture requires proximity and a photo.
- Captured players are eliminated.
- Last surviving runner wins.

Example Infection configuration:

- 2 infected and 18 humans.
- Capturing a human converts them into infected.
- No respawns.
- Humans win by surviving 60 minutes.

Both games should use the same underlying engine. The initial Manhunt release uses team survival at the timer; individual survival can be highlighted in results. Alternative last-survivor rules remain a future configuration option.

## 3. Target users

Initial audiences include groups of friends, teenagers and young adults, youth organizations, camps, schools, sports groups, student organizations, scouts, community organizations, birthday groups, and company/team-building groups.

The initial product focuses on casual groups of approximately **4–20 players**. Larger games can be supported later.

## 4. Core product loop

1. Someone creates a game.
2. The host selects a game mode.
3. The host configures the rules.
4. The host defines the playing area.
5. Outrun generates a lobby code, QR code, and invitation link.
6. Players join.
7. Teams and roles are assigned.
8. Players indicate they are ready.
9. The host starts the game.
10. A countdown begins.
11. Players physically move through the real world.
12. Outrun tracks relevant locations and game events.
13. Players complete objectives, find players, capture opponents, take photos, and reach zones.
14. The server validates actions according to the game rules.
15. The game ends when a win condition or timer is reached.
16. Outrun presents the results.

## 5. Initial game mode: Manhunt

The first MVP should contain **one excellent game mode rather than many incomplete ones**. The recommended first game is Manhunt.

Players are divided into **runners** and **hunters**. Runners attempt to survive until the timer expires. Hunters attempt to capture all runners.

Example game with 10 players:

- 8 runners and 2 hunters.
- 60-minute game.
- 2 km playing area.
- Five-minute runner head start.
- Runner locations revealed every three minutes.
- Each reveal lasts ten seconds.
- Capture radius of 30 meters.
- Photo required for capture.
- No respawning.

Runners receive **RUN!**. Hunters see **RUNNERS RELEASED — Hunt begins in 04:32**. After five minutes, they receive **HUNT BEGINS**.

Hunters do not continuously see runners. They receive **LOCATION REVEAL IN 10 SECONDS**, followed by a brief reveal. Hunters must remember those positions and search for the runners.

## 6. Capture system

Capturing another player is a central mechanic. Different capture mechanisms should eventually be supported.

### Photo capture

The hunter selects **CAPTURE**, the camera opens, and the hunter takes a photograph and selects the intended target.

Outrun records the photographer, target, timestamp, photographer GPS position, target's recent GPS position, calculated distance, game/session, photograph, and applicable rules.

Example:

> CAPTURE ATTEMPT  
> Hunter: Mehmet  
> Target: Talha  
> Distance: 22 m  
> Maximum: 30 m  
> ✓ VALID CAPTURE

The target becomes eliminated following the applicable confirmation/dispute policy.

### Disputes

GPS and photographs will not always be perfect. For friendly games, Outrun should provide a simple dispute mechanism:

> Mehmet captured you.  
> [ACCEPT] [DISPUTE]

The host can resolve disputes. More sophisticated automatic verification can be introduced later.

## 7. Location mechanics

Location is a **game mechanic**, not merely tracking. The engine should eventually support:

| Mode | Behavior |
| --- | --- |
| Live location | Continuously show permitted players. |
| Periodic reveal | Show locations every X minutes for Y seconds; e.g. ENEMY LOCATION REVEAL — 00:05. |
| Last known location | Show a sampled position and age; e.g. Talha — Last seen 2m 18s ago. |
| Approximate location | Show an area; e.g. target somewhere within this 150 m area. |
| Direction only | Show a bearing; e.g. northeast, approximately 400 m away when distance is also permitted. |
| Distance only | Show distance without direction; e.g. TARGET DISTANCE — 623 m. |
| Hidden | Provide no location information. |

These mechanics can eventually be combined.

## 8. Playing area

Every game can optionally have a physical boundary. Hosts should eventually be able to choose their current location or another location, set a radius, draw a custom area, define multiple allowed areas, and create forbidden zones.

Example: **Antwerp city park — Radius: 1.5 km**.

Leaving the area could trigger **YOU LEFT THE PLAYING AREA — Return within 60 seconds**. Rules may specify warning only, a point penalty, automatic elimination, a countdown, or host notification.

## 9. Zones

A zone contains coordinates, radius/polygon, type, team restrictions, activation rules, and effects.

Potential types:

- **Safe zone:** Players cannot be captured.
- **Checkpoint:** A player must physically reach the location.
- **Capture point:** Teams compete to control it.
- **Spawn:** Starting location.
- **Respawn:** Eliminated players return here.
- **Objective zone:** Triggers an objective.
- **Forbidden zone:** Players may not enter.

## 10. Lobby

Every session has a lobby showing the game mode, host, player list, maximum players, rules, map, teams, roles, readiness, and game code.

Example:

> MANHUNT — Game code: J7K4P — 8 / 10 players  
> ✓ Talha — Ready  
> ✓ Mehmet — Ready  
> ✓ Yusuf — Ready  
> ✓ Emir — Ready  
> ○ Kerem — Not Ready  
> [SHARE] [START GAME]

Joining methods: game code, QR code, and invitation link.

## 11. Teams and roles

The engine distinguishes **teams** from **roles**.

A team represents allegiance: Red, Blue, Humans, Zombies, Hunters, or Runners.

A role defines special abilities or rules: Hunter, Runner, Medic, VIP, Spy, Zombie, or Guard.

Players on the same team may eventually have different capabilities.

## 12. Game events

Important server actions are events with timestamps and relevant metadata:

```text
GAME_CREATED
PLAYER_JOINED
PLAYER_LEFT
PLAYER_READY
GAME_STARTED
PLAYER_LOCATION_UPDATED
LOCATION_REVEALED
ZONE_ENTERED
ZONE_LEFT
CAPTURE_ATTEMPTED
CAPTURE_CONFIRMED
CAPTURE_DISPUTED
PLAYER_ELIMINATED
PLAYER_RESPAWNED
TEAM_CHANGED
OBJECTIVE_COMPLETED
SCORE_CHANGED
GAME_PAUSED
GAME_RESUMED
GAME_ENDED
```

Events support history, replays, auditing, and debugging. Event design must respect location retention limits.

## 13. Game state

An active game has authoritative server-side state. Conceptually, a `GameSession` contains its definition/configuration, status, players, teams, roles, locations, zones, objectives, scores, timer, events, eliminations, captures, and winner.

Clients submit actions. The server validates them. Clients are never authoritative for important game outcomes.

## 14. Rules engine

A `GameDefinition` describes how a game operates:

```ts
interface GameDefinition {
  duration: number;
  playerLimits: {
    minimum: number;
    maximum: number;
  };
  teams: TeamDefinition[];
  roles: RoleDefinition[];
  playArea: PlayAreaDefinition;
  locationRules: LocationRules;
  captureRules: CaptureRules;
  respawnRules: RespawnRules;
  scoringRules: ScoringRule[];
  zones: ZoneDefinition[];
  objectives: ObjectiveDefinition[];
  winConditions: WinCondition[];
}
```

This is a conceptual interface, not a finalized contract. Game modes should ultimately be presets built from these primitives.

## 15. Game presets

Future built-in presets:

- **Manhunt:** Hunters attempt to capture runners.
- **Infection:** Captured humans become infected.
- **Capture the Flag:** Defend one objective while capturing another team's objective.
- **Assassin:** Each player receives a target; capturing the correct target assigns another.
- **VIP:** One team protects a designated player while another attempts to capture them.
- **King of the Hill:** Teams physically control geographic zones.
- **Checkpoint Race:** Players race through real-world checkpoints.
- **Treasure Hunt:** Clues lead players between locations.
- **Photo Hunt:** Photograph specified people, objects, locations, or challenges.
- **Custom Game:** Advanced users build their own rules.

## 16. Game creator

The long-term differentiator is a **Game Creator** that requires no programming.

Example Infection definition:

> Teams: Humans 18, Zombies 2  
> Duration: 60 minutes  
> Capture: Photo + within 20 m  
> On human captured: Change team to Zombies  
> Human location: Reveal every 5 minutes  
> Zombie location: Hidden  
> Win condition: Humans survive timer

Users should eventually invent modes the developers never anticipated.

## 17. Game actions

Generic actions include:

```text
capturePlayer
takePhoto
enterZone
leaveZone
reachCheckpoint
completeObjective
changeTeam
eliminatePlayer
respawnPlayer
awardPoints
revealLocation
hideLocation
startTimer
sendHint
```

Rules determine when actions are allowed and their consequences.

## 18. Map experience

The map may display the player's location, teammates, opponents, approximate enemy areas, last-known positions, zones, checkpoints, objectives, playing boundary, capture points, and warnings.

Gameplay must avoid constant map watching. Modes should encourage players to put the phone away and physically interact with their surroundings.

## 19. Camera

Initial use: **capture another player**.

Future uses: prove arrival, photograph objectives, treasure hunts, photo challenges, QR/object scanning, and team missions.

Photos contain server-associated metadata such as player, session, timestamp, and relevant location data.

## 20. Realtime architecture

Recommended architecture:

```text
Expo + React Native + TypeScript
                  ↓
Cloudflare Workers + Hono
                  ↓
Cloudflare Durable Objects + WebSockets
                  ↓
Neon PostgreSQL + Drizzle

Media: Cloudflare R2
```

Each active game can have a Durable Object responsible for authoritative live state, for example `game:J7K4P`.

It maintains connected players, current state, locations, timers, events, scores, captures, and realtime broadcasts.

PostgreSQL stores persistent users, definitions, sessions, results, statistics, and game history. Detailed routing and ownership are described in [architecture.md](architecture.md).

## 21. Recommended technology stack

| Concern | Proposal |
| --- | --- |
| Mobile | Expo, React Native, TypeScript, Expo Router |
| Device capabilities | Expo Location, Expo Camera, Expo Notifications |
| Maps | MapLibre or Mapbox |
| Backend | Cloudflare Workers, Hono, Zod |
| Realtime | Durable Objects, WebSockets |
| Database | Neon PostgreSQL, Drizzle ORM |
| Authentication | Better Auth; accounts not mandatory for guests |
| Storage | Cloudflare R2 for capture photos, avatars, and game media |
| Monorepo | pnpm, Turborepo |

## 22. Suggested repository structure

```text
apps/
  mobile/
services/
  api/
packages/
  db/
  contracts/
  api-client/
  auth/
  game-engine/
  game-presets/
  location/
  ui/
  utils/
  config/
docs/
```

`game-engine` remains separate from UI code. Create packages when they have an actual responsibility rather than adding empty scaffolding.

## 23. Suggested domain model

| Entity | Meaning |
| --- | --- |
| User | Permanent account |
| PlayerIdentity | Person participating; supports guests |
| GameDefinition | Rules describing a game |
| GamePreset | Reusable predefined definition |
| GameSession | Particular running instance |
| Player | Participant within a session |
| Team | Shared allegiance |
| Role | Assigned capabilities/rules |
| Zone | Geographic region with behavior |
| Objective | Something a player/team must accomplish |
| Capture | Attempt and result |
| GameEvent | Immutable record of an occurrence |
| GameResult | Final outcome |

## 24. Offline and connection handling

Real-world games cannot assume perfect internet. The app should cache current game information, retain its own recent location, queue appropriate actions, reconnect automatically, and synchronize after reconnection.

The server remains authoritative. Players see **CONNECTION LOST — Attempting to reconnect…**, rather than a crash or automatic ejection.

## 25. GPS accuracy

GPS is imperfect. Location records contain latitude, longitude, accuracy, and timestamp.

Capture validation must account for quality and configurable tolerances, rather than simply testing `distance <= 20m`. Poor readings can be rejected.

## 26. Battery usage

Games should support different tracking frequencies:

- High intensity: approximately every 2–5 seconds.
- Normal: every 10–20 seconds.
- Low power: every 30–60 seconds.

Location collection and broadcasting are separate. Periodic reveals do not require broadcasting every location update to every client.

## 27. Privacy

Players clearly understand when location sharing begins and ends. Tracking is associated with active sessions. Precise location history must not be retained indefinitely without a clear product need and appropriate user control.

Other players receive only information allowed by the rules. If a hunter is entitled only to an approximate distance and bearing, their client must not secretly receive exact coordinates and hide them visually.

The server sends only information the recipient is authorized to know.

## 28. Safety

Warn players against private property, unsafe road crossings, playing while driving, dangerous or restricted areas, and focusing on the screen while running.

Hosts can define safe boundaries. Mechanics should avoid encouraging reckless movement.

## 29. MVP scope

Include mobile app, guest identity, create game, join with code, lobby, host controls, readiness, Manhunt, hunters/runners, map, playing radius, timer, runner head start, GPS, periodic reveals, photo capture, proximity validation, elimination, realtime updates, game ending, and results.

Do not build a social network, friends system, public discovery, matchmaking, rankings, achievements, advanced profiles, dozens of modes, AI recognition, sophisticated anti-cheat, marketplace, or full visual rule builder yet.

> Is running around outside with friends using Outrun genuinely fun?

## 30. MVP user journey

The host opens Outrun, selects **Create Game → Manhunt**, and configures:

- Duration: 45 minutes.
- Playing radius: 1 km.
- Hunters: 2.
- Runner head start: 3 minutes.
- Reveal interval: 3 minutes.
- Capture distance: 25 m.

Outrun creates **J7K4P** and a QR code. Friends join. The host presses **START GAME**. Runners receive **RUN!** and hunters receive a countdown. The hunt starts, players chase each other, hunters photograph runners, the server validates captures, captured runners are eliminated, and results appear when runners survive the timer or all runners are captured.

## 31. Future results experience

Example:

> GAME OVER — 🏆 RUNNERS WIN  
> Survived: Talha — 45:00  
> Most captures: Mehmet — 4  
> Distance travelled: Yusuf — 7.8 km  
> Closest escape: Talha — 14 m  
> Total game time: 45 minutes

Future results could include a map replay. Advanced statistics require explicit definitions and privacy-compatible data collection before implementation.

## 32. Future game replay

Players could watch moving markers and events on a map:

> 12:42 — Runner location reveal  
> 18:17 — Mehmet captures Yusuf  
> 31:03 — Talha enters safe zone  
> 43:52 — Mehmet nearly reaches Talha

Replay becomes something players discuss afterward. It is a future feature, subject to retention and sharing choices.

## 33. Future creator platform

Outrun can evolve from an app containing real-world games into a platform for building them.

Users could create **Zombie Apocalypse — Antwerp**, **Campus Assassin**, **Brussels Spy Hunt**, **Birthday Treasure Hunt**, **Scouts Capture the Flag**, or **Youth Camp Manhunt**.

Definitions could be saved and shared, eventually supporting **CREATE**, **PLAY**, and **DISCOVER**, with published templates for others.

## 34. Long-term platform model

- **Outrun Engine:** Location, rules, realtime, camera, zones, and state.
- **Outrun Games:** Official modes such as Manhunt, Infection, Assassin, Capture the Flag, and King of the Hill.
- **Community Games:** User-created and shared games.

This enables expansion without developers inventing every possible game.

## 35. Product identity

Outrun feels energetic, competitive, adventurous, modern, social, slightly tactical, and playful rather than childish.

Visual inspiration can come from tactical maps, sports applications, multiplayer lobbies, and mission interfaces.

Screens remain simple enough to understand while running. Large buttons, strong contrast, and minimal interaction are important.

## 36. Core product statement

**Outrun turns the real world into a multiplayer game.**

Players create a game, invite friends, define where and how they play, then physically run, chase, hide, capture, photograph, explore, and compete.

The phone provides the rules and game intelligence. The real world provides the gameplay.

## 37. Development philosophy

When implementing a feature, ask:

> Does this make the real-world game more fun?

rather than:

> Does this give the application more features?

Outrun should not become an app where players stand still looking at a map. The ideal experience is:

**Look at phone → receive information → put phone away → act in the real world.**

This guides product, UX, and technical decisions.

## 38. MVP success criteria

The first milestone succeeds when approximately 6–10 people can:

1. Install/open Outrun.
2. Create a Manhunt game.
3. Join within a few minutes.
4. Understand their roles without explanation.
5. Start the game.
6. Physically chase and evade one another.
7. Receive reliable location reveals.
8. Capture players.
9. Finish without the host manually managing the game.
10. Immediately want another round.

The final criterion is the most important. If people finish and say **“Again.”**, the core product works.
