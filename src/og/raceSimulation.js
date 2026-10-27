// Authentic 1996 Road Rash 60Hz Physics, Combat, Pedestrian, Police & Ramp Engine
import { SAMPLE_LEN } from './courseRenderer.js';

const RIVAL_ROSTER = [
  { name: 'Natasha', remap: 1, weapon: 2, female: true, statsIdx: 2 },
  { name: 'Slater', remap: 2, weapon: 1, female: false, statsIdx: 8 },
  { name: 'P.E.No.1', remap: 3, weapon: 2, female: false, statsIdx: 12 },
  { name: 'Bose', remap: 4, weapon: 1, female: false, statsIdx: 1 },
  { name: 'Rhonda', remap: 5, weapon: 0, female: true, statsIdx: 5 },
  { name: 'Ikira', remap: 6, weapon: 1, female: false, statsIdx: 10 },
  { name: 'Mike', remap: 7, weapon: 2, female: false, statsIdx: 7 },
  { name: 'Cydney', remap: 8, weapon: 0, female: true, statsIdx: 2 },
  { name: 'Jon', remap: 9, weapon: 1, female: false, statsIdx: 3 },
  { name: 'Pearl', remap: 10, weapon: 0, female: true, statsIdx: 4 },
  { name: 'Sven', remap: 11, weapon: 1, female: false, statsIdx: 14 },
  { name: 'Chino', remap: 12, weapon: 2, female: false, statsIdx: 9 },
  { name: 'Slim Jim', remap: 13, weapon: 0, female: false, statsIdx: 6 },
  { name: 'Spike', remap: 14, weapon: 1, female: false, statsIdx: 11 }
];

const COP_NAMES = ['Ortega', 'Marshall', "O'Leary", "O'Shea", 'Flynn', 'Kelly', 'Krupke'];

// Conversion: 330 samples = 1.0 mile -> 1 MPH at 60Hz = 330 / 3600 / 60 = 0.0015278 samples/tick
const MPH_TO_SAMPLES_PER_TICK = 330 / 216000;
const SAMPLES_PER_TICK_TO_MPH = 1 / MPH_TO_SAMPLES_PER_TICK;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class RaceSimulation {
  constructor(assets, audio, courseRenderer, config, onRaceEnd) {
    this.assets = assets;
    this.audio = audio;
    this.courseRenderer = courseRenderer;
    this.config = config;
    this.onRaceEnd = onRaceEnd;

    this.course = courseRenderer.course;
    this.startSample = this.course.startSample || 50;
    this.finishSample =
      this.course.finishSamples?.[config.level] || this.course.samples.length - 50;

    this.ticks = 0;
    this.countdownTicks = 150; // 2.5s 3..2..1 countdown
    this.goBannerTicks = 0;
    this.paused = false;
    this.pauseFocus = 0;
    this.ended = false;
    this.endDelayTicks = 0;
    this.endStatus = null;

    this.bannerText = '';
    this.bannerColor = '#ffff40';
    this.bannerTicks = 0;

    this.riders = [];
    this.player = null;
    this.downedBikes = [];
    this.traffic = [];
    this.pedestrians = [];
    this.cop = null;
    this.effects = [];

    this.playerPlace = 15;
    this.nearestRival = null;

    this.cameraSample = this.startSample - 1.48;
    this.cameraLat = 0;
    this.cameraHeight = 150;

    this.initRace();
  }

  bikeStatsFor(bikeId, level) {
    const raw = this.assets.frontend?.bikes?.[bikeId];
    const hpLike = raw ? raw[42] : 38 + level * 2;
    const mass = raw ? raw[6] : 200;
    const cond = raw ? raw[81] : 160;
    const nitroCharges = raw ? raw[86] : 0;

    // Top speed scales authentically from ~104 MPH (125cc Perro Pico) to ~196 MPH (1000cc Diablo Vipera N)
    const topMph = 88 + (hpLike - 34) * 7.2;
    const accel = (0.42 + (hpLike - 34) * 0.032) * (220 / Math.max(130, mass + 40));
    const grip = clamp(1.12 - (mass - 160) * 0.0011, 0.78, 1.18);

    return {
      topMph,
      accel,
      grip,
      maxCond: Math.max(120, cond * 1.4),
      nitroCharges: nitroCharges > 0 ? nitroCharges : this.config.mode === 'thrash' && level >= 2 ? 3 : 0
    };
  }

  initRace() {
    const level = this.config.level || 0;
    const pBike = this.bikeStatsFor(this.config.bikeId, level);

    // 1. Create Player (index 0) + 14 Rivals on 2-column staggered starting grid
    this.riders = [];
    const totalRiders = 15;
    for (let i = 0; i < totalRiders; i++) {
      const isPlayer = i === 0;
      const rv = isPlayer ? null : RIVAL_ROSTER[(i - 1) % RIVAL_ROSTER.length];
      const gridRow = isPlayer ? 7 : i <= 7 ? i - 1 : i;
      const col = gridRow % 2 === 0 ? -135 : 135;
      const sPos = this.startSample + (14 - gridRow) * 0.42;

      const rStat =
        this.assets.frontend?.riderStats?.[isPlayer ? this.config.charIdx || 0 : rv.statsIdx] || {
          stamina: 2600,
          strength: 7,
          speeds: [95, 112, 128, 148, 175]
        };

      const maxStamina = isPlayer ? 120 : 88 + level * 14;
      const aiBaseMph = (rStat.speeds?.[level] || 96 + level * 18) * (0.95 + (i % 5) * 0.025);

      const rider = {
        id: i,
        isPlayer,
        name: isPlayer ? this.config.playerName : rv.name,
        female: isPlayer ? Boolean(this.config.female) : rv.female,
        remap: isPlayer ? 0 : rv.remap,
        sample: sPos,
        lat: col,
        latVel: 0,
        airY: 0,
        airVel: 0,
        speedMph: 0,
        lean: 0,
        wobble: 0,

        topMph: isPlayer ? pBike.topMph : aiBaseMph,
        accel: isPlayer ? pBike.accel : 0.46 + level * 0.06,
        grip: isPlayer ? pBike.grip : 0.96,
        gear: 1,
        rpmNorm: 0.18,

        stamina: maxStamina,
        maxStamina,
        bikeCond: isPlayer ? pBike.maxCond : 220,
        maxBikeCond: isPlayer ? pBike.maxCond : 220,

        weapon: isPlayer ? 0 : level === 0 && i % 3 !== 0 ? 0 : rv.weapon, // 0=fists, 1=club, 2=chain
        nitroCharges: isPlayer ? pBike.nitroCharges : 0,
        nitroTicks: 0,

        // State machine: 'riding' | 'crashing' | 'getting_up' | 'running' | 'remounting' | 'finished' | 'wrecked' | 'busted'
        state: 'riding',
        stateTicks: 0,
        downedBike: null,
        runHeading: 0,

        // Combat state
        attackCode: 0, // 0 = none, 10..27 = active swing
        attackTicks: 0,
        attackDuration: 0,
        attackSide: 0, // -1 left, +1 right
        attackType: 'punch', // 'punch' | 'club' | 'chain' | 'kick'
        attackLanded: false,
        staggerCode: 0,
        staggerTicks: 0,
        hitFlashTicks: 0,
        aiSwingCooldown: 40 + (i * 13) % 70,
        aiTargetLane: col + ((i * 53) % 180) - 90,

        finished: false,
        finishTicks: 0
      };
      this.riders.push(rider);
    }
    this.player = this.riders[0];

    // 2. Spawn course traffic cars (both oncoming in left lane & cruising in right lane)
    this.traffic = [];
    const courseCars = this.assets.carsMeta?.courses?.[this.config.courseKey] || [];
    const carTypeCount = Math.max(1, courseCars.length);
    let sCursor = this.startSample + 36;
    let carIdx = 0;
    while (sCursor < this.finishSample + 60) {
      const oncoming = carIdx % 2 === 0;
      const pose = this.courseRenderer.samplePose(sCursor);
      const laneLat = oncoming ? -pose.left * 0.48 : pose.right * 0.48;
      const baseSpeed = 38 + (carIdx % 4) * 8 + level * 4;
      this.traffic.push({
        id: carIdx,
        typeIdx: carIdx % carTypeCount,
        sample: sCursor,
        lat: laneLat,
        latVel: 0,
        oncoming,
        speedMph: oncoming ? -baseSpeed : baseSpeed,
        hitCooldown: 0
      });
      // Denser traffic in higher levels & The City / Peninsula
      const spacing =
        (this.config.courseKey === 'CITY' || this.config.courseKey === 'MEDLY' ? 42 : 56) -
        level * 4 +
        ((carIdx * 17) % 24);
      sCursor += Math.max(26, spacing);
      carIdx++;
    }

    // 3. Spawn animated pedestrians from real .CRS pedSpawns + regular crosswalk jaywalkers
    this.pedestrians = [];
    const pedLooks = this.assets.worldMeta?.pedestrians || [];
    const lookCount = Math.max(1, pedLooks.length);
    const rawSpawns = this.course.pedSpawns || [];

    const usedSamples = new Set();
    for (let i = 0; i < rawSpawns.length; i++) {
      const [rIdx, rawLat, lookId] = rawSpawns[i];
      if (rIdx < this.startSample + 18 || rIdx > this.finishSample + 30) continue;
      usedSamples.add(Math.floor(rIdx / 12));
      const pose = this.courseRenderer.samplePose(rIdx);
      const crossing = i % 2 === 0;
      const side = rawLat < 0 ? -1 : 1;
      const startLat = crossing
        ? side * (pose.right * 0.88)
        : side * (pose.right + pose.shR * 0.42);
      this.pedestrians.push({
        id: this.pedestrians.length,
        sample: rIdx,
        lat: startLat,
        dir: crossing ? -side : 0, // crossing across lanes or strolling along sidewalk
        walkAlong: crossing ? 0 : (i % 4 < 2 ? 1 : -1),
        lookId: clamp(lookId, 0, lookCount - 1),
        active: true,
        state: 'walking', // 'walking' | 'hit'
        animTick: (i * 11) % 60,
        airY: 0,
        airVel: 0,
        latVel: 0,
        sampleVel: 0,
        spinAngle: 0
      });
    }

    // Ensure lively jaywalking pedestrians every ~65 samples so every track has fun pedestrian dodges/clips
    for (let s = this.startSample + 28; s < this.finishSample; s += 62) {
      if (usedSamples.has(Math.floor(s / 12))) continue;
      const pose = this.courseRenderer.samplePose(s);
      const side = (s % 4 < 2) ? -1 : 1;
      this.pedestrians.push({
        id: this.pedestrians.length,
        sample: s,
        lat: side * (pose.right * 0.72),
        dir: -side,
        walkAlong: 0,
        lookId: s % lookCount,
        active: true,
        state: 'walking',
        animTick: s % 42,
        airY: 0,
        airVel: 0,
        latVel: 0,
        sampleVel: 0,
        spinAngle: 0
      });
    }

    // 4. Spawn Motorcycle Police Officer (LOCOP.DAT) patrolling ahead
    this.cop = {
      name: COP_NAMES[(this.config.courseId + level) % COP_NAMES.length],
      active: true,
      chasing: false,
      sample: this.startSample + 145,
      lat: 210,
      latVel: 0,
      airY: 0,
      airVel: 0,
      speedMph: 58,
      lean: 0,
      stamina: 110 + level * 20,
      maxStamina: 110 + level * 20,
      state: 'riding', // 'riding' | 'crashing'
      stateTicks: 0,
      attackCode: 0,
      attackTicks: 0,
      swingCooldown: 50,
      respawnCooldown: 0
    };
  }

  showBanner(text, color = '#ffff40', ticks = 85) {
    this.bannerText = text;
    this.bannerColor = color;
    this.bannerTicks = ticks;
  }

  spawnSparks(sample, lat, extraY = 45, count = 8, color = '#ffe066') {
    const pose = this.courseRenderer.samplePose(sample, lat, extraY);
    for (let i = 0; i < count; i++) {
      this.effects.push({
        kind: 'spark',
        wx: pose.x + (Math.random() - 0.5) * 40,
        wy: pose.y + (Math.random() - 0.5) * 30,
        wz: pose.z + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 14,
        vy: 4 + Math.random() * 12,
        vz: (Math.random() - 0.5) * 14,
        color,
        ticks: 14 + Math.floor(Math.random() * 10)
      });
    }
  }

  spawnCallout(sample, lat, text, color = '#ffff40') {
    const pose = this.courseRenderer.samplePose(sample, lat, 165);
    this.effects.push({
      kind: 'callout',
      wx: pose.x,
      wy: pose.y,
      wz: pose.z,
      vx: 0,
      vy: 2.2,
      vz: 0,
      text,
      color,
      ticks: 48
    });
  }

  // ==================== PLAYER COMBAT TRIGGERS ====================

  triggerAttack(kind, inputState) {
    const p = this.player;
    if (this.paused || this.countdownTicks > 0 || p.state !== 'riding' || p.attackTicks > 0) return;

    // Pick side: explicit punchL / punchR, or toward nearest adjacent rival/cop for Kick!
    let side = 1;
    if (kind === 'left') {
      side = -1;
    } else if (kind === 'right') {
      side = 1;
    } else if (kind === 'kick') {
      if (inputState.left && !inputState.right) side = -1;
      else if (inputState.right && !inputState.left) side = 1;
      else {
        const near = this.findClosestCombatTarget(p, 2.4, 280);
        side = near && near.lat < p.lat ? -1 : 1;
      }
    }

    p.attackSide = side;
    p.attackLanded = false;

    if (kind === 'kick') {
      p.attackType = 'kick';
      p.attackCode = side < 0 ? 26 : 27;
      p.attackDuration = 22;
      p.attackTicks = 22;
      this.audio.playSfx('swishgen', { volume: 0.7, rate: 0.92 });
      return;
    }

    if (p.weapon === 2) {
      p.attackType = 'chain';
      p.attackCode = side < 0 ? 10 : 11;
      p.attackDuration = 26;
      p.attackTicks = 26;
      this.audio.playSfx('swishcha', { volume: 0.85, rate: 1.0 });
    } else if (p.weapon === 1) {
      p.attackType = 'club';
      p.attackCode = side < 0 ? 16 : 17;
      p.attackDuration = 24;
      p.attackTicks = 24;
      this.audio.playSfx('swishgen', { volume: 0.8, rate: 1.0 });
    } else {
      p.attackType = 'punch';
      p.attackCode = side < 0 ? 22 : 23;
      p.attackDuration = 18;
      p.attackTicks = 18;
      this.audio.playSfx('swishgen', { volume: 0.68, rate: 1.18 });
    }
  }

  triggerNitro() {
    const p = this.player;
    if (this.paused || this.countdownTicks > 0 || p.state !== 'riding') return;
    if (p.nitroCharges > 0 && p.nitroTicks <= 0) {
      p.nitroCharges--;
      p.nitroTicks = 95; // ~1.6s roaring superbike boost
      this.audio.playSfx('engnitro', { volume: 0.75, rate: 1.1 });
      this.showBanner('NITRO BOOST!', '#66e6ff', 50);
    }
  }

  // ==================== 60HZ SIMULATION STEP ====================

  step(input) {
    if (this.paused || this.ended) return;
    this.ticks++;

    if (this.bannerTicks > 0) this.bannerTicks--;
    if (this.goBannerTicks > 0) this.goBannerTicks--;

    // Countdown before green flag
    if (this.countdownTicks > 0) {
      if (this.countdownTicks % 60 === 0) {
        this.audio.playSfx('punchlig', { volume: 0.65, rate: 1.4 });
      }
      this.countdownTicks--;
      if (this.countdownTicks === 0) {
        this.goBannerTicks = 70;
        this.audio.playSfx('m_yeah', { volume: 0.85 });
      }
      this.player.rpmNorm = input.gas ? 0.55 + Math.sin(this.ticks * 0.35) * 0.12 : 0.22;
      this.updateCamera();
      this.updateAudioLoops(false, false);
      return;
    }

    // Check delayed race end transition
    if (this.endDelayTicks > 0) {
      this.endDelayTicks--;
      if (this.endDelayTicks === 0) {
        this.finishAndExit(this.endStatus);
        return;
      }
    }

    // 1. Step all 15 riders
    let playerSkidding = false;
    let playerOffRoad = false;
    for (let i = 0; i < this.riders.length; i++) {
      const r = this.riders[i];
      if (r.isPlayer) {
        const res = this.stepPlayerRider(r, input);
        playerSkidding = res.skidding;
        playerOffRoad = res.offRoad;
      } else {
        this.stepAiRider(r);
      }
    }

    // 2. Step downed motorcycles sliding on the road & ramp physics!
    this.stepDownedBikes();

    // 3. Step rider-vs-rider combat swings, boot-kick lateral shoves & body-to-bike collisions
    this.stepRiderInteractions();

    // 4. Step traffic cars & car collisions (including kicked rivals slamming into oncoming cars!)
    this.stepTraffic();

    // 5. Step walking pedestrians & comical hit/tumble physics
    this.stepPedestrians();

    // 6. Step motorcycle cop pursuit, nightstick combat & bust logic
    this.stepCop();

    // 7. Step visual sparks / callouts
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.wx += fx.vx;
      fx.wy += fx.vy;
      fx.wz += fx.vz;
      if (fx.kind === 'spark') fx.vy -= 0.9;
      fx.ticks--;
      if (fx.ticks <= 0) this.effects.splice(i, 1);
    }

    // 8. Compute live standings (1..15) and nearest rival for HUD
    this.updateStandingsAndNearest();

    // 9. Update smooth 1996 follow camera & Doppler audio loops
    this.updateCamera();
    const camPose = this.courseRenderer.samplePose(this.player.sample);
    this.updateAudioLoops(playerSkidding, playerOffRoad, camPose.tunnel);
  }

  stepPlayerRider(p, input) {
    if (p.hitFlashTicks > 0) p.hitFlashTicks--;
    if (p.staggerTicks > 0) p.staggerTicks--;
    if (p.stamina < p.maxStamina && this.ticks % 8 === 0 && p.state === 'riding') {
      p.stamina = Math.min(p.maxStamina, p.stamina + 0.45);
    }

    if (p.state !== 'riding') {
      this.stepCrashedRider(p);
      return { skidding: false, offRoad: false };
    }

    const pose = this.courseRenderer.samplePose(p.sample, p.lat);
    const offLeft = p.lat < -pose.left;
    const offRight = p.lat > pose.right;
    const offRoad = offLeft || offRight;

    // Steering & lean
    const steerInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (steerInput !== 0) {
      p.lean = clamp(p.lean + steerInput * 0.085 * p.grip, -1.0, 1.0);
    } else {
      p.lean *= 0.84;
      if (Math.abs(p.lean) < 0.02) p.lean = 0;
    }

    // Nitro boost
    if (p.nitroTicks > 0) p.nitroTicks--;
    const effectiveTop = p.topMph * (p.nitroTicks > 0 ? 1.24 : 1.0) * (offRoad ? 0.68 : 1.0);

    // Throttle, braking, hill slope & aerodynamic drag
    let skidding = false;
    if (input.gas && p.endDelay === undefined) {
      const ratio = p.speedMph / Math.max(40, effectiveTop);
      const torque = p.accel * (1.18 - ratio * 0.72) * (p.nitroTicks > 0 ? 1.65 : 1.0);
      p.speedMph += Math.max(0.05, torque);
    } else if (input.brake) {
      p.speedMph -= 1.35;
      if (p.speedMph > 35) skidding = true;
    } else {
      p.speedMph -= 0.24;
    }

    // Hill gravity (uphill slows slightly, downhill accelerates!)
    p.speedMph -= pose.rise * 0.0022;
    if (offRoad && p.speedMph > effectiveTop) {
      p.speedMph -= 0.85;
    }
    p.speedMph = clamp(p.speedMph, 0, effectiveTop + 18);

    // Automatic 6-speed gearbox & tachometer needle feel
    const gearSpan = Math.max(18, p.topMph / 6);
    p.gear = clamp(1 + Math.floor(p.speedMph / gearSpan), 1, 6);
    const gearLo = (p.gear - 1) * gearSpan;
    p.rpmNorm = clamp(0.24 + ((p.speedMph - gearLo) / gearSpan) * 0.74, 0.16, 1.02);

    // Advance longitudinal sample & lateral position (including curve centrifugal pull + kick shove!)
    const ds = p.speedMph * MPH_TO_SAMPLES_PER_TICK;
    const prevRise = pose.rise;
    p.sample += ds;

    const speedFactor = clamp(p.speedMph / 75, 0.22, 1.35);
    const steerLat = p.lean * 12.2 * speedFactor * (offRoad ? 0.72 : 1.0);
    const centrifugal = -pose.bend * ds * 18.5 * speedFactor;

    p.lat += steerLat + centrifugal + p.latVel + p.wobble;
    p.latVel *= 0.86;
    p.wobble *= -0.76;
    if (Math.abs(p.latVel) < 0.15) p.latVel = 0;
    if (Math.abs(p.wobble) < 0.15) p.wobble = 0;

    if (Math.abs(p.lean) > 0.85 && p.speedMph > 65) skidding = true;

    // Crest jump physics on steep hilltops (like San Francisco Lombard/Nob Hill!)
    const nextPose = this.courseRenderer.samplePose(p.sample, p.lat);
    if (p.airY <= 0 && prevRise > 28 && nextPose.rise < prevRise - 16 && p.speedMph > 68) {
      p.airVel = Math.min(20, (prevRise - nextPose.rise) * 0.28 * (p.speedMph / 95));
    }
    this.integrateAir(p);

    // Building / cliff wall & roadside solid object collisions
    this.checkWallAndSceneryCollision(p, nextPose);

    // Advance active melee attack timer
    if (p.attackTicks > 0) {
      p.attackTicks--;
      if (p.attackTicks === 0) p.attackCode = 0;
    }

    // Crossing finish line!
    if (!p.finished && p.sample >= this.finishSample) {
      p.finished = true;
      p.finishTicks = this.ticks;
      this.audio.playSfx(p.female ? 'f_yeah' : 'm_yeah', { volume: 0.95 });
      this.showBanner('FINISH LINE!', '#ffff40', 90);
      this.endStatus = 'finished';
      this.endDelayTicks = 75;
    }

    return { skidding, offRoad };
  }

  stepAiRider(r) {
    if (r.hitFlashTicks > 0) r.hitFlashTicks--;
    if (r.staggerTicks > 0) r.staggerTicks--;
    if (r.stamina < r.maxStamina && this.ticks % 12 === 0 && r.state === 'riding') {
      r.stamina = Math.min(r.maxStamina, r.stamina + 0.35);
    }

    if (r.state !== 'riding') {
      this.stepCrashedRider(r);
      return;
    }

    const pose = this.courseRenderer.samplePose(r.sample, r.lat);

    // Gentle OG rubber-banding so rivals stay competitive & brawling around the player
    const gapToPlayer = r.sample - this.player.sample;
    let rubber = 1.0;
    if (gapToPlayer > 32) rubber = 0.88;
    else if (gapToPlayer < -28) rubber = 1.13;
    else if (Math.abs(gapToPlayer) < 8) rubber = 1.01;

    const targetSpeed = r.topMph * rubber;
    if (r.speedMph < targetSpeed) {
      r.speedMph = Math.min(targetSpeed, r.speedMph + r.accel * 0.95);
    } else {
      r.speedMph = Math.max(targetSpeed, r.speedMph - 0.35);
    }

    // AI lane choice: weave around oncoming traffic & swerve toward player to brawl!
    if ((this.ticks + r.id * 11) % 35 === 0) {
      if (Math.abs(gapToPlayer) < 4.5 && Math.abs(this.player.lat - r.lat) < 340) {
        const offset = this.player.lat > r.lat ? -95 : 95;
        r.aiTargetLane = clamp(this.player.lat + offset, -pose.left * 0.8, pose.right * 0.8);
      } else {
        // Favor right half of road to dodge oncoming left-lane cars
        r.aiTargetLane = clamp(
          pose.right * 0.15 + Math.sin(this.ticks * 0.02 + r.id * 1.7) * (pose.right * 0.55),
          -pose.left * 0.72,
          pose.right * 0.82
        );
      }
    }

    // Dodge imminent oncoming car
    for (const car of this.traffic) {
      const dsCar = car.sample - r.sample;
      if (dsCar > 0 && dsCar < 10 && Math.abs(car.lat - r.lat) < 135) {
        r.aiTargetLane = car.lat < 0 ? Math.min(pose.right * 0.75, car.lat + 220) : Math.max(-pose.left * 0.75, car.lat - 220);
        break;
      }
    }

    const latErr = r.aiTargetLane - r.lat;
    // While staggered from a punch/weapon/boot-kick, rival loses steering control and careens across lanes!
    r.lean = r.staggerTicks > 0 ? clamp(r.latVel * 0.025, -0.85, 0.85) : clamp(latErr * 0.0045, -0.78, 0.78);

    const ds = r.speedMph * MPH_TO_SAMPLES_PER_TICK;
    r.sample += ds;
    r.lat += (r.staggerTicks > 0 ? 0 : r.lean * 8.5) + r.latVel + r.wobble;
    r.latVel *= r.staggerTicks > 0 ? 0.91 : 0.87;
    r.wobble *= -0.76;
    if (Math.abs(r.latVel) < 0.15) r.latVel = 0;

    this.integrateAir(r);
    this.checkWallAndSceneryCollision(r, pose);

    // AI melee attack when alongside player
    if (r.attackTicks > 0) {
      r.attackTicks--;
      if (r.attackTicks === 0) r.attackCode = 0;
    } else if (r.aiSwingCooldown > 0) {
      r.aiSwingCooldown--;
    } else if (
      this.player.state === 'riding' &&
      Math.abs(r.sample - this.player.sample) < 1.25 &&
      Math.abs(r.lat - this.player.lat) < 175
    ) {
      const side = this.player.lat < r.lat ? -1 : 1;
      r.attackSide = side;
      r.attackLanded = false;
      if (r.weapon === 2) {
        r.attackType = 'chain';
        r.attackCode = side < 0 ? 10 : 11;
        r.attackDuration = 30;
        r.attackTicks = 30;
      } else if (r.weapon === 1) {
        r.attackType = 'club';
        r.attackCode = side < 0 ? 16 : 17;
        r.attackDuration = 28;
        r.attackTicks = 28;
      } else if ((this.ticks + r.id) % 4 === 0) {
        r.attackType = 'kick';
        r.attackCode = side < 0 ? 26 : 27;
        r.attackDuration = 24;
        r.attackTicks = 24;
      } else {
        r.attackType = 'punch';
        r.attackCode = side < 0 ? 22 : 23;
        r.attackDuration = 22;
        r.attackTicks = 22;
      }
      r.aiSwingCooldown = 52 + (r.id * 9) % 40;
    }

    if (!r.finished && r.sample >= this.finishSample) {
      r.finished = true;
      r.finishTicks = this.ticks;
    }
  }

  integrateAir(actor) {
    if (actor.airY > 0 || actor.airVel > 0) {
      actor.airY += actor.airVel;
      actor.airVel -= 1.05; // gravity
      if (actor.airY <= 0) {
        actor.airY = 0;
        const impactVel = -actor.airVel;
        actor.airVel = 0;
        if (impactVel > 9 && actor.state === 'riding') {
          if (actor.isPlayer) {
            this.audio.playSfx('crashlit', { volume: 0.55, rate: 1.15 });
            this.spawnSparks(actor.sample, actor.lat, 8, 6);
            // Crash if landing severely tilted from a big jump!
            if (Math.abs(actor.lean) >= 0.78 && impactVel > 13) {
              this.triggerCrash(actor, 0.7, 'WIPEOUT ON LANDING!');
            }
          }
        }
      }
    }
  }

  checkWallAndSceneryCollision(r, pose) {
    // 1. Building / Cliff outer wall crash or scrape
    const leftWallX = -pose.left - pose.shL;
    const rightWallX = pose.right + pose.shR;

    if (pose.hasLeftWall && r.lat < leftWallX + 38) {
      if (r.speedMph > 48 || Math.abs(r.latVel) > 9) {
        this.triggerCrash(r, 0.9, r.isPlayer ? 'SLAMMED BUILDING!' : `${r.name.toUpperCase()} HIT WALL!`);
        return;
      }
      r.lat = leftWallX + 40;
      r.latVel = Math.abs(r.latVel) * 0.4 + 3;
      r.speedMph *= 0.82;
    } else if (pose.hasRightWall && r.lat > rightWallX - 38) {
      if (r.speedMph > 48 || Math.abs(r.latVel) > 9) {
        this.triggerCrash(r, 0.9, r.isPlayer ? 'SLAMMED BUILDING!' : `${r.name.toUpperCase()} HIT WALL!`);
        return;
      }
      r.lat = rightWallX - 40;
      r.latVel = -Math.abs(r.latVel) * 0.4 - 3;
      r.speedMph *= 0.82;
    } else {
      // Clamp extreme off-road excursion
      r.lat = clamp(r.lat, leftWallX - 450, rightWallX + 450);
    }

    // 2. Solid roadside trees / signposts / poles
    const sIdx = Math.floor(r.sample);
    const objs = this.courseRenderer.objectsBySample[sIdx];
    if (objs && r.airY < 60) {
      for (let i = 0; i < objs.length; i++) {
        const [, oLat, , , , solid] = objs[i];
        if (!solid) continue;
        if (Math.abs(r.lat - oLat) < 68 && r.speedMph > 36) {
          this.triggerCrash(r, 0.85, r.isPlayer ? 'ROADSIDE CRASH!' : `${r.name.toUpperCase()} WRECKED!`);
          return;
        }
      }
    }
  }

  // ==================== CRASH, DOWNED BIKE RAMPS & SPRINTING ON FOOT ====================

  triggerCrash(r, severity = 0.8, calloutText = '') {
    if (r.state !== 'riding') return;

    const pan = clamp((r.lat - this.player.lat) / 500, -1, 1);
    const distSamples = Math.abs(r.sample - this.player.sample);
    if (distSamples < 28) {
      const sfx = severity > 0.85 ? 'crashhar' : severity > 0.55 ? 'crashmed' : 'crashlit';
      this.audio.playSfx(sfx, { volume: r.isPlayer ? 0.95 : 0.72, pan });
      this.audio.playSfx('ridersli', { volume: r.isPlayer ? 0.65 : 0.4, pan });
      this.audio.playSfx(r.female ? 'gruntf2_' : 'gruntm2_', { volume: 0.8, pan });
    }

    this.spawnSparks(r.sample, r.lat, 30, 12, '#ffae42');
    if (calloutText && distSamples < 24) {
      this.spawnCallout(r.sample, r.lat, calloutText, r.isPlayer ? '#ff6432' : '#ffff40');
    }

    // Bike condition damage
    const dmg = (14 + r.speedMph * 0.16) * severity;
    r.bikeCond = Math.max(0, r.bikeCond - dmg);

    // Spawn separate physical downed motorcycle sliding down the road!
    const bikeSlideDist = clamp(2.2 + (r.speedMph / 45) * 2.6, 2.0, 8.5);
    const db = {
      ownerId: r.id,
      remap: r.remap,
      active: true,
      sliding: true,
      sample: r.sample + 0.6,
      targetSample: Math.min(this.finishSample + 20, r.sample + bikeSlideDist),
      lat: clamp(r.lat + (Math.random() - 0.5) * 160, -420, 420),
      mirror: Math.random() < 0.5,
      rampCooldown: 0
    };
    this.downedBikes.push(db);
    r.downedBike = db;

    // Launch rider body tumbling separately
    r.state = 'crashing';
    r.stateTicks = 52;
    r.airY = 18;
    r.airVel = 9 + Math.min(11, r.speedMph * 0.08);
    r.crashSampleVel = Math.min(0.32, r.speedMph * MPH_TO_SAMPLES_PER_TICK * 0.72);
    r.latVel = clamp(r.latVel * 0.6 + (Math.random() - 0.5) * 8, -14, 14);
    r.speedMph = 0;
    r.attackCode = 0;
    r.attackTicks = 0;

    // Check total bike wreck for player
    if (r.isPlayer && r.bikeCond <= 0) {
      r.state = 'wrecked';
      this.showBanner('WRECKED!', '#ff3b2f', 110);
      this.endStatus = 'wrecked';
      this.endDelayTicks = 95;
    }
  }

  stepCrashedRider(r) {
    if (r.state === 'wrecked' || r.state === 'busted') {
      this.integrateAir(r);
      return;
    }

    if (r.state === 'crashing') {
      r.sample += r.crashSampleVel || 0;
      r.crashSampleVel = (r.crashSampleVel || 0) * 0.94;
      r.lat += r.latVel;
      r.latVel *= 0.9;
      const pose = this.courseRenderer.samplePose(r.sample);
      r.lat = clamp(r.lat, -pose.left - pose.shL + 30, pose.right + pose.shR - 30);
      this.integrateAir(r);

      r.stateTicks--;
      if (r.stateTicks <= 0 && r.airY <= 0) {
        r.state = 'getting_up';
        r.stateTicks = 22;
      }
      return;
    }

    if (r.state === 'getting_up') {
      r.stateTicks--;
      if (r.stateTicks <= 0) {
        r.state = 'running';
        r.stateTicks = 0;
      }
      return;
    }

    if (r.state === 'running') {
      const db = r.downedBike;
      if (!db || !db.active) {
        this.remountRider(r);
        return;
      }

      // Sprint on foot (anim 38!) directly toward the downed motorcycle!
      const dS = db.sample - r.sample;
      const dLat = db.lat - r.lat;
      const distWorld = Math.hypot(dS * SAMPLE_LEN, dLat);

      if (distWorld < 58) {
        r.state = 'remounting';
        r.stateTicks = 24;
        return;
      }

      const runSpeedWorld = r.isPlayer ? 9.5 : 8.2; // brisk sprint back to bike
      const stepWorld = Math.min(distWorld, runSpeedWorld);
      const nx = (dS * SAMPLE_LEN) / distWorld;
      const ny = dLat / distWorld;
      r.sample += (nx * stepWorld) / SAMPLE_LEN;
      r.lat += ny * stepWorld;
      r.runHeading = Math.atan2(ny, nx);
      r.stateTicks++;

      if (r.isPlayer && r.stateTicks % 14 === 0) {
        this.audio.playSfx('footstep', { volume: 0.5, rate: 1.05 });
      }
      return;
    }

    if (r.state === 'remounting') {
      r.stateTicks--;
      if (r.stateTicks <= 0) {
        this.remountRider(r);
      }
    }
  }

  remountRider(r) {
    if (r.downedBike) {
      r.sample = r.downedBike.sample;
      r.lat = r.downedBike.lat;
      r.downedBike.active = false;
      r.downedBike = null;
    }
    r.state = 'riding';
    r.stamina = Math.max(r.maxStamina * 0.75, r.stamina);
    r.lean = 0;
    r.latVel = 0;
    r.airY = 0;
    r.airVel = 0;
    r.speedMph = 18;
  }

  stepDownedBikes() {
    for (let i = this.downedBikes.length - 1; i >= 0; i--) {
      const db = this.downedBikes[i];
      if (!db.active) {
        this.downedBikes.splice(i, 1);
        continue;
      }
      if (db.rampCooldown > 0) db.rampCooldown--;
      if (db.sliding) {
        db.sample += 0.16;
        if (db.sample >= db.targetSample) {
          db.sample = db.targetSample;
          db.sliding = false;
        }
      }

      // SIGNATURE OG MECHANIC: Downed motorcycles on the road act as physical launch ramps!
      for (const r of this.riders) {
        if (r.state !== 'riding' || r.id === db.ownerId || r.airY > 35 || db.rampCooldown > 0) continue;
        if (Math.abs(r.sample - db.sample) < 0.95 && Math.abs(r.lat - db.lat) < 96 && r.speedMph > 22) {
          db.rampCooldown = 28;
          const pan = clamp((db.lat - this.player.lat) / 500, -1, 1);
          if (Math.abs(r.sample - this.player.sample) < 25) {
            this.audio.playSfx('bounce', { volume: r.isPlayer ? 0.95 : 0.65, rate: 1.0, pan });
            this.audio.playSfx('crashlit', { volume: r.isPlayer ? 0.6 : 0.4, rate: 1.2, pan });
          }
          this.spawnSparks(db.sample, db.lat, 16, 10, '#66e6ff');

          // Launch bike airborne off the downed motorcycle!
          r.airY = 14;
          r.airVel = clamp(10.5 + r.speedMph * 0.085, 11, 23);
          r.wobble = (Math.random() - 0.5) * 5;

          if (r.isPlayer) {
            if (Math.abs(r.lean) > 0.76) {
              this.triggerCrash(r, 0.75, 'RAMP FLIP!');
            } else {
              this.showBanner('DOWNED-BIKE RAMP JUMP!', '#66e6ff', 60);
              this.spawnCallout(r.sample, r.lat, 'AIRBORNE!', '#66e6ff');
            }
          }
        }
      }
    }
  }

  // ==================== COMBAT, WEAPON SNATCHING, KICK SHOVES & CLIPPING FALLEN RIDERS ====================

  findClosestCombatTarget(attacker, maxSampleDiff, maxLatDiff) {
    let best = null;
    let bestScore = Infinity;
    for (const other of this.riders) {
      if (other === attacker || other.state !== 'riding') continue;
      const ds = Math.abs(other.sample - attacker.sample);
      const dl = Math.abs(other.lat - attacker.lat);
      if (ds <= maxSampleDiff && dl <= maxLatDiff) {
        const s = ds * 180 + dl;
        if (s < bestScore) {
          bestScore = s;
          best = other;
        }
      }
    }
    if (this.cop && this.cop.active && this.cop.state === 'riding') {
      const ds = Math.abs(this.cop.sample - attacker.sample);
      const dl = Math.abs(this.cop.lat - attacker.lat);
      if (ds <= maxSampleDiff && dl <= maxLatDiff && ds * 180 + dl < bestScore) {
        best = this.cop;
      }
    }
    return best;
  }

  stepRiderInteractions() {
    // 1. Resolve active melee strikes (mid-swing impact window)
    for (const attacker of this.riders) {
      if (attacker.state !== 'riding' || attacker.attackTicks <= 0 || attacker.attackLanded) continue;
      const progress = 1 - attacker.attackTicks / Math.max(1, attacker.attackDuration);
      if (progress < 0.32 || progress > 0.76) continue;

      // Candidate targets: riding rivals + motorcycle cop
      const candidates = [...this.riders];
      if (this.cop && this.cop.active && this.cop.state === 'riding') {
        candidates.push(this.cop);
      }

      for (const target of candidates) {
        if (target === attacker || target.state !== 'riding') continue;
        const dSample = Math.abs(target.sample - attacker.sample);
        if (dSample > 1.35) continue;

        const relLat = target.lat - attacker.lat;
        const onSide = attacker.attackSide < 0 ? relLat < 35 && relLat > -210 : relLat > -35 && relLat < 210;
        if (!onSide) continue;

        // HIT LANDED!
        attacker.attackLanded = true;
        this.applyCombatImpact(attacker, target);
        break;
      }
    }

    // 2. Bike-to-bike rub & bike-vs-sprinting-rider-on-foot clipping!
    for (let i = 0; i < this.riders.length; i++) {
      const a = this.riders[i];
      if (a.state !== 'riding') continue;

      for (let j = 0; j < this.riders.length; j++) {
        if (i === j) continue;
        const b = this.riders[j];

        // SIGNATURE OG MECHANIC: Clipping a crashed rider who is sprinting on foot back to their bike!
        if (b.state === 'running' || b.state === 'getting_up') {
          if (Math.abs(a.sample - b.sample) < 0.95 && Math.abs(a.lat - b.lat) < 88 && a.speedMph > 16) {
            const pan = clamp((b.lat - this.player.lat) / 500, -1, 1);
            if (Math.abs(a.sample - this.player.sample) < 28) {
              this.audio.playSfx('bounce', { volume: 0.85, pan });
              this.audio.playSfx(b.female ? 'gruntf3_' : 'gruntm3_', { volume: 0.9, pan });
            }
            // Bowl the running rider back into a comical ragdoll tumble!
            b.state = 'crashing';
            b.stateTicks = 44;
            b.airY = 16;
            b.airVel = 11.5;
            b.crashSampleVel = a.speedMph * MPH_TO_SAMPLES_PER_TICK * 0.45;
            b.latVel = (b.lat >= a.lat ? 1 : -1) * 11;
            // Minor wobble & slight speed dip on the hitting bike
            a.speedMph *= 0.92;
            a.wobble = (a.lat >= b.lat ? 1 : -1) * 7.5;
            this.spawnSparks(b.sample, b.lat, 55, 7, '#ffff60');
            if (a.isPlayer) {
              this.showBanner(`CLIPPED ${b.name.toUpperCase()} ON FOOT!`, '#ffff40', 60);
              this.spawnCallout(b.sample, b.lat, 'BOWLED OVER!', '#ffff40');
            }
            continue;
          }
        }

        // Bike-to-bike handlebar rub
        if (b.state === 'riding' && j > i) {
          if (Math.abs(a.sample - b.sample) < 0.72 && Math.abs(a.lat - b.lat) < 76) {
            const push = a.lat < b.lat ? -4.5 : 4.5;
            a.lat += push;
            b.lat -= push;
            a.latVel += push * 0.35;
            b.latVel -= push * 0.35;
          }
        }
      }
    }
  }

  applyCombatImpact(attacker, target) {
    const isCopTarget = target === this.cop;
    const pan = clamp((target.lat - this.player.lat) / 500, -1, 1);
    const nearCamera = Math.abs(target.sample - this.player.sample) < 26;
    const dir = attacker.attackSide; // -1 shoves target left, +1 shoves target right

    // Check TIMED WEAPON SNATCH: unarmed punch hits armed rival during their swing windup!
    if (
      attacker.attackType === 'punch' &&
      attacker.weapon === 0 &&
      !isCopTarget &&
      target.weapon > 0 &&
      target.attackTicks > 6
    ) {
      const stolen = target.weapon;
      attacker.weapon = stolen;
      target.weapon = 0;
      target.attackTicks = 0;
      target.attackCode = 0;
      if (attacker.isPlayer) {
        this.audio.playSfx(attacker.female ? 'f_yeah' : 'm_yeah', { volume: 0.95 });
        const wLabel = stolen === 2 ? 'CHAIN' : 'CLUB';
        this.showBanner(`SNATCHED ${target.name.toUpperCase()}'S ${wLabel}!`, '#66ff88', 85);
        this.spawnCallout(target.sample, target.lat, `STOLE ${wLabel}!`, '#66ff88');
      }
    }

    // Play authentic weapon/kick/punch impact SFX & grunt
    if (nearCamera) {
      if (attacker.attackType === 'kick') {
        this.audio.playSfx('kick_mw4', { volume: 0.95, pan });
      } else if (attacker.attackType === 'chain') {
        this.audio.playSfx('chainimp', { volume: 0.95, pan });
      } else if (attacker.attackType === 'club') {
        this.audio.playSfx('clubimpa', { volume: 0.95, pan });
      } else {
        this.audio.playSfx('punchhea', { volume: 0.9, pan });
      }
      this.audio.playSfx(target.female ? 'gruntf1_' : 'gruntm1_', { volume: 0.85, pan });
    }

    this.spawnSparks(
      target.sample,
      target.lat,
      92,
      attacker.attackType === 'punch' ? 6 : 11,
      attacker.attackType === 'kick' ? '#ff9933' : '#ffff60'
    );

    // SIGNATURE OG MECHANIC: Boot Kick physically shoves bike laterally across lanes!
    if (attacker.attackType === 'kick') {
      const shoveImpulse = attacker.isPlayer ? 34 : 22;
      target.latVel += dir * shoveImpulse;
      attacker.latVel -= dir * 5.5; // Newton recoil on kicker
      target.wobble = dir * 8;
      target.stamina = Math.max(0, target.stamina - 18);
      if (!isCopTarget) {
        target.staggerCode = dir < 0 ? 5 : 6;
        target.staggerTicks = 26;
        target.hitFlashTicks = 12;
      }
      if (attacker.isPlayer) {
        this.spawnCallout(target.sample, target.lat, 'KICK SHOVE!', '#ffae42');
      }
    } else {
      // Melee stamina damage (Fists / Club / Chain)
      const baseDmg =
        attacker.attackType === 'chain' ? 48 : attacker.attackType === 'club' ? 40 : 24;
      const dmg = attacker.isPlayer ? baseDmg : baseDmg * 0.58;
      target.stamina = Math.max(0, target.stamina - dmg);
      target.latVel += dir * (attacker.attackType === 'punch' ? 8 : 13);
      target.wobble = dir * 6.5;

      if (!isCopTarget) {
        target.staggerCode = dir < 0 ? 5 : 6;
        target.staggerTicks = 20;
        target.hitFlashTicks = 14;
      }
    }

    // Provoke cop if player attacks cop or brawls right in front of cop!
    if (
      attacker.isPlayer &&
      this.cop &&
      this.cop.active &&
      (isCopTarget || Math.abs(this.cop.sample - attacker.sample) < 18)
    ) {
      this.cop.chasing = true;
    }

    // Stamina KO -> Full Crash!
    if (target.stamina <= 0) {
      if (isCopTarget) {
        this.crashCop("KO'D OFFICER " + this.cop.name.toUpperCase() + '!');
      } else {
        const msg = attacker.isPlayer
          ? `KNOCKED OUT ${target.name.toUpperCase()}!`
          : `${target.name.toUpperCase()} KO'D!`;
        if (attacker.isPlayer) {
          this.audio.playSfx(attacker.female ? 'f_yeah' : 'm_yeah', { volume: 0.9 });
          this.showBanner(msg, '#ffff40', 75);
        }
        this.triggerCrash(target, 0.95, 'KO!');
      }
    }
  }

  // ==================== TRAFFIC CARS & PEDESTRIANS ====================

  stepTraffic() {
    for (const car of this.traffic) {
      if (car.hitCooldown > 0) car.hitCooldown--;
      car.sample += car.speedMph * MPH_TO_SAMPLES_PER_TICK;

      // Wrap far-behind oncoming cars ahead so long races always have live traffic
      if (car.oncoming && car.sample < this.player.sample - 35) {
        const respawnS = Math.min(this.finishSample + 45, this.player.sample + 95 + (car.id % 35));
        if (respawnS < this.finishSample + 40) {
          const pose = this.courseRenderer.samplePose(respawnS);
          car.sample = respawnS;
          car.lat = -pose.left * 0.48;
        }
      }

      if (car.hitCooldown > 0) continue;

      // Check rider-vs-car collisions (including rivals boot-kicked into oncoming traffic!)
      const actors = [...this.riders];
      if (this.cop && this.cop.active && this.cop.state === 'riding') actors.push(this.cop);

      for (const r of actors) {
        if (r.state !== 'riding' || r.airY > 95) continue;
        if (Math.abs(r.sample - car.sample) < 1.35 && Math.abs(r.lat - car.lat) < 118) {
          car.hitCooldown = 24;
          const relSpeed = Math.abs(r.speedMph - car.speedMph);
          if (relSpeed > 44 || car.oncoming) {
            if (r === this.cop) {
              this.crashCop('COP SLAMMED ONCOMING CAR!');
            } else {
              const callout = r.isPlayer ? 'TRAFFIC WRECK!' : `${r.name.toUpperCase()} HIT A CAR!`;
              if (!r.isPlayer && Math.abs(r.sample - this.player.sample) < 20) {
                this.showBanner(callout, '#ffae42', 65);
              }
              this.triggerCrash(r, 1.0, callout);
            }
          } else {
            // Glancing bumper sideswipe
            const push = r.lat >= car.lat ? 18 : -18;
            r.latVel += push;
            r.speedMph *= 0.78;
            this.spawnSparks(r.sample, (r.lat + car.lat) * 0.5, 50, 8);
            if (r.isPlayer) this.audio.playSfx('crashlit', { volume: 0.75 });
          }
        }
      }
    }
  }

  stepPedestrians() {
    const looks = this.assets.worldMeta?.pedestrians || [];

    for (const ped of this.pedestrians) {
      if (!ped.active) continue;
      const distToPlayer = Math.abs(ped.sample - this.player.sample);
      if (distToPlayer > 95) continue;

      ped.animTick++;

      if (ped.state === 'hit') {
        ped.sample += ped.sampleVel;
        ped.sampleVel *= 0.94;
        ped.lat += ped.latVel;
        ped.latVel *= 0.92;
        if (ped.airY > 0 || ped.airVel > 0) {
          ped.airY += ped.airVel;
          ped.airVel -= 0.95;
          ped.spinAngle += 0.24;
          if (ped.airY <= 0) {
            ped.airY = 0;
            ped.airVel = 0;
            ped.spinAngle = Math.PI * 0.5; // tumbled flat, comical stars!
          }
        }
        continue;
      }

      // Walking across road or along shoulder
      const pose = this.courseRenderer.samplePose(ped.sample);
      if (ped.dir !== 0) {
        ped.lat += ped.dir * 2.15;
        const limitL = -pose.left - pose.shL * 0.55;
        const limitR = pose.right + pose.shR * 0.55;
        if (ped.lat <= limitL) {
          ped.lat = limitL;
          ped.dir = 1;
        } else if (ped.lat >= limitR) {
          ped.lat = limitR;
          ped.dir = -1;
        }
      } else if (ped.walkAlong !== 0) {
        ped.sample += ped.walkAlong * 0.008;
      }

      // SIGNATURE OG MECHANIC: Clipping walking pedestrians!
      for (const r of this.riders) {
        if (r.state !== 'riding' || r.airY > 85) continue;
        if (Math.abs(r.sample - ped.sample) < 0.95 && Math.abs(r.lat - ped.lat) < 88 && r.speedMph > 12) {
          ped.state = 'hit';
          ped.airY = 14;
          ped.airVel = clamp(9 + r.speedMph * 0.09, 10, 22);
          ped.sampleVel = r.speedMph * MPH_TO_SAMPLES_PER_TICK * 0.58;
          ped.latVel = (ped.lat >= r.lat ? 1 : -1) * (8 + Math.random() * 6);
          ped.spinAngle = 0.2;

          // Minor bike wobble & slight speed dip (never crashes you unless totaled!)
          r.speedMph *= 0.93;
          r.wobble = (r.lat >= ped.lat ? 1 : -1) * 6.5;

          const pan = clamp((ped.lat - this.player.lat) / 500, -1, 1);
          if (Math.abs(ped.sample - this.player.sample) < 28) {
            const look = looks[ped.lookId];
            const voiceId = look?.voices?.[0] ?? 101;
            this.audio.playPedVoice(voiceId, pan);
            this.audio.playSfx('bounce', { volume: 0.72, rate: 1.12, pan });
          }
          if (r.isPlayer) {
            this.spawnCallout(ped.sample, ped.lat, 'OOPS!', '#ffdd55');
          }
          break;
        }
      }
    }
  }

  // ==================== MOTORCYCLE POLICE OFFICER (LOCOP.DAT) ====================

  crashCop(bannerMsg) {
    const cop = this.cop;
    if (!cop || cop.state !== 'riding') return;
    cop.state = 'crashing';
    cop.stateTicks = 120;
    cop.chasing = false;
    cop.airY = 16;
    cop.airVel = 12;
    this.audio.playSfx('crashhar', { volume: 0.9 });
    this.spawnSparks(cop.sample, cop.lat, 40, 14, '#66aaff');
    if (bannerMsg) this.showBanner(bannerMsg, '#66e6ff', 80);
  }

  stepCop() {
    const cop = this.cop;
    if (!cop) return;

    if (!cop.active) {
      if (cop.respawnCooldown > 0) {
        cop.respawnCooldown--;
        if (cop.respawnCooldown === 0 && this.player.sample < this.finishSample - 120) {
          cop.active = true;
          cop.state = 'riding';
          cop.chasing = false;
          cop.stamina = cop.maxStamina;
          cop.sample = this.player.sample + 95;
          cop.lat = 210;
          cop.speedMph = 58;
        }
      }
      return;
    }

    if (cop.state === 'crashing') {
      this.integrateAir(cop);
      cop.stateTicks--;
      if (cop.stateTicks <= 0) {
        cop.active = false;
        cop.respawnCooldown = 600; // next officer patrols 10s later down the road
      }
      return;
    }

    const p = this.player;
    const dS = p.sample - cop.sample;

    // Trigger pursuit when player blasts past cop at high speed!
    if (!cop.chasing && Math.abs(dS) < 12 && p.speedMph > 55) {
      cop.chasing = true;
      this.showBanner(`POLICE PURSUIT!`, '#ff4444', 65);
    }

    // Give up if player escapes way ahead
    if (cop.chasing && Math.abs(dS) > 75) {
      cop.chasing = false;
      cop.active = false;
      cop.respawnCooldown = 520;
      return;
    }

    if (cop.chasing) {
      // If player crashed and is on foot/ground, cop pulls up and BUSTS player!
      if (p.state === 'crashing' || p.state === 'getting_up' || p.state === 'running') {
        const targetSpeed = dS > 1.5 ? 85 : dS < -1.5 ? 20 : 12;
        cop.speedMph += (targetSpeed - cop.speedMph) * 0.08;
        cop.lat += (p.lat - cop.lat) * 0.07;
        cop.sample += cop.speedMph * MPH_TO_SAMPLES_PER_TICK;

        if (Math.abs(cop.sample - p.sample) < 1.8 && Math.abs(cop.lat - p.lat) < 140 && p.airY <= 2) {
          p.state = 'busted';
          cop.attackCode = 43;
          this.audio.playSfx('sirenfst', { volume: 0.7 });
          this.showBanner('BUSTED!', '#ff3333', 110);
          this.endStatus = 'busted';
          this.endDelayTicks = 95;
        }
        return;
      }

      // High-speed chase alongside player + nightstick swings!
      const desiredS = p.sample - 0.35;
      const chaseTop = p.topMph * 1.04;
      const targetSpeed = clamp(p.speedMph + (desiredS - cop.sample) * 9, 35, chaseTop);
      cop.speedMph += (targetSpeed - cop.speedMph) * 0.065;

      const sideOffset = cop.lat >= p.lat ? 105 : -105;
      const latErr = p.lat + sideOffset - cop.lat;
      cop.lean = clamp(latErr * 0.005, -0.75, 0.75);
      cop.lat += cop.lean * 9.0 + cop.latVel;
      cop.latVel *= 0.86;
      cop.sample += cop.speedMph * MPH_TO_SAMPLES_PER_TICK;
      this.integrateAir(cop);

      const pose = this.courseRenderer.samplePose(cop.sample);
      if (
        (pose.hasLeftWall && cop.lat < -pose.left - pose.shL + 35) ||
        (pose.hasRightWall && cop.lat > pose.right + pose.shR - 35)
      ) {
        this.crashCop('COP HIT BUILDING!');
        return;
      }

      if (cop.attackTicks > 0) {
        cop.attackTicks--;
        if (cop.attackTicks === 10 && Math.abs(cop.sample - p.sample) < 1.25 && Math.abs(cop.lat - p.lat) < 155) {
          const dir = p.lat < cop.lat ? -1 : 1;
          this.audio.playSfx('clubimpa', { volume: 0.9 });
          this.spawnSparks(p.sample, p.lat, 90, 9, '#ff6666');
          p.stamina = Math.max(0, p.stamina - 22);
          p.latVel += dir * 14;
          p.staggerCode = dir < 0 ? 5 : 6;
          p.staggerTicks = 18;
          if (p.stamina <= 0) {
            this.triggerCrash(p, 0.9, 'CLUBBED BY COP!');
          }
        }
        if (cop.attackTicks === 0) cop.attackCode = 0;
      } else if (cop.swingCooldown > 0) {
        cop.swingCooldown--;
      } else if (Math.abs(cop.sample - p.sample) < 1.25 && Math.abs(cop.lat - p.lat) < 165) {
        cop.attackCode = p.lat < cop.lat ? 16 : 17;
        cop.attackTicks = 24;
        cop.swingCooldown = 48;
        this.audio.playSfx('swishgen', { volume: 0.7 });
      }
    } else {
      // Peaceful patrol cruise ahead
      cop.speedMph = 54;
      cop.sample += cop.speedMph * MPH_TO_SAMPLES_PER_TICK;
      const pose = this.courseRenderer.samplePose(cop.sample);
      cop.lat = pose.right * 0.58;
    }
  }

  // ==================== STANDINGS, CAMERA & AUDIO ====================

  updateStandingsAndNearest() {
    const sorted = [...this.riders].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTicks - b.finishTicks;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.sample - a.sample;
    });
    this.playerPlace = sorted.findIndex((r) => r.isPlayer) + 1;

    // Nearest opponent (preferring riders ahead within 2x distance, matching hud.cpp::nearest_opponent)
    let aheadR = null;
    let aheadD = Infinity;
    let behindR = null;
    let behindD = Infinity;
    for (let i = 1; i < this.riders.length; i++) {
      const r = this.riders[i];
      const d = r.sample - this.player.sample;
      if (d >= 0 && d < aheadD) {
        aheadD = d;
        aheadR = r;
      } else if (d < 0 && -d < behindD) {
        behindD = -d;
        behindR = r;
      }
    }
    this.nearestRival = behindD * 2 < aheadD ? behindR : aheadR;
  }

  updateCamera() {
    const p = this.player;
    const pullBack = p.finished || p.state === 'wrecked' || p.state === 'busted' ? 2.6 : 1.48;
    this.cameraSample = p.sample - pullBack;
    // Trail laterally at 75% of player offset (clamped within ±200 world units like race.cpp::update_camera!)
    const targetLat = p.lat - clamp(p.lat * 0.25, -195, 195);
    this.cameraLat += (targetLat - this.cameraLat) * 0.28;
    const lift = p.finished || p.state === 'wrecked' || p.state === 'busted' ? 225 : 150;
    this.cameraHeight += (lift - this.cameraHeight) * 0.12;
  }

  updateAudioLoops(skidding, offRoad, inTunnel = false) {
    const p = this.player;
    let rivalDist = Infinity;
    let rivalPan = 0;
    if (this.nearestRival) {
      rivalDist = Math.hypot(
        (this.nearestRival.sample - p.sample) * SAMPLE_LEN,
        this.nearestRival.lat - p.lat
      );
      rivalPan = clamp((this.nearestRival.lat - p.lat) / 480, -1, 1);
    }

    let carDist = Infinity;
    let carPan = 0;
    let carRelSpeed = 0;
    for (const car of this.traffic) {
      const d = Math.hypot((car.sample - p.sample) * SAMPLE_LEN, car.lat - p.lat);
      if (d < carDist) {
        carDist = d;
        carPan = clamp((car.lat - p.lat) / 480, -1, 1);
        carRelSpeed = p.speedMph - car.speedMph;
      }
    }

    let copDist = Infinity;
    let copPan = 0;
    if (this.cop && this.cop.active) {
      copDist = Math.hypot((this.cop.sample - p.sample) * SAMPLE_LEN, this.cop.lat - p.lat);
      copPan = clamp((this.cop.lat - p.lat) / 480, -1, 1);
    }

    this.audio.updateRaceLoops({
      bikeId: this.config.bikeId,
      rpmNorm: p.state === 'riding' ? p.rpmNorm : 0.15,
      speedMph: p.speedMph,
      inTunnel,
      nitroActive: p.nitroTicks > 0,
      skidding,
      offRoad,
      rivalDist,
      rivalPan,
      carDist,
      carPan,
      carRelSpeed,
      copDist,
      copPan,
      copChasing: Boolean(this.cop?.chasing)
    });
  }

  finishAndExit(status) {
    if (this.ended) return;
    this.ended = true;
    this.audio.stopAllRaceLoops();

    // Build full 15-rider Race Results standings table
    const sorted = [...this.riders].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTicks - b.finishTicks;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.sample - a.sample;
    });

    const formatTime = (ticks) => {
      const totalSec = Math.max(1, Math.floor(ticks / 60));
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      const tenths = Math.floor((ticks % 60) / 6);
      return `${min}:${String(sec).padStart(2, '0')}.${tenths}`;
    };

    const standings = sorted.map((r) => {
      let estTicks = r.finishTicks;
      if (!r.finished) {
        const remSamples = Math.max(0, this.finishSample - r.sample);
        const spd = Math.max(45, r.topMph * 0.85) * MPH_TO_SAMPLES_PER_TICK;
        estTicks = this.ticks + Math.round(remSamples / spd);
      }
      const timeStr =
        r.isPlayer && status === 'wrecked'
          ? 'WRECKED'
          : r.isPlayer && status === 'busted'
            ? 'BUSTED'
            : formatTime(estTicks);
      return {
        name: r.name,
        isPlayer: r.isPlayer,
        timeStr
      };
    });

    const place = sorted.findIndex((r) => r.isPlayer) + 1;
    this.onRaceEnd({
      status,
      place,
      courseId: this.config.courseId,
      playerName: this.config.playerName,
      standings
    });
  }

  // ==================== AUTHENTIC SPRITE FRAME RESOLVERS ====================

  resolveRiderSprite(rider, camYaw, roadYaw) {
    const bm = this.assets.bikersMeta;
    if (!bm) return null;

    let frameIdx = 3;
    let mirror = false;

    if (rider.state === 'crashing' || rider.state === 'wrecked') {
      const seq = bm.riderAnims[28] || [];
      const step = Math.min(seq.length - 1, Math.floor((52 - rider.stateTicks) / 7));
      const grp = seq[Math.max(0, step)]?.r?.[0] ?? 94;
      const cell = bm.riderViews[grp]?.[0] || [241, 0];
      frameIdx = cell[0];
      mirror = Boolean(cell[1] & 1);
    } else if (rider.state === 'busted') {
      const seq = bm.riderAnims[43] || [];
      const step = Math.floor(this.ticks / 10) % Math.max(1, seq.length);
      const grp = seq[step]?.r?.[0] ?? 149;
      const cell = bm.riderViews[grp]?.[0] || [314, 0];
      frameIdx = cell[0];
      mirror = Boolean(cell[1] & 1);
    } else if (rider.state === 'getting_up') {
      frameIdx = 289;
      mirror = false;
    } else if (rider.state === 'running') {
      // 8-angle animated sprinting cycle (anim 38, groups 139..144)
      const seq = bm.riderAnims[38] || [];
      const step = Math.floor(rider.stateTicks / 5) % Math.max(1, seq.length);
      const grp = seq[step]?.r?.[0] ?? 139;
      const viewRow = bm.riderViews[grp] || [[297, 0]];
      const normAngle = (((rider.runHeading / (Math.PI * 2)) % 1) + 1) % 1;
      const sub = Math.floor(normAngle * viewRow.length) % viewRow.length;
      const cell = viewRow[sub] || viewRow[0];
      frameIdx = cell[0];
      mirror = Boolean(cell[1] & 1);
    } else if (rider.state === 'remounting') {
      const cell = bm.riderViews[147]?.[Math.min(4, Math.floor((24 - rider.stateTicks) / 5))] || [310, 0];
      frameIdx = cell[0];
      mirror = Boolean(cell[1] & 1);
    } else if (rider.attackTicks > 0 && rider.attackCode > 0) {
      // Melee / Club / Chain / Kick swing sequence!
      const seq = bm.riderAnims[rider.attackCode] || [];
      const elapsed = Math.max(0, rider.attackDuration - rider.attackTicks);
      let acc = 0;
      let chosen = seq[0];
      for (const s of seq) {
        acc += s.dur || 7;
        chosen = s;
        if (elapsed < acc) break;
      }
      const grp = chosen?.r?.[0] ?? 84;
      const viewRow = bm.riderViews[grp] || [[176, 0]];
      const midIdx = Math.floor(viewRow.length / 2);
      const cell = viewRow[midIdx] || viewRow[0];
      frameIdx = cell[0];
      mirror = Boolean(cell[1] & 1);
    } else if (rider.staggerTicks > 0 && rider.staggerCode > 0) {
      const seq = bm.riderAnims[rider.staggerCode] || [];
      const grp = seq[0]?.r?.[0] ?? 22;
      const viewRow = bm.riderViews[grp] || [[42, 0]];
      const cell = viewRow[Math.floor(viewRow.length / 2)];
      frameIdx = cell[0];
      mirror = Boolean(cell[1] & 1);
    } else if (rider.airY > 10) {
      // Wheelie / Ramp Jump pose (anim 4 -> view[21])!
      const viewRow = bm.riderViews[21] || [[41, 0]];
      const leanSlot = clamp(2 + Math.round(rider.lean * 2), 0, viewRow.length - 1);
      const cell = viewRow[leanSlot];
      frameIdx = cell[0];
      mirror = Boolean(cell[1] & 1);
    } else if (rider.speedMph < 4 && this.countdownTicks > 0) {
      // Stopped at starting grid with foot down (anim 8 -> view[27])
      const cell = bm.riderViews[27]?.[2] || [47, 0];
      frameIdx = cell[0];
      mirror = Boolean(cell[1] & 1);
    } else {
      // Normal riding (view[2..10] across 9 lean angles) or Nitro high-speed tuck (view[12..20])!
      const tucked = rider.nitroTicks > 0 || rider.speedMph > rider.topMph * 0.96;
      const baseGroup = tucked ? 16 : 6; // upright group (6 normal, 16 tucked)
      const leanSteps = clamp(Math.round(rider.lean * 3.4), -4, 4);
      const grp = baseGroup + leanSteps;
      const viewRow = bm.riderViews[grp] || bm.riderViews[6];

      const relYaw = wrapAngle(roadYaw - camYaw);
      const yawIdx = clamp(3 + Math.round(relYaw * 2.2), 0, viewRow.length - 1);
      const cell = viewRow[yawIdx] || viewRow[3];
      frameIdx = cell[0];
      mirror = Boolean(cell[1] & 1);
    }

    const canvas = this.assets.getRiderCanvas(rider.remap, frameIdx);
    if (!canvas) return null;
    const shadowCanvas = this.assets.getRiderShadowCanvas(frameIdx);
    const meta = bm.riderFrames[frameIdx];
    // riderFrames hotspots are stored in 320x240 logical coords (half of hibob 2x pixel dims)
    const hx = meta ? meta[0] * 2 : canvas.width * 0.5;
    const hy = meta ? meta[1] * 2 : canvas.height * 0.85;

    return { canvas, shadowCanvas, hx, hy, mirror };
  }

  resolveDownedBikeSprite(db) {
    const bm = this.assets.bikersMeta;
    if (!bm) return null;
    const slidingFrames = [319, 320, 321, 322];
    const frameIdx = db.sliding ? slidingFrames[Math.floor(this.ticks / 4) % 4] : 321;
    const canvas = this.assets.getRiderCanvas(db.remap, frameIdx);
    if (!canvas) return null;
    return { canvas };
  }

  resolveCopSprite(cop, camYaw, roadYaw) {
    const bm = this.assets.bikersMeta;
    if (!bm) return null;

    let frameIdx = 3;
    let mirror = false;

    if (cop.state === 'crashing') {
      frameIdx = 37;
    } else if (cop.attackCode === 43) {
      frameIdx = 35;
    } else if (cop.attackTicks > 0 && (cop.attackCode === 16 || cop.attackCode === 17)) {
      const seq = bm.copAnims[cop.attackCode] || [];
      const grp = seq[Math.min(seq.length - 1, Math.floor((24 - cop.attackTicks) / 8))]?.r?.[0] ?? 3;
      const viewRow = bm.copViews[grp] || [[8, 0]];
      const cell = viewRow[3] || viewRow[0];
      frameIdx = cell[0];
      mirror = Boolean(cell[1] & 1);
    } else {
      const viewRow = bm.copViews[1] || [[3, 0]];
      const relYaw = wrapAngle(roadYaw - camYaw + cop.lean * 0.45);
      const idx = clamp(3 + Math.round(relYaw * 2.5), 0, viewRow.length - 1);
      const cell = viewRow[idx] || viewRow[3];
      frameIdx = cell[0];
      mirror = Boolean(cell[1] & 1);
    }

    const canvas = this.assets.getCopCanvas(frameIdx);
    if (!canvas) return null;
    const shadowCanvas = this.assets.getCopShadowCanvas(frameIdx);
    const meta = bm.copFrames[frameIdx];
    const hx = meta ? meta[0] : canvas.width * 0.5;
    const hy = meta ? meta[1] : canvas.height * 0.88;
    return { canvas, shadowCanvas, hx, hy, mirror };
  }

  resolveCarSprite(car, camYaw, roadYaw, zc) {
    const courseCars = this.assets.carsMeta?.courses?.[this.config.courseKey];
    if (!courseCars || !courseCars.length) return null;
    const def = courseCars[car.typeIdx % courseCars.length];
    if (!def?.frames?.length || !def?.views?.length) return null;

    // Always use views[2] (full-resolution frame coords matching cars_atlas.png pixel dimensions!)
    const lodGroup = def.views[2] || def.views[0];
    const worldScale = 5.1;

    // Include lateral perspective angle (atan2(latDiff, depth)) just like actor_render.cpp::actor_angles!
    const latAngle = Math.atan2(car.lat - this.cameraLat, Math.max(180, zc));
    const carHeading = car.oncoming ? roadYaw + Math.PI : roadYaw;
    const rel = wrapAngle(carHeading - camYaw - latAngle);
    const slot = clamp(4 + Math.round((rel / Math.PI) * 4), 0, lodGroup.length - 1);
    const [fIdx, flags] = lodGroup[slot] || lodGroup[4] || [0, 0];
    const fr = def.frames[fIdx] || def.frames[0];
    const [rectIdx, rawHx, rawHy, logicalW, logicalH] = fr;
    const canvas = this.assets.getCarCanvas(rectIdx);
    if (!canvas) return null;

    const sx = logicalW > 0 ? canvas.width / logicalW : 1;
    const sy = logicalH > 0 ? canvas.height / logicalH : 1;

    return {
      canvas,
      hx: rawHx * sx,
      hy: rawHy * sy,
      mirror: Boolean(flags & 1),
      worldScale
    };
  }

  resolvePedSprite(ped) {
    const looks = this.assets.worldMeta?.pedestrians;
    if (!looks || !looks.length) return null;
    const look = looks[ped.lookId % looks.length];
    if (!look?.frames?.length) return null;

    let frameEntry = look.frames[0];
    let mirror = ped.dir < 0;

    if (ped.state === 'hit') {
      // Knockdown / flying frames (anim 3 in look.anims)
      const hitSeq = look.anims?.[3];
      if (hitSeq && hitSeq.length) {
        const step = Math.min(hitSeq.length - 1, Math.floor((ped.animTick % 24) / 4));
        const vGrp = hitSeq[step]?.r?.[0] ?? 0;
        const cell = look.views?.[vGrp]?.[0];
        if (cell && look.frames[cell[0]]) {
          frameEntry = look.frames[cell[0]];
        }
      }
    } else {
      // Walking animation (anim 0 in look.anims)
      const walkSeq = look.anims?.[0];
      if (walkSeq && walkSeq.length) {
        const step = Math.floor(ped.animTick / 6) % walkSeq.length;
        const vGrp = walkSeq[step]?.r?.[0] ?? 0;
        const cell = look.views?.[vGrp]?.[0];
        if (cell && look.frames[cell[0]]) {
          frameEntry = look.frames[cell[0]];
        }
      } else {
        frameEntry = look.frames[Math.floor(ped.animTick / 7) % look.frames.length];
      }
    }

    const [texId, hx, hy, w, h] = frameEntry;
    const canvas = this.assets.getWorldCanvas(texId);
    if (!canvas) return null;
    return { canvas, hx, hy, w, h, mirror };
  }
}
