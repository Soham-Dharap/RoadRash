import * as THREE from 'three';

const textureCache = new Map();

/**
 * Converts a 2D offscreen drawing into an authentic 1996 SVGA 256-color-style
 * razor-sharp sprite (hard alpha threshold so zero WebGL halo artifacts + subtle Bayer quantization).
 */
function finalizeSpriteTexture(canvas, quantizeStep = 10) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = d[i + 3];
      if (a < 95) {
        d[i + 3] = 0;
      } else {
        // Keep deliberate semi-transparent ground shadow dark pixels (~110-165), make solid body 255
        const isShadow = d[i] < 18 && d[i + 1] < 18 && d[i + 2] < 24 && a < 190;
        d[i + 3] = isShadow ? 145 : 255;
        if (!isShadow && quantizeStep > 1) {
          const bayer = (((x & 1) << 1) | (y & 1)) * 2 - 3;
          d[i] = Math.max(0, Math.min(255, Math.round((d[i] + bayer) / quantizeStep) * quantizeStep));
          d[i + 1] = Math.max(0, Math.min(255, Math.round((d[i + 1] + bayer) / quantizeStep) * quantizeStep));
          d[i + 2] = Math.max(0, Math.min(255, Math.round((d[i + 2] + bayer) / quantizeStep) * quantizeStep));
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function shadeHex(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

/**
 * Renders one rear-view 1996 SVGA biker + motorcycle sprite frame (88x104 retro pixels)
 */
function renderBikerFrame(opts) {
  const {
    bikeColor = '#7e22ce',
    suitMain = '#c026d3',
    suitShoulder = '#ca8a04',
    helmetColor = '#a16207',
    pantsColor = '#701a75',
    isCop = false,
    lean = 0, // -2..-1..0..1..2
    wheelie = false,
    pose = 'ride', // ride | punch_l | punch_r | windup_l | windup_r | swing_l | swing_r | kick_l | kick_r | hit_l | hit_r
    weapon = 'fist'
  } = opts;

  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 108;
  const ctx = c.getContext('2d');

  const cx = 48;
  const groundY = 98;

  // Ground drop shadow (shifts slightly with lean, separates slightly on wheelie)
  ctx.fillStyle = 'rgba(5, 6, 12, 0.58)';
  ctx.beginPath();
  ctx.ellipse(cx + lean * 5, groundY, 17 + Math.abs(lean) * 3, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, groundY - 4);
  ctx.rotate(lean * 0.145);
  if (wheelie) ctx.translate(0, -6);

  // --- KICKING LEG BEHIND/BESIDE BIKE ---
  if (pose === 'kick_l' || pose === 'kick_r') {
    const dir = pose === 'kick_l' ? -1 : 1;
    // Extended thigh + knee pad + heavy armored black boot sticking straight sideways!
    ctx.strokeStyle = isCop ? '#b89f72' : pantsColor;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dir * 6, -34);
    ctx.lineTo(dir * 29, -27);
    ctx.stroke();

    // Leather highlight on kicking leg
    ctx.strokeStyle = shadeHex(isCop ? '#b89f72' : pantsColor, 42);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dir * 7, -36);
    ctx.lineTo(dir * 27, -29);
    ctx.stroke();

    // Heavy racing boot sole-out
    ctx.fillStyle = '#111827';
    ctx.fillRect(dir > 0 ? 26 : -37, -33, 11, 9);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(dir > 0 ? 34 : -37, -33, 3, 9);
  }

  // --- MOTORCYCLE CHASSIS, EXHAUSTS & REAR TIRE ---
  // Dual angled chrome exhaust mufflers
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 10, -16);
    ctx.rotate(side * -0.12);
    ctx.fillStyle = '#374151';
    ctx.fillRect(-3.5, -9, 7, 16);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-2.5, -8, 3, 14);
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(0, -8, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Police hard saddlebags + red/blue rear strobes!
  if (isCop) {
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(side > 0 ? 8 : -20, -31, 12, 16);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(side > 0 ? 8 : -20, -25, 12, 10);
      // Red & Blue patrol beacons
      ctx.fillStyle = side < 0 ? '#ef4444' : '#3b82f6';
      ctx.fillRect(side > 0 ? 11 : -17, -35, 6, 4);
    }
  }

  // Rear Tire (fat 90s sportbike slick w/ subtle tread grooves)
  ctx.fillStyle = '#0f131a';
  ctx.fillRect(-7, -29, 14, 29);
  ctx.fillStyle = '#262d3b';
  ctx.fillRect(-5, -27, 4, 25);
  ctx.fillStyle = '#1a202c';
  for (let ty = -25; ty < -3; ty += 5) {
    ctx.fillRect(-6, ty, 12, 2);
  }

  // Swingarm & chain/sprocket detail
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-9, -16, 3, 11);
  ctx.fillRect(6, -16, 3, 11);

  // Sculpted Rear Tail Fairing / Cowl + Glowing Red Taillight (Screenshots 1, 2, 4!)
  const cowlColor = isCop ? '#f8fafc' : bikeColor;
  ctx.fillStyle = shadeHex(cowlColor, -38);
  ctx.beginPath();
  ctx.moveTo(-11, -28);
  ctx.lineTo(11, -28);
  ctx.lineTo(9, -43);
  ctx.lineTo(-9, -43);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = cowlColor;
  ctx.fillRect(-8, -42, 16, 12);
  ctx.fillStyle = shadeHex(cowlColor, 48);
  ctx.fillRect(-6, -42, 6, 5);

  // Bright Crimson Brake/Tail Light
  ctx.fillStyle = '#ff1e1e';
  ctx.fillRect(-5, -35, 10, 5);
  ctx.fillStyle = '#fca5a5';
  ctx.fillRect(-3, -34, 6, 2);

  // --- RIDER LEGS HUGGING TANK ---
  for (const side of [-1, 1]) {
    if ((side === -1 && pose === 'kick_l') || (side === 1 && pose === 'kick_r')) continue;
    const kneeOut = (lean < 0 && side === -1) || (lean > 0 && side === 1) ? side * 5 : 0;
    // Lower leg + boot on peg
    ctx.fillStyle = '#111827';
    ctx.fillRect(side * 11 - 4, -29, 8, 13);
    // Thigh / knee hugging tank
    ctx.fillStyle = isCop ? '#b89f72' : pantsColor;
    ctx.beginPath();
    ctx.ellipse(side * 12 + kneeOut, -35, 6, 9, side * -0.25, 0, Math.PI * 2);
    ctx.fill();
    // Knee puck highlight
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(side * 14 + kneeOut - 2, -36, 4, 5);
  }

  // --- HANDLEBARS & MIRRORS ---
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-21, -54);
  ctx.lineTo(21, -54);
  ctx.stroke();
  // Glinting side mirrors
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-24, -59, 6, 4);
  ctx.fillRect(18, -59, 6, 4);

  // --- RIDER TORSO (ICONIC TWO-TONE CHEVRON LEATHER JACKET!) ---
  const hitShift = pose === 'hit_l' ? -6 : pose === 'hit_r' ? 6 : 0;
  ctx.save();
  ctx.translate(hitShift + lean * 2.2, wheelie ? -4 : 0);

  // Waist / lower back belt
  ctx.fillStyle = '#111827';
  ctx.fillRect(-10, -45, 20, 6);

  // Main jacket back (trapezoid broad shoulders)
  const jMain = isCop ? '#111827' : suitMain;
  const jTop = isCop ? '#1f2937' : suitShoulder;

  ctx.fillStyle = shadeHex(jMain, -32);
  ctx.beginPath();
  ctx.moveTo(-10, -43);
  ctx.lineTo(10, -43);
  ctx.lineTo(16, -64);
  ctx.lineTo(-16, -64);
  ctx.closePath();
  ctx.fill();

  // Lit center/left jacket panel
  ctx.fillStyle = jMain;
  ctx.beginPath();
  ctx.moveTo(-8, -44);
  ctx.lineTo(8, -44);
  ctx.lineTo(13, -63);
  ctx.lineTo(-13, -63);
  ctx.closePath();
  ctx.fill();

  // Iconic 1996 Shoulder Yoke / V-Chevron Panel (exact look of yellow/magenta suit in Screenshots 1, 2, 4!)
  ctx.fillStyle = jTop;
  ctx.beginPath();
  ctx.moveTo(-16, -65);
  ctx.lineTo(16, -65);
  ctx.lineTo(13, -55);
  ctx.lineTo(0, -50);
  ctx.lineTo(-13, -55);
  ctx.closePath();
  ctx.fill();

  // Bright specular highlight on upper shoulder leather
  ctx.fillStyle = shadeHex(jTop, 46);
  ctx.fillRect(-12, -64, 9, 4);
  // Spine pad creases
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-2, -59, 4, 13);

  // --- ARMS & MELEE / WEAPON POSES ---
  for (const side of [-1, 1]) {
    const isLeft = side === -1;
    const punchingThis = (isLeft && pose === 'punch_l') || (!isLeft && pose === 'punch_r');
    const windupThis = (isLeft && pose === 'windup_l') || (!isLeft && pose === 'windup_r');
    const swingThis = (isLeft && pose === 'swing_l') || (!isLeft && pose === 'swing_r');

    ctx.strokeStyle = jTop;
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';

    if (punchingThis) {
      // Thrown lateral punch / backhand!
      ctx.beginPath();
      ctx.moveTo(side * 14, -61);
      ctx.lineTo(side * 35, -58);
      ctx.stroke();
      // Black leather racing glove + white motion arc
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(side * 37, -58, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(side * 26, -58, 12, side < 0 ? 2.5 : -0.6, side < 0 ? 3.8 : 0.7);
      ctx.stroke();
    } else if (windupThis) {
      // Arm raised HIGH above helmet holding weapon (snatchable window! Matches Screenshot 4!)
      ctx.beginPath();
      ctx.moveTo(side * 14, -62);
      ctx.lineTo(side * 18, -83);
      ctx.stroke();
      drawWeaponInHand(ctx, side * 18, -85, side, weapon, true, isCop);
    } else if (swingThis) {
      // Weapon swung wide sideways/overhead! (Matches chain whip in Screenshot 1!)
      ctx.beginPath();
      ctx.moveTo(side * 14, -62);
      ctx.lineTo(side * 30, -68);
      ctx.stroke();
      drawWeaponInHand(ctx, side * 31, -68, side, weapon, false, isCop);
    } else {
      // Normal riding arm bent to handlebar grip
      ctx.beginPath();
      ctx.moveTo(side * 14, -61);
      ctx.lineTo(side * 20, -53);
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.fillRect(side * 20 - 3, -55, 6, 5);
    }
  }

  // --- FULL-FACE MOTORCYCLE HELMET ---
  const hCol = isCop ? '#f8fafc' : helmetColor;
  ctx.fillStyle = '#111827'; // neck collar
  ctx.fillRect(-6, -68, 12, 5);

  ctx.fillStyle = shadeHex(hCol, -35);
  ctx.beginPath();
  ctx.arc(0, -74, 9.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hCol;
  ctx.beginPath();
  ctx.arc(-1, -75, 8.2, 0, Math.PI * 2);
  ctx.fill();

  // Dark wraparound helmet trim / rear aero vent + glossy white highlight dot
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-7, -73, 14, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-5, -80, 4, 3);

  ctx.restore(); // end torso
  ctx.restore(); // end bike tilt

  return finalizeSpriteTexture(c, 10);
}

function drawWeaponInHand(ctx, hx, hy, dir, weapon, isWindup, isCop) {
  ctx.save();
  ctx.translate(hx, hy);
  const wType = isCop ? 'club' : weapon;

  if (wType === 'chain') {
    // Glinting silver steel chain whipping in a wide curved arc (Screenshot 1!)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    if (isWindup) {
      ctx.arc(-dir * 8, 4, 13, -Math.PI * 0.9, 0.2);
    } else {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(dir * 10, -14, dir * 16, 4);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (wType === 'crowbar') {
    ctx.rotate(isWindup ? -dir * 0.6 : dir * 1.15);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-2, -20, 4, 22);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-5, -22, 8, 4);
  } else if (wType === 'nunchaku') {
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-2, -13, 4, 13);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(dir * 2, -15, 4, 3);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(dir * 5, isWindup ? -9 : -20, 4, 12);
  } else {
    // Oak Billy Club / Police Nightstick
    ctx.rotate(isWindup ? -dir * 0.55 : dir * 1.15);
    ctx.fillStyle = isCop ? '#0f172a' : '#92400e';
    ctx.fillRect(-2.5, -21, 5, 22);
    ctx.fillStyle = isCop ? '#334155' : '#d97706';
    ctx.fillRect(-1.5, -20, 2, 18);
  }
  ctx.restore();
}

/**
 * Downed Motorcycle lying flat on its side on the asphalt (Screenshot 6!)
 * Acts as a physical BUMP / LAUNCH RAMP when ridden over!
 */
function renderDownedBikeFrame(bikeColor = '#22c55e', isCop = false) {
  const c = document.createElement('canvas');
  c.width = 112;
  c.height = 64;
  const ctx = c.getContext('2d');

  // Wide ground shadow beneath fallen motorcycle
  ctx.fillStyle = 'rgba(5, 6, 12, 0.6)';
  ctx.beginPath();
  ctx.ellipse(56, 52, 42, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rear & Front wheels lying nearly horizontal
  for (const wx of [26, 84]) {
    ctx.fillStyle = '#0f131a';
    ctx.beginPath();
    ctx.ellipse(wx, 43, 14, 9, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.ellipse(wx, 43, 7, 4.5, -0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Engine block & chrome exhaust pipe
  ctx.fillStyle = '#475569';
  ctx.fillRect(36, 34, 34, 13);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(22, 42, 42, 5);

  // Sculpted fuel tank & sport fairing on its side (exact look of green downed bike in Screenshot 6!)
  const col = isCop ? '#f8fafc' : bikeColor;
  ctx.fillStyle = shadeHex(col, -32);
  ctx.beginPath();
  ctx.moveTo(22, 36);
  ctx.lineTo(62, 24);
  ctx.lineTo(92, 32);
  ctx.lineTo(78, 45);
  ctx.lineTo(30, 44);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(26, 34);
  ctx.lineTo(62, 24);
  ctx.lineTo(88, 31);
  ctx.lineTo(74, 39);
  ctx.lineTo(34, 39);
  ctx.closePath();
  ctx.fill();

  // Bright fairing highlight + black seat + bent handlebars
  ctx.fillStyle = shadeHex(col, 55);
  ctx.fillRect(52, 26, 22, 5);
  ctx.fillStyle = '#111827';
  ctx.fillRect(34, 28, 18, 7);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(76, 27);
  ctx.lineTo(84, 16);
  ctx.stroke();

  return finalizeSpriteTexture(c, 10);
}

/**
 * Sprawling / Tumbling crashed rider + 4-frame Sprinting-On-Foot rider frames!
 */
function renderFallenOrRunningRider(palette, mode, step = 0) {
  const { suitMain, suitShoulder, helmetColor, pantsColor = '#1e293b', isCop = false } = palette;
  const c = document.createElement('canvas');
  c.width = 88;
  c.height = 96;
  const ctx = c.getContext('2d');

  const jMain = isCop ? '#111827' : suitMain;
  const jTop = isCop ? '#1f2937' : suitShoulder;
  const hCol = isCop ? '#f8fafc' : helmetColor;
  const pCol = isCop ? '#b89f72' : pantsColor;

  if (mode === 'tumble') {
    // Sprawling mid-air / sliding crash pose (exact match to green/blue sprawling rider in Screenshot 6!)
    ctx.fillStyle = 'rgba(5, 6, 12, 0.52)';
    ctx.beginPath();
    ctx.ellipse(44, 86, 26, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(44, 52);
    ctx.rotate(step === 0 ? -0.25 : 0.45);

    // Splayed legs
    ctx.strokeStyle = pCol;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, 6);
    ctx.lineTo(-22, 24);
    ctx.moveTo(4, 6);
    ctx.lineTo(22, 20);
    ctx.stroke();

    // Boots
    ctx.fillStyle = '#111827';
    ctx.fillRect(-26, 21, 8, 7);
    ctx.fillRect(19, 17, 8, 7);

    // Splayed arms
    ctx.strokeStyle = jTop;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.lineTo(-28, -16);
    ctx.moveTo(10, -8);
    ctx.lineTo(27, -12);
    ctx.stroke();

    // Torso
    ctx.fillStyle = jMain;
    ctx.fillRect(-11, -12, 22, 20);
    ctx.fillStyle = jTop;
    ctx.fillRect(-13, -14, 26, 8);

    // Helmet
    ctx.fillStyle = hCol;
    ctx.beginPath();
    ctx.arc(0, -20, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // 4-frame SPRINTING ON FOOT back toward the downed bike!
    const swing = Math.sin((step / 4) * Math.PI * 2);
    const bob = Math.abs(Math.cos((step / 4) * Math.PI * 2)) * 4;

    ctx.fillStyle = 'rgba(5, 6, 12, 0.55)';
    ctx.beginPath();
    ctx.ellipse(44, 89, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(44, 86 - bob);

    // Pumping legs
    for (const side of [-1, 1]) {
      const phase = side * swing;
      ctx.strokeStyle = pCol;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(side * 5, -28);
      ctx.lineTo(side * 7 + phase * 5, -6 - Math.max(0, phase) * 11);
      ctx.stroke();

      ctx.fillStyle = '#111827';
      ctx.fillRect(side * 7 + phase * 5 - 4, -8 - Math.max(0, phase) * 11, 8, 7);
    }

    // Pumping arms
    for (const side of [-1, 1]) {
      const phase = -side * swing;
      ctx.strokeStyle = jTop;
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(side * 12, -50);
      ctx.lineTo(side * 17, -36 + phase * 8);
      ctx.stroke();
    }

    // Torso leaning forward in sprint
    ctx.fillStyle = jMain;
    ctx.fillRect(-10, -52, 20, 24);
    ctx.fillStyle = jTop;
    ctx.fillRect(-12, -54, 24, 9);

    // Helmet
    ctx.fillStyle = hCol;
    ctx.beginPath();
    ctx.arc(0, -62, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-4, -67, 4, 3);
    ctx.restore();
  }

  return finalizeSpriteTexture(c, 10);
}

export function getBikerSpriteSet(palette) {
  const key = JSON.stringify(palette);
  if (textureCache.has(key)) return textureCache.get(key);

  const weapon = palette.weapon || 'club';
  const set = {
    idle: renderBikerFrame({ ...palette, lean: 0, pose: 'ride' }),
    lean_l1: renderBikerFrame({ ...palette, lean: -1, pose: 'ride' }),
    lean_l2: renderBikerFrame({ ...palette, lean: -2, pose: 'ride' }),
    lean_r1: renderBikerFrame({ ...palette, lean: 1, pose: 'ride' }),
    lean_r2: renderBikerFrame({ ...palette, lean: 2, pose: 'ride' }),
    wheelie: renderBikerFrame({ ...palette, lean: 0, wheelie: true, pose: 'ride' }),
    punch_l: renderBikerFrame({ ...palette, lean: -0.4, pose: 'punch_l' }),
    punch_r: renderBikerFrame({ ...palette, lean: 0.4, pose: 'punch_r' }),
    kick_l: renderBikerFrame({ ...palette, lean: 0.3, pose: 'kick_l' }),
    kick_r: renderBikerFrame({ ...palette, lean: -0.3, pose: 'kick_r' }),
    hit_l: renderBikerFrame({ ...palette, lean: -0.6, pose: 'hit_l' }),
    hit_r: renderBikerFrame({ ...palette, lean: 0.6, pose: 'hit_r' }),
    // Cache weapon swings per weapon type dynamically
    weapons: {},
    tumble: [
      renderFallenOrRunningRider(palette, 'tumble', 0),
      renderFallenOrRunningRider(palette, 'tumble', 1)
    ],
    run: [
      renderFallenOrRunningRider(palette, 'run', 0),
      renderFallenOrRunningRider(palette, 'run', 1),
      renderFallenOrRunningRider(palette, 'run', 2),
      renderFallenOrRunningRider(palette, 'run', 3)
    ],
    downedBike: renderDownedBikeFrame(palette.bikeColor, palette.isCop)
  };

  for (const w of ['club', 'chain', 'crowbar', 'nunchaku']) {
    set.weapons[w] = {
      windup_l: renderBikerFrame({ ...palette, weapon: w, pose: 'windup_l' }),
      windup_r: renderBikerFrame({ ...palette, weapon: w, pose: 'windup_r' }),
      swing_l: renderBikerFrame({ ...palette, weapon: w, pose: 'swing_l' }),
      swing_r: renderBikerFrame({ ...palette, weapon: w, pose: 'swing_r' })
    };
  }
  // Ensure default weapon exists too
  if (!set.weapons[weapon]) {
    set.weapons[weapon] = set.weapons.club;
  }

  textureCache.set(key, set);
  return set;
}

/**
 * Pedestrians (Sidewalk walkers & Crosswalk jaywalkers!)
 * Includes 4-frame walk cycle + 2 comical airborne/cartwheel hit frames + dazed sitting frame!
 */
export function getPedestrianSprites() {
  if (textureCache.has('__peds__')) return textureCache.get('__peds__');

  const outfits = [
    { top: '#ef4444', pants: '#1d4ed8', hair: '#451a03', skin: '#f5cba7' },
    { top: '#f8fafc', pants: '#0f172a', hair: '#ca8a04', skin: '#f1c27d' },
    { top: '#14b8a6', pants: '#334155', hair: '#111827', skin: '#e0ac69' },
    { top: '#eab308', pants: '#1e3a8a', hair: '#7c2d12', skin: '#f5cba7' }
  ];

  const variants = outfits.map((o) => {
    const walk = [0, 1, 2, 3].map((step) => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 84;
      const ctx = c.getContext('2d');
      const stride = Math.sin((step / 4) * Math.PI * 2) * 8;

      // Shadow
      ctx.fillStyle = 'rgba(5, 6, 12, 0.5)';
      ctx.beginPath();
      ctx.ellipse(32, 78, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs walking sideways across crosswalk
      ctx.strokeStyle = o.pants;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(30, 48);
      ctx.lineTo(30 - stride, 74);
      ctx.moveTo(34, 48);
      ctx.lineTo(34 + stride, 74);
      ctx.stroke();

      // Sneakers
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(26 - stride, 72, 8, 5);
      ctx.fillRect(30 + stride, 72, 8, 5);

      // Jacket / Shirt
      ctx.fillStyle = o.top;
      ctx.fillRect(24, 26, 16, 24);
      ctx.fillStyle = shadeHex(o.top, 35);
      ctx.fillRect(25, 27, 6, 20);

      // Swinging arms
      ctx.strokeStyle = o.top;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(26, 30);
      ctx.lineTo(24 + stride * 0.8, 48);
      ctx.moveTo(38, 30);
      ctx.lineTo(40 - stride * 0.8, 48);
      ctx.stroke();

      // Head & Hair
      ctx.fillStyle = o.skin;
      ctx.beginPath();
      ctx.arc(32, 18, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = o.hair;
      ctx.fillRect(25, 10, 14, 6);

      return finalizeSpriteTexture(c, 10);
    });

    // Comical cartwheeling / bumped airborne frames (unharmed cartoon physics!)
    const fly = [0, 1].map((rotIdx) => {
      const c = document.createElement('canvas');
      c.width = 76;
      c.height = 76;
      const ctx = c.getContext('2d');
      ctx.save();
      ctx.translate(38, 38);
      ctx.rotate(rotIdx === 0 ? 0.85 : -1.15);

      // Pinwheeling legs & arms!
      ctx.strokeStyle = o.pants;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-4, 6);
      ctx.lineTo(-18, 24);
      ctx.moveTo(4, 6);
      ctx.lineTo(20, 20);
      ctx.stroke();

      ctx.strokeStyle = o.top;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(-24, -18);
      ctx.moveTo(8, -6);
      ctx.lineTo(24, -16);
      ctx.stroke();

      ctx.fillStyle = o.top;
      ctx.fillRect(-8, -10, 16, 18);
      ctx.fillStyle = o.skin;
      ctx.beginPath();
      ctx.arc(0, -17, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return finalizeSpriteTexture(c, 10);
    });

    return { walk, fly };
  });

  textureCache.set('__peds__', variants);
  return variants;
}

/**
 * 90s Traffic Cars & Trucks (Front view for oncoming left lanes — Screenshot 6 white coupe!,
 * and Rear view for same-direction right lanes!)
 */
export function getVehicleSprites() {
  if (textureCache.has('__vehicles__')) return textureCache.get('__vehicles__');

  const specs = [
    { body: '#f1f5f9', kind: 'coupe' }, // Iconic white 90s sports coupe from Screenshot 6!
    { body: '#dc2626', kind: 'sedan' },
    { body: '#2563eb', kind: 'sedan' },
    { body: '#eab308', kind: 'pickup' },
    { body: '#475569', kind: 'van' }
  ];

  const list = specs.map((sp) => {
    const makeView = (isFront) => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 96;
      const ctx = c.getContext('2d');
      const tall = sp.kind === 'van' ? 14 : sp.kind === 'pickup' ? 7 : 0;

      // Ground shadow
      ctx.fillStyle = 'rgba(5, 6, 12, 0.62)';
      ctx.beginPath();
      ctx.ellipse(64, 88, 48, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Left & Right Tires
      ctx.fillStyle = '#0b0f17';
      ctx.fillRect(19, 66, 16, 22);
      ctx.fillRect(93, 66, 16, 22);

      // Lower bumper & body
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(16, 66, 96, 11);

      ctx.fillStyle = shadeHex(sp.body, -28);
      ctx.fillRect(18, 42 - tall * 0.4, 92, 27 + tall * 0.4);
      ctx.fillStyle = sp.body;
      ctx.fillRect(20, 40 - tall * 0.4, 88, 22 + tall * 0.4);

      // Roof cabin & tinted windshield
      ctx.fillStyle = sp.body;
      ctx.beginPath();
      ctx.moveTo(26, 42 - tall * 0.4);
      ctx.lineTo(35, 20 - tall * 0.6);
      ctx.lineTo(93, 20 - tall * 0.6);
      ctx.lineTo(102, 42 - tall * 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(31, 40 - tall * 0.4);
      ctx.lineTo(38, 24 - tall * 0.6);
      ctx.lineTo(90, 24 - tall * 0.6);
      ctx.lineTo(97, 40 - tall * 0.4);
      ctx.closePath();
      ctx.fill();

      // Windshield sky reflection streak
      ctx.fillStyle = 'rgba(186, 214, 255, 0.45)';
      ctx.beginPath();
      ctx.moveTo(36, 39 - tall * 0.4);
      ctx.lineTo(43, 25 - tall * 0.6);
      ctx.lineTo(56, 25 - tall * 0.6);
      ctx.lineTo(48, 39 - tall * 0.4);
      ctx.closePath();
      ctx.fill();

      if (isFront) {
        // Bright oncoming headlights + dark grille (Screenshot 6!)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(44, 54, 40, 8);
        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(23, 51, 17, 9);
        ctx.fillRect(88, 51, 17, 9);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(26, 53, 11, 5);
        ctx.fillRect(91, 53, 11, 5);
      } else {
        // Rear red taillights + license plate
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(22, 50, 20, 9);
        ctx.fillRect(86, 50, 20, 9);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(54, 53, 20, 9);
      }

      return finalizeSpriteTexture(c, 10);
    };

    return {
      kind: sp.kind,
      front: makeView(true),
      rear: makeView(false)
    };
  });

  textureCache.set('__vehicles__', list);
  return list;
}

/**
 * Roadside 1996 Props: Traffic Lights (Screenshot 1!), Yellow Curve Warning Signs (Screenshot 4!),
 * Green Highway Signs (Screenshot 2!), Billboards (Screenshot 5!), Trees, Poles, Boulders!
 */
export function getPropSprites() {
  if (textureCache.has('__props__')) return textureCache.get('__props__');

  const props = {};

  // 1. Signalized Intersection Traffic Light Pole (Exact match to Screenshot 1!)
  for (const state of ['green', 'red']) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 144;
    const ctx = c.getContext('2d');
    // Base & silver pole
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(34, 138, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(29, 20, 6, 118);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(30, 20, 2, 118);
    ctx.fillRect(25, 132, 14, 6);
    // Signal housing
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(20, 12, 24, 48);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(20, 12, 24, 48);
    // Red / Yellow / Green lenses
    ctx.fillStyle = state === 'red' ? '#ff2a2a' : '#450a0a';
    ctx.beginPath();
    ctx.arc(32, 22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#422006';
    ctx.beginPath();
    ctx.arc(32, 36, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = state === 'green' ? '#22ff55' : '#052e16';
    ctx.beginPath();
    ctx.arc(32, 50, 6, 0, Math.PI * 2);
    ctx.fill();
    // Pedestrian WALK / DON'T WALK box (Screenshot 1!)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(21, 66, 22, 15);
    ctx.fillStyle = state === 'green' ? '#ef4444' : '#38bdf8';
    ctx.fillRect(25, 70, 14, 7);

    props[`traffic_light_${state}`] = finalizeSpriteTexture(c, 8);
  }
  props.traffic_light = props.traffic_light_green;

  // 2. Yellow Diamond Winding Curve Sign (Exact match to Screenshot 4!)
  for (const dir of ['left', 'right']) {
    const c = document.createElement('canvas');
    c.width = 72;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#64748b';
    ctx.fillRect(34, 46, 5, 80);
    ctx.save();
    ctx.translate(36, 32);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-18, -18, 36, 36);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.strokeRect(-16, -16, 32, 32);
    ctx.restore();

    // Winding black arrow
    const s = dir === 'right' ? 1 : -1;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(36 - s * 4, 44);
    ctx.lineTo(36 - s * 4, 34);
    ctx.lineTo(36 + s * 6, 26);
    ctx.lineTo(36 + s * 6, 18);
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(36 + s * 6, 13);
    ctx.lineTo(30 + s * 6, 21);
    ctx.lineTo(42 + s * 6, 21);
    ctx.closePath();
    ctx.fill();

    props[`sign_curve_${dir}`] = finalizeSpriteTexture(c, 8);
  }

  // 3. White Crosswalk / Lane Merge Regulatory Sign (Screenshot 1!)
  {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 120;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#64748b';
    ctx.fillRect(30, 44, 4, 74);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(16, 14, 32, 36);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 16, 28, 32);
    ctx.fillStyle = '#111827';
    ctx.fillRect(23, 22, 4, 20);
    ctx.fillRect(37, 22, 4, 20);
    ctx.fillRect(29, 28, 6, 14);
    props.sign_crosswalk = finalizeSpriteTexture(c, 8);
  }

  // 4. Green California Highway Junction Sign (Screenshot 2: Junction / Big Basin!)
  {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#78716c';
    ctx.fillRect(28, 62, 6, 64);
    ctx.fillRect(94, 62, 6, 64);
    ctx.fillStyle = '#065f46';
    ctx.fillRect(10, 14, 108, 52);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.strokeRect(13, 17, 102, 46);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('JUNCTION', 22, 33);
    ctx.fillText('BIG BASIN ->', 20, 52);
    props.highway_sign = finalizeSpriteTexture(c, 8);
  }

  // 5. Roadside California Billboard on Dual Posts (Screenshot 5!)
  {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#57534e';
    ctx.fillRect(38, 68, 7, 58);
    ctx.fillRect(114, 68, 7, 58);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(10, 14, 140, 58);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 16, 136, 54);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('ROAD RASH', 22, 38);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('CALIFORNIA 96', 24, 58);
    props.billboard = finalizeSpriteTexture(c, 8);
  }

  // 6. Digitized-look 90s Trees (Oak/Cypress from Screenshot 2, Alpine Pine, Urban Street Tree)
  const makeTree = (kind) => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 160;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.beginPath();
    ctx.ellipse(64, 152, 24, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Multi-forked brown bark trunk (Screenshot 2!)
    ctx.fillStyle = '#4a2511';
    ctx.fillRect(58, 92, 12, 60);
    ctx.fillStyle = '#7c3f1c';
    ctx.fillRect(60, 92, 5, 60);

    if (kind === 'pine') {
      for (let tier = 0; tier < 4; tier++) {
        const yTop = 14 + tier * 24;
        const w = 22 + tier * 11;
        ctx.fillStyle = '#143820';
        ctx.beginPath();
        ctx.moveTo(64, yTop);
        ctx.lineTo(64 - w, yTop + 38);
        ctx.lineTo(64 + w, yTop + 38);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#255c36';
        ctx.beginPath();
        ctx.moveTo(64, yTop + 3);
        ctx.lineTo(64 - w * 0.78, yTop + 34);
        ctx.lineTo(64 + w * 0.35, yTop + 34);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Leafy stippled canopy clusters
      const blobs = [
        [64, 46, 36, 26],
        [40, 62, 26, 22],
        [88, 60, 28, 22],
        [56, 74, 30, 20]
      ];
      for (const [bx, by, rx, ry] of blobs) {
        ctx.fillStyle = '#173819';
        ctx.beginPath();
        ctx.ellipse(bx, by + 4, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2b5e28';
        ctx.beginPath();
        ctx.ellipse(bx - 2, by, rx * 0.9, ry * 0.88, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#478238';
        ctx.beginPath();
        ctx.ellipse(bx - 6, by - 5, rx * 0.55, ry * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return finalizeSpriteTexture(c, 12);
  };
  props.oak_tree = makeTree('oak');
  props.pine_tree = makeTree('pine');
  props.city_tree = makeTree('oak');

  // 7. Utility Telephone Pole, City Trash Can & Shoulder Ramp Boulder
  {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 160;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(29, 10, 6, 148);
    ctx.fillStyle = '#7c5032';
    ctx.fillRect(30, 10, 2, 148);
    ctx.fillStyle = '#4a2e19';
    ctx.fillRect(12, 22, 40, 5);
    ctx.fillRect(16, 36, 32, 4);
    props.pole = finalizeSpriteTexture(c, 8);
  }
  {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#78350f';
    ctx.fillRect(14, 24, 20, 36);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(16, 24, 7, 36);
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(18, 28, 12, 8);
    props.trash_can = finalizeSpriteTexture(c, 8);
  }
  {
    const c = document.createElement('canvas');
    c.width = 80;
    c.height = 56;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(40, 48, 28, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57534e';
    ctx.beginPath();
    ctx.moveTo(12, 47);
    ctx.lineTo(26, 22);
    ctx.lineTo(54, 19);
    ctx.lineTo(68, 47);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a8a29e';
    ctx.beginPath();
    ctx.moveTo(20, 42);
    ctx.lineTo(28, 24);
    ctx.lineTo(50, 22);
    ctx.lineTo(44, 40);
    ctx.closePath();
    ctx.fill();
    props.boulder_ramp = finalizeSpriteTexture(c, 10);
  }

  textureCache.set('__props__', props);
  return props;
}
