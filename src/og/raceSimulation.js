// Authentic 1996 Road Rash 60Hz Race Simulation Engine
// Exact ROADRASH.EXE speed-to-sample scale (0.1526 samples/tick at 100 MPH, 33 samples = 0.1 mi),
// exact race.cpp centrifugal curve sweep (-bend * ds * 1.5625), 6-speed gearbox & RPM needle,
// smart/directional melee combat (punches, clubs, chains, timed weapon snatching),
// lateral boot-kick shoves into traffic/walls, hittable pedestrians & sprinting crashed riders,
// motorcycle cops (sirens, nightstick duels & busts), Superbike Nitro, and downed-bike stunt ramps!

const RIVAL_ROSTER = [
  { name: 'Biff', aggr: 0.86, weapon: 1, bikeId: 3, female: false },
  { name: 'Ikira', aggr: 0.72, weapon: 0, bikeId: 12, female: false },
  { name: 'Lola', aggr: 0.68, weapon: 2, bikeId: 14, female: true },
  { name: 'Natasha', aggr: 0.80, weapon: 2, bikeId: 7, female: true },
  { name: 'Slater', aggr: 0.90, weapon: 1, bikeId: 4, female: false },
  { name: 'Torque', aggr: 0.82, weapon: 1, bikeId: 11, female: false },
  { name: 'Viper', aggr: 0.93, weapon: 2, bikeId: 8, female: false },
  { name: 'Helga', aggr: 0.76, weapon: 1, bikeId: 10, female: true },
  { name: 'Chino', aggr: 0.74, weapon: 0, bikeId: 2, female: false },
  { name: 'Cannon', aggr: 0.66, weapon: 0, bikeId: 0, female: false },
  { name: 'Sven', aggr: 0.78, weapon: 1, bikeId: 6, female: false },
  { name: 'Roxy', aggr: 0.71, weapon: 2, bikeId: 13, female: true },
  { name: 'Spike', aggr: 0.88, weapon: 2, bikeId: 5, female: false },
  { name: 'Mugsy', aggr: 0.64, weapon: 1, bikeId: 1, female: false }
];

const COP_NAMES = ["O'Connor", 'Kowalski', 'Vance', ' Roscoe'];
const GEAR_THRESHOLDS = [0.0, 0.23, 0.41, 0.58, 0.75, 0.90, 1.35];

export class RaceSimulation {
  constructor(assets, audio, courseRenderer, config, onRaceComplete) {
    this.assets = assets;
    this.audio = audio;
    this.courseRenderer = courseRenderer;
    this.config = config;
    this.course = courseRenderer.course;
    this.onRaceComplete = onRaceComplete;

    this.ticks = 0;
    this.countdownTicks = 180; // 3.0s 3-2-1-GO! (lifecycle.hpp: 3 * 60)
    this.goBannerTicks = 0;
    this.paused = false;
    this.pauseFocus = 0;
    this.completed = false;

    const totalSamples = this.course.samples.length;
    this.startSample = this.course.startSample || 50;
    this.finishSample =
      this.course.finishSamples?.[config.level] || Math.max(240, totalSamples - 50);

    this.bannerText = '';
    this.bannerColor = '#ffff40';
    this.bannerTicks = 0;

    this.riders = [];
    this.player = null;
    this.playerPlace = 15;
    this.nearestRival = null;
    this.focusedRival = null;
    this.focusedTimer = 0;

    this.downedBikes = [];
    this.traffic = [];
    this.pedestrians = [];
    this.cops = [];
    this.activeCop = null;

    // Camera state for road.cpp::project_road
    this.cameraSample = Math.max(1, this.startSample - 1.55);
    this.cameraLat = 0;
    this.cameraHeightOffset = 0;
    this.headingAccum = 0;

    this.initRiders();
    this.initTraffic();
    this.initPedestrians();
    this.initPolice();
  }

  bikeStats(bikeId) {
    const raw = this.assets.frontend?.bikes?.[bikeId];
    const cls = bikeId < 5 ? 'rat' : bikeId < 10 ? 'super' : 'sport';
    const hasNitro = raw ? raw[86] > 0 : cls === 'super';
    const hp = raw ? (raw[24] | (raw[25] << 8)) : 80;

    const topMphBase =
      cls === 'rat' ? 116 + (hp % 22) : cls === 'sport' ? 144 + (hp % 24) : 170 + (hp % 26);
    const accelBase = cls === 'rat' ? 0.58 : cls === 'sport' ? 0.78 : 0.98;
    const steerBase = cls === 'rat' ? 7.2 : cls === 'sport' ? 8.4 : 9.4;

    return {
      cls,
      hasNitro,
      nitroCharges: hasNitro ? 6 : 0,
      topMph: topMphBase + this.config.level * 5,
      accel: accelBase + this.config.level * 0.05,
      steerRate: steerBase,
      maxBikeCond: cls === 'rat' ? 135 : cls === 'sport' ? 155 : 175
    };
  }

  initRiders() {
    const pStats = this.bikeStats(this.config.bikeId);
    this.player = this.makeRider({
      id: 0,
      isPlayer: true,
      name: this.config.playerName || 'Axle',
      female: Boolean(this.config.female),
      colorIdx: 0,
      bikeId: this.config.bikeId,
      stats: pStats,
      sample: this.startSample,
      lat: 95,
      weapon: 0,
      aggr: 0
    });
    this.riders.push(this.player);
    this.cameraLat = this.player.lat;

    for (let i = 0; i < 14; i++) {
      const rdef = RIVAL_ROSTER[i];
      const lvlBike = Math.min(14, (rdef.bikeId + this.config.level * 2) % 15);
      const st = this.bikeStats(lvlBike);
      const row = Math.floor((i + 1) / 2);
      const col = (i + 1) % 2;

      const aiScale = 0.85 + (i / 14) * 0.21 + this.config.level * 0.025;
      st.topMph = pStats.topMph * aiScale;

      this.riders.push(
        this.makeRider({
          id: i + 1,
          isPlayer: false,
          name: rdef.name,
          female: rdef.female,
          colorIdx: (i % 14) + 1,
          bikeId: lvlBike,
          stats: st,
          sample: this.startSample + row * 1.18,
          lat: col === 0 ? -135 : 135,
          weapon: i % 3 === 0 ? rdef.weapon : 0,
          aggr: rdef.aggr,
          aiLaneTarget: (col === 0 ? -155 : 155) + ((i * 37) % 90) - 45
        })
      );
    }
  }

  makeRider(opts) {
    return {
      ...opts,
      speedMph: 0,
      latVel: 0,
      shoveVel: 0,
      lean: 0,
      gear: 1,
      rpmNorm: 0.16,
      airY: 0,
      airVel: 0,
      offRoad: false,
      skidding: false,
      runCompass: Math.PI,
      stamina: 100,
      maxStamina: 100,
      bikeCond: opts.stats.maxBikeCond,
      maxBikeCond: opts.stats.maxBikeCond,
      nitroCharges: opts.stats.nitroCharges,
      nitroTicks: 0,
      state: 'riding', // 'riding' | 'crashing' | 'running' | 'busted' | 'wrecked'
      stateTimer: 0,
      downedBikeRef: null,
      animId: 2,
      animStep: 0,
      animTick: 0,
      forceMirror: null,
      attackType: null,
      attackSide: 1,
      attackPhase: 'idle',
      attackTimer: 0,
      hitDone: false,
      staggerTimer: 0,
      hitSparkTimer: 0,
      lastHitSide: 1,
      finished: false,
      finishTick: 0,
      place: 15,
      aiCooldown: 35 + Math.floor(Math.random() * 55)
    };
  }

  initTraffic() {
    const courseCars = this.assets.carsMeta?.courses?.[this.course.name] || [];
    const numKinds = Math.max(1, courseCars.length);
    const totalSpan = this.finishSample - (this.startSample + 22);
    const count = Math.min(36, Math.max(18, Math.floor(totalSpan / 45)));

    for (let i = 0; i < count; i++) {
      const s = this.startSample + 24 + (i + 0.5) * (totalSpan / count);
      const smp = this.sampleInfoAt(s);
      const oncoming = i % 2 === 0;
      const laneMag = Math.max(115, (oncoming ? smp.left : smp.right) * 0.52);
      this.traffic.push({
        id: i,
        active: true,
        kind: i % numKinds,
        sample: s,
        dir: oncoming ? -1 : 1,
        mph: oncoming ? 44 + (i % 18) : 48 + (i % 20),
        lat: oncoming ? -laneMag : laneMag,
        hornCooldown: 0
      });
    }
  }

  initPedestrians() {
    const pedsMeta = this.assets.worldMeta?.pedestrians || [];
    const maxTypes = Math.max(1, pedsMeta.length);
    const spawns = this.course.pedSpawns || [];

    if (spawns.length > 0) {
      const step = Math.max(1, Math.floor(spawns.length / 65));
      for (let i = 0; i < spawns.length; i += step) {
        const [sIdx, rawLat, pType] = spawns[i];
        if (sIdx < this.startSample + 10 || sIdx > this.finishSample - 8) continue;
        const smp = this.sampleInfoAt(sIdx);
        if (smp.tunnel) continue;
        const isCrossing = (smp.flags & 8) !== 0 || i % 3 === 0;
        const startLat = rawLat || (i % 2 === 0 ? -(smp.left + 45) : smp.right + 45);
        this.pedestrians.push({
          active: true,
          type: (pType || i) % maxTypes,
          sample: sIdx + 0.25,
          lat: startLat,
          vx: isCrossing ? (startLat < 0 ? 1.85 : -1.85) : 0,
          moving: isCrossing,
          state: 'walk',
          airY: 0,
          airVel: 0,
          spinAngle: 0,
          animStep: i % 6,
          animTick: 0,
          edgeLimit: Math.max(smp.left, smp.right) + 95
        });
      }
    } else {
      for (let s = this.startSample + 20; s < this.finishSample - 15; s += 30) {
        const smp = this.sampleInfoAt(s);
        if (smp.tunnel) continue;
        const side = (s & 2) === 0 ? -1 : 1;
        const edge = side < 0 ? -(smp.left + 48) : smp.right + 48;
        this.pedestrians.push({
          active: true,
          type: (s * 7) % maxTypes,
          sample: s + 0.25,
          lat: edge * 0.78,
          vx: -side * 1.75,
          moving: true,
          state: 'walk',
          airY: 0,
          airVel: 0,
          spinAngle: 0,
          animStep: s % 6,
          animTick: 0,
          edgeLimit: Math.max(smp.left, smp.right) + 95
        });
      }
    }
  }

  initPolice() {
    const patrolCount = 2 + Math.min(2, Math.floor(this.config.level / 2));
    const span = this.finishSample - (this.startSample + 110);
    for (let i = 0; i < patrolCount; i++) {
      const spawnS = this.startSample + 120 + Math.floor(((i + 0.45) * span) / patrolCount);
      this.cops.push({
        id: i,
        name: COP_NAMES[i % COP_NAMES.length].trim(),
        active: false,
        chasing: false,
        spawnSample: spawnS,
        sample: spawnS,
        lat: 195,
        latVel: 0,
        mph: 0,
        lean: 0,
        airY: 0,
        stamina: 115,
        animId: 0,
        animStep: 0,
        animTick: 0,
        attackCooldown: 45
      });
    }
  }

  // Decode compact course.samples[idx] array into clean physical fields!
  sampleInfoAt(sFloat) {
    const arr = this.course.samples;
    const idx = Math.max(0, Math.min(arr.length - 1, Math.floor(sFloat)));
    const raw = arr[idx];
    const ttype = raw[11] || 0;
    return {
      idx,
      bend: raw[0] || 0,
      rise: raw[1] || 0,
      elev: raw[2] || 0,
      left: raw[3] || 500,
      right: raw[4] || 500,
      shL: raw[5] || 220,
      shR: raw[6] || 220,
      hL: raw[7] || 0,
      hR: raw[8] || 0,
      flags: raw[9] || 0,
      tunnel: raw[10] === 1,
      ttype,
      hasWallL: ttype === 0 ? raw[14] >= 0 : (raw[22] || 0) > 55,
      hasWallR: ttype === 0 ? raw[15] >= 0 : (raw[23] || 0) > 55,
      coastalDropL: (ttype === 1 || ttype === 3) && (raw[22] || 0) <= 40,
      raw
    };
  }

  showBanner(text, color = '#ffff40', durationTicks = 80) {
    this.bannerText = text;
    this.bannerColor = color;
    this.bannerTicks = durationTicks;
  }

  triggerNitro() {
    const p = this.player;
    if (!p || p.state !== 'riding') return;
    if (p.nitroCharges > 0 && p.nitroTicks <= 0) {
      p.nitroCharges -= 1;
      p.nitroTicks = 135;
      this.audio.playSfx('m_yeah', { volume: 0.72 });
      this.showBanner(`NITRO BOOST! (${p.nitroCharges} LEFT)`, '#66e6ff', 65);
    }
  }

  pickSmartSide(rider, steerDir = 0) {
    let bestSide = steerDir < 0 ? -1 : steerDir > 0 ? 1 : rider.lean < -0.1 ? -1 : 1;
    let bestScore = 9999;

    for (const other of this.riders) {
      if (other === rider || other.state !== 'riding' || other.finished) continue;
      const ds = Math.abs(other.sample - rider.sample);
      const dLat = other.lat - rider.lat;
      if (ds < 1.7 && Math.abs(dLat) < 210) {
        const score = ds * 95 + Math.abs(dLat);
        if (score < bestScore) {
          bestScore = score;
          bestSide = dLat < 0 ? -1 : 1;
        }
      }
    }
    for (const cop of this.cops) {
      if (!cop.active) continue;
      const ds = Math.abs(cop.sample - rider.sample);
      const dLat = cop.lat - rider.lat;
      if (ds < 1.7 && Math.abs(dLat) < 210) {
        const score = ds * 95 + Math.abs(dLat);
        if (score < bestScore) {
          bestScore = score;
          bestSide = dLat < 0 ? -1 : 1;
        }
      }
    }
    return bestSide;
  }

  // Unified attack trigger called from keyboard or touch buttons!
  // kind: 'smart' | 'left' | 'right' | 'kick'
  triggerAttack(kind, inputState = {}) {
    const p = this.player;
    if (!p || p.state !== 'riding' || p.attackPhase !== 'idle' || this.countdownTicks > 0) return;

    const steerDir = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
    if (kind === 'kick') {
      const side = this.pickSmartSide(p, steerDir);
      this.startAttack(p, 'kick', side);
    } else if (kind === 'left') {
      this.startAttack(p, p.weapon > 0 ? 'weapon' : 'punch', -1);
    } else if (kind === 'right') {
      this.startAttack(p, p.weapon > 0 ? 'weapon' : 'punch', 1);
    } else {
      const side = this.pickSmartSide(p, steerDir);
      this.startAttack(p, p.weapon > 0 ? 'weapon' : 'punch', side);
    }
  }

  playGrunt(female) {
    if (female) {
      const n = 1 + Math.floor(Math.random() * 3);
      this.audio.playSfx(`gruntf${n}_`, { volume: 0.78 });
    } else {
      const n = 1 + Math.floor(Math.random() * 5);
      this.audio.playSfx(`gruntm${n}_`, { volume: 0.78 });
    }
  }

  // ==================== MAIN 60HZ TICK ====================

  step(input) {
    if (this.paused || this.completed) return;

    const prevPlayerSample = this.player.sample;

    if (this.countdownTicks > 0) {
      this.countdownTicks -= 1;
      if (this.countdownTicks === 120 || this.countdownTicks === 60) {
        this.audio.playSfx('swishgen', { volume: 0.55, rate: 1.05 });
      } else if (this.countdownTicks === 1) {
        this.goBannerTicks = 55;
        this.audio.playSfx(this.player.female ? 'f_yeah' : 'm_yeah', { volume: 0.85 });
      }
      this.player.rpmNorm = input.gas ? 0.68 : 0.22;
      this.audio.updateRaceLoops({
        bikeId: this.player.bikeId,
        rpmNorm: this.player.rpmNorm,
        speedMph: 0,
        inTunnel: false
      });
      return;
    }

    this.ticks += 1;
    if (this.goBannerTicks > 0) this.goBannerTicks -= 1;
    if (this.bannerTicks > 0) this.bannerTicks -= 1;
    if (this.focusedTimer > 0) {
      this.focusedTimer -= 1;
      if (this.focusedTimer === 0) this.focusedRival = null;
    }

    this.stepTraffic();
    this.stepPedestrians();
    this.stepDownedBikes();

    for (const r of this.riders) {
      if (r.isPlayer) this.stepPlayerRider(r, input);
      else this.stepAIRider(r);
    }

    this.stepRiderToRiderCollisions();
    this.stepPolice();
    this.updateStandings();
    this.updateCameraAndAudio(prevPlayerSample);
    this.checkEndConditions();
  }

  // ==================== PLAYER & AI MOTORCYCLE PHYSICS ====================

  stepPlayerRider(r, input) {
    if (r.state !== 'riding') {
      this.stepNonRidingState(r);
      return;
    }

    const steerInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    this.integrateMotorcyclePhysics(r, {
      throttle: Boolean(input.gas || input.throttle),
      brake: Boolean(input.brake),
      steer: steerInput
    });
  }

  stepAIRider(r) {
    if (r.finished) {
      r.speedMph = Math.max(0, r.speedMph - 1.5);
      return;
    }
    if (r.state !== 'riding') {
      this.stepNonRidingState(r);
      return;
    }

    const smp = this.sampleInfoAt(r.sample);
    const lookSmp = this.sampleInfoAt(r.sample + 5);

    let targetLat = r.aiLaneTarget;
    for (const car of this.traffic) {
      const ds = car.sample - r.sample;
      if (ds > 0 && ds < 10 && Math.abs(car.lat - targetLat) < 110) {
        targetLat = car.lat > 0 ? -155 : 165;
        break;
      }
    }

    const distToPlayer = r.sample - this.player.sample;
    if (Math.abs(distToPlayer) < 6 && this.player.state === 'riding' && r.aggr > 0.72) {
      const sideOffset = r.id % 2 === 0 ? 78 : -78;
      targetLat = this.player.lat + sideOffset;
    }

    const maxRoadL = -(smp.left - 55);
    const maxRoadR = smp.right - 55;
    targetLat = Math.max(maxRoadL, Math.min(maxRoadR, targetLat));

    const latErr = targetLat - r.lat;
    const curveAnticipation = lookSmp.bend * 0.012;
    const steer = Math.max(-1, Math.min(1, latErr * 0.018 + curveAnticipation));

    let speedMul = 1.0;
    if (distToPlayer > 30) speedMul = 0.90;
    else if (distToPlayer < -24) speedMul = 1.09;

    const cornerCaution = Math.abs(lookSmp.bend) > 45 && r.speedMph > r.stats.topMph * 0.84;

    if (r.aiCooldown > 0) r.aiCooldown -= 1;
    if (this.ticks > 150 && r.attackPhase === 'idle' && r.aiCooldown <= 0) {
      const target = this.findAdjacentTarget(r);
      if (target && Math.random() < r.aggr * 0.08) {
        const side = target.lat < r.lat ? -1 : 1;
        const kind = r.weapon > 0 ? 'weapon' : Math.random() < 0.28 ? 'kick' : 'punch';
        this.startAttack(r, kind, side);
        r.aiCooldown = 95 + Math.floor(Math.random() * 90);
      }
    }

    this.integrateMotorcyclePhysics(
      r,
      {
        throttle: !cornerCaution && r.speedMph < r.stats.topMph * speedMul,
        brake: cornerCaution,
        steer
      },
      speedMul
    );
  }

  integrateMotorcyclePhysics(r, ctrl, topMul = 1.0) {
    const smp = this.sampleInfoAt(r.sample);
    const nextSmp = this.sampleInfoAt(r.sample + 1);

    if (r.nitroTicks > 0) r.nitroTicks -= 1;
    if (r.hitSparkTimer > 0) r.hitSparkTimer -= 1;
    if (r.staggerTimer <= 0 && r.stamina < r.maxStamina) {
      r.stamina = Math.min(r.maxStamina, r.stamina + (r.isPlayer ? 0.04 : 0.015));
    }

    const nitroBoost = r.nitroTicks > 0 ? 1.26 : 1.0;
    const maxMph = r.stats.topMph * topMul * nitroBoost;

    const offRoadLeft = r.lat < -smp.left;
    const offRoadRight = r.lat > smp.right;
    r.offRoad = offRoadLeft || offRoadRight;
    r.skidding = Boolean(ctrl.brake && r.speedMph > 30);

    // 1. Throttle / Brake / Slope / Dirt Drag (bike.cpp)
    if (ctrl.throttle && r.airY <= 1) {
      const ratio = r.speedMph / Math.max(1, maxMph);
      const torqueCurve = Math.max(0.16, 1.08 - ratio * 0.82);
      r.speedMph += r.stats.accel * torqueCurve * (r.nitroTicks > 0 ? 1.85 : 1.0);
    } else {
      r.speedMph -= 0.19 + (r.speedMph / 190) * 0.24;
    }

    if (ctrl.brake && r.airY <= 1) {
      r.speedMph -= 1.45;
    }

    r.speedMph -= smp.rise * 0.0018;
    if (r.offRoad && r.airY <= 1) {
      r.speedMph -= 0.44 + r.speedMph * 0.0065;
    }
    r.speedMph = Math.max(0, Math.min(maxMph + 14, r.speedMph));

    // 2. 6-Speed Gearbox & Analog Tachometer RPM (bike.cpp::update_engine_rpm)
    const speedRatio = r.speedMph / Math.max(1, r.stats.topMph);
    let newGear = 1;
    for (let g = 1; g <= 6; g++) {
      if (speedRatio >= GEAR_THRESHOLDS[g - 1]) newGear = g;
    }
    r.gear = newGear;
    const gLow = GEAR_THRESHOLDS[newGear - 1];
    const gHigh = GEAR_THRESHOLDS[newGear];
    const inGearFrac = Math.max(0, Math.min(1, (speedRatio - gLow) / Math.max(0.12, gHigh - gLow)));
    const targetRpm =
      r.airY > 4 && ctrl.throttle
        ? 0.96
        : 0.20 + inGearFrac * 0.72 + (r.nitroTicks > 0 ? 0.08 : 0);
    r.rpmNorm += (targetRpm - r.rpmNorm) * 0.24;

    // 3. Progressive Lean & Exact race.cpp Centrifugal Curve Sweep!
    const steerAuthority = r.staggerTimer > 0 ? 0.12 : Math.min(1.0, 0.24 + r.speedMph / 42);
    const effSteer = r.staggerTimer > 0 ? 0 : ctrl.steer;
    if (Math.abs(effSteer) > 0.04) {
      r.lean += (effSteer - r.lean) * 0.14 * steerAuthority;
    } else if (r.staggerTimer <= 0) {
      r.lean *= 0.84;
      if (Math.abs(r.lean) < 0.01) r.lean = 0;
    }
    r.lean = Math.max(-1, Math.min(1, r.lean));

    const ds = r.speedMph * 0.001526;
    const centrifugalPush = -smp.bend * ds * 0.58;
    const leanLatDrive = r.lean * r.stats.steerRate * steerAuthority * (r.offRoad ? 0.75 : 1.0);

    r.shoveVel = (r.shoveVel || 0) * 0.90;
    if (Math.abs(r.shoveVel) < 0.05) r.shoveVel = 0;
    r.latVel = r.latVel * 0.78 + leanLatDrive * 0.30;
    r.lat += r.latVel + r.shoveVel + centrifugalPush;

    // 4. Advance Forward & Hilltop Air Launches!
    r.sample += ds;
    const slopeDrop = smp.rise - nextSmp.rise;
    if (r.airY <= 0 && slopeDrop > 30 && r.speedMph > 68) {
      r.airVel = Math.min(18, (slopeDrop - 24) * 0.16 * (r.speedMph / 95));
      r.airY = 2;
    }

    if (r.airY > 0 || r.airVel > 0) {
      r.airY += r.airVel;
      r.airVel -= 0.78;
      if (r.airY <= 0) {
        const hardImpact = r.airVel < -11;
        r.airY = 0;
        r.airVel = 0;
        if (r.isPlayer) {
          this.audio.playSfx('bounce', { volume: hardImpact ? 0.85 : 0.62 });
        }
        if (hardImpact && Math.abs(r.lean) > 0.82) {
          this.triggerCrash(r, r.speedMph * 0.65, r.lean > 0 ? 1 : -1, 'BAD LANDING!');
          return;
        }
      }
    }

    // 5. Roadside Buildings, Cliffs & Pacific Highway Drop-Offs
    const wallLeft = -(smp.left + smp.shL);
    const wallRight = smp.right + smp.shR;
    const prevSmp = this.sampleInfoAt(r.sample - 1);
    const exposedCornerL = smp.hasWallL && !prevSmp.hasWallL;
    const exposedCornerR = smp.hasWallR && !prevSmp.hasWallR;

    if (smp.hasWallL && r.lat < wallLeft + 18) {
      if ((exposedCornerL && r.speedMph > 45) || (r.speedMph > 52 && Math.abs(r.latVel + (r.shoveVel || 0)) >= 9.0)) {
        this.triggerCrash(r, r.speedMph * 0.78, 1, 'HIT WALL!');
        return;
      }
      r.lat = wallLeft + 22;
      r.latVel = Math.max(3.5, Math.abs(r.latVel) * 0.55);
      r.shoveVel = 0;
      r.speedMph *= 0.88;
      r.hitSparkTimer = 5;
      r.lastHitSide = -1;
      if (r.isPlayer && this.ticks % 10 === 0) this.audio.playSfx('crashlit', { volume: 0.48 });
    } else if (smp.hasWallR && r.lat > wallRight - 18) {
      if ((exposedCornerR && r.speedMph > 45) || (r.speedMph > 52 && Math.abs(r.latVel + (r.shoveVel || 0)) >= 9.0)) {
        this.triggerCrash(r, r.speedMph * 0.78, -1, 'HIT WALL!');
        return;
      }
      r.lat = wallRight - 22;
      r.latVel = -Math.max(3.5, Math.abs(r.latVel) * 0.55);
      r.shoveVel = 0;
      r.speedMph *= 0.88;
      r.hitSparkTimer = 5;
      r.lastHitSide = 1;
      if (r.isPlayer && this.ticks % 10 === 0) this.audio.playSfx('crashlit', { volume: 0.48 });
    }

    if (smp.coastalDropL && r.lat < wallLeft - 120) {
      this.triggerCrash(r, 48, 1, 'OVER THE CLIFF!');
      return;
    }

    const maxExcursion = Math.max(smp.left, smp.right) + 380;
    r.lat = Math.max(-maxExcursion, Math.min(maxExcursion, r.lat));

    if (this.checkWorldHazards(r)) return;
    this.stepAttackAndAnim(r);

    if (!r.finished && r.sample >= this.finishSample) {
      r.finished = true;
      r.finishTick = this.ticks;
    }
  }

  // ==================== OG MELEE COMBAT, WEAPON SNATCH & BOOT KICK SHOVE ====================

  startAttack(r, type, side) {
    r.attackType = type;
    r.attackSide = side < 0 ? -1 : 1;
    r.attackPhase = 'windup';
    r.attackTimer = 0;
    r.hitDone = false;

    if (r.isPlayer) {
      const sfx = r.weapon === 2 ? 'swishcha' : 'swishgen';
      this.audio.playSfx(sfx, { volume: 0.74 });
    }
  }

  stepAttackAndAnim(r) {
    if (r.staggerTimer > 0) {
      r.staggerTimer -= 1;
      r.animId = 5;
      r.animStep = r.staggerTimer > 8 ? 0 : 1;
      r.forceMirror = r.lastHitSide < 0;
      return;
    }

    if (r.attackPhase !== 'idle') {
      r.attackTimer += 1;
      const isKick = r.attackType === 'kick';
      const isWeapon = r.attackType === 'weapon' && r.weapon > 0;

      if (isKick) {
        r.animId = r.attackSide > 0 ? 26 : 27;
        r.forceMirror = null;
      } else if (isWeapon) {
        r.animId = r.weapon === 1 ? (r.attackSide > 0 ? 10 : 12) : r.attackSide > 0 ? 16 : 18;
        r.forceMirror = null;
      } else {
        r.animId = r.attackSide > 0 ? 22 : 24;
        r.forceMirror = r.attackSide < 0;
      }

      const seq = this.assets.bikersMeta?.riderAnims?.[r.animId] || [{ dur: 8 }, { dur: 8 }];
      const totalTicks = Math.max(10, seq.length * 4);
      r.animStep = Math.min(seq.length - 1, Math.floor((r.attackTimer / totalTicks) * seq.length));

      const strikeTick = Math.max(4, Math.floor(totalTicks * 0.48));
      if (r.attackTimer >= strikeTick && !r.hitDone) {
        r.attackPhase = 'strike';
        r.hitDone = true;
        this.resolveCombatHit(r);
      }

      if (r.attackTimer >= totalTicks) {
        r.attackPhase = 'idle';
        r.attackType = null;
        r.forceMirror = null;
      }
      return;
    }

    r.forceMirror = null;
    if (r.airY > 14) {
      r.animId = 4;
      r.animStep = 0;
    } else if (r.nitroTicks > 0 || r.speedMph > r.stats.topMph * 0.92) {
      r.animId = 3;
      r.animStep = 0;
    } else {
      r.animId = 2;
      r.animStep = 0;
    }
  }

  findAdjacentTarget(attacker) {
    let best = null;
    let bestDist = 999;
    for (const other of this.riders) {
      if (other === attacker || other.state !== 'riding' || other.finished) continue;
      const ds = Math.abs(other.sample - attacker.sample);
      const dLat = Math.abs(other.lat - attacker.lat);
      if (ds < 1.65 && dLat < 185) {
        const d = ds * 65 + dLat;
        if (d < bestDist) {
          bestDist = d;
          best = other;
        }
      }
    }
    return best;
  }

  resolveCombatHit(attacker) {
    const reachLat = attacker.attackType === 'weapon' && attacker.weapon > 0 ? 205 : 178;

    // 1. Check rival / player bikers
    for (const victim of this.riders) {
      if (victim === attacker || victim.state !== 'riding' || victim.finished) continue;
      if (victim.isPlayer && victim.staggerTimer > 6) continue;
      const ds = Math.abs(victim.sample - attacker.sample);
      const relLat = victim.lat - attacker.lat;
      if (ds > 1.7) continue;
      if (attacker.attackSide > 0 && (relLat < -28 || relLat > reachLat)) continue;
      if (attacker.attackSide < 0 && (relLat > 28 || relLat < -reachLat)) continue;

      // TIMED WEAPON SNATCH: Bare-knuckle punch while armed rival is swinging steals their weapon!
      if (
        attacker.attackType === 'punch' &&
        attacker.weapon === 0 &&
        victim.weapon > 0 &&
        victim.attackPhase !== 'idle'
      ) {
        const stolenName = victim.weapon === 2 ? 'CHAIN' : 'CLUB';
        attacker.weapon = victim.weapon;
        victim.weapon = 0;
        victim.attackPhase = 'idle';
        if (attacker.isPlayer || victim.isPlayer) {
          this.audio.playSfx(attacker.female ? 'f_yeah' : 'm_yeah', { volume: 0.9 });
          this.showBanner(
            attacker.isPlayer ? `SNATCHED ${stolenName}!` : `${attacker.name.toUpperCase()} STOLE YOUR ${stolenName}!`,
            '#ffcf40',
            80
          );
        }
      }

      let dmg = 18;
      let latShove = attacker.attackSide * 4.8;
      let hitSfx = 'punchhea';

      if (attacker.attackType === 'kick') {
        dmg = 22;
        // MASSIVE LATERAL SHOVE: kicks launch rival bikes sideways across lanes into oncoming cars & walls!
        latShove = attacker.attackSide * 21.0;
        hitSfx = 'kick_mw4';
      } else if (attacker.attackType === 'weapon' && attacker.weapon === 1) {
        dmg = 36;
        latShove = attacker.attackSide * 7.8;
        hitSfx = 'clubimpa';
      } else if (attacker.attackType === 'weapon' && attacker.weapon === 2) {
        dmg = 40;
        latShove = attacker.attackSide * 7.2;
        hitSfx = 'chainimp';
      }

      if (victim.isPlayer) {
        dmg = Math.round(dmg * 0.48);
        latShove *= 0.65;
      }

      victim.stamina = Math.max(0, victim.stamina - dmg);
      victim.shoveVel = (victim.shoveVel || 0) + latShove;
      victim.lean = Math.max(-1, Math.min(1, victim.lean + attacker.attackSide * 0.48));
      victim.staggerTimer = attacker.attackType === 'kick' ? 22 : 16;
      victim.hitSparkTimer = 10;
      victim.lastHitSide = -attacker.attackSide;

      if (attacker.isPlayer || victim.isPlayer) {
        this.audio.playSfx(hitSfx, { volume: 0.9 });
        this.playGrunt(victim.female);
        const rival = attacker.isPlayer ? victim : attacker;
        this.focusedRival = rival;
        this.focusedTimer = 260;
      }

      if (victim.stamina <= 0) {
        if (attacker.isPlayer) {
          this.audio.playSfx(attacker.female ? 'f_yeah' : 'm_yeah', { volume: 0.9 });
          this.showBanner(`KO'D ${victim.name.toUpperCase()}!`, '#66ff66', 80);
        }
        this.triggerCrash(victim, Math.max(40, victim.speedMph * 0.72), attacker.attackSide, 'KNOCKED OUT!');
      }
      return;
    }

    // 2. Check Motorcycle Police Officer!
    for (const cop of this.cops) {
      if (!cop.active) continue;
      const ds = Math.abs(cop.sample - attacker.sample);
      const relLat = cop.lat - attacker.lat;
      if (ds <= 1.7 && Math.abs(relLat) <= reachLat && Math.sign(relLat || attacker.attackSide) === attacker.attackSide) {
        const dmg = attacker.attackType === 'weapon' && attacker.weapon > 0 ? 38 : 22;
        cop.stamina -= dmg;
        cop.latVel += attacker.attackSide * (attacker.attackType === 'kick' ? 19.0 : 6.0);
        this.audio.playSfx(attacker.attackType === 'kick' ? 'kick_mw4' : 'clubimpa', { volume: 0.9 });
        if (cop.stamina <= 0) {
          cop.active = false;
          cop.chasing = false;
          this.audio.playSfx('crashhar', { volume: 0.9 });
          if (attacker.isPlayer) this.showBanner(`WRECKED OFFICER ${cop.name.toUpperCase()}!`, '#66ff66', 90);
        }
        return;
      }
    }
  }

  // ==================== TRAFFIC, PEDESTRIANS, FALLEN RIDERS & DOWNED-BIKE RAMPS ====================

  checkWorldHazards(r) {
    // 1. Traffic Cars / Trucks / Taxis
    for (const car of this.traffic) {
      if (!car.active) continue;
      const ds = Math.abs(car.sample - r.sample);
      const dLat = Math.abs(car.lat - r.lat);
      if (ds < 1.18 && dLat < 94 && r.airY < 32) {
        const closingMph = car.dir < 0 ? r.speedMph + car.mph : Math.abs(r.speedMph - car.mph);
        if (closingMph > 30) {
          if (r.isPlayer) {
            this.audio.playSfx('crashhar', { volume: 0.92 });
          }
          this.triggerCrash(r, closingMph * 0.85, r.lat < car.lat ? -1 : 1, 'SMASHED TRAFFIC!');
          return true;
        }
        r.speedMph = Math.min(r.speedMph, car.mph * 0.82);
        r.latVel += r.lat < car.lat ? -8.5 : 8.5;
        if (r.isPlayer) this.audio.playSfx('crashlit', { volume: 0.65 });
      } else if (r.isPlayer && ds < 4.8 && dLat < 130 && car.dir < 0 && car.hornCooldown <= 0) {
        car.hornCooldown = 140;
        this.audio.playSfx('bmwlong', { volume: 0.56 });
      }
    }

    // 2. Hittable Jaywalking & Shoulder Pedestrians!
    const pedsMeta = this.assets.worldMeta?.pedestrians || [];
    for (const ped of this.pedestrians) {
      if (!ped.active || ped.state !== 'walk') continue;
      const ds = Math.abs(ped.sample - r.sample);
      const dLat = Math.abs(ped.lat - r.lat);
      if (ds < 0.95 && dLat < 64 && r.airY < 26) {
        ped.state = 'hit';
        ped.airVel = 10.0 + r.speedMph * 0.055;
        ped.airY = 4;
        ped.vx = (ped.lat >= r.lat ? 1 : -1) * 5.6;
        r.speedMph *= 0.91;
        r.latVel += (r.lat < ped.lat ? -1 : 1) * 3.0;
        r.staggerTimer = 8;

        if (r.isPlayer) {
          this.audio.playSfx('punchhea', { volume: 0.78 });
          const pDesc = pedsMeta[ped.type % Math.max(1, pedsMeta.length)];
          const voiceId = pDesc?.voices?.[0];
          if (voiceId !== undefined && voiceId >= 0) {
            this.audio.playPedVoice(voiceId, Math.max(-1, Math.min(1, (ped.lat - r.lat) / 250)));
          } else {
            this.audio.playSfx(ped.type % 2 === 0 ? 'af1_eek' : 'jm_aiie', { volume: 0.85 });
          }
        }
      }
    }

    // 3. Hittable Sprinting Crashed Riders running on foot back to their bikes!
    for (const other of this.riders) {
      if (other === r || other.state !== 'running') continue;
      const ds = Math.abs(other.sample - r.sample);
      const dLat = Math.abs(other.lat - r.lat);
      if (ds < 0.95 && dLat < 60 && r.airY < 26) {
        other.state = 'crashing';
        other.stateTimer = 46;
        other.airVel = 9.2;
        other.airY = 5;
        other.speedMph = r.speedMph * 0.36;
        r.speedMph *= 0.92;
        if (r.isPlayer || other.isPlayer) {
          this.audio.playSfx('punchhea', { volume: 0.82 });
          this.playGrunt(other.female);
          if (r.isPlayer) this.showBanner(`CLIPPED ${other.name.toUpperCase()}!`, '#ffcf40', 60);
        }
      }
    }

    // 4. Downed Motorcycles Lying on Pavement -> PHYSICAL STUNT LAUNCH RAMPS!
    for (const db of this.downedBikes) {
      if (!db.active || db.ownerId === r.id) continue;
      const ds = Math.abs(db.sample - r.sample);
      const dLat = Math.abs(db.lat - r.lat);
      if (ds < 0.98 && dLat < 68 && r.airY < 14) {
        if (Math.abs(r.lean) < 0.68 && r.speedMph > 22) {
          r.airVel = 14.0 + r.speedMph * 0.088;
          r.airY = 8;
          db.spinStep = (db.spinStep + 3) % 8;
          if (r.isPlayer) {
            this.audio.playSfx('bounce', { volume: 0.92 });
            this.showBanner('BIKE RAMP JUMP!', '#66e6ff', 58);
          }
        } else {
          this.triggerCrash(r, r.speedMph * 0.72, r.lean >= 0 ? 1 : -1, 'PILED UP!');
          return true;
        }
      }
    }

    return false;
  }

  // ==================== CRASH, DETACHED BIKE SLIDE & ON-FOOT SPRINT ====================

  triggerCrash(r, severityMph, sideDir, reason = '') {
    if (r.state !== 'riding') return;

    const bikeDmg = Math.max(12, Math.floor(severityMph * 0.28));
    r.bikeCond = Math.max(0, r.bikeCond - bikeDmg);
    r.attackPhase = 'idle';
    r.forceMirror = null;

    if (r.isPlayer) {
      const crashSfx = severityMph > 95 ? 'crashhar' : severityMph > 55 ? 'crashmed' : 'crashlit';
      this.audio.playSfx(crashSfx, { volume: 0.92 });
      this.audio.playSfx('ridersli', { volume: 0.72 });
      this.playGrunt(r.female);
      if (reason) this.showBanner(reason, '#ff6432', 80);
    }

    const db = {
      active: true,
      ownerId: r.id,
      colorIdx: r.colorIdx,
      sample: r.sample + 0.55,
      lat: r.lat - sideDir * 28,
      mph: Math.min(105, r.speedMph * 0.86),
      latVel: -sideDir * 4.2,
      spinStep: 0
    };
    this.downedBikes.push(db);
    r.downedBikeRef = db;

    r.state = 'crashing';
    r.stateTimer = 58;
    r.airVel = Math.min(14, 5.5 + severityMph * 0.065);
    r.airY = 4;
    r.latVel = sideDir * 6.5;
    r.speedMph = Math.min(92, r.speedMph * 0.74);
    r.animId = 0;
  }

  stepNonRidingState(r) {
    const smp = this.sampleInfoAt(r.sample);

    if (r.state === 'crashing') {
      r.stateTimer -= 1;
      r.sample += r.speedMph * 0.0014;
      r.speedMph *= 0.92;
      r.lat += r.latVel;
      r.latVel *= 0.90;
      r.lat = Math.max(-(smp.left + 140), Math.min(smp.right + 140, r.lat));

      if (r.airY > 0 || r.airVel > 0) {
        r.airY += r.airVel;
        r.airVel -= 0.82;
        if (r.airY <= 0) {
          r.airY = 0;
          r.airVel = Math.abs(r.airVel) > 4 ? Math.abs(r.airVel) * 0.35 : 0;
        }
      }

      if (r.stateTimer <= 0 && r.speedMph < 5) {
        if (r.bikeCond <= 0) {
          r.state = 'wrecked';
          if (!r.isPlayer && r.downedBikeRef) r.downedBikeRef.active = false;
          return;
        }
        if (r.isPlayer) {
          for (const cop of this.cops) {
            if (cop.active && Math.abs(cop.sample - r.sample) < 10) {
              r.state = 'busted';
              this.audio.playSfx('sirenfst', { volume: 0.88 });
              return;
            }
          }
        }
        r.state = 'running';
        r.animId = 38;
        r.animStep = 0;
      }
      return;
    }

    if (r.state === 'running') {
      const db = r.downedBikeRef;
      if (!db || !db.active) {
        r.state = 'riding';
        r.speedMph = 20;
        r.stamina = Math.max(50, r.stamina);
        return;
      }

      const dSample = db.sample - r.sample;
      const dLat = db.lat - r.lat;
      r.runCompass = Math.atan2(dLat * 0.01, dSample);

      r.animId = 38;
      r.animTick += 1;
      if (r.animTick >= 5) {
        r.animTick = 0;
        r.animStep = (r.animStep + 1) % 6;
        if (r.isPlayer && r.animStep % 3 === 0) {
          this.audio.playSfx('footstep', { volume: 0.45 });
        }
      }

      r.sample += Math.sign(dSample) * Math.min(Math.abs(dSample), 0.088);
      r.lat += Math.sign(dLat) * Math.min(Math.abs(dLat), 6.2);

      if (Math.abs(dSample) < 0.4 && Math.abs(dLat) < 28) {
        db.active = false;
        r.downedBikeRef = null;
        r.state = 'riding';
        r.speedMph = 22;
        r.lean = 0;
        r.latVel = 0;
        r.stamina = Math.max(60, r.stamina);
        const remountSmp = this.sampleInfoAt(r.sample);
        r.lat = Math.max(-(remountSmp.left - 28), Math.min(remountSmp.right - 28, r.lat));
      }
    }
  }

  stepDownedBikes() {
    for (const db of this.downedBikes) {
      if (!db.active) continue;
      if (db.mph > 0.5) {
        const smp = this.sampleInfoAt(db.sample);
        db.sample += db.mph * 0.00145;
        db.mph *= 0.935;
        db.lat += db.latVel;
        db.latVel *= 0.90;
        db.lat = Math.max(-(smp.left + 85), Math.min(smp.right + 85, db.lat));
        if (this.ticks % 4 === 0) db.spinStep = (db.spinStep + 1) % 8;
      }
    }
  }

  stepTraffic() {
    for (const car of this.traffic) {
      if (!car.active) continue;
      if (car.hornCooldown > 0) car.hornCooldown -= 1;

      car.sample += car.dir * car.mph * 0.00145;
      const smp = this.sampleInfoAt(car.sample);
      const targetMag = Math.max(110, (car.dir < 0 ? smp.left : smp.right) * 0.52);
      const desiredLat = car.dir < 0 ? -targetMag : targetMag;
      car.lat += (desiredLat - car.lat) * 0.14;

      if (car.sample < this.startSample + 8) {
        car.sample = Math.min(this.finishSample - 12, this.player.sample + 54);
      } else if (car.sample > this.finishSample - 6) {
        car.sample = Math.max(this.startSample + 14, this.player.sample - 22);
      }
    }
  }

  stepPedestrians() {
    for (const ped of this.pedestrians) {
      if (!ped.active) continue;
      if (ped.state === 'hit') {
        ped.airY += ped.airVel;
        ped.airVel -= 0.72;
        ped.lat += ped.vx;
        ped.spinAngle += 0.36;
        if (ped.airY <= 0) ped.active = false;
        continue;
      }

      if (ped.moving) {
        ped.lat += ped.vx;
        if (Math.abs(ped.lat) > ped.edgeLimit) ped.vx = -ped.vx;
        ped.animTick += 1;
        if (ped.animTick >= 6) {
          ped.animTick = 0;
          ped.animStep = (ped.animStep + 1) % 6;
        }
      }
    }
  }

  stepRiderToRiderCollisions() {
    const n = this.riders.length;
    for (let i = 0; i < n; i++) {
      const a = this.riders[i];
      if (a.state !== 'riding') continue;
      for (let j = i + 1; j < n; j++) {
        const b = this.riders[j];
        if (b.state !== 'riding') continue;
        const ds = Math.abs(a.sample - b.sample);
        const dLat = a.lat - b.lat;
        if (ds < 0.75 && Math.abs(dLat) < 56) {
          const push = dLat >= 0 ? 3.6 : -3.6;
          a.lat += push;
          b.lat -= push;
          a.latVel += push * 0.55;
          b.latVel -= push * 0.55;
          if ((a.isPlayer || b.isPlayer) && this.ticks % 12 === 0) {
            this.audio.playSfx('crashlit', { volume: 0.38 });
          }
        }
      }
    }
  }

  stepPolice() {
    const p = this.player;
    this.activeCop = null;

    for (const cop of this.cops) {
      if (!cop.active && Math.abs(p.sample - cop.spawnSample) < 9 && !cop.chasing && cop.stamina > 0) {
        cop.active = true;
        cop.chasing = true;
        cop.sample = Math.max(this.startSample + 5, p.sample - 4.5);
        cop.lat = p.lat + (p.lat > 0 ? -135 : 135);
        cop.mph = Math.max(60, p.speedMph * 0.95);
        this.showBanner(`POLICE PURSUIT: OFFICER ${cop.name.toUpperCase()}!`, '#ff5555', 80);
      }

      if (!cop.active) continue;
      this.activeCop = cop;

      const targetMph = p.state === 'riding' ? Math.min(186, p.stats.topMph * 1.04) : 34;
      cop.mph += (targetMph - cop.mph) * 0.055;
      const ds = cop.mph * 0.001526;
      cop.sample += ds;

      const smp = this.sampleInfoAt(cop.sample);
      const desiredLat = p.lat + (cop.lat >= p.lat ? 62 : -62);
      const latErr = desiredLat - cop.lat;
      cop.lean = Math.max(-1, Math.min(1, latErr * 0.02));
      cop.latVel = cop.latVel * 0.78 + Math.max(-6.8, Math.min(6.8, latErr * 0.14));
      cop.lat += cop.latVel - smp.bend * ds * 0.58;
      cop.lat = Math.max(-(smp.left - 24), Math.min(smp.right - 24, cop.lat));

      if (cop.attackCooldown > 0) cop.attackCooldown -= 1;
      if (
        p.state === 'riding' &&
        cop.attackCooldown <= 0 &&
        Math.abs(cop.sample - p.sample) < 1.4 &&
        Math.abs(cop.lat - p.lat) < 135
      ) {
        cop.attackCooldown = 54;
        const pushDir = p.lat >= cop.lat ? 1 : -1;
        p.stamina = Math.max(0, p.stamina - 22);
        p.latVel += pushDir * 11.5;
        p.staggerTimer = 14;
        p.hitSparkTimer = 10;
        this.audio.playSfx('clubimpa', { volume: 0.9 });
        this.playGrunt(p.female);

        if (p.stamina <= 0) {
          this.triggerCrash(p, p.speedMph * 0.7, pushDir, 'BUSTED BY POLICE!');
          p.state = 'busted';
        }
      }

      if (p.sample - cop.sample > 56) {
        cop.active = false;
        cop.chasing = false;
        this.showBanner('OUTRAN THE COPS!', '#66ff66', 65);
      }
    }
  }

  updateStandings() {
    const sorted = [...this.riders].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTick - b.finishTick;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.sample - a.sample;
    });
    sorted.forEach((r, idx) => {
      r.place = idx + 1;
    });
    this.playerPlace = this.player.place;

    // Nearest rival for right-side Cockpit HUD Stamina & Gap readout
    if (this.focusedRival && this.focusedRival.state === 'riding') {
      this.nearestRival = this.focusedRival;
    } else {
      let best = null;
      let bestD = Infinity;
      for (const r of this.riders) {
        if (r.isPlayer) continue;
        const d = Math.abs(r.sample - this.player.sample);
        if (d < bestD) {
          bestD = d;
          best = r;
        }
      }
      this.nearestRival = best;
    }
  }

  updateCameraAndAudio(prevPlayerSample) {
    const p = this.player;
    const smp = this.sampleInfoAt(p.sample);

    this.cameraSample = Math.max(1, p.sample - 1.55);
    this.cameraLat += (p.lat * 0.84 - this.cameraLat) * 0.24;
    this.cameraHeightOffset += (p.airY * 0.55 - this.cameraHeightOffset) * 0.25;

    const dSample = p.sample - prevPlayerSample;
    if (Math.abs(dSample) < 2.0) {
      this.headingAccum += smp.bend * dSample;
    }

    // Spatial audio distances & stereo pans for AudioEngine.updateRaceLoops!
    let rivalDist = Infinity;
    let rivalPan = 0;
    for (const r of this.riders) {
      if (r.isPlayer || r.state !== 'riding') continue;
      const dWorld = Math.hypot((r.sample - p.sample) * 256, r.lat - p.lat);
      if (dWorld < rivalDist) {
        rivalDist = dWorld;
        rivalPan = Math.max(-1, Math.min(1, (r.lat - p.lat) / 400));
      }
    }

    let carDist = Infinity;
    let carPan = 0;
    let carRelSpeed = 0;
    for (const car of this.traffic) {
      if (!car.active) continue;
      const dWorld = Math.hypot((car.sample - p.sample) * 256, car.lat - p.lat);
      if (dWorld < carDist) {
        carDist = dWorld;
        carPan = Math.max(-1, Math.min(1, (car.lat - p.lat) / 450));
        carRelSpeed = car.dir < 0 ? p.speedMph + car.mph : p.speedMph - car.mph;
      }
    }

    let copDist = Infinity;
    let copPan = 0;
    let copChasing = false;
    if (this.activeCop && this.activeCop.active) {
      copDist = Math.hypot((this.activeCop.sample - p.sample) * 256, this.activeCop.lat - p.lat);
      copPan = Math.max(-1, Math.min(1, (this.activeCop.lat - p.lat) / 400));
      copChasing = this.activeCop.chasing;
    }

    this.audio.updateRaceLoops({
      bikeId: p.bikeId,
      rpmNorm: p.state === 'riding' ? p.rpmNorm : 0.14,
      speedMph: p.speedMph,
      inTunnel: smp.tunnel,
      nitroActive: p.nitroTicks > 0,
      skidding: p.skidding,
      offRoad: p.offRoad,
      rivalDist,
      rivalPan,
      carDist,
      carPan,
      carRelSpeed,
      copDist,
      copPan,
      copChasing
    });
  }

  checkEndConditions() {
    const p = this.player;
    if (p.state === 'wrecked') {
      this.finishRaceWithStatus('wrecked');
    } else if (p.state === 'busted') {
      this.finishRaceWithStatus('busted');
    } else if (p.finished) {
      this.finishRaceWithStatus('finished');
    }
  }

  formatRaceTime(ticks) {
    const totalTenths = Math.max(1, Math.floor((ticks * 10) / 60));
    const mins = Math.floor(totalTenths / 600);
    const secs = Math.floor((totalTenths % 600) / 10);
    const tenths = totalTenths % 10;
    return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`;
  }

  finishRaceWithStatus(status) {
    if (this.completed) return;
    this.completed = true;
    this.audio.stopAllRaceLoops();

    const standings = [...this.riders]
      .sort((a, b) => a.place - b.place)
      .map((r) => {
        let estTicks = r.finishTick;
        if (!estTicks) {
          const rem = Math.max(1, this.finishSample - r.sample);
          const avgDs = Math.max(0.08, r.stats.topMph * 0.78 * 0.001526);
          estTicks = this.ticks + Math.floor(rem / avgDs);
        }
        return {
          name: r.name,
          isPlayer: r.isPlayer,
          place: r.place,
          timeStr:
            r.state === 'wrecked'
              ? 'WRECKED'
              : r.state === 'busted'
                ? 'BUSTED'
                : this.formatRaceTime(estTicks)
        };
      });

    setTimeout(() => {
      this.onRaceComplete({
        status,
        place: this.player.place,
        playerName: this.player.name,
        courseId: this.config.courseId,
        standings
      });
    }, 900);
  }
}
