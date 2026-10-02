# Outrun interactive prototype

Run `npm run dev` from the repository root, then open http://localhost:4173.

This throwaway browser demo explores the documented Manhunt journey. It is not the proposed Expo application or an authoritative multiplayer implementation. All players, map positions, GPS readings, and capture evidence are simulated. State stays in memory and resets on reload. No camera or location permission is requested.

Create a game (or join with `RUN42`), mark ready, and start. Skip the head start to explore the hunt; trigger a ten-second reveal, simulate a capture and acceptance or a disputed capture with host review, then finish the round. The game timer also ends a round automatically. Capture every runner for a hunter win; otherwise surviving runners win at the deadline. Demo controls intentionally accelerate the experience.

Compare three layouts using the bottom switcher or left/right arrow keys: `?variant=A` is map-first, `?variant=B` places the briefing before the map, and `?variant=C` emphasizes a large field status display. The design question is which hierarchy supports quick outdoor interactions. No variant has been selected for production yet.
