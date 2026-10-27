# Road Rash (1996 PC Web Edition)

A personal, non-profit browser recreation of the 1996 Windows PC / 3DO classic **Road Rash**, built with Three.js, HTML5 Canvas, and WebAudio — complete with the original 640×480 `.RRI` menus, `.CRS` California courses, digitized rider/cop/traffic/pedestrian sprites, `.WAV` sound effects, SoundFont Grunge rock music, client-side `localStorage` Big Game career saves, and full OG combat & road-hazard physics.

## Authentic OG Features

- **1996 640×480 Frontend & Big Game Career (`localStorage`):**
  - **Thrash Mode** (instant race across Levels 1–5) & **Big Game Mode** (select from all 8 classic characters — *Axle, Bose Jefferson, Cydney Bass, Milwaukee Jon, Pearl McKurdy, Rhonda the Rash, Slim Jim, Teflon Mike* — visit **Der Panzer Klub** to schmooze & check the Bulletin Board, shop all 15 Rat, Sport, and Nitro Superbikes at **Olley's Skoot-A-Rama**, and progress through all 5 levels without any backend database).
- **All 5 Decoded `.CRS` California Courses:**
  - *The City*, *Sierra Nevada*, *The Peninsula*, *Napa Valley*, and *Pacific Highway* with real elevation, curves, 3D buildings, hills, coastal cliffs, tunnels, horizon backdrops, and cockpit dashboards (`Rat`, `Sport`, `Super`).
- **Full OG Combat, Pedestrian & Downed-Bike Ramp Physics:**
  - **Melee Combat & Timed Weapon Snatching (`Z` / `C`):** Punches, clubs, and chains visibly stagger rivals and drain their stamina bar until knockout; timing an unarmed punch during an armed rival's windup snatches their club or chain.
  - **Physical Boot-Kick Shoves (`X`):** Kicks apply real lateral momentum that shoves rival motorcycles (or pursuing cops) across lanes into oncoming traffic, buildings, cliffs, or roadside obstacles.
  - **Hittable Pedestrians & Sprinting Fallen Riders:** Walking jaywalkers scream and tumble comically when clipped, and crashed riders sprint on foot back to their downed motorcycles (and can be bowled over again while running!).
  - **Downed-Bike Launch Ramps:** Crashed motorcycles lying on the road act as physical ramps that launch oncoming bikes airborne on contact.

## Controls

| Key | Action |
| --- | --- |
| `Arrow Keys` / `WASD` | Steer, Accelerate & Brake |
| `Z` / `,` | Left Melee Swing (Punch / Club / Chain) |
| `C` / `.` / `Enter` | Right Melee Swing (Punch / Club / Chain) |
| `X` / `Shift` / `/` | Lateral Boot Kick (Shove Rival Across Lanes) |
| `Space` / `N` | Superbike Nitro Boost |
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
