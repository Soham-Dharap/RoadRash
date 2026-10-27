import { WEAPONS, BIKES, AI_RIVALS, LEVEL_ECONOMY } from '../data/roster.js';
import { ROAD_HALF_WIDTH, buildCourseData } from '../data/tracks.js';
import {
  getBikerSpriteSet,
  getPedestrianSprites,
  getVehicleSprites
} from '../graphics/sprites.js';
import { sampleCourse } from './world3d.js';

export class RaceEngine {
  constructor(world3d, sound) {
    this.world3d = world3d;
    this.sound = sound;

    this.course = null;
    this.level = 1;
    this.trafficEnabled = true;

    this.racers = []; // [0] = player, [1..14] = 14 named AI Rashers
    this.cops = [];
    this.cars = [];
    this.pedestrians = [];

    this.player = null;
    this.cameraMode = 0; // 0 = Classic 1996 Cockpit Chase, 1 = Clean Chase, 2 = First-Person Cockpit
    this.mirrorOn = true;

    this.countdown = 3.2;
    this.raceTime = 0;
    this.finished = false;
    this.finishOutcome = null; // 'qualified' | 'finished' | 'wrecked' | 'busted'
    this.finishDelayTimer = 0;

    this.callout = '';
    this.calloutColor = '#facc15';
    this.calloutTimer = 0;
    this.screenShake = 0;

    // Input state
    this.keys = {};
    this.lastAccelTap = 0;
  }

  showCallout(text, color = '#facc15', dur = 1.9) {
    this.callout = text;
    this.calloutColor = color;
    this.calloutTimer = dur;
  }

  startRace({ track, level = 1, playerChar, playerBike, playerWeapon = 'fist', trafficEnabled = true }) {
    this.level = level;
    this.trafficEnabled = trafficEnabled;
    const econ = LEVEL_ECONOMY[Math.max(0, Math.min(4, level - 1))];
    this.economy = econ;

    this.course = buildCourseData(track, econ.baseDistanceKm);
    this.world3d.buildCourseScene(this.course);

    this.racers = [];
    this.cops = [];
    this.cars = [];
    this.pedestrians = [];
    this.countdown = 3.2;
    this.raceTime = 0;
    this.finished = false;
    this.finishOutcome = null;
    this.finishDelayTimer = 0;
    this.callout = '';
    this.calloutTimer = 0;
    this.screenShake = 0;

    // 1. Create Player Racer (Grid slot 15 at back of pack — classic Road Rash start!)
    this.player = this.createRacer({
      isPlayer: true,
      name: playerChar.name,
      bike: playerBike,
      weapon: playerWeapon || playerChar.startWeapon || 'fist',
      palette: {
        bikeColor: playerBike.color,
        suitMain: playerChar.suitMain,
        suitShoulder: playerChar.suitShoulder,
        helmetColor: playerChar.helmetColor,
        pantsColor: playerChar.pantsColor,
        weapon: playerWeapon || 'club'
      },
      s: 18,
      x: 3.2,
      skill: 1.0,
      aggro: 0
    });
    this.racers.push(this.player);

    // 2. Create 14 Named AI Rivals on a 2-column staggered starting grid ahead of player!
    const [minTier, maxTier] = econ.bikeTierRange;
    AI_RIVALS.slice(0, 14).forEach((ai, idx) => {
      const tierSpan = maxTier - minTier;
      const tierIdx = Math.min(
        BIKES.length - 1,
        Math.round(minTier + (1 - idx / 13) * tierSpan)
      );
      const aiBike = BIKES[tierIdx];
      const row = Math.floor(idx / 2);
      const col = idx % 2;
      const startS = 24 + (6 - row) * 6.5 + col * 2.5;
      const startX = col === 0 ? 2.1 : 5.9;

      const r = this.createRacer({
        isPlayer: false,
        name: ai.name,
        bike: aiBike,
        weapon: idx % 3 === 0 ? ai.weapon : idx % 5 === 0 ? 'club' : 'fist',
        palette: {
          bikeColor: ai.bikeColor,
          suitMain: ai.suitMain,
          suitShoulder: ai.suitShoulder,
          helmetColor: ai.helmetColor,
          pantsColor: ai.suitMain,
          weapon: ai.weapon === 'fist' ? 'club' : ai.weapon
        },
        s: startS,
        x: startX,
        skill: ai.skill,
        aggro: ai.aggro
      });
      r.preferredLaneX = 1.8 + ((idx * 1.9) % 6.2);
      this.racers.push(r);
    });

    // 3. Create Patrol Police Motorcycle Officers stationed along the course!
    for (let c = 0; c < econ.copCount; c++) {
      const patrolS = ((c + 0.65) / (econ.copCount + 0.3)) * this.course.finishS;
      const copBike = BIKES[Math.min(BIKES.length - 1, maxTier + 1)];
      const cop = this.createRacer({
        isPlayer: false,
        isCop: true,
        name: `Officer #${c + 1}`,
        bike: copBike,
        weapon: 'club',
        palette: {
          bikeColor: '#f8fafc',
          suitMain: '#111827',
          suitShoulder: '#1f2937',
          helmetColor: '#f8fafc',
          pantsColor: '#b89f72',
          isCop: true,
          weapon: 'club'
        },
        s: patrolS,
        x: 7.8,
        skill: 0.94,
        aggro: 0.95
      });
      cop.patrolOriginS = patrolS;
      cop.chasing = false;
      this.cops.push(cop);
    }

    // 4. Create 2-Way Highway Traffic Cars & Trucks!
    if (this.trafficEnabled) {
      const vehSprites = getVehicleSprites();
      const totalCars = Math.round(28 * econ.trafficMult);
      for (let i = 0; i < totalCars; i++) {
        const oncoming = i % 2 === 0; // 50% oncoming in left 2 lanes, 50% forward in right 2 lanes!
        const laneChoice = i % 4 < 2 ? 0 : 1;
        const laneX = oncoming
          ? laneChoice === 0
            ? -6.6
            : -2.4
          : laneChoice === 0
            ? 2.4
            : 6.6;
        const vSpec = vehSprites[i % vehSprites.length];
        const tex = oncoming ? vSpec.front : vSpec.rear;
        const sprite = this.world3d.createEntitySprite(tex, 3.2, 2.35);
        const startS = 140 + ((i / totalCars) * (this.course.finishS - 180));
        this.cars.push({
          s: startS,
          x: laneX,
          oncoming,
          speed: oncoming ? -(19 + (i % 5) * 3.2) : 18 + (i % 5) * 3.0, // m/s (~65-115 km/h)
          vSpec,
          sprite,
          halfW: 1.35,
          halfL: 2.5
        });
      }
    }

    // 5. Create Jaywalking & Crosswalk Pedestrians!
    const pedVariants = getPedestrianSprites();
    for (const sp of this.course.pedestrianSpawns) {
      const v = pedVariants[sp.variant % pedVariants.length];
      const sprite = this.world3d.createEntitySprite(v.walk[0], 1.45, 1.85);
      this.pedestrians.push({
        s: sp.s,
        baseS: sp.s,
        x: sp.startX,
        dir: sp.dir,
        speed: sp.speed,
        crosswalk: sp.crosswalk,
        v,
        sprite,
        state: 'walking', // 'walking' | 'flying' | 'recover'
        airY: 0,
        vx: 0,
        vy: 0,
        vs: 0,
        animTime: Math.random() * 4,
        timer: 0
      });
    }

    // Position all entities for initial countdown render
    this.syncAllSprites(0.016);
  }

  createRacer(cfg) {
    const sprites = getBikerSpriteSet(cfg.palette);
    const riderSprite = this.world3d.createEntitySprite(sprites.idle, 2.05, 2.05);
    const downedBikeSprite = this.world3d.createEntitySprite(sprites.downedBike, 2.35, 1.35);
    downedBikeSprite.visible = false;

    return {
      isPlayer: !!cfg.isPlayer,
      isCop: !!cfg.isCop,
      name: cfg.name,
      bike: cfg.bike,
      palette: cfg.palette,
      sprites,
      riderSprite,
      downedBikeSprite,

      s: cfg.s,
      x: cfg.x,
      airY: 0,
      speed: 0, // m/s forward
      vx: 0, // external lateral shove velocity (m/s)
      vy: 0, // vertical jump/bounce velocity (m/s)
      lean: 0, // -1..+1
      rpm: 1400,

      stamina: 100,
      bikeHealth: cfg.bike.durability,
      bikeMaxHealth: cfg.bike.durability,

      weapon: cfg.weapon || 'fist',
      nitroCharges: cfg.bike.nitroCharges || 0,
      maxNitro: cfg.bike.nitroCharges || 0,
      nitroTimer: 0,

      state: 'riding', // 'riding' | 'tumbling' | 'running' | 'wrecked' | 'busted'
      stateTimer: 0,
      hitRecoilTimer: 0,
      hitRecoilSide: 1,

      // Attack state machine
      attackType: null, // 'punch' | 'backhand' | 'kick' | 'weapon'
      attackSide: 1, // -1 left, +1 right
      attackPhase: 'none', // 'none' | 'windup' | 'active' | 'cooldown'
      attackTimer: 0,
      attackConnected: false,

      // Downed motorcycle separate physics body when rider crashes!
      bikeS: cfg.s,
      bikeX: cfg.x,
      bikeVs: 0,
      bikeVx: 0,
      rampCooldown: 0, // prevents multi-triggering same downed bike in consecutive frames

      // AI fields
      skill: cfg.skill || 0.85,
      aggro: cfg.aggro || 0.75,
      preferredLaneX: 4.0,
      aiAttackCooldown: 0.5 + Math.random(),
      lastShovedByPlayer: 0,
      finished: false,
      finishTime: 0
    };
  }

  triggerNitro(r) {
    if (r.state !== 'riding' || r.nitroCharges <= 0 || r.nitroTimer > 0 || this.countdown > 0) return;
    r.nitroCharges--;
    r.nitroTimer = 2.1;
    if (r.isPlayer) {
      this.sound.playNitro();
      this.showCallout('NITROUS OXIDE BOOST!', '#38bdf8', 1.3);
    }
  }

  startAttack(r, kind, explicitSide = 0) {
    if (r.state !== 'riding' || r.attackPhase !== 'none' || this.countdown > 0) return;

    // Auto-select side toward nearest rival/cop within 9m longitudinal & 5.5m lateral!
    let side = explicitSide;
    if (side === 0) {
      let bestDist = 999;
      side = 1;
      const targets = r.isCop ? this.racers : [...this.racers, ...this.cops];
      for (const other of targets) {
        if (other === r || other.state !== 'riding') continue;
        const ds = Math.abs(other.s - r.s);
        const dx = other.x - r.x;
        if (ds < 6.0 && Math.abs(dx) < 5.5) {
          const d = ds + Math.abs(dx);
          if (d < bestDist) {
            bestDist = d;
            side = dx < 0 ? -1 : 1;
          }
        }
      }
    }

    let wSpec;
    if (kind === 'kick') {
      wSpec = WEAPONS.kick;
      r.attackType = 'kick';
    } else if (r.weapon && r.weapon !== 'fist') {
      wSpec = WEAPONS[r.weapon] || WEAPONS.club;
      r.attackType = 'weapon';
    } else if (kind === 'backhand') {
      wSpec = WEAPONS.backhand;
      r.attackType = 'backhand';
    } else {
      wSpec = WEAPONS.fist;
      r.attackType = 'punch';
    }

    r.attackSide = side;
    r.attackSpec = wSpec;
    r.attackPhase = 'windup';
    r.attackTimer = wSpec.windup;
    r.attackConnected = false;

    if (r.isPlayer) {
      this.sound.playSwing(r.attackType === 'weapon' ? r.weapon : 'fist');
    }
  }

  /**
   * Knocks a rider off their motorcycle (from stamina KO, car collision, pole/guardrail crash, or bad jump landing)!
   * Separates the Rider Body and the Downed Motorcycle Body on the asphalt!
   */
  triggerCrash(r, impactSeverity = 1.0, reasonCallout = '') {
    if (r.state !== 'riding') return;

    const bikeDmg = Math.round((10 + impactSeverity * 16) * (r.isPlayer ? 1.0 : 0.7));
    r.bikeHealth = Math.max(0, r.bikeHealth - bikeDmg);

    // Bike slides farther down the road than the tumbling rider (classic Road Rash theater!)
    r.bikeS = r.s + 2.5;
    r.bikeX = Math.max(-(ROAD_HALF_WIDTH + 1.2), Math.min(ROAD_HALF_WIDTH + 1.2, r.x + (Math.random() - 0.5) * 2.2));
    r.bikeVs = Math.min(34, r.speed * 0.78 + 7);
    r.bikeVx = (Math.random() - 0.5) * 4.5;
    r.downedBikeSprite.visible = true;

    // Rider launches & tumbles
    r.speed = Math.min(24, r.speed * 0.52);
    r.airY = Math.max(r.airY, 0.9 + Math.min(2.6, impactSeverity * 1.2));
    r.vy = 4.8 + Math.min(6.5, impactSeverity * 3.4);
    r.vx = (Math.random() - 0.5) * 6.5;
    r.attackPhase = 'none';

    const cs = sampleCourse(this.course, r.s);
    const wPos = { x: cs.x + cs.rx * r.x, y: cs.roadY + 0.5, z: cs.z + cs.rz * r.x };
    this.world3d.spawnSparks(wPos, 20, 0xf97316, 8);

    if (r.isPlayer) {
      this.sound.playCrash();
      this.screenShake = 0.55;
      if (r.bikeHealth <= 0) {
        r.state = 'wrecked';
        this.finished = true;
        this.finishOutcome = 'wrecked';
        this.finishDelayTimer = 2.4;
        this.showCallout('BIKE WRECKED! ENGINE BLOWN!', '#ef4444', 3.0);
        return;
      }
      this.showCallout(reasonCallout || 'WIPEOUT! SPRINT BACK TO YOUR BIKE!', '#ef4444', 2.2);
    } else if (Math.abs(r.s - this.player.s) < 55) {
      this.sound.playCrash();
      if (reasonCallout) {
        this.showCallout(reasonCallout, '#fbbf24', 2.1);
      }
    }

    r.state = 'tumbling';
    r.stateTimer = 1.15 + Math.min(0.85, impactSeverity * 0.35);
  }

  update(dt, controls) {
    if (!this.course || !this.player) return;
    const clampedDt = Math.min(0.05, dt);

    if (this.calloutTimer > 0) this.calloutTimer -= clampedDt;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - clampedDt * 1.8);

    // 3.. 2.. 1.. RASH! Countdown
    if (this.countdown > 0) {
      const prevSec = Math.ceil(this.countdown);
      this.countdown -= clampedDt;
      const nextSec = Math.ceil(this.countdown);
      if (nextSec !== prevSec && nextSec >= 0) {
        this.sound.playCountdownBeep(nextSec === 0);
      }
      this.player.rpm = controls.accel ? 6800 + Math.sin(performance.now() * 0.04) * 900 : 1600;
      this.sound.updateRaceLoops({ active: true, rpm: this.player.rpm, nitro: false, copProximity: 0 });
      this.syncAllSprites(clampedDt);
      return;
    }

    if (!this.finished) {
      this.raceTime += clampedDt;
    } else {
      this.finishDelayTimer -= clampedDt;
    }

    // Update Traffic Cars
    this.updateTraffic(clampedDt);

    // Update Pedestrians (walking & flying!)
    this.updatePedestrians(clampedDt);

    // Update All Racers (Player + 14 AI) & Police Officers
    const allBikes = [...this.racers, ...this.cops];
    for (const r of allBikes) {
      this.updateSingleRacer(r, clampedDt, r.isPlayer ? controls : null);
    }

    // Resolve Combat Attacks, Bike-to-Bike Rubbing, Downed-Bike Ramps, Hitting Fallen Riders, Pedestrians & Traffic!
    this.resolveInteractions(clampedDt);

    // Compute live race standings (1..15)
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.s - a.s;
    });
    sorted.forEach((r, idx) => {
      r.position = idx + 1;
    });

    // Check cop siren proximity for audio & HUD warning
    let closestCopDist = 999;
    for (const cop of this.cops) {
      if (cop.chasing && cop.state === 'riding') {
        closestCopDist = Math.min(closestCopDist, Math.abs(cop.s - this.player.s));
      }
    }
    const copProx = closestCopDist < 65 ? 1 - closestCopDist / 65 : 0;
    this.copWarning = copProx;

    this.sound.updateRaceLoops({
      active: !this.finished && !this.attractMode,
      rpm: this.player.state === 'riding' ? this.player.rpm : 1400,
      nitro: this.player.nitroTimer > 0,
      copProximity: copProx
    });

    this.syncAllSprites(clampedDt);
  }

  updateTraffic(dt) {
    for (const car of this.cars) {
      car.s += car.speed * dt;
      // Recycle traffic cleanly far ahead/behind player so road always feels alive!
      if (car.oncoming && car.s < this.player.s - 95) {
        car.s = Math.min(this.course.totalS - 40, this.player.s + 380 + Math.random() * 220);
      } else if (!car.oncoming && car.s < this.player.s - 130) {
        car.s = Math.min(this.course.totalS - 40, this.player.s + 310 + Math.random() * 200);
      } else if (car.s > this.course.totalS - 25) {
        car.s = 90 + Math.random() * 140;
      }
    }
  }

  updatePedestrians(dt) {
    for (const ped of this.pedestrians) {
      ped.animTime += dt;
      if (ped.state === 'walking') {
        if (ped.crosswalk) {
          ped.x += ped.dir * ped.speed * dt;
          const limit = ROAD_HALF_WIDTH + 2.6;
          if (ped.x > limit) {
            ped.x = limit;
            ped.dir = -1;
          } else if (ped.x < -limit) {
            ped.x = -limit;
            ped.dir = 1;
          }
        } else {
          // Sidewalk stroller walking along shoulder
          ped.s += ped.dir * 1.4 * dt;
          if (Math.abs(ped.s - ped.baseS) > 18) ped.dir *= -1;
        }
      } else if (ped.state === 'flying') {
        // Comical cartoon arc to the roadside!
        ped.s += ped.vs * dt;
        ped.x += ped.vx * dt;
        ped.airY += ped.vy * dt;
        ped.vy -= 22 * dt;
        if (ped.airY <= 0) {
          ped.airY = 0;
          ped.vs *= 0.4;
          ped.vx *= 0.4;
          ped.state = 'recover';
          ped.timer = 2.4;
        }
      } else if (ped.state === 'recover') {
        ped.timer -= dt;
        if (ped.timer <= 0) {
          ped.state = 'walking';
          ped.x = (ped.x < 0 ? -1 : 1) * (ROAD_HALF_WIDTH + 1.8);
          ped.dir = ped.x < 0 ? 1 : -1;
        }
      }
    }
  }

  updateSingleRacer(r, dt, controls) {
    if (r.rampCooldown > 0) r.rampCooldown -= dt;
    if (r.hitRecoilTimer > 0) r.hitRecoilTimer -= dt;
    if (r.lastShovedByPlayer > 0) r.lastShovedByPlayer -= dt;

    // Update sliding downed motorcycle if separated from rider!
    if (r.state !== 'riding') {
      if (r.bikeVs > 0.1 || Math.abs(r.bikeVx) > 0.1) {
        r.bikeS = Math.min(this.course.totalS - 15, r.bikeS + r.bikeVs * dt);
        r.bikeX = Math.max(-(ROAD_HALF_WIDTH + 1.8), Math.min(ROAD_HALF_WIDTH + 1.8, r.bikeX + r.bikeVx * dt));
        r.bikeVs = Math.max(0, r.bikeVs - 16 * dt);
        r.bikeVx *= Math.pow(0.15, dt);
        if (Math.abs(r.bikeS - this.player.s) < 90 && Math.random() < 0.35) {
          const bcs = sampleCourse(this.course, r.bikeS);
          this.world3d.spawnSmoke({
            x: bcs.x + bcs.rx * r.bikeX,
            y: bcs.roadY,
            z: bcs.z + bcs.rz * r.bikeX
          });
        }
      } else if (Math.abs(r.bikeS - this.player.s) < 85 && Math.random() < 0.08) {
        // Rising smoke puffs from downed smoking motorcycle on the road!
        const bcs = sampleCourse(this.course, r.bikeS);
        this.world3d.spawnSmoke({
          x: bcs.x + bcs.rx * r.bikeX,
          y: bcs.roadY + 0.25,
          z: bcs.z + bcs.rz * r.bikeX
        }, 0x9ca3af, 0.42);
      }

      // Cap max separation to 30m just like OG Road Rash!
      if (Math.abs(r.bikeS - r.s) > 30) {
        r.bikeS = r.s + Math.sign(r.bikeS - r.s) * 30;
      }
    }

    if (r.state === 'wrecked' || r.state === 'busted') return;

    // --- TUMBLING STATE ---
    if (r.state === 'tumbling') {
      r.s = Math.min(this.course.totalS - 15, r.s + r.speed * dt);
      r.x = Math.max(-(ROAD_HALF_WIDTH + 2.2), Math.min(ROAD_HALF_WIDTH + 2.2, r.x + r.vx * dt));
      r.speed = Math.max(0, r.speed - 17 * dt);
      r.vx *= Math.pow(0.2, dt);

      if (r.airY > 0 || r.vy > 0) {
        r.airY += r.vy * dt;
        r.vy -= 25 * dt;
        if (r.airY <= 0) {
          r.airY = 0;
          if (Math.abs(r.vy) > 4) r.vy = -r.vy * 0.32; // bounce on asphalt!
          else r.vy = 0;
        }
      }

      r.stateTimer -= dt;
      if (r.stateTimer <= 0 && r.airY <= 0.05) {
        r.airY = 0;
        r.state = 'running';
      }
      return;
    }

    // --- SPRINTING ON FOOT BACK TO DOWNED BIKE (WALK OF SHAME!) ---
    if (r.state === 'running') {
      const ds = r.bikeS - r.s;
      const dx = r.bikeX - r.x;
      const dist = Math.hypot(ds, dx);

      if (dist < 1.55 && r.bikeVs < 2.0) {
        // REMOUNT MOTORCYCLE!
        r.state = 'riding';
        r.s = r.bikeS;
        r.x = r.bikeX;
        r.speed = 8;
        r.vx = 0;
        r.vy = 0;
        r.airY = 0;
        r.stamina = 100; // OG rule: full stamina upon touching bike!
        r.downedBikeSprite.visible = false;
        if (r.isPlayer) {
          this.showCallout('BACK IN THE SADDLE! PUNCH IT!', '#22c55e', 1.4);
        }
        return;
      }

      const runSpeed = 8.4; // m/s brisk sprint
      if (r.isPlayer && controls) {
        // Player can hold Brake to wait for a car to pass, or steer Left/Right while running!
        const pauseRun = controls.brake;
        if (!pauseRun) {
          r.s += Math.sign(ds || 1) * Math.min(Math.abs(ds), runSpeed * dt);
          if (controls.left) r.x -= 6.8 * dt;
          else if (controls.right) r.x += 6.8 * dt;
          else r.x += Math.sign(dx) * Math.min(Math.abs(dx), 5.6 * dt);
        }
      } else {
        r.s += (ds / Math.max(0.1, dist)) * runSpeed * dt;
        r.x += (dx / Math.max(0.1, dist)) * runSpeed * dt;
      }
      r.x = Math.max(-(ROAD_HALF_WIDTH + 2.2), Math.min(ROAD_HALF_WIDTH + 2.2, r.x));

      // Check if a Police Officer busts the crashed player before remounting!
      if (r.isPlayer && !this.finished) {
        for (const cop of this.cops) {
          if (cop.state === 'riding' && Math.abs(cop.s - r.s) < 7.5 && Math.abs(cop.x - r.x) < 4.8) {
            r.state = 'busted';
            this.finished = true;
            this.finishOutcome = 'busted';
            this.finishDelayTimer = 2.5;
            this.showCallout(`BUSTED! FINED $${this.economy.fine}!`, '#3b82f6', 3.2);
            return;
          }
        }
      }
      return;
    }

    // --- RIDING STATE ---
    r.stamina = Math.min(100, r.stamina + 2.2 * dt);
    if (r.nitroTimer > 0) r.nitroTimer -= dt;

    // Advance melee attack timer
    if (r.attackPhase !== 'none') {
      r.attackTimer -= dt;
      if (r.attackTimer <= 0) {
        if (r.attackPhase === 'windup') {
          r.attackPhase = 'active';
          r.attackTimer = r.attackSpec.active;
        } else if (r.attackPhase === 'active') {
          r.attackPhase = 'cooldown';
          r.attackTimer = r.attackSpec.cooldown;
        } else {
          r.attackPhase = 'none';
        }
      }
    }

    const beforeSample = sampleCourse(this.course, r.s);
    const prevWorldY = beforeSample.roadY + r.airY;

    let throttle = 0;
    let brake = 0;
    let steerInput = 0;

    if (r.isPlayer && !this.attractMode) {
      if (!this.finished && controls) {
        throttle = controls.accel ? 1 : 0;
        brake = controls.brake ? 1 : 0;
        steerInput = (controls.left ? -1 : 0) + (controls.right ? 1 : 0);
      } else {
        // Post-finish celebratory coast
        throttle = 0.25;
        steerInput = -r.x * 0.1;
      }
    } else {
      // AI Rider or Police Patrol Brain (also drives attract demo mode on title screen)!
      const aiCmd = this.computeAIBrain(r, dt, beforeSample);
      throttle = aiCmd.throttle;
      brake = aiCmd.brake;
      steerInput = aiCmd.steer;
    }

    // Top speed & Acceleration with Nitro + Off-road penalty + Slope gravity
    const nitroMult = r.nitroTimer > 0 ? 1.24 : 1.0;
    const maxSpeedMs = (r.bike.topSpeedKmh / 3.6) * nitroMult * (r.isPlayer ? 1.0 : 0.88 + r.skill * 0.13);
    const offRoad = Math.abs(r.x) > ROAD_HALF_WIDTH + 0.25;

    if (throttle > 0) {
      const ratio = r.speed / Math.max(1, maxSpeedMs);
      const pull = r.bike.accel * (1 - ratio * 0.82) * (r.nitroTimer > 0 ? 1.55 : 1.0);
      r.speed += (pull / 3.6) * throttle * dt * 2.5;
    } else {
      r.speed = Math.max(0, r.speed - 5.5 * dt); // engine braking
    }

    if (brake > 0) {
      r.speed = Math.max(0, r.speed - 34 * brake * dt);
    }

    // Hill pitch gravity
    r.speed -= Math.sin(beforeSample.pitch) * 11.5 * dt;

    // Off-road dirt/grass drag & instability
    if (offRoad && r.airY <= 0.05) {
      r.speed -= r.speed * 0.62 * dt;
      if (r.isPlayer && r.speed > 22 && Math.random() < 0.35) {
        this.world3d.spawnSmoke(
          { x: beforeSample.x + beforeSample.rx * r.x, y: beforeSample.roadY, z: beforeSample.z + beforeSample.rz * r.x },
          0xa16207,
          0.48
        );
      }
    }

    r.speed = Math.max(0, Math.min(maxSpeedMs * 1.08, r.speed));

    // Nitro exhaust flames!
    if (r.nitroTimer > 0 && Math.abs(r.s - this.player.s) < 80) {
      this.world3d.spawnSparks(
        { x: beforeSample.x + beforeSample.rx * r.x, y: beforeSample.roadY + 0.4, z: beforeSample.z + beforeSample.rz * r.x },
        2,
        0x38bdf8,
        1.5
      );
    }

    // Steering, Lean & Centrifugal Force
    const airSteerFactor = r.airY > 0.15 ? 0.28 : r.hitRecoilTimer > 0 ? 0.25 : 1.0;
    const targetLean = steerInput;
    const leanRate = steerInput !== 0 ? 5.6 : 6.8;
    r.lean += (targetLean - r.lean) * Math.min(1, leanRate * dt);

    const steerAuthority = 14.2 * r.bike.handling * airSteerFactor * Math.min(1, 0.25 + r.speed / 24);
    const centrifugal = -beforeSample.curve * r.speed * r.speed * 0.44;

    r.x += (r.lean * steerAuthority + centrifugal + r.vx) * dt;
    // Tire grip decays external lateral shove vx smoothly so kicks careen across an entire lane!
    r.vx *= Math.pow(r.airY > 0.15 ? 0.62 : 0.17, dt);

    // Advance longitudinal s
    r.s += r.speed * dt;

    // True 3D Crest Launch & Airborne Physics!
    const afterSample = sampleCourse(this.course, r.s);
    if (r.airY <= 0.001 && r.vy <= 0) {
      // Did the road suddenly drop away beneath us over a sharp San Francisco / Sierra hill crest?
      const naturalDrop = prevWorldY - afterSample.roadY;
      const gravityDrop = 0.5 * 26 * dt * dt + 0.14 * dt;
      if (naturalDrop > gravityDrop && r.speed > 34) {
        r.airY = naturalDrop;
        r.vy = (prevWorldY - beforeSample.roadY) / Math.max(0.008, dt) + Math.sin(-beforeSample.pitch) * r.speed * 0.35;
        r.vy = Math.max(2.5, Math.min(11, r.vy));
      } else {
        r.airY = 0;
      }
    } else {
      r.airY += r.vy * dt;
      r.vy -= 25.5 * dt;
      if (r.airY <= 0) {
        const impactVy = Math.abs(r.vy);
        r.airY = 0;
        r.vy = 0;
        if (impactVy > 4.2) {
          const wPos = { x: afterSample.x + afterSample.rx * r.x, y: afterSample.roadY, z: afterSample.z + afterSample.rz * r.x };
          this.world3d.spawnSparks(wPos, 8, 0xfbbf24, 3.5);
          this.world3d.spawnSmoke(wPos, 0xe5e7eb, 0.55);
          if (r.isPlayer) this.sound.playLandingChirp();

          // OG Road Rash tilt-landing check: landing twisted hard at extreme speed wipes you out!
          if (Math.abs(r.lean) > 0.92 && impactVy > 10.5 && r.speed > 45) {
            this.triggerCrash(r, 1.1, 'LANDED SIDEWAYS AT HIGH SPEED!');
            return;
          }
        }
      }
    }

    r.bikeS = r.s;
    r.bikeX = r.x;

    // Guardrail / Cliff / Urban Building Wall Boundary Check!
    const railLimit = ROAD_HALF_WIDTH + 1.15;
    const hardWallLeft = afterSample.guardrailLeft || this.course.track.cliffLeft || this.course.track.urban;
    const hardWallRight = afterSample.guardrailRight || this.course.track.urban || this.course.track.oceanRight;

    if (r.x < -railLimit && hardWallLeft) {
      const lateralHit = Math.abs(r.vx) + Math.max(0, -r.lean * 7);
      r.x = -railLimit + 0.18;
      if (lateralHit > 6.2 && r.speed > 26) {
        const msg = !r.isPlayer && r.lastShovedByPlayer > 0
          ? `KICKED ${r.name.toUpperCase()} INTO THE WALL!`
          : 'SLAMMED THE GUARDRAIL!';
        this.triggerCrash(r, 1.15, msg);
        return;
      } else {
        r.vx = 2.8;
        r.speed *= 0.91;
        this.world3d.spawnSparks(
          { x: afterSample.x - afterSample.rx * railLimit, y: afterSample.roadY + 0.5, z: afterSample.z - afterSample.rz * railLimit },
          6,
          0xfbbf24,
          4
        );
      }
    } else if (r.x > railLimit && hardWallRight) {
      const lateralHit = Math.abs(r.vx) + Math.max(0, r.lean * 7);
      r.x = railLimit - 0.18;
      if (lateralHit > 6.2 && r.speed > 26) {
        const msg = !r.isPlayer && r.lastShovedByPlayer > 0
          ? `KICKED ${r.name.toUpperCase()} OVER THE GUARDRAIL!`
          : 'SLAMMED THE GUARDRAIL!';
        this.triggerCrash(r, 1.15, msg);
        return;
      } else {
        r.vx = -2.8;
        r.speed *= 0.91;
        this.world3d.spawnSparks(
          { x: afterSample.x + afterSample.rx * railLimit, y: afterSample.roadY + 0.5, z: afterSample.z + afterSample.rz * railLimit },
          6,
          0xfbbf24,
          4
        );
      }
    } else {
      r.x = Math.max(-(ROAD_HALF_WIDTH + 5.5), Math.min(ROAD_HALF_WIDTH + 5.5, r.x));
    }

    // 6-Gear RPM Simulation for Tachometer & Engine Synth
    const speedKmh = r.speed * 3.6;
    const gearSpan = Math.max(32, r.bike.topSpeedKmh / 6);
    const gearPos = (speedKmh % gearSpan) / gearSpan;
    const gearNum = Math.min(6, Math.floor(speedKmh / gearSpan) + 1);
    r.rpm = speedKmh < 3 ? 1350 : 3800 + gearPos * 7100 + gearNum * 160;

    // Finish Line Check!
    if (!r.isCop && !r.finished && r.s >= this.course.finishS) {
      r.finished = true;
      r.finishTime = this.raceTime;
      if (r.isPlayer && !this.finished) {
        this.finished = true;
        // Count how many finished ahead of player
        const ahead = this.racers.filter((o) => o !== r && o.finished).length;
        r.position = ahead + 1;
        this.finishOutcome = r.position <= 3 ? 'qualified' : 'finished';
        this.finishDelayTimer = 2.6;
        this.showCallout(
          r.position <= 3 ? `FINISHED #${r.position} — QUALIFIED!` : `FINISHED #${r.position} (TOP 3 TO ADVANCE)`,
          r.position <= 3 ? '#22c55e' : '#facc15',
          3.0
        );
      }
    }
  }

  computeAIBrain(r, dt, sample) {
    // Police officer activation & pursuit logic
    if (r.isCop) {
      const distToPlayer = this.player.s - r.s;
      if (!r.chasing && distToPlayer > -25 && distToPlayer < 95) {
        r.chasing = true;
        if (Math.abs(distToPlayer) < 60) {
          this.showCallout('HIGHWAY PATROL IN HOT PURSUIT!', '#60a5fa', 1.8);
        }
      }
      if (!r.chasing) {
        // Cruise slowly on right shoulder waiting for speeding rashers
        return { throttle: r.speed < 14 ? 0.35 : 0, brake: 0, steer: (7.5 - r.x) * 0.25 };
      }
      // Chasing player or nearby brawling rashers!
      let target = this.player;
      let targetX = target.state === 'riding' ? target.x + (r.x < target.x ? -1.4 : 1.4) : target.x;
      let throttle = 1.0;
      let brake = 0;
      if (target.state !== 'riding' && Math.abs(target.s - r.s) < 16) {
        // Pull right up beside fallen player to bust them!
        throttle = 0.2;
        if (r.speed > 12) brake = 0.8;
      } else if (r.s > target.s + 14) {
        throttle = 0.55;
      }
      const steer = Math.max(-1, Math.min(1, (targetX - r.x) * 0.48));
      r.aiAttackCooldown -= dt;
      if (r.aiAttackCooldown <= 0 && Math.abs(target.s - r.s) < 2.8 && Math.abs(target.x - r.x) < 2.7 && target.state === 'riding') {
        this.startAttack(r, 'punch', target.x < r.x ? -1 : 1);
        r.aiAttackCooldown = 0.9 + Math.random() * 0.6;
      }
      return { throttle, brake, steer };
    }

    // Standard AI Rival Brain:
    // 1) Look ahead for cars to dodge (though imperfect so chaos happens!)
    let desiredX = r.preferredLaneX;
    for (const car of this.cars) {
      const ds = car.s - r.s;
      if (ds > 2 && ds < 42 && Math.abs(car.x - desiredX) < 2.5) {
        desiredX = car.x > 0 ? Math.max(-1.2, car.x - 3.6) : car.x + 3.8;
        break;
      }
    }

    // 2) Mild rubber-banding so the pack stays competitive and action-packed!
    const gapToPlayer = r.s - this.player.s;
    let throttle = 0.96;
    if (gapToPlayer > 170) throttle = 0.80;
    else if (gapToPlayer < -140) throttle = 1.0;

    // 3) Swerve toward adjacent rivals/player to brawl!
    r.aiAttackCooldown -= dt;
    let closestFoe = null;
    let bestD = 999;
    for (const foe of this.racers) {
      if (foe === r || foe.state !== 'riding') continue;
      const ds = Math.abs(foe.s - r.s);
      const dx = Math.abs(foe.x - r.x);
      if (ds < 9 && dx < 5.5 && ds + dx < bestD) {
        bestD = ds + dx;
        closestFoe = foe;
      }
    }

    if (closestFoe && r.aggro > 0.55) {
      const sideOffset = r.x < closestFoe.x ? -1.55 : 1.55;
      desiredX = desiredX * 0.45 + (closestFoe.x + sideOffset) * 0.55;
      if (r.aiAttackCooldown <= 0 && Math.abs(closestFoe.s - r.s) < 2.5 && Math.abs(closestFoe.x - r.x) < 2.75) {
        const useKick = Math.random() < 0.36;
        this.startAttack(r, useKick ? 'kick' : 'punch', closestFoe.x < r.x ? -1 : 1);
        r.aiAttackCooldown = 0.85 + (1 - r.aggro) * 1.1 + Math.random() * 0.6;
      }
    }

    // Compensate for road curvature
    const curveComp = sample.curve * r.speed * r.speed * 0.028;
    const steer = Math.max(-1, Math.min(1, (desiredX - r.x) * 0.36 + curveComp));
    return { throttle, brake: 0, steer };
  }

  resolveInteractions(dt) {
    const allRacers = [...this.racers, ...this.cops];

    // 1. RESOLVE MELEE HITS & TIMED WEAPON SNATCHING!
    for (const attacker of allRacers) {
      if (attacker.state !== 'riding' || attacker.attackPhase !== 'active' || attacker.attackConnected) continue;

      const reach = attacker.attackSpec.reach;
      for (const target of allRacers) {
        if (target === attacker || target.state !== 'riding') continue;
        if (attacker.isCop && target.isCop) continue;

        const ds = Math.abs(target.s - attacker.s);
        const dx = target.x - attacker.x;
        const rightSideMatch = (attacker.attackSide < 0 && dx < 0.4 && dx > -reach) ||
                               (attacker.attackSide > 0 && dx > -0.4 && dx < reach);

        if (ds < 2.5 && rightSideMatch && Math.abs(target.airY - attacker.airY) < 1.5) {
          attacker.attackConnected = true;
          const dir = attacker.attackSide;

          // CHECK TIMED WEAPON SNATCHING! (Unarmed punch hits armed opponent during their overhead windup!)
          if (
            (attacker.attackType === 'punch' || attacker.attackType === 'backhand') &&
            attacker.weapon === 'fist' &&
            target.weapon !== 'fist' &&
            !target.isCop &&
            target.attackPhase === 'windup'
          ) {
            const stolen = target.weapon;
            attacker.weapon = stolen;
            target.weapon = 'fist';
            target.attackPhase = 'none';
            if (attacker.isPlayer) {
              this.sound.playSnatch();
              this.showCallout(
                `WEAPON SNATCHED! STOLE ${WEAPONS[stolen].name.toUpperCase()} FROM ${target.name.toUpperCase()}!`,
                '#22c55e',
                2.5
              );
            }
          }

          // Apply Stamina Damage + Lateral Shove Physics!
          const dmg = attacker.attackSpec.damage * (attacker.isPlayer ? 1.15 : 0.72);
          target.stamina = Math.max(0, target.stamina - dmg);
          target.vx += (dir * attacker.attackSpec.shove) / target.bike.weight;
          target.speed *= attacker.attackType === 'kick' ? 0.96 : 0.94;
          target.hitRecoilTimer = attacker.attackType === 'kick' ? 0.52 : 0.26;
          target.hitRecoilSide = dir;

          if (attacker.isPlayer) {
            target.lastShovedByPlayer = 2.0;
            this.screenShake = Math.max(this.screenShake, attacker.attackType === 'kick' ? 0.24 : 0.16);
          }

          const cs = sampleCourse(this.course, target.s);
          this.world3d.spawnSparks(
            { x: cs.x + cs.rx * ((attacker.x + target.x) * 0.5), y: cs.roadY + 1.3, z: cs.z + cs.rz * ((attacker.x + target.x) * 0.5) },
            10,
            attacker.attackType === 'kick' ? 0xfbbf24 : 0xffffff,
            4.5
          );

          if (attacker.isPlayer || target.isPlayer || Math.abs(target.s - this.player.s) < 35) {
            this.sound.playHit(attacker.attackType === 'weapon' ? attacker.weapon : attacker.attackType);
          }

          if (attacker.isPlayer && attacker.attackType === 'kick' && target.stamina > 0) {
            this.showCallout(`BOOTED ${target.name.toUpperCase()} SIDEWAYS!`, '#fbbf24', 1.1);
          }

          // Stamina Depleted -> Knocked Off Bike!
          if (target.stamina <= 0) {
            const koMsg = attacker.isPlayer
              ? `KNOCKOUT! ${target.name.toUpperCase()} HITS THE ASPHALT!`
              : target.isPlayer
                ? `KNOCKED OFF YOUR BIKE BY ${attacker.name.toUpperCase()}!`
                : '';
            this.triggerCrash(target, 1.0, koMsg);
          }
          break;
        }
      }
    }

    // 2. BIKE-TO-BIKE RUBBING, DOWNED-BIKE RAMP BUMPS, AND BOWLING OVER FALLEN/RUNNING RIDERS!
    for (let i = 0; i < allRacers.length; i++) {
      const a = allRacers[i];
      if (a.state !== 'riding') continue;

      for (let j = 0; j < allRacers.length; j++) {
        if (i === j) continue;
        const b = allRacers[j];

        if (b.state === 'riding') {
          // Bike-to-bike rubbing / side-body collision (only resolve once for i < j)
          if (i < j && Math.abs(a.s - b.s) < 1.9 && Math.abs(a.x - b.x) < 1.25 && Math.abs(a.airY - b.airY) < 1.2) {
            const pushDir = a.x < b.x ? -1 : 1;
            const overlap = 1.25 - Math.abs(a.x - b.x);
            a.x += pushDir * overlap * 0.5;
            b.x -= pushDir * overlap * 0.5;
            const relVx = a.vx - b.vx;
            a.vx += pushDir * 2.8 - relVx * 0.3;
            b.vx -= pushDir * 2.8 - relVx * 0.3;

            if (a.lastShovedByPlayer > 0) b.lastShovedByPlayer = 1.5;
            if (b.lastShovedByPlayer > 0) a.lastShovedByPlayer = 1.5;

            if (Math.abs(a.s - this.player.s) < 40) {
              const cs = sampleCourse(this.course, a.s);
              this.world3d.spawnSparks({ x: cs.x + cs.rx * ((a.x + b.x) * 0.5), y: cs.roadY + 0.7, z: cs.z + cs.rz * ((a.x + b.x) * 0.5) }, 5, 0xfbbf24, 3);
            }
          }
        } else if (b.state === 'tumbling' || b.state === 'running') {
          // (A) CHECK HITTING B'S DOWNED MOTORCYCLE LYING ON THE ROAD -> PHYSICAL BUMP / LAUNCH RAMP!!
          if (
            a.rampCooldown <= 0 &&
            a.airY < 0.95 &&
            Math.abs(a.s - b.bikeS) < 2.35 &&
            Math.abs(a.x - b.bikeX) < 1.58 &&
            a.speed > 9
          ) {
            a.rampCooldown = 0.45;
            // Launch riding motorcycle AIRBORNE off the downed bike!
            const launchVy = Math.max(6.8, Math.min(13.2, 4.5 + a.speed * 0.19));
            a.vy = Math.max(a.vy, launchVy);
            a.airY = Math.max(a.airY, 0.32);
            a.speed *= 0.96;

            // Skid the downed bike slightly with metallic crunch & sparks!
            b.bikeVs = Math.max(b.bikeVs, a.speed * 0.22);
            b.bikeVx += (Math.random() - 0.5) * 3.5;

            const bcs = sampleCourse(this.course, b.bikeS);
            this.world3d.spawnSparks(
              { x: bcs.x + bcs.rx * b.bikeX, y: bcs.roadY + 0.45, z: bcs.z + bcs.rz * b.bikeX },
              18,
              0xf97316,
              8.5
            );

            if (a.isPlayer) {
              this.sound.playRampBump();
              this.screenShake = 0.35;
              this.showCallout(`BUMP LAUNCH! JUMPED ${b.name.toUpperCase()}'S FALLEN BIKE!`, '#38bdf8', 2.1);
            } else if (Math.abs(a.s - this.player.s) < 45) {
              this.sound.playRampBump();
            }
          }

          // (B) CHECK HITTING THE FALLEN / RUNNING RIDER ON FOOT IN THE ROAD!!
          if (
            a.airY < 1.35 &&
            (b.state === 'running' || (b.state === 'tumbling' && b.stateTimer < 0.8)) &&
            Math.abs(a.s - b.s) < 2.15 &&
            Math.abs(a.x - b.x) < 1.35 &&
            a.speed > 7
          ) {
            // Bowl the running rider flat back down into a comical tumble (unharmed cartoon physics)!
            b.state = 'tumbling';
            b.stateTimer = 1.25;
            b.speed = Math.min(20, a.speed * 0.45 + 4);
            b.vx = (b.x >= a.x ? 1 : -1) * 5.8;
            b.airY = 1.35;
            b.vy = 5.6;

            // Riding bike gets a tactile small bump & handlebar wobble without crashing!
            a.vy = Math.max(a.vy, 2.5);
            a.airY = Math.max(a.airY, 0.15);
            a.vx += (Math.random() - 0.5) * 2.6;
            a.speed *= 0.95;

            if (a.isPlayer) {
              this.sound.playPedestrianYelp(false);
              this.screenShake = 0.25;
              this.showCallout(`BOWLED OVER ${b.name.toUpperCase()} ON THE ROAD!`, '#fbbf24', 1.9);
            } else if (b.isPlayer) {
              this.sound.playPedestrianYelp(false);
              this.screenShake = 0.35;
              this.showCallout(`CLIPPED BY ${a.name.toUpperCase()} WHILE RUNNING!`, '#ef4444', 1.9);
            }
          }
        }
      }

      // 3. CHECK PEDESTRIAN HITS (Jaywalkers & Crosswalk Walkers)!
      if (a.airY < 1.45 && a.speed > 5) {
        for (const ped of this.pedestrians) {
          if (ped.state !== 'walking') continue;
          if (Math.abs(a.s - ped.s) < 1.9 && Math.abs(a.x - ped.x) < 1.3) {
            ped.state = 'flying';
            ped.airY = 0.6;
            ped.vy = 8.2 + Math.min(4, a.speed * 0.08);
            ped.vs = a.speed * 0.34;
            ped.vx = (ped.x >= a.x ? 1 : -1) * (7.5 + Math.random() * 2.5);

            // Bike gets handlebar shudder + small suspension thump (no crash!)
            a.vx += (a.x > ped.x ? 1 : -1) * 2.2;
            a.vy = Math.max(a.vy, 1.9);
            a.airY = Math.max(a.airY, 0.12);
            a.speed *= 0.94;

            if (a.isPlayer) {
              this.sound.playPedestrianYelp(true);
              this.screenShake = 0.22;
              this.showCallout('BUMPED JAYWALKING PEDESTRIAN!', '#fde047', 1.5);
            } else if (Math.abs(a.s - this.player.s) < 40) {
              this.sound.playPedestrianYelp(true);
            }
          }
        }
      }

      // 4. CHECK TRAFFIC CAR / TRUCK COLLISIONS!
      if (a.airY < 1.75) {
        for (const car of this.cars) {
          const ds = Math.abs(a.s - car.s);
          const dx = a.x - car.x;
          if (ds < car.halfL + 0.9 && Math.abs(dx) < car.halfW + 0.55) {
            const relSpeed = Math.abs(a.speed - car.speed);
            // Side-scrape vs Direct Front/Rear Slam!
            if (Math.abs(dx) > car.halfW - 0.15 && ds < car.halfL * 0.85 && relSpeed < 34) {
              const push = dx >= 0 ? 1 : -1;
              a.x = car.x + push * (car.halfW + 0.62);
              a.vx = push * 4.8;
              a.speed *= 0.88;
              a.bikeHealth = Math.max(1, a.bikeHealth - 4);
              const cs = sampleCourse(this.course, a.s);
              this.world3d.spawnSparks({ x: cs.x + cs.rx * a.x, y: cs.roadY + 0.7, z: cs.z + cs.rz * a.x }, 8, 0xfbbf24, 4);
              if (a.isPlayer) this.sound.playHit('crowbar');
            } else {
              const msg = !a.isPlayer && a.lastShovedByPlayer > 0
                ? `KICKED ${a.name.toUpperCase()} RIGHT INTO TRAFFIC!!`
                : car.oncoming
                  ? 'HEAD-ON TRAFFIC COLLISION!'
                  : 'REAR-ENDED TRAFFIC!';
              this.triggerCrash(a, Math.min(1.8, 0.8 + relSpeed / 28), msg);
              break;
            }
          }
        }
      }
    }

    // 5. CHECK ROADSIDE PROPS & SHOULDER BOULDER RAMPS FOR PLAYER (AND KICKED RIVALS)!
    for (const r of allRacers) {
      if (r.state !== 'riding' || Math.abs(r.x) < ROAD_HALF_WIDTH - 0.2) continue;
      const segIdx = Math.floor(r.s / 15);
      for (const prop of this.course.props) {
        if (Math.abs(prop.seg - segIdx) > 1) continue;
        const propS = prop.seg * 15;
        if (Math.abs(r.s - propS) < 1.8 && Math.abs(r.x - prop.offset) < prop.radius + 0.65) {
          if (prop.isRamp && r.airY < 0.8 && r.rampCooldown <= 0) {
            r.rampCooldown = 0.45;
            r.vy = Math.max(r.vy, 6.5 + r.speed * 0.15);
            r.airY = 0.28;
            if (r.isPlayer) {
              this.sound.playRampBump();
              this.showCallout('ROADSIDE ROCK LAUNCH!', '#38bdf8', 1.4);
            }
          } else if (prop.solid && r.speed > 18 && r.airY < 2.2) {
            const msg = !r.isPlayer && r.lastShovedByPlayer > 0
              ? `KICKED ${r.name.toUpperCase()} INTO A ROADSIDE POLE!`
              : 'CRASHED INTO ROADSIDE OBSTACLE!';
            this.triggerCrash(r, 1.15, msg);
            break;
          }
        }
      }
    }
  }

  selectRacerTexture(r) {
    const set = r.sprites;
    if (r.state === 'tumbling') {
      const idx = Math.floor(performance.now() / 130) % 2;
      return set.tumble[idx];
    }
    if (r.state === 'running') {
      const idx = Math.floor(performance.now() / 105) % 4;
      return set.run[idx];
    }
    if (r.state === 'wrecked' || r.state === 'busted') {
      return set.tumble[1];
    }

    if (r.hitRecoilTimer > 0) {
      return r.hitRecoilSide < 0 ? set.hit_l : set.hit_r;
    }

    if (r.attackPhase === 'windup' || r.attackPhase === 'active') {
      const left = r.attackSide < 0;
      if (r.attackType === 'kick') {
        return left ? set.kick_l : set.kick_r;
      }
      if (r.attackType === 'weapon') {
        const wGroup = set.weapons[r.weapon] || set.weapons.club;
        if (r.attackPhase === 'windup') return left ? wGroup.windup_l : wGroup.windup_r;
        return left ? wGroup.swing_l : wGroup.swing_r;
      }
      return left ? set.punch_l : set.punch_r;
    }

    if (r.airY > 0.25) return set.wheelie;
    if (r.lean < -0.58) return set.lean_l2;
    if (r.lean < -0.20) return set.lean_l1;
    if (r.lean > 0.58) return set.lean_r2;
    if (r.lean > 0.20) return set.lean_r1;
    return set.idle;
  }

  syncAllSprites(dt) {
    const placeOnCourse = (sprite, s, latX, extraY = 0) => {
      const smp = sampleCourse(this.course, s);
      sprite.position.set(
        smp.x + smp.rx * latX,
        smp.roadY + extraY,
        smp.z + smp.rz * latX
      );
      return smp;
    };

    const allRacers = [...this.racers, ...this.cops];
    for (const r of allRacers) {
      const tex = this.selectRacerTexture(r);
      if (r.riderSprite.material.map !== tex) {
        r.riderSprite.material.map = tex;
        r.riderSprite.material.needsUpdate = true;
      }
      // Hide player sprite only in First-Person Handlebar cam while riding
      r.riderSprite.visible = !(r.isPlayer && this.cameraMode === 2 && r.state === 'riding');
      placeOnCourse(r.riderSprite, r.s, r.x, r.airY);

      if (r.downedBikeSprite.visible) {
        placeOnCourse(r.downedBikeSprite, r.bikeS, r.bikeX, 0.02);
      }
    }

    for (const car of this.cars) {
      placeOnCourse(car.sprite, car.s, car.x, 0);
    }

    for (const ped of this.pedestrians) {
      let pTex;
      if (ped.state === 'walking') {
        const idx = Math.floor(ped.animTime * 7) % 4;
        pTex = ped.v.walk[idx];
      } else {
        const idx = Math.floor(ped.animTime * 10) % 2;
        pTex = ped.v.fly[idx];
      }
      if (ped.sprite.material.map !== pTex) {
        ped.sprite.material.map = pTex;
        ped.sprite.material.needsUpdate = true;
      }
      placeOnCourse(ped.sprite, ped.s, ped.x, ped.airY);
    }

    // Build Chase / First-Person Camera State (exact Screenshot 2 framing!)
    const p = this.player;
    const isFP = this.cameraMode === 2 && p.state === 'riding';
    const camBackDist = isFP ? -0.35 : 5.4;
    const camS = Math.max(0, p.s - camBackDist);
    const camSmp = sampleCourse(this.course, camS);
    const lookDistAhead = 24;
    const lookSmp = sampleCourse(this.course, Math.min(this.course.totalS - 1, p.s + lookDistAhead));

    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake * 0.7 : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake * 0.5 : 0;

    const camLat = p.x * (isFP ? 1.0 : 0.85) + shakeX;
    const baseHeight = isFP ? 1.35 : 1.95;
    const camY = camSmp.roadY + baseHeight + p.airY * 0.65 + shakeY;

    const lookLat = p.x * 0.75;
    // In Cockpit mode (0), pitch -8.2 deg puts horizon at 36%, helmet at 45%, tire at 69%, cleanly above 75.5% dashboard!
    const lookTargetHeight = isFP ? 1.15 : this.cameraMode === 1 ? 0.55 : -2.28;

    const camState = {
      x: camSmp.x + camSmp.rx * camLat,
      y: camY,
      z: camSmp.z + camSmp.rz * camLat,
      lookX: lookSmp.x + lookSmp.rx * lookLat,
      lookY: lookSmp.roadY + baseHeight + lookTargetHeight + p.airY * 0.35,
      lookZ: lookSmp.z + lookSmp.rz * lookLat,
      roll: p.state === 'riding' ? -p.lean * (isFP ? 0.14 : 0.045) : 0
    };

    this.world3d.renderFrame(camState, dt);
  }

  getHUDState() {
    const p = this.player;
    if (!p || !this.course) return null;

    // Nearest adjacent/close rival for Bottom-Right Curved Opponent Stamina Meter!
    let nearestRival = null;
    let bestScore = 36;
    for (const r of [...this.racers, ...this.cops]) {
      if (r === p || r.state !== 'riding') continue;
      const d = Math.abs(r.s - p.s) + Math.abs(r.x - p.x) * 1.4;
      if (d < bestScore) {
        bestScore = d;
        nearestRival = {
          name: r.name,
          stamina: r.stamina,
          weapon: r.weapon
        };
      }
    }

    // Gap to next rider ahead (for red ↑0.225 readout!)
    let gapAhead = 0;
    const aheadRacer = this.racers
      .filter((r) => r !== p && r.s > p.s)
      .sort((a, b) => a.s - b.s)[0];
    if (aheadRacer) {
      gapAhead = (aheadRacer.s - p.s) / Math.max(22, p.speed);
    }

    // Blips in Rearview Mirror (within 70m behind player)
    const behindBlips = [];
    for (const r of [...this.racers, ...this.cops]) {
      if (r === p) continue;
      const dist = p.s - r.s;
      if (dist > 1.5 && dist < 70) {
        behindBlips.push({
          dist,
          x: r.x - p.x,
          isCop: r.isCop,
          color: r.palette.bikeColor
        });
      }
    }
    behindBlips.sort((a, b) => b.dist - a.dist); // draw farthest first

    let countdownText = '';
    if (this.countdown > 0) {
      const sec = Math.ceil(this.countdown);
      countdownText = sec >= 1 ? String(sec) : 'RASH!';
    } else if (this.raceTime < 0.75) {
      countdownText = 'RASH!';
    }

    return {
      cameraMode: this.cameraMode,
      mirrorOn: this.mirrorOn,
      speedKmh: p.state === 'riding' ? p.speed * 3.6 : 0,
      rpm: p.rpm,
      position: p.position || 15,
      remainingKm: Math.max(0, (this.course.finishS - p.s) / 1000),
      bikeHealth: p.bikeHealth,
      bikeMaxHealth: p.bikeMaxHealth,
      playerStamina: p.stamina,
      playerName: p.name,
      playerWeapon: p.weapon,
      playerState: p.state,
      nearestRival,
      gapAhead,
      nitroCharges: p.nitroCharges,
      maxNitro: p.maxNitro,
      nitroActive: p.nitroTimer > 0,
      copWarning: this.copWarning || 0,
      behindBlips,
      countdownText,
      callout: this.callout,
      calloutColor: this.calloutColor,
      calloutTimer: this.calloutTimer
    };
  }
}
