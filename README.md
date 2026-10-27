# Road Rash (1996 PC Web Edition) — Made By Soham

A personal, non-profit browser recreation of the 1996 Windows PC / 3DO classic **Road Rash**, built with Three.js, HTML5 Canvas, and WebAudio — complete with the original `.RRI` menus, `.CRS` California courses, digitized rider/cop/traffic/pedestrian sprites, `.WAV` sound effects, SoundFont Grunge rock music, client-side `localStorage` Big Game career saves, and authentic `ROADRASH.EXE` physics & combat.

## Features

- **Start-Screen Display Ratio Controls & Full Responsiveness (`4:3 OG` vs `16:9 Widescreen`):**
  - Displays **"Made By Soham"** on the starting screens along with interactive **`4:3 OG`**, **`16:9 Wide`**, **`Fullscreen`**, and **`Start Game`** buttons right on the landing page, Main Menu, and responsive bottom navigation bar.
  - **`16:9 Widescreen` (`854×480`)** renders a genuinely wider Three.js 3D horizontal field-of-view while keeping all 1996 cockpit gauges and UI photography razor-sharp with zero stretching.
- **`$1,000,000` Cash & All 15 Bikes Unlocked (`localStorage`):**
  - Starts every rider with **`$1,000,000` cash** so **all 15 Rat, Sport, and Super bikes are unlocked** right away at **Olley's Skoot-A-Rama** in Big Game Mode and selectable via click or **`Tab`** on Track Select.
- **All 4 OG Weapons Unlocked for Everyone:**
  - Switch freely anytime pre-race or mid-race (`Q`, `E`, `1`–`4`, or clicking the HUD `WPN` badge / touch `WPN` button) between **Bare Fists** (with timed weapon-snatching), **Wooden Club**, **Steel Chain**, and **Police Nightstick**.
- **Special Police Interceptor Mode + New Custom Map (*Interceptor Beltway*):**
  - Ride as a **Highway Patrol Officer** (`LOCOP.DAT` Police Interceptor bike, officer animations, flashing red/blue strobes, and live siren) and **bust all 14 outlaw racers** before any single racer crosses the finish line!
  - Includes a brand-new 6th custom course — **Interceptor Beltway** — spanning a 6-lane downtown metro freeway, twin enclosed echo tunnels, Pacific coastal cliff drop-offs, and Sierra mountain sweepers.
- **Nitro / Speed Boost on ALL Bikes:**
  - Every motorcycle (Rat, Sport, Super, and Police Interceptor) is equipped with rechargeable **Nitro Speed Boost** (`N`, `B`, `Ctrl`, or double-tap `Up`/`W`).
- **Authentic Grounded `ROADRASH.EXE` Physics & Combat (No Fake Jumps):**
  - Bikes stay planted on hill crests with fixed camera height; riding upright over a downed motorcycle gives a realistic low tire hop without artificial sky launches; crashed riders tumble, slide, stand up, and sprint back to their bikes; clipped jaywalkers collapse onto the pavement.

## Controls

| Key | Action |
| --- | --- |
| `Arrow Keys` / `WASD` | Steer, Accelerate & Brake |
| `Space` / `Enter` | Smart Melee Swing (Fists / Club / Chain / Nightstick) |
| `Z` / `,` and `C` / `.` | Left / Right Melee Swing |
| `Q` / `E` / `1`–`4` | Cycle or Select Any Unlocked OG Weapon Mid-Race |
| `X` / `Shift` / `/` | Lateral Boot Kick (Shove Rival Across Lanes) |
| `N` / `B` / `Ctrl` / Double-Tap `Up` | Nitro Speed Boost (Enabled on ALL Bikes!) |
| `G` | Toggle Police Siren (in Police Mode) |
| `F10` / `H` | Cycle Cockpit HUD (Full Dash / Mini / Off) |
| `F11` | Toggle Fullscreen (`4:3 OG` or `16:9 Wide`) |
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
