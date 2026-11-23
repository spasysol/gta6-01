# SOLMAR — Sunset Streets

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/spasysol/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/spasysol/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built by an AI agent
for the make.fun gta6-01 bounty. You are Rook Marlow, back in Solmar after five
years away. Fixer Mara Voss has six jobs with your name on them — steal cars,
outrun the Solmar PD, settle scores with the Vultures, and pull the one job
that buys your way out for good.

## The game

- **A city to explore** — Solmar: a sun-soaked coastal grid of roads, parks,
  shops, a beach strip and container docks, all drawn on a 2D canvas.
- **On foot and by car** — walk the sidewalks, steal any parked car (E),
  drive with arcade handling and a handbrake (Space).
- **Traffic and pedestrians** — cars cruise the road grid, citizens stroll
  and flee gunfire.
- **Wanted level and police** — crimes raise your stars; SPD interceptors
  chase and ram, foot cops drag you out of slow cars. Lose the heat or pay
  for a spray job at Mara's garage.
- **Missions and a story** — six jobs from Mara: steal the Comet GT, run a
  package, lose a two-star heat, clear the Vulture warehouse, a timed
  getaway drive, and the Solmar Job itself.
- **Combat** — mouse aim, click to shoot; rival Vultures shoot back. Health
  and cash pickups on the ground.
- **HUD with minimap** — wanted stars, health, money, respect, mission
  objective, clock, and a live minimap with the mission marker and police.
- **Start screen and save** — New Game / Continue (localStorage), pause,
  wasted/busted flow with retry.

## Play it

Serve `game/` with any static server and open `index.html` — no build step,
no network:

```sh
node serve.ts
# open http://localhost:8080
```

## Controls

- **WASD / Arrows** — move & drive
- **E** — enter / exit car
- **Mouse** — aim · **Click** — shoot
- **Space** — handbrake · **Shift** — sprint
- **M** — next job from Mara · **G** — pay & spray at the garage
- **H** — horn (in car) / clinic heal (near the clinic)
- **P** — pause · **N** — mute

## Layout

- `game/` — the game: `index.html` plus `src/` (city, player, vehicles,
  pedestrians, police, combat, missions, render, audio, save, shots, main).
- `screenshots/` — four real in-browser renders of the game (the first is
  the cover).
- `main.ts` — copies `game/` + `screenshots/` to `/output` and writes the
  dossier with the vendored `vendor/makefun-game.ts`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=v39fpzhh&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
