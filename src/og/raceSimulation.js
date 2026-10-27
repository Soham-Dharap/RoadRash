// Authentic 1996 Road Rash 60Hz Race Simulation Engine
// Exact ROADRASH.EXE speed-to-sample scale (0.1526 samples/tick at 100 MPH, 33 samples = 0.1 mi),
// exact race.cpp centrifugal curve sweep, grounded hill crests & fixed camera height (no fake jumps!),
// 6-speed gearbox & RPM needle, ALL OG weapons unlocked (Fists, Club, Chain, Police Baton + Boot Kick),
// lateral boot-kick shoves into traffic/walls, grounded pedestrian knockdowns & HIBOB crash animations,
// exact race.cpp iclass==0 downed-bike ride-over, Special Police Interceptor Mode, and Nitro on ALL bikes!

export const OG_WEAPONS = [
  { id: 0, key: 'FISTS', name: 'Bare Fists', label: 'Bare Fists (Snatch)', reach: 178, dmg: 20, shove: 5.0, sfx: 'punchhea', swish: 'swishgen' },
  { id: 1, key: 'CLUB', name: 'Wooden Club', label: 'Wooden Club', reach: 202, dmg: 38, shove: 8.6, sfx: 'clubimpa', swish: 'swishgen' },
  { id: 2, key: 'CHAIN', name: 'Steel Chain', label: 'Steel Chain', reach: 222, dmg: 44, shove: 8.2, sfx: 'chainimp', swish: 'swishcha' },
  { id: 3, key: 'BATON', name: 'Police Nightstick', label: 'Police Nightstick', reach: 212, dmg: 48, shove: 13.5, sfx: 'clubimpa', swish: 'swishgen' }
];

// Exact ROADRASH.EXE attack_codes[right ? 1 : 0][backhand ? 1 : 0][weaponSlot]
const ATTACK_CODES = [
  [
    [22, 16, 10, 26], // Left forehand:  Fists=22, Club/Baton=16, Chain=10, Kick=26
    [24, 18, 12, 26]  // Left backhand:  Fists=24, Club/Baton=18, Chain=12, Kick=26
  ],
  [
    [23, 17, 11, 27], // Right forehand: Fists=23, Club/Baton=17, Chain=11, Kick=27
    [25, 19, 13, 27]  // Right backhand: Fists=25, Club/Baton=19, Chain=13, Kick=27
  ]
];

const RIVAL_ROSTER = [
  { name: 'Biff', aggr: 0.86, weapon: 1, bikeId: 3, female: false },
  { name: 'Ikira', aggr: 0.72, weapon: 2, bikeId: 12, female: false },
  { name: 'Lola', aggr: 0.68, weapon: 2, bikeId: 14, female: true },
  { name: 'Natasha', aggr: 0.80, weapon: 2, bikeId: 7, female: true },
  { name: 'Slater', aggr: 0.90, weapon: 1, bikeId: 4, female: false },
  { name: 'Torque', aggr: 0.82, weapon: 1, bikeId: 11, female: false },
  { name: 'Viper', aggr: 0.93, weapon: 2, bikeId: 8, female: false },
  { name: 'Helga', aggr: 0.76, weapon: 1, bikeId: 10, female: true },
  { name: 'Chino', aggr: 0.74, weapon: 1, bikeId: 2, female: false },
  { name: 'Cannon', aggr: 0.66, weapon: 2, bikeId: 0, female: false },
  { name: 'Sven', aggr: 0.78, weapon: 1, bikeId: 6, female: false },
  { name: 'Roxy', aggr: 0.71, weapon: 2, bikeId: 13, female: true },
  { name: 'Spike', aggr: 0.88, weapon: 2, bikeId: 5, female: false },
  { name: 'Mugsy', aggr: 0.64, weapon: 1, bikeId: 1, female: false }
];

const COP_NAMES = ["O'Connor", 'Kowalski', 'Vance', 'Roscoe'];

// Exact ROADRASH.EXE (0x0046dce4) surface drag & grip tables:
// [0]=asphalt, [1]=paved/curb shoulder, [2]=dirt/grass shoulder, [3]=rough off-road
const SURFACE_DRAG = [0, 2, 20, 30];
const SURFACE_GRIP = [1.0, 0.94, 0.56, 0.44];

// Exact ROADRASH.EXE (0x00464558) AI rival speed bands (MPH) across Levels 1..5
const AI_LEVEL_MPH_RANGE = [
  [87, 105],  // Level 1 (Rat tier)
  [105, 121], // Level 2
  [122, 140], // Level 3 (Sport tier)
  [142, 159], // Level 4
  [158, 176]  // Level 5 (Super tier)
];
const COP_LEVEL_MPH = [122, 132, 142, 160, 175];

function mphFromVel(v) {
  if (v <= 0) return 0;
  return (v * 41) / 4096;
}

export class RaceSimulation {
  constructor(assets, audio, courseRenderer, config, onRaceComplete) {
    this.assets = assets;
    this.audio = audio;
    this.courseRenderer = courseRenderer;
    this.config = config;
    this.course = courseRenderer.course;
    this.onRaceComplete = onRaceComplete;

    this.isPoliceMode = config.mode === 'copchase';
    this.bustedCount = 0;
    this.totalOutlaws = 14;
    this.outlawsRemaining = 14;
    this.leadOutlaw = null;
    this.escapedOutlawName = '';

    this.ticks = 0;
    this.countdownTicks = 180; // 3.0s 3-2-1-GO! (lifecycle.hpp: 3 * 60)
    this.goBannerTicks = 0;
    this.paused = false;
    this.pauseFocus = 0;
    this.completed = false;

    const totalSamples = this.course.samples.length;
    this.startSample = this.course.startSample || 50;
    // In Police Pursuit Mode, give at least Level-3+ distance so Officer can intercept all 14 racers!
    const effFinishLevel = this.isPoliceMode ? Math.max(2, config.level || 0) : config.level || 0;
    this.finishSample =
      this.course.finishSamples?.[effFinishLevel] || Math.max(240, totalSamples - 50);

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

    // Camera state for road.cpp::project_road (exact race.cpp:4125-4150 close chase + finish/bust crane pull-back)
    this.cameraSample = Math.max(1, this.startSample - 1.36);
    this.cameraLat = 0;
    this.cameraHeightOffset = 0;
    this.cameraBackExtra = 0;
    this.headingAccum = 0;
    this.prevCameraSample = this.cameraSample;
    this.prevCameraLat = 0;
    this.prevCameraHeightOffset = 0;
    this.prevHeadingAccum = 0;

    this.initRiders();
    this.initTraffic();
    this.initPedestrians();
    this.initPolice();
  }

  // Exact DATA/BIKESPEC.RSC + bike.cpp::apply_spec decoding for all 15 OG motorcycles!
  bikeStats(bikeId, isPlayer = false) {
    const bikes = this.assets.frontend?.bikes;
    const specId = isPlayer && this.isPoliceMode ? 7 : Math.max(0, Math.min(14, bikeId || 0));
    const d = bikes?.[specId] || bikes?.[0] || [];
    const cls = specId < 5 ? 'rat' : specId < 10 ? 'super' : 'sport';

    const mass = d[6] || 196;
    const riderVal = 75;
    const weight = mass + 75 + Math.trunc((riderVal - 75) / 8);
    const steerDiv = mass + Math.trunc(riderVal / 4);
    const clamp15 = (v) => {
      const x = Math.max(1, v || 10);
      return x > 14 ? 15 : x;
    };

    const throttleRaw = isPlayer && this.isPoliceMode ? 50 : (d[42] || 40);
    const brakeRaw = d[49] || -112;
    const throttleMax = Math.trunc((throttleRaw * (mass + 75) * 256) / weight);
    const brakeMax = Math.trunc((brakeRaw * (mass + 75) * 256) / weight);
    const throttleUp = Math.max(64, Math.trunc(throttleMax / clamp15(d[43] || 10)));
    const throttleDown = Math.max(32, Math.trunc(throttleMax / clamp15(d[44] || 128)));
    const brakeUp = Math.min(-64, Math.trunc(brakeMax / clamp15(d[50] || 10)));
    const brakeDown = Math.min(-64, Math.trunc(brakeMax / clamp15(d[51] || 10)));

    const turnTicks = Math.max(20, Math.trunc(((d[62] || 38) * (mass + 75)) / steerDiv));
    const returnTicks = Math.max(18, Math.trunc(((d[63] || 36) * (mass + 75)) / steerDiv));
    const latScale = d[66] || 120;
    const maxLatStep = (46 * latScale) / 256; // 21.56 world units/tick in ROADRASH.EXE!

    const gears = [];
    for (let g = 0; g < 6; g++) {
      gears.push({
        rpmRatio: d[9 + g * 4] || 4000 >> g,
        torqueRatio: d[10 + g * 4] || 240 - g * 8,
        upVel: d[11 + g * 4] || (g < 5 ? (g + 1) * 3200 : 16777215),
        downVel: d[12 + g * 4] ?? (g === 0 ? -999 : g * 2800)
      });
    }

    // Exact equilibrium top speed from integrate_speed: b114_top = (torqueRatio_top * throttleMax) >> 16
    const topTorque = Math.trunc((gears[4].torqueRatio * throttleMax) / 65536);
    const estTopVel = Math.max(9500, Math.trunc(((topTorque - 8) * 65536) / 130));
    const topMph = Math.round(mphFromVel(estTopVel));

    // User custom perk: Nitro / Speed Boost enabled on ALL 15 bikes for the player!
    // Uses exact BIKESPEC.RSC boost factor (288..384) on Superbikes, and 340 (1.33x torque) on Rat/Sport!
    const hasNitro = isPlayer ? true : (d[86] || 0) > 0;
    const nitroBoost = isPlayer && this.isPoliceMode ? 384 : Math.max(328, d[84] || 340);
    const nitroCharges = isPlayer ? 10 : hasNitro ? d[86] || 8 : 0;
    const maxBikeCond = isPlayer && this.isPoliceMode ? 320 : Math.max(100, d[81] || 160);

    return {
      cls,
      mass,
      gears,
      throttleMax,
      brakeMax,
      throttleUp,
      throttleDown,
      brakeUp,
      brakeDown,
      turnTicks,
      returnTicks,
      maxLatStep,
      hasNitro,
      nitroBoost,
      nitroCharges,
      maxNitroCharges: nitroCharges,
      topMph,
      maxBikeCond
    };
  }

  initRiders() {
    const pStats = this.bikeStats(this.config.bikeId, true);
    const requestedWeapon = this.config.weaponId ?? this.config.startWeapon;
    const defaultWeapon =
      requestedWeapon !== undefined
        ? requestedWeapon
        : this.isPoliceMode
          ? 3
          : 2;

    this.player = this.makeRider({
      id: 0,
      isPlayer: true,
      isPolice: this.isPoliceMode,
      sirenOn: this.isPoliceMode,
      name: this.isPoliceMode
        ? `Ofc. ${this.config.playerName || 'Soham'}`
        : this.config.playerName || 'Axle',
      female: Boolean(this.config.female),
      colorIdx: 0,
      bikeId: this.isPoliceMode ? 9 : this.config.bikeId,
      stats: pStats,
      sample: this.startSample,
      lat: this.isPoliceMode ? 0 : 95,
      weapon: defaultWeapon,
      unlockedWeapons: [0, 1, 2, 3],
      aggr: 0
    });
    this.riders.push(this.player);
    this.cameraLat = this.player.lat * 0.75;
    this.prevCameraLat = this.cameraLat;

    const lv = Math.max(0, Math.min(4, this.config.level || 0));
    const [minLvMph, maxLvMph] = AI_LEVEL_MPH_RANGE[lv];

    for (let i = 0; i < 14; i++) {
      const rdef = RIVAL_ROSTER[i];
      // Match rival bike class to race level just like 1996 Road Rash!
      const tierPool = lv <= 1 ? [0, 1, 2, 3, 4, 13, 14] : lv === 2 ? [10, 11, 12, 13, 14, 3] : [5, 6, 7, 8, 9, 10, 11];
      const lvlBike = tierPool[i % tierPool.length];
      const st = this.bikeStats(lvlBike, false);
      const row = Math.floor((i + 1) / 2);
      const col = (i + 1) % 2;

      if (this.isPoliceMode) {
        // Outlaws race hard toward the finish line, paced so a skilled Police Interceptor can hunt all 14!
        st.aiTargetMph = 104 + (i / 13) * 34 + lv * 5;
      } else {
        // Exact ROADRASH.EXE (0x00464558) level-based rival speeds (not fake player-speed cloning!),
        // so buying a Superbike genuinely lets you blow past slower tiers while Lv4-5 are 155-175 MPH wars!
        st.aiTargetMph = minLvMph + (i / 13) * (maxLvMph - minLvMph);
      }
      // Calibrate AI bike throttleMax if AI personality target exceeds base bike spec on Lv4-5
      const neededVel = st.aiTargetMph * 100.5;
      const neededB114 = Math.trunc((130 * (neededVel / 256)) / 256) + 12;
      const minThrottleMax = Math.trunc((neededB114 * 65536) / Math.max(180, st.gears[4].torqueRatio));
      if (minThrottleMax > st.throttleMax) {
        st.throttleMax = minThrottleMax;
        st.throttleUp = Math.max(st.throttleUp, Math.trunc(st.throttleMax / 11));
        st.topMph = Math.round(st.aiTargetMph);
      }

      this.riders.push(
        this.makeRider({
          id: i + 1,
          isPlayer: false,
          isPolice: false,
          sirenOn: false,
          name: rdef.name,
          female: rdef.female,
          colorIdx: (i % 14) + 1,
          bikeId: lvlBike,
          stats: st,
          sample: this.startSample + (this.isPoliceMode ? 2.2 + row * 1.45 : row * 1.18),
          lat: col === 0 ? -145 : 145,
          weapon: i % 2 === 0 ? rdef.weapon : 0,
          aggr: rdef.aggr,
          aiLaneTarget: (col === 0 ? -155 : 155) + ((i * 37) % 90) - 45,
          lastTouchedByPlayerTick: -9999
        })
      );
    }
  }

  makeRider(opts) {
    return {
      ...opts,
      prevSample: opts.sample,
      prevLat: opts.lat,
      prevAirY: 0,
      prevLean: 0,
      vel: 0,      // Exact bike.cpp b.i32(0xec) integer velocity (100 units ~= 1 MPH)
      b240: 0,     // Exact bike.cpp b.i32(0x240) spooled throttle/brake state
      b114: 0,     // Exact bike.cpp b.i32(0x114) longitudinal drive/brake force
      b2dc: 0x2000,// Exact bike.cpp b.i32(0x2dc) engine RPM (0x2000 idle .. 0xffff redline)
      gearIdx: 0,  // Exact bike.cpp b.i32(0x23c) 0..5 gear index
      speedMph: 0,
      latVel: 0,
      shoveVel: 0,
      lean: 0,
      gear: 1,
      rpmNorm: 0.0,
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
      maxNitroCharges: opts.stats.maxNitroCharges || opts.stats.nitroCharges,
      nitroRechargeTicks: 0,
      nitroTicks: 0,
      state: 'riding', // 'riding' | 'crashing' | 'running' | 'busted' | 'wrecked'
      stateTimer: 0,
      crashTotalTicks: 0,
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
    const courseKey = this.course.carPool || this.course.name;
    const courseCars =
      this.assets.carsMeta?.courses?.[courseKey] || this.assets.carsMeta?.courses?.CITY || [];

    // Separate DATA/CARS/*.CAR vehicle classes:
    // *G (views=9) = Going same-direction rear taillights,
    // *C (views>=16) = Coming oncoming front headlights,
    // *S (views=2) = Sideways cross-intersection vehicles!
    const goingKinds = [];
    const comingKinds = [];
    const crossKinds = [];
    courseCars.forEach((c, idx) => {
      const vLen = c.views?.[0]?.length || 0;
      if (vLen >= 16) comingKinds.push(idx);
      else if (vLen >= 9) goingKinds.push(idx);
      else if (vLen >= 2) crossKinds.push(idx);
    });
    const safeGoing = goingKinds.length ? goingKinds : [0];
    const safeComing = comingKinds.length ? comingKinds : safeGoing;

    const totalSpan = this.finishSample - (this.startSample + 22);
    const count = Math.min(36, Math.max(18, Math.floor(totalSpan / 45)));

    for (let i = 0; i < count; i++) {
      const s = this.startSample + 24 + (i + 0.5) * (totalSpan / count);
      const smp = this.sampleInfoAt(s);
      const oncoming = i % 2 === 0;
      const halfRoad = oncoming ? smp.left : smp.right;
      const laneFrac = halfRoad >= 420 ? (i % 4 < 2 ? 0.34 : 0.72) : 0.52;
      const laneMag = Math.max(112, halfRoad * laneFrac);
      const kind = oncoming
        ? safeComing[Math.floor(i / 2) % safeComing.length]
        : safeGoing[Math.floor(i / 2) % safeGoing.length];

      this.traffic.push({
        id: i,
        active: true,
        kind,
        sample: s,
        dir: oncoming ? -1 : 1,
        crossDir: 0,
        laneFrac,
        mph: oncoming ? 44 + (i % 18) : 48 + (i % 20),
        lat: oncoming ? -laneMag : laneMag,
        hornCooldown: 0
      });
    }

    // Spawn authentic cross-intersection vehicles (*S) at marked side-street crosswalks (flags & 8)
    if (crossKinds.length) {
      let lastCrossS = this.startSample + 50;
      let crossAdded = 0;
      for (let s = this.startSample + 70; s < this.finishSample - 35 && crossAdded < 8; s++) {
        const raw = this.course.samples[s];
        if (!raw || (raw[9] & 8) === 0 || raw[10] === 1) continue;
        if (s - lastCrossS < 190) continue;
        lastCrossS = s;
        const smp = this.sampleInfoAt(s);
        const crossDir = crossAdded % 2 === 0 ? 1 : -1;
        this.traffic.push({
          id: count + crossAdded,
          active: true,
          kind: crossKinds[crossAdded % crossKinds.length],
          sample: s + 0.5,
          dir: 0,
          crossDir,
          laneFrac: 0.5,
          mph: 36,
          lat: crossDir > 0 ? -(smp.left * 0.65) : smp.right * 0.65,
          hornCooldown: 0
        });
        crossAdded++;
      }
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
    if (this.isPoliceMode) return; // Player IS the Police Interceptor in Police Mode!

    const patrolCount = 2 + Math.min(2, Math.floor((this.config.level || 0) / 2));
    const span = this.finishSample - (this.startSample + 110);
    for (let i = 0; i < patrolCount; i++) {
      const spawnS = this.startSample + 120 + Math.floor(((i + 0.45) * span) / patrolCount);
      this.cops.push({
        id: i,
        name: COP_NAMES[i % COP_NAMES.length].trim(),
        active: false,
        chasing: false,
        state: 'riding',
        spawnSample: spawnS,
        sample: spawnS,
        lat: 195,
        latVel: 0,
        mph: 0,
        lean: 0,
        airY: 0,
        stamina: 115,
        animId: 2,
        animStep: 0,
        animTick: 0,
        swingTicks: 0,
        crashTimer: 0,
        hitSparkTimer: 0,
        lastHitSide: 1,
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
    if (!p || p.state !== 'riding' || this.countdownTicks > 0) return;
    if (p.nitroCharges > 0 && p.nitroTicks <= 0) {
      p.nitroCharges -= 1;
      p.nitroTicks = 140;
      this.audio.playSfx(p.female ? 'f_yeah' : 'm_yeah', { volume: 0.76 });
      this.showBanner(`NITRO BOOST! (${p.nitroCharges} LEFT)`, '#66e6ff', 65);
    }
  }

  cycleWeapon(step = 1) {
    const p = this.player;
    if (!p) return;
    const count = OG_WEAPONS.length;
    p.weapon = (((p.weapon || 0) + step) % count + count) % count;
    const w = OG_WEAPONS[p.weapon] || OG_WEAPONS[0];
    this.audio.playSfx(w.swish, { volume: 0.65, rate: 1.1 });
    this.showBanner(`EQUIPPED: ${w.label.toUpperCase()}`, '#ffcf40', 55);
  }

  selectWeapon(weaponId) {
    const p = this.player;
    if (!p || weaponId < 0 || weaponId >= OG_WEAPONS.length) return;
    p.weapon = weaponId;
    const w = OG_WEAPONS[p.weapon] || OG_WEAPONS[0];
    this.audio.playSfx(w.swish, { volume: 0.65, rate: 1.1 });
    this.showBanner(`EQUIPPED: ${w.label.toUpperCase()}`, '#ffcf40', 55);
  }

  toggleSiren() {
    const p = this.player;
    if (!p || !p.isPolice) return;
    p.sirenOn = !p.sirenOn;
    this.audio.playSfx('sirenfst', { volume: 0.6 });
    this.showBanner(p.sirenOn ? 'POLICE SIREN: ON' : 'POLICE SIREN: SILENT', '#66e6ff', 50);
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

  snapshotPrevPositions() {
    this.prevCameraSample = this.cameraSample;
    this.prevCameraLat = this.cameraLat;
    this.prevCameraHeightOffset = this.cameraHeightOffset;
    this.prevHeadingAccum = this.headingAccum;

    for (const r of this.riders) {
      r.prevSample = r.sample;
      r.prevLat = r.lat;
      r.prevAirY = r.airY || 0;
      r.prevLean = r.lean;
    }
    for (const car of this.traffic) {
      car.prevSample = car.sample;
      car.prevLat = car.lat;
    }
    for (const ped of this.pedestrians) {
      ped.prevLat = ped.lat;
    }
    for (const db of this.downedBikes) {
      db.prevSample = db.sample;
      db.prevLat = db.lat;
    }
    for (const cop of this.cops) {
      cop.prevSample = cop.sample;
      cop.prevLat = cop.lat;
    }
  }

  step(input) {
    if (this.paused || this.completed) return;

    this.snapshotPrevPositions();
    const prevPlayerSample = this.player.sample;

    if (this.countdownTicks > 0) {
      this.countdownTicks -= 1;
      if (this.countdownTicks === 120 || this.countdownTicks === 60) {
        this.audio.playSfx('swishgen', { volume: 0.55, rate: 1.05 });
      } else if (this.countdownTicks === 1) {
        this.goBannerTicks = 55;
        this.audio.playSfx(this.player.female ? 'f_yeah' : 'm_yeah', { volume: 0.85 });
      }
      const revTarget = input.gas ? 0xc800 : 0x2800;
      this.player.b2dc += Math.max(-0x1800, Math.min(0x1800, revTarget - (this.player.b2dc || 0x2000)));
      this.player.rpmNorm = Math.max(0, Math.min(1, (this.player.b2dc - 0x2000) / (0xffff - 0x2000)));
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
      r.vel = Math.round((r.speedMph * 4096) / 41);
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
      if (!car.active) continue;
      const ds = car.sample - r.sample;
      if (ds > 0 && ds < 11 && Math.abs(car.lat - targetLat) < 120) {
        targetLat = car.lat > 0 ? -160 : 165;
        break;
      }
    }

    const distToPlayer = r.sample - this.player.sample;
    if (Math.abs(distToPlayer) < 6 && this.player.state === 'riding' && r.aggr > 0.72) {
      const sideOffset = r.id % 2 === 0 ? 78 : -78;
      targetLat = this.player.lat + sideOffset;
    }

    const maxRoadL = -(smp.left - 58);
    const maxRoadR = smp.right - 58;
    targetLat = Math.max(maxRoadL, Math.min(maxRoadR, targetLat));

    // Exact feedforward lean to counteract ROADRASH.EXE centrifugal curve push (-bend * ds * 1.5625)
    const dsEst = r.speedMph * 0.001526;
    const curveFeedforward = (smp.bend * 0.65 + lookSmp.bend * 0.35) * dsEst * (1.5625 / 21.56);
    const latErr = targetLat - r.lat;
    const steer = Math.max(-1, Math.min(1, latErr * 0.011 + curveFeedforward));

    // Subtle OG rubber_band pack cohesion (+/- 6%) around authentic ROADRASH.EXE level speed!
    let speedMul = 1.0;
    if (!this.isPoliceMode) {
      if (distToPlayer > 38) speedMul = 0.94;
      else if (distToPlayer < -32) speedMul = 1.06;
    }
    const aiGoalMph = (r.stats.aiTargetMph || r.stats.topMph) * speedMul;

    const futureCentrifugal = Math.abs(lookSmp.bend) * dsEst * 1.5625;
    const cornerCaution = futureCentrifugal > 19.2;

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
        throttle: !cornerCaution && r.speedMph < aiGoalMph,
        brake: cornerCaution && r.speedMph > 55,
        steer
      },
      speedMul
    );
  }

  // Exact surface_class (bike.cpp:312-327): 0=road, 1=paved/city curb, 2=dirt shoulder, 3=rough off-road
  surfaceClassAt(smp, lat) {
    if (lat > -smp.left && lat < smp.right) return 0;
    if (smp.flags & 0x20) return 0;
    if (smp.flags & 0x18) return smp.ttype === 0 ? 1 : 2;
    if (smp.ttype === 3) return 1;
    if (lat >= smp.right) {
      if (lat >= smp.right + smp.shR) return 3;
      if (smp.ttype === 0) return 1;
      return lat <= smp.right + 48 ? 0 : 2;
    }
    if (lat <= -(smp.left + smp.shL)) return 3;
    if (smp.ttype === 0) return 1;
    return lat >= -(smp.left + 48) ? 0 : 2;
  }

  integrateMotorcyclePhysics(r, ctrl) {
    const smp = this.sampleInfoAt(r.sample);
    const st = r.stats;

    // Keep integer velocity synced if external impacts/crashes modified speedMph
    if (Math.abs(mphFromVel(r.vel || 0) - r.speedMph) > 0.35) {
      r.vel = Math.max(0, Math.round((r.speedMph * 4096) / 41));
    }

    if (r.nitroTicks > 0) r.nitroTicks -= 1;
    if (r.isPlayer && r.nitroTicks <= 0 && r.nitroCharges < r.maxNitroCharges) {
      r.nitroRechargeTicks = (r.nitroRechargeTicks || 0) + 1;
      const rechargeTarget = this.isPoliceMode ? 540 : 1080;
      if (r.nitroRechargeTicks >= rechargeTarget) {
        r.nitroRechargeTicks = 0;
        r.nitroCharges += 1;
      }
    }
    if (r.hitSparkTimer > 0) r.hitSparkTimer -= 1;
    if (r.staggerTimer <= 0 && r.stamina < r.maxStamina) {
      r.stamina = Math.min(r.maxStamina, r.stamina + (r.isPlayer ? 0.04 : 0.015));
    }

    const surf = this.surfaceClassAt(smp, r.lat);
    r.offRoad = surf >= 2;
    r.skidding = Boolean(ctrl.brake && r.speedMph > 32) || (surf >= 2 && Math.abs(r.lean) > 0.72 && r.speedMph > 65);

    // 1. Exact bike.cpp drive_mode + throttle/brake spooling + race.cpp:3355 post-gear Nitro boost!
    let b240 = r.b240 || 0;
    let b114 = 0;
    const gearIdx = Math.max(0, Math.min(5, r.gearIdx || 0));
    const gears = st.gears;

    if (ctrl.brake && r.airY <= 1) {
      if ((r.vel || 0) <= 0) {
        b240 = 0;
      } else {
        const limit = st.brakeMax; // negative
        if (b240 > limit) {
          b240 = Math.max(limit, b240 + st.brakeDown);
        }
      }
      b114 = b240 >> 8;
    } else if (ctrl.throttle && r.airY <= 1) {
      const target = st.throttleMax;
      if (b240 < target) {
        b240 = Math.min(target, b240 + st.throttleUp);
      } else if (b240 > target) {
        b240 = Math.max(target, b240 - st.throttleDown);
      }
      if (b240 < 1) {
        b114 = b240 >> 8;
      } else {
        b114 = Math.trunc((gears[gearIdx].torqueRatio * b240) / 65536);
        if (r.nitroTicks > 0) {
          b114 = Math.trunc((b114 * st.nitroBoost) / 256);
        }
      }
    } else {
      // Coasting back toward 0
      if (b240 > 0) b240 = Math.max(0, b240 - st.throttleDown);
      else if (b240 < 0) b240 = Math.min(0, b240 - st.brakeUp);
      b114 = b240 >= 0 ? Math.trunc((gears[gearIdx].torqueRatio * b240) / 65536) : b240 >> 8;
    }
    r.b240 = b240;
    r.b114 = b114;

    // 2. Exact bike.cpp::shift_gears (0..5)
    let g = gearIdx;
    if (r.vel > gears[g].upVel && g < 5) g += 1;
    else if (r.vel < gears[g].downVel && g > 0) g -= 1;
    r.gearIdx = g;
    r.gear = g + 1;

    // 3. Exact bike.cpp::integrate_speed (aero=130, rolling=8, surface_drag=[0,2,20,30], hill rise)
    const speedAbs = Math.abs(r.vel || 0);
    const onGround = r.airY <= 1;
    const aeroBase = onGround ? speedAbs : speedAbs >> 2;
    const contactDrag = onGround ? ((SURFACE_DRAG[surf] * speedAbs) >> 14) + 8 : 0;
    const aeroDrag = (130 * (aeroBase >> 8)) >> 8;
    const turnScrub = onGround ? Math.trunc(Math.abs(r.lean) * (r.skidding ? 12 : 3)) : 0;
    const slopeAccel = onGround ? Math.trunc(-smp.rise * 0.085) : 0;

    const accel = b114 + slopeAccel - (aeroDrag + contactDrag + turnScrub);
    let nextVel = (r.vel || 0) + accel;
    if (nextVel < 1) {
      nextVel = b114 > 0 ? 100 : 0;
    }
    r.vel = nextVel;
    r.speedMph = mphFromVel(nextVel);

    // 4. Exact bike.cpp::update_engine_rpm (+0x2dc: 0x2000..0xffff, +-0x2000/tick slew!)
    const rpmRatio = gears[g].rpmRatio;
    const rawTarget = Math.min(0xffff, Math.max(0x2000, Math.trunc((rpmRatio * nextVel) / 256) + 0x2000));
    const curRpm = r.b2dc || 0x2000;
    let nextRpm = curRpm;
    if (!onGround) {
      nextRpm = Math.min(0xffff, curRpm + 0x1000);
    } else if (rawTarget > curRpm + 0x2000) {
      nextRpm = curRpm + 0x2000;
    } else if (rawTarget < curRpm - 0x2000) {
      nextRpm = curRpm - 0x2000;
    } else {
      nextRpm = rawTarget;
    }
    r.b2dc = nextRpm;
    r.rpmNorm = Math.max(0, Math.min(1, (nextRpm - 0x2000) / (0xffff - 0x2000)));

    // 5. Exact bike.cpp::steer + race.cpp:378,1830 Centrifugal Curve Sweep (-bend * ds * 1.5625)!
    const speedSteerCap = r.vel <= 0 ? 0 : Math.min(1.0, r.vel / 4800);
    const effSteer = r.staggerTimer > 0 ? 0 : Math.max(-1, Math.min(1, ctrl.steer)) * speedSteerCap;
    const targetLean = effSteer;
    const leanStep =
      Math.abs(targetLean) > Math.abs(r.lean) && targetLean * r.lean >= 0
        ? 1 / st.turnTicks
        : 1 / st.returnTicks;

    if (r.lean < targetLean) {
      r.lean = Math.min(targetLean, r.lean + leanStep * (r.lean < 0 ? 1.35 : 1.0));
    } else if (r.lean > targetLean) {
      r.lean = Math.max(targetLean, r.lean - leanStep * (r.lean > 0 ? 1.35 : 1.0));
    }
    if (Math.abs(targetLean) < 0.01 && Math.abs(r.lean) < 0.012) r.lean = 0;
    r.lean = Math.max(-1, Math.min(1, r.lean));

    // Exact ROADRASH.EXE longitudinal sample step: (vel / 256) / 256
    const ds = nextVel / 65536;
    const centrifugalPush = -smp.bend * ds * (r.skidding && r.isPlayer ? 2.45 : 1.5625);
    const leanLatDrive = r.lean * st.maxLatStep * SURFACE_GRIP[surf];

    r.shoveVel = (r.shoveVel || 0) * 0.90;
    if (Math.abs(r.shoveVel) < 0.05) r.shoveVel = 0;
    r.latVel = r.latVel * 0.55 + leanLatDrive * 0.45;
    r.lat += r.latVel + r.shoveVel + centrifugalPush;

    // 6. Advance Forward Grounded on Road (exact ROADRASH.EXE: no fake hilltop launches!)
    r.sample += ds;

    // Settle any tiny tire bump (e.g. riding over a downed bike) cleanly back to asphalt
    if (r.airY > 0 || r.airVel > 0) {
      r.airY += r.airVel;
      r.airVel -= 0.85;
      if (r.airY <= 0) {
        r.airY = 0;
        r.airVel = 0;
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
    r.attackBackhand = ((this.ticks + r.id) & 1) === 1;
    r.attackPhase = 'windup';
    r.attackTimer = 0;
    r.hitDone = false;

    if (r.isPlayer) {
      const wDef = OG_WEAPONS[r.weapon] || OG_WEAPONS[0];
      const sfx = type === 'kick' ? 'swishgen' : wDef.swish;
      this.audio.playSfx(sfx, { volume: 0.74 });
    }
  }

  stepAttackAndAnim(r) {
    if (r.staggerTimer > 0) {
      r.staggerTimer -= 1;
      r.animId = r.isPolice ? 9 : 5;
      r.animStep = r.staggerTimer > 8 ? 0 : 1;
      r.forceMirror = r.lastHitSide < 0;
      return;
    }

    if (r.attackPhase !== 'idle') {
      r.attackTimer += 1;
      const isKick = r.attackType === 'kick';
      const rightIdx = r.attackSide > 0 ? 1 : 0;
      const backIdx = r.attackBackhand ? 1 : 0;

      // Weapon index into ROADRASH.EXE ATTACK_CODES: 0=Fists, 1=Club/Baton, 2=Chain, 3=Kick
      let wSlot = 0;
      if (isKick) wSlot = 3;
      else if (r.weapon === 2) wSlot = 2;
      else if (r.weapon === 1 || r.weapon === 3) wSlot = 1;

      if (r.isPolice) {
        // LOCOP.DAT has copAnim[16] (left baton/weapon swing) & copAnim[17] (right swing)!
        r.animId = r.attackSide > 0 ? 17 : 16;
        r.forceMirror = null;
      } else {
        r.animId = ATTACK_CODES[rightIdx][backIdx][wSlot];
        r.forceMirror = null;
      }

      const bank = r.isPolice
        ? this.assets.bikersMeta?.copAnims
        : this.assets.bikersMeta?.riderAnims;
      const seq = bank?.[r.animId] || [{ dur: 8 }, { dur: 8 }];
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
    if (r.isPolice) {
      r.animId = 2;
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

  bustOutlaw(victim, methodLabel = 'BUSTED') {
    if (!this.isPoliceMode || victim.isPlayer || victim.state === 'busted') return;
    victim.state = 'busted';
    victim.speedMph = 0;
    victim.latVel = 0;
    victim.shoveVel = 0;
    victim.finished = false;
    if (victim.downedBikeRef) victim.downedBikeRef.active = false;

    this.bustedCount += 1;
    this.outlawsRemaining = Math.max(0, this.totalOutlaws - this.bustedCount);

    this.audio.playSfx('sirenfst', { volume: 0.92 });
    this.audio.playSfx('crashhar', { volume: 0.85 });
    this.playGrunt(victim.female);

    if (this.outlawsRemaining === 0) {
      this.showBanner('ALL 14 OUTLAWS BUSTED! HIGHWAY SECURED!', '#66ff66', 110);
    } else {
      this.showBanner(
        `${methodLabel} ${victim.name.toUpperCase()}! (${this.outlawsRemaining} LEFT)`,
        '#66e6ff',
        85
      );
    }
  }

  resolveCombatHit(attacker) {
    const wDef = OG_WEAPONS[attacker.weapon] || OG_WEAPONS[0];
    const reachLat = attacker.attackType === 'kick' ? 186 : wDef.reach;

    // 1. Check rival / player bikers
    for (const victim of this.riders) {
      if (victim === attacker || victim.state !== 'riding' || victim.finished) continue;
      if (victim.isPlayer && victim.staggerTimer > 6) continue;
      const ds = Math.abs(victim.sample - attacker.sample);
      const relLat = victim.lat - attacker.lat;
      if (ds > 1.75) continue;
      if (attacker.attackSide > 0 && (relLat < -30 || relLat > reachLat)) continue;
      if (attacker.attackSide < 0 && (relLat > 30 || relLat < -reachLat)) continue;

      // TIMED WEAPON SNATCH: Bare-knuckle punch while armed rival is swinging steals their weapon!
      if (
        attacker.attackType === 'punch' &&
        attacker.weapon === 0 &&
        victim.weapon > 0 &&
        victim.attackPhase !== 'idle'
      ) {
        const stolenDef = OG_WEAPONS[victim.weapon] || OG_WEAPONS[1];
        attacker.weapon = victim.weapon;
        victim.weapon = 0;
        victim.attackPhase = 'idle';
        if (attacker.isPlayer || victim.isPlayer) {
          this.audio.playSfx(attacker.female ? 'f_yeah' : 'm_yeah', { volume: 0.9 });
          this.showBanner(
            attacker.isPlayer
              ? `SNATCHED ${stolenDef.key}!`
              : `${attacker.name.toUpperCase()} STOLE YOUR ${stolenDef.key}!`,
            '#ffcf40',
            80
          );
        }
      }

      let dmg = wDef.dmg;
      let latShove = attacker.attackSide * wDef.shove;
      let hitSfx = wDef.sfx;

      if (attacker.attackType === 'kick') {
        dmg = this.isPoliceMode && attacker.isPlayer ? 28 : 22;
        // MASSIVE LATERAL SHOVE: kicks launch rival bikes sideways across lanes into oncoming cars & walls!
        latShove = attacker.attackSide * (this.isPoliceMode && attacker.isPlayer ? 24.0 : 21.0);
        hitSfx = 'kick_mw4';
      } else if (this.isPoliceMode && attacker.isPlayer) {
        // Police Interceptor hits extra hard so Officer can systematically take down all 14 outlaws!
        dmg = Math.round(dmg * 1.28);
        latShove *= 1.15;
      }

      if (victim.isPlayer) {
        dmg = Math.round(dmg * (this.isPoliceMode ? 0.32 : 0.48));
        latShove *= 0.65;
      }

      victim.stamina = Math.max(0, victim.stamina - dmg);
      victim.shoveVel = (victim.shoveVel || 0) + latShove;
      victim.lean = Math.max(-1, Math.min(1, victim.lean + attacker.attackSide * 0.48));
      victim.staggerTimer = attacker.attackType === 'kick' ? 22 : 16;
      victim.hitSparkTimer = 10;
      victim.lastHitSide = -attacker.attackSide;
      if (attacker.isPlayer) {
        victim.lastTouchedByPlayerTick = this.ticks;
      }

      if (attacker.isPlayer || victim.isPlayer) {
        this.audio.playSfx(hitSfx, { volume: 0.9 });
        this.playGrunt(victim.female);
        const rival = attacker.isPlayer ? victim : attacker;
        this.focusedRival = rival;
        this.focusedTimer = 260;
      }

      if (victim.stamina <= 0) {
        if (this.isPoliceMode && attacker.isPlayer) {
          this.bustOutlaw(victim, 'BUSTED');
        } else {
          if (attacker.isPlayer) {
            this.audio.playSfx(attacker.female ? 'f_yeah' : 'm_yeah', { volume: 0.9 });
            this.showBanner(`KO'D ${victim.name.toUpperCase()}!`, '#66ff66', 80);
          }
          this.triggerCrash(victim, Math.max(40, victim.speedMph * 0.72), attacker.attackSide, 'KNOCKED OUT!');
        }
      }
      return;
    }

    // 2. Check Motorcycle Police Officer!
    for (const cop of this.cops) {
      if (!cop.active || cop.state === 'crashing') continue;
      const ds = Math.abs(cop.sample - attacker.sample);
      const relLat = cop.lat - attacker.lat;
      if (ds <= 1.7 && Math.abs(relLat) <= reachLat && Math.sign(relLat || attacker.attackSide) === attacker.attackSide) {
        const dmg = attacker.attackType === 'weapon' && attacker.weapon > 0 ? 38 : 22;
        cop.stamina -= dmg;
        cop.latVel += attacker.attackSide * (attacker.attackType === 'kick' ? 19.0 : 6.0);
        cop.hitSparkTimer = 10;
        cop.lastHitSide = -attacker.attackSide;
        this.audio.playSfx(attacker.attackType === 'kick' ? 'kick_mw4' : 'clubimpa', { volume: 0.9 });
        if (cop.stamina <= 0) {
          cop.state = 'crashing';
          cop.chasing = false;
          cop.animId = 28;
          cop.animStep = 0;
          cop.crashTimer = 84;
          cop.mph = Math.max(24, cop.mph * 0.68);
          this.audio.playSfx('crashhar', { volume: 0.9 });
          if (attacker.isPlayer) this.showBanner(`WRECKED OFFICER ${cop.name.toUpperCase()}!`, '#66ff66', 90);
        }
        return;
      }
    }
  }

  // ==================== TRAFFIC, PEDESTRIANS, FALLEN RIDERS & DOWNED-BIKE RAMPS ====================

  checkWorldHazards(r) {
    // 1. Traffic Cars / Trucks / Taxis & Cross-Intersection Cars
    for (const car of this.traffic) {
      if (!car.active) continue;
      const ds = Math.abs(car.sample - r.sample);
      const dLat = Math.abs(car.lat - r.lat);
      const hitLat = car.crossDir ? 132 : 94;
      const hitDs = car.crossDir ? 1.05 : 1.18;
      if (ds < hitDs && dLat < hitLat && r.airY < 32) {
        const closingMph = car.crossDir
          ? Math.max(40, r.speedMph * 0.9 + 25)
          : car.dir < 0
            ? r.speedMph + car.mph
            : Math.abs(r.speedMph - car.mph);
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
      } else if (
        r.isPlayer &&
        ds < 5.0 &&
        dLat < (car.crossDir ? 190 : 130) &&
        (car.dir < 0 || car.crossDir) &&
        car.hornCooldown <= 0
      ) {
        car.hornCooldown = 140;
        this.audio.playSfx('bmwlong', { volume: 0.56 });
      }
    }

    // 2. Hittable Jaywalking & Shoulder Pedestrians (exact race.cpp type 0x20: grounded knockdown!)
    const pedsMeta = this.assets.worldMeta?.pedestrians || [];
    for (const ped of this.pedestrians) {
      if (!ped.active || ped.state !== 'walk') continue;
      const ds = Math.abs(ped.sample - r.sample);
      const dLat = Math.abs(ped.lat - r.lat);
      if (ds < 0.95 && dLat < 64 && r.airY < 26) {
        ped.state = 'down';
        ped.airY = 0;
        ped.airVel = 0;
        ped.animStep = 0;
        ped.animTick = 0;
        ped.downTimer = 150;
        ped.vx = (ped.lat >= r.lat ? 1 : -1) * 4.2;
        r.speedMph *= 0.92;
        r.latVel += (r.lat < ped.lat ? -1 : 1) * 2.8;
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

    // 3. Hittable Sprinting Crashed Riders running on foot back to their bikes (grounded knockdown!)
    for (const other of this.riders) {
      if (other === r || other.state !== 'running') continue;
      const ds = Math.abs(other.sample - r.sample);
      const dLat = Math.abs(other.lat - r.lat);
      if (ds < 0.95 && dLat < 60 && r.airY < 26) {
        other.state = 'crashing';
        other.stateTimer = 48;
        other.crashTotalTicks = 48;
        other.airVel = 0;
        other.airY = 0;
        other.animId = 28;
        other.animStep = 0;
        other.latVel = (other.lat >= r.lat ? 1 : -1) * 5.0;
        other.speedMph = r.speedMph * 0.32;
        r.speedMph *= 0.93;
        if (this.isPoliceMode && r.isPlayer) {
          this.bustOutlaw(other, 'ARRESTED');
          continue;
        }
        if (r.isPlayer || other.isPlayer) {
          this.audio.playSfx('punchhea', { volume: 0.82 });
          this.playGrunt(other.female);
          if (r.isPlayer) this.showBanner(`CLIPPED ${other.name.toUpperCase()}!`, '#ffcf40', 60);
        }
      }
    }

    // In Police Mode, riding right past any crashed/running outlaw arrests them on the spot!
    if (this.isPoliceMode && r.isPlayer) {
      for (const other of this.riders) {
        if (other.isPlayer || other.state === 'riding' || other.state === 'busted') continue;
        if (Math.abs(other.sample - r.sample) < 3.2 && Math.abs(other.lat - r.lat) < 165) {
          this.bustOutlaw(other, 'ARRESTED');
        }
      }
    }

    // 4. Downed Motorcycles on Pavement (exact ROADRASH.EXE race.cpp::0x004049c0 iclass == 0!)
    // Slow bikes nudge aside; fast upright bikes ride over with a small tire bump (NO fake moon-launch!);
    // heavily leaned bikes wipe out!
    for (const db of this.downedBikes) {
      if (!db.active || db.ownerId === r.id || (db.hitCooldown || 0) > 0) continue;
      const ds = Math.abs(db.sample - r.sample);
      const dLat = Math.abs(db.lat - r.lat);
      if (ds < 0.92 && dLat < 62 && r.airY < 10) {
        db.hitCooldown = 18;
        if (r.speedMph <= 25) {
          const pushDir = r.lat < db.lat ? -1 : 1;
          r.latVel += pushDir * 4.5;
          db.lat -= pushDir * 10;
          if (r.isPlayer) this.audio.playSfx('crashlit', { volume: 0.52 });
        } else if (Math.abs(r.lean) < 0.68 || r.isPolice) {
          // Small realistic OG tire hop over the downed bike frame — stays planted right on the road!
          r.airVel = 3.2;
          r.airY = 2;
          r.speedMph *= 0.94;
          r.staggerTimer = Math.max(r.staggerTimer, 6);
          db.spinStep = (db.spinStep + 2) % 8;
          if (r.isPlayer) {
            this.audio.playSfx('bounce', { volume: 0.78 });
          }
        } else {
          this.triggerCrash(r, r.speedMph * 0.72, r.lean >= 0 ? 1 : -1, 'PILED UP!');
          return true;
        }
      }
    }

    return false;
  }

  // ==================== GROUNDED HIBOB CRASH, BIKE SLIDE & ON-FOOT SPRINT ====================

  triggerCrash(r, severityMph, sideDir, reason = '') {
    if (r.state !== 'riding') return;

    // In Police Pursuit Mode, shoving/ramming an outlaw into traffic, walls, or cliffs busts them!
    if (
      this.isPoliceMode &&
      !r.isPlayer &&
      (this.ticks - (r.lastTouchedByPlayerTick || -9999) < 180 ||
        Math.abs(r.sample - this.player.sample) < 16)
    ) {
      this.bustOutlaw(r, reason === 'OVER THE CLIFF!' ? 'CLIFF-BUSTED' : 'BUSTED');
      return;
    }

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
      spinStep: 0,
      hitCooldown: 0
    };
    if (!r.isPolice) {
      this.downedBikes.push(db);
      r.downedBikeRef = db;
    } else {
      r.downedBikeRef = null;
    }

    // Grounded HIBOB / LOCOP crash: anim[28] tumble -> anim[29/33] slide -> anim[36/37] stand-up
    r.state = 'crashing';
    r.crashTotalTicks = 66;
    r.stateTimer = 66;
    r.airVel = 0;
    r.airY = 0;
    r.latVel = sideDir * 6.0;
    r.speedMph = Math.min(88, r.speedMph * 0.72);
    r.animId = 28;
    r.animStep = 0;
    r.animTick = 0;
  }

  stepNonRidingState(r) {
    const smp = this.sampleInfoAt(r.sample);

    if (r.state === 'crashing') {
      r.stateTimer -= 1;
      r.airY = 0;
      r.airVel = 0;
      r.sample += r.speedMph * 0.0014;
      r.speedMph *= 0.915;
      r.lat += r.latVel;
      r.latVel *= 0.90;
      r.lat = Math.max(-(smp.left + 140), Math.min(smp.right + 140, r.lat));

      // Advance grounded HIBOB crash animations:
      // 1) Initial tumble (anim 28, 7 frames)
      // 2) Pavement slide (anim 29, 8 frames)
      // 3) Stand up from asphalt (anim 36, 5 frames)
      const total = r.crashTotalTicks || 66;
      const elapsed = total - Math.max(0, r.stateTimer);
      if (r.isPolice) {
        if (elapsed < 24) {
          r.animId = 28;
          r.animStep = Math.min(6, Math.floor((elapsed / 24) * 7));
        } else if (r.stateTimer > 16 || r.speedMph >= 5) {
          r.animId = 33;
          r.animStep = Math.floor(elapsed / 4) % 5;
        } else {
          r.animId = 37;
          r.animStep = Math.min(3, Math.floor(((16 - r.stateTimer) / 16) * 4));
        }
      } else if (elapsed < 22) {
        r.animId = 28;
        r.animStep = Math.min(6, Math.floor((elapsed / 22) * 7));
      } else if (r.stateTimer > 15 || r.speedMph >= 5) {
        r.animId = 29;
        r.animTick = (r.animTick || 0) + 1;
        if (r.animTick >= 4) {
          r.animTick = 0;
          r.animStep = (r.animStep + 1) % 8;
        }
      } else {
        r.animId = 36;
        const standFrac = Math.max(0, Math.min(1, (15 - r.stateTimer) / 15));
        r.animStep = Math.min(4, Math.floor(standFrac * 5));
      }

      if (r.stateTimer <= 0 && r.speedMph < 5) {
        if (r.bikeCond <= 0) {
          r.state = 'wrecked';
          if (!r.isPlayer && r.downedBikeRef) r.downedBikeRef.active = false;
          return;
        }
        if (r.isPlayer && !r.isPolice) {
          for (const cop of this.cops) {
            if (cop.active && Math.abs(cop.sample - r.sample) < 10) {
              r.state = 'busted';
              this.audio.playSfx('sirenfst', { volume: 0.88 });
              return;
            }
          }
        }
        if (r.isPolice) {
          r.state = 'riding';
          r.animId = 2;
          r.speedMph = 32;
          r.lean = 0;
          return;
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
      if (db.hitCooldown > 0) db.hitCooldown -= 1;
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

      if (car.crossDir) {
        const smp = this.sampleInfoAt(car.sample);
        car.lat += car.crossDir * 3.35;
        const wrapL = -(smp.left + 290);
        const wrapR = smp.right + 290;
        if (car.crossDir > 0 && car.lat > wrapR) car.lat = wrapL;
        else if (car.crossDir < 0 && car.lat < wrapL) car.lat = wrapR;
        continue;
      }

      car.sample += car.dir * car.mph * 0.00145;
      const smp = this.sampleInfoAt(car.sample);
      const frac = car.laneFrac || 0.52;
      const targetMag = Math.max(110, (car.dir < 0 ? smp.left : smp.right) * frac);
      const desiredLat = car.dir < 0 ? -targetMag : targetMag;
      car.lat += (desiredLat - car.lat) * 0.14;

      if (car.sample < this.startSample + 8) {
        const nextS = this.player.sample + 54 + (car.id % 9) * 5.8;
        if (nextS >= this.finishSample - 14) {
          car.active = false;
        } else {
          car.sample = nextS;
        }
      } else if (car.sample > this.finishSample - 6) {
        const prevS = this.player.sample - (24 + (car.id % 7) * 5.2);
        if (prevS <= this.startSample + 10) {
          car.active = false;
        } else {
          car.sample = prevS;
        }
      }
    }
  }

  stepPedestrians() {
    for (const ped of this.pedestrians) {
      if (!ped.active) continue;
      if (ped.state === 'down') {
        ped.airY = 0;
        ped.lat += ped.vx;
        ped.vx *= 0.86;
        ped.animTick += 1;
        if (ped.animTick >= 4 && ped.animStep < 5) {
          ped.animTick = 0;
          ped.animStep += 1;
        }
        ped.downTimer = (ped.downTimer ?? 120) - 1;
        if (ped.downTimer <= 0 && this.player.sample - ped.sample > 4) {
          ped.active = false;
        }
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
          if (a.isPlayer) {
            b.lastTouchedByPlayerTick = this.ticks;
            if (this.isPoliceMode) b.shoveVel = (b.shoveVel || 0) - push * 1.4;
          } else if (b.isPlayer) {
            a.lastTouchedByPlayerTick = this.ticks;
            if (this.isPoliceMode) a.shoveVel = (a.shoveVel || 0) + push * 1.4;
          }
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
      if (cop.hitSparkTimer > 0) cop.hitSparkTimer -= 1;

      if (cop.active && cop.state === 'crashing') {
        cop.crashTimer -= 1;
        cop.sample += cop.mph * 0.00145;
        cop.mph *= 0.93;
        cop.lat += cop.latVel;
        cop.latVel *= 0.88;
        if (cop.crashTimer % 6 === 0 && cop.animStep < 12) {
          cop.animStep += 1;
        }
        if (cop.crashTimer <= 0) {
          cop.active = false;
          cop.state = 'wrecked';
        }
        continue;
      }

      if (
        !cop.active &&
        cop.state !== 'wrecked' &&
        Math.abs(p.sample - cop.spawnSample) < 9 &&
        !cop.chasing &&
        cop.stamina > 0
      ) {
        cop.active = true;
        cop.chasing = true;
        cop.state = 'riding';
        cop.animId = 2;
        cop.animStep = 0;
        cop.sample = Math.max(this.startSample + 5, p.sample - 4.5);
        cop.lat = p.lat + (p.lat > 0 ? -135 : 135);
        cop.mph = Math.max(60, p.speedMph * 0.95);
        this.showBanner(`POLICE PURSUIT: OFFICER ${cop.name.toUpperCase()}!`, '#ff5555', 80);
      }

      if (!cop.active) continue;
      this.activeCop = cop;

      const lv = Math.max(0, Math.min(4, this.config.level || 0));
      const baseCopMph = COP_LEVEL_MPH[lv];
      const targetMph = p.state === 'riding' ? Math.max(baseCopMph, Math.min(182, p.speedMph * 1.03)) : 26;
      cop.mph += (targetMph - cop.mph) * 0.048;
      const ds = cop.mph * 0.001526;
      cop.sample += ds;

      const smp = this.sampleInfoAt(cop.sample);
      const desiredLat = p.lat + (cop.lat >= p.lat ? 62 : -62);
      const latErr = desiredLat - cop.lat;
      const curveComp = smp.bend * ds * (1.5625 / 19.5);
      cop.lean = Math.max(-1, Math.min(1, latErr * 0.016 + curveComp));
      cop.latVel = cop.latVel * 0.60 + cop.lean * 19.5 * 0.40;
      cop.lat += cop.latVel - smp.bend * ds * 1.5625;
      cop.lat = Math.max(-(smp.left - 24), Math.min(smp.right - 24, cop.lat));

      if (cop.swingTicks > 0) {
        cop.swingTicks -= 1;
        cop.animStep = cop.swingTicks > 12 ? 0 : cop.swingTicks > 5 ? 1 : 2;
        if (cop.swingTicks === 0) {
          cop.animId = 2;
          cop.animStep = 0;
        }
      }

      if (cop.attackCooldown > 0) cop.attackCooldown -= 1;
      if (
        p.state === 'riding' &&
        cop.attackCooldown <= 0 &&
        Math.abs(cop.sample - p.sample) < 1.4 &&
        Math.abs(cop.lat - p.lat) < 135
      ) {
        cop.attackCooldown = 54;
        const pushDir = p.lat >= cop.lat ? 1 : -1;
        cop.animId = pushDir > 0 ? 16 : 17;
        cop.animStep = 0;
        cop.swingTicks = 18;
        p.stamina = Math.max(0, p.stamina - 22);
        p.latVel += pushDir * 11.5;
        p.staggerTimer = 14;
        p.hitSparkTimer = 10;
        p.lastHitSide = -pushDir;
        this.audio.playSfx('clubimpa', { volume: 0.9 });
        this.playGrunt(p.female);

        if (p.stamina <= 0) {
          this.triggerCrash(p, p.speedMph * 0.7, pushDir, 'BUSTED BY POLICE!');
          p.state = 'busted';
        }
      } else if (
        (p.state === 'crashing' || p.state === 'running') &&
        p.speedMph < 16 &&
        Math.abs(cop.sample - p.sample) < 1.55 &&
        Math.abs(cop.lat - p.lat) < 165
      ) {
        // Authentic OG Road Rash Police Arrest: crashing right in front of a pursuing cop busts you!
        p.state = 'busted';
        this.audio.playSfx('sirenfst', { volume: 0.85 });
        this.showBanner(`BUSTED BY OFFICER ${cop.name.toUpperCase()}!`, '#ff4444', 95);
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
      if (this.isPoliceMode) {
        if (a.state === 'busted' && b.state !== 'busted') return 1;
        if (b.state === 'busted' && a.state !== 'busted') return -1;
      }
      if (a.finished && b.finished) return a.finishTick - b.finishTick;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.sample - a.sample;
    });
    sorted.forEach((r, idx) => {
      r.place = idx + 1;
    });
    this.playerPlace = this.player.place;

    if (this.isPoliceMode) {
      let rem = 0;
      let leader = null;
      for (const r of this.riders) {
        if (r.isPlayer || r.state === 'busted') continue;
        rem += 1;
        if (!leader || r.sample > leader.sample) leader = r;
      }
      this.outlawsRemaining = rem;
      this.leadOutlaw = leader;
    }

    // Nearest active rival for right-side Cockpit HUD Stamina & Gap readout
    if (
      this.focusedRival &&
      this.focusedRival.state === 'riding' &&
      this.focusedRival.state !== 'busted'
    ) {
      this.nearestRival = this.focusedRival;
    } else {
      let best = null;
      let bestD = Infinity;
      for (const r of this.riders) {
        if (r.isPlayer || r.state === 'busted') continue;
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

    // Exact race.cpp:4140-4146 crane-shot pull-back & lift on finish, arrest, or bike wreck!
    if (p.finished || p.state === 'busted' || p.state === 'wrecked') {
      this.cameraHeightOffset = Math.min(260, this.cameraHeightOffset + 1.5);
      this.cameraBackExtra = Math.min(3.2, (this.cameraBackExtra || 0) + 0.02);
    } else {
      this.cameraHeightOffset = Math.max(0, this.cameraHeightOffset - 1.5);
      this.cameraBackExtra = Math.max(0, (this.cameraBackExtra || 0) - 0.02);
    }

    this.cameraSample = Math.max(1, p.sample - 1.36 - (this.cameraBackExtra || 0));

    // Exact race.cpp:4130-4135 lateral camera tracking: off = 0.75 * d, clamped within +-200 of rider!
    let targetCamLat = p.lat * 0.75;
    if (p.lat - targetCamLat > 200) targetCamLat = p.lat - 200;
    else if (p.lat - targetCamLat < -200) targetCamLat = p.lat + 200;
    this.cameraLat += (targetCamLat - this.cameraLat) * 0.55;

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
    if (p.isPolice && p.sirenOn && this.outlawsRemaining > 0) {
      copDist = rivalDist < 2200 ? 130 : 320;
      copPan = 0;
      copChasing = true;
    } else if (this.activeCop && this.activeCop.active) {
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
      return;
    }

    if (this.isPoliceMode) {
      // Prevent player from accidentally ending the race by crossing finishSample ahead of #1!
      if (p.sample > this.finishSample - 6 && this.outlawsRemaining > 0) {
        p.sample = this.finishSample - 6;
        p.speedMph = Math.min(p.speedMph, 15);
        p.finished = false;
      }

      if (this.outlawsRemaining <= 0) {
        this.finishRaceWithStatus('cop_win');
        return;
      }

      for (const r of this.riders) {
        if (r.isPlayer || r.state === 'busted') continue;
        if (r.finished || r.sample >= this.finishSample) {
          this.escapedOutlawName = r.name;
          this.finishRaceWithStatus('cop_escaped');
          return;
        }
      }
      return;
    }

    if (p.state === 'busted') {
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
        let timeStr = this.formatRaceTime(estTicks);
        if (this.isPoliceMode && r.isPlayer) {
          timeStr = `${this.bustedCount}/${this.totalOutlaws} BUSTS`;
        } else if (r.state === 'wrecked') {
          timeStr = 'WRECKED';
        } else if (r.state === 'busted') {
          timeStr = 'BUSTED';
        } else if (this.isPoliceMode && status === 'cop_escaped' && r.name === this.escapedOutlawName) {
          timeStr = 'ESCAPED (#1)';
        }
        return {
          name: r.name,
          isPlayer: r.isPlayer,
          place: r.place,
          timeStr
        };
      });

    setTimeout(() => {
      this.onRaceComplete({
        status,
        isPoliceMode: this.isPoliceMode,
        bustedCount: this.bustedCount,
        totalOutlaws: this.totalOutlaws,
        escapedOutlawName: this.escapedOutlawName,
        place: this.player.place,
        playerName: this.player.name,
        courseId: this.config.courseId,
        standings
      });
    }, 900);
  }
}
