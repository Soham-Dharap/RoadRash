# Road Rash (1996 PC Web Edition) — Made By Soham

A personal, non-profit browser recreation of the 1996 Windows PC / 3DO classic **Road Rash**, built with Three.js, HTML5 Canvas, and WebAudio — complete with the original 640×480 `.RRI` menus, `.CRS` California courses, digitized rider/cop/traffic/pedestrian sprites, `.WAV` sound effects, SoundFont Grunge rock music, client-side `localStorage` Big Game career saves, and authentic `ROADRASH.EXE` physics & combat.

## Features

- **1996 640×480 Frontend & `$1,000,000` Unlocked Garage (`localStorage`):**
  - Displays **"Made By Soham"** on the starting screens.
  - Starts every rider with **`$1,000,000` cash** so **all 15 Rat, Sport, and Super bikes are unlocked** right away at **Olley's Skoot-A-Rama** in Big Game Mode and selectable via **`Tab`** (or the Restroom) in Thrash Mode.
- **Nitro / Speed Boost on ALL 15 Bikes:**
  - Every motorcycle (Rat, Sport, and Super) is equipped with rechargeable **Nitro Speed Boost** (`N`, `B`, `Ctrl`, or double-tap `Up`/`W`).
- **All 5 Decoded `.CRS` California Courses:**
  - *The City*, *Sierra Nevada*, *The Peninsula*, *Napa Valley*, and *Pacific Highway* with camera-space perspective projection, 3D buildings, hills, coastal cliffs, tunnels, horizon backdrops, rear-view mirror, and cockpit dashboards (`Rat`, `Sport`, `Super`).
- **Authentic Grounded `ROADRASH.EXE` Combat & Road Mechanics (No Fake Jumps):**
  - **Grounded Road Riding:** Bikes stay planted on hill crests with fixed camera height; riding upright over a downed motorcycle gives a realistic low tire bump without artificial sky launches.
  - **Melee Combat & Timed Weapon Snatching (`Space` / `Z` / `C`):** Punches, clubs, and chains visibly stagger rivals and drain their stamina bar until knockout; timing an unarmed punch during an armed rival's windup snatches their club or chain.
  - **Physical Boot-Kick Shoves (`X` / `Shift`):** Kicks apply real lateral momentum that shoves rival motorcycles (or pursuing cops) across lanes into oncoming traffic, buildings, cliffs, or roadside obstacles.
  - **Grounded Pedestrians & `HIBOB` Rider Crashes:** Clipped jaywalkers scream and collapse onto the pavement (`ped.anims[3]`), and crashed riders tumble, slide across the asphalt, stand up, and sprint on foot back to their downed motorcycles.

## Controls

| Key | Action |
| --- | --- |
| `Arrow Keys` / `WASD` | Steer, Accelerate & Brake |
| `Space` / `Enter` | Smart Melee Swing (Punch / Club / Chain toward closest rival) |
| `Z` / `,` | Left Melee Swing |
| `C` / `.` | Right Melee Swing |
| `X` / `Shift` / `/` | Lateral Boot Kick (Shove Rival Across Lanes) |
| `N` / `B` / `Ctrl` / Double-Tap `Up` | Nitro Speed Boost (Enabled on ALL 15 Bikes!) |
| `Tab` | Switch Any of the 15 Unlocked Bikes on Thrash Track Select |
| `F10` / `H` | Cycle Cockpit HUD (Full Dash / Mini / Off) |
| `M` | Next Grunge Rock Jukebox Track |
| `Esc` / `P` | Pause / Menu |

## Local Development

```bash
npm install
npm run dev
```

## Deploy on Render (Static Site Blueprint)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Soham-Dharap/RoadRash/tree/arena/5201adec-roadrash)

`render.yaml` configures a zero-database Render Static Site building `./dist` with Node 22 directly from branch `arena/5201adec-roadrash`.
