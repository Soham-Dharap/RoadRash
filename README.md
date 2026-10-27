# ROAD RASH '96 — Authentic Browser Edition

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Soham-Dharap/RoadRash/tree/arena/5201adec-roadrash)

A ground-up, copyright-safe browser recreation of the classic **1996 Windows 95 / 3DO *Road Rash*** built with **HTML5, CSS3, Vanilla JavaScript, Three.js (Papy3D-style 480p SVGA renderer), 2D Canvas Cockpit HUD, and Web Audio API synthesis** — featuring all the original combat & road physics missing from simplified browser clones.

## Core OG 1996 Features & Physics

- **Authentic 1996 SVGA Graphics & Cockpit Fairing HUD:**
  - Crisp 480p `NearestFilter` 3D road geometry with hills, crests, S-bends, 4-lane California highway markings, signalized crosswalk intersections, corrugated steel guardrails, Pacific cliffs/surf, and 3D San Francisco downtown blocks.
  - Pre-rendered-style 256-color SVGA pixel-art biker, cop, pedestrian, and vehicle sprites with dynamic shadows.
  - Exact 1996 sculpted bottom fairing dashboard: analog `0–320 km/h` speedometer, `0–12k RPM` tachometer, curved player & nearest-rival stamina gauges with live names, top-center bike condition bar, digital rank (`1–15`), distance remaining, and rearview mirror.
- **Full Melee Combat & Lateral Kick Physics:**
  - **Punches & Backhands (`Space / Z / B`):** Drain rival stamina bars; knock rivals off their bikes when stamina hits zero.
  - **Timed Weapon Snatching:** Punch an armed rival during their overhead windup to **steal their Oak Club, Steel Chain, Crowbar, or Nunchaku** right out of their hand!
  - **High-Knockback Side Kicks (`X / C / K`):** Boot rival motorcycles sideways into oncoming cars, signposts, trees, or guardrails for instant environmental wipeouts!
- **Downed Motorcycles Act as Physical Bump / Launch Ramps:**
  - Crashed riders separate from their bikes — leaving their smoking motorcycle lying across the lane. Riding over a **downed bike** launches your motorcycle **airborne** with suspension crunch & sparks (stick the landing straight, or wipe out if tilted hard!).
- **Jaywalking Pedestrians & Fallen Riders Running Back on Foot:**
  - Pedestrians cross intersections and sidewalks; clipping them triggers comical cartoon tumbles + yelps and wobbles your bars without wrecking you.
  - Knocked-off riders don't teleport — they tumble, stand up, and **sprint on foot across traffic** back to their bike (and can be bowled right back down if clipped by passing bikes!).
- **Thrash Mode & Big Game Career (`localStorage` Saves):**
  - **5 California Courses:** *The City*, *The Peninsula*, *Pacific Highway*, *Sierra Nevada*, *Napa Valley* across **Levels 1–5**.
  - **8 Classic Rashers** & **15 Motorcycles** (*Rat*, *Sport*, *Super* classes with **Nitrous Oxide `N2O`**) in the Bike Shop, plus pursuing **Highway Patrol Motorcycle Cops** (`BUSTED!` fines & bike repair bills).

## Controls

| Action | Keys |
| :--- | :--- |
| **Accelerate** | `W` or `↑` *(Double-tap for Nitro!)* |
| **Brake / Pause On-Foot Run** | `S` or `↓` |
| **Steer & Lean** | `A / D` or `← / →` |
| **Punch / Swing Weapon** | `Space`, `Z`, or `J` (`Q` / `E` for explicit Left/Right, `B` for Backhand) |
| **Side Kick (Lateral Shove)** | `X`, `C`, `K`, or `Enter` |
| **Nitrous Oxide (`N2O`)** | `N` or `Shift` |
| **Switch Cockpit / Chase / 1st-Person** | `V` |
| **Toggle Rearview Mirror** | `M` |
| **Next 90s Grunge Track** | `T` |
| **Pause** | `Esc` or `P` |

## Running Locally

```bash
npm install
npm run dev
```

Or build static files (deployable straight to Render / GitHub Pages / Cloudflare Pages / Vercel, or served via Python):

```bash
npm run build
python3 server.py
```

## Deploying on Render via Blueprint (`render.yaml`)

This branch (`arena/5201adec-roadrash`) includes a ready-to-deploy `render.yaml` Blueprint configured as a **Render Static Site** (free global CDN, instant loads, zero server cold-starts):

1. **Option A — 1-Click Deploy Link:**
   Open `https://render.com/deploy?repo=https://github.com/Soham-Dharap/RoadRash/tree/arena/5201adec-roadrash` and click **Apply**.
2. **Option B — Render Dashboard Blueprint:**
   - Go to **Render Dashboard → New + → Blueprint**.
   - Connect **`Soham-Dharap/RoadRash`**.
   - Under **Branch**, select **`arena/5201adec-roadrash`**.
   - Click **Apply** — Render reads `render.yaml`, runs `npm ci --include=dev && npm run build`, and publishes `./dist` automatically.
