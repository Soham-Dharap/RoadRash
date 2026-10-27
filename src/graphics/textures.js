import * as THREE from 'three';
import { mulberry32 } from '../data/tracks.js';

function makeNearestTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatX > 1 || repeatY > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  } else {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function createTrackTextures(track) {
  const rng = mulberry32(track.seed + 999);

  // 1. 4-LANE HIGHWAY ASPHALT + SHOULDERS TEXTURE (256x256 pixel-crisp)
  // Layout across U [0..1]:
  // [0.00..0.13] Dirt/Sidewalk Shoulder
  // [0.13..0.148] Solid White Left Edge Line
  // [0.15..0.50] Oncoming 2 Lanes (dashed white divider at 0.32)
  // [0.488..0.512] Double Yellow Center Line
  // [0.50..0.85] Forward Race 2 Lanes (dashed white divider at 0.68)
  // [0.852..0.87] Solid White Right Edge Line
  // [0.87..1.00] Dirt/Sidewalk Shoulder
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 256;
  roadCanvas.height = 128;
  const rctx = roadCanvas.getContext('2d');
  const rImg = rctx.createImageData(256, 128);
  const baseAsphalt = hexToRgb(track.asphaltBase);
  const shoulderRgb = hexToRgb(track.shoulderColor);

  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 256; x++) {
      const u = x / 256;
      const v = y / 128;
      const idx = (y * 256 + x) * 4;
      const grain = (rng() - 0.5) * 18;

      if (u < 0.13 || u > 0.87) {
        // Textured dirt gravel or urban sidewalk curb
        let sr = shoulderRgb[0] + grain * 1.3;
        let sg = shoulderRgb[1] + grain * 1.2;
        let sb = shoulderRgb[2] + grain * 1.1;
        if (track.urban) {
          // Concrete sidewalk blocks + dark curb edge
          const nearCurb = (u >= 0.115 && u < 0.13) || (u > 0.87 && u <= 0.885);
          if (nearCurb) {
            sr -= 28;
            sg -= 28;
            sb -= 26;
          } else if (y % 32 === 0) {
            sr -= 18;
            sg -= 18;
            sb -= 18;
          }
        } else {
          // Pebble dithering on dirt shoulder
          if (((x + y * 3) & 3) === 0) {
            sr -= 14;
            sg -= 12;
            sb -= 10;
          }
        }
        rImg.data[idx] = Math.max(0, Math.min(255, sr));
        rImg.data[idx + 1] = Math.max(0, Math.min(255, sg));
        rImg.data[idx + 2] = Math.max(0, Math.min(255, sb));
        rImg.data[idx + 3] = 255;
      } else {
        // 1996 SVGA Asphalt with darker wheel-rut tracks in each of the 4 lanes
        const laneCenters = [0.235, 0.405, 0.595, 0.765];
        let rutDarken = 0;
        for (const lc of laneCenters) {
          const dist = Math.abs(u - lc);
          if (dist < 0.055) rutDarken += (1 - dist / 0.055) * 9;
        }
        let ar = baseAsphalt[0] - rutDarken + grain * 0.65;
        let ag = baseAsphalt[1] - rutDarken + grain * 0.65;
        let ab = baseAsphalt[2] - rutDarken + grain * 0.72;

        // Solid white outer edge stripes
        if ((u >= 0.135 && u <= 0.15) || (u >= 0.85 && u <= 0.865)) {
          ar = 228 + grain * 0.5;
          ag = 230 + grain * 0.5;
          ab = 234 + grain * 0.5;
        }
        // Double yellow center divider (one solid, one solid/semi-dashed classic CA highway style)
        else if ((u >= 0.486 && u <= 0.496) || (u >= 0.504 && u <= 0.514)) {
          ar = 226 + grain * 0.5;
          ag = 182 + grain * 0.5;
          ab = 36 + grain * 0.3;
        }
        // Dashed white lane dividers (left lanes & right lanes)
        else if ((Math.abs(u - 0.318) < 0.006 || Math.abs(u - 0.682) < 0.006) && v < 0.46) {
          ar = 222 + grain * 0.5;
          ag = 225 + grain * 0.5;
          ab = 230 + grain * 0.5;
        }

        rImg.data[idx] = Math.max(0, Math.min(255, ar));
        rImg.data[idx + 1] = Math.max(0, Math.min(255, ag));
        rImg.data[idx + 2] = Math.max(0, Math.min(255, ab));
        rImg.data[idx + 3] = 255;
      }
    }
  }
  rctx.putImageData(rImg, 0, 0);

  // 2. INTERSECTION + CROSSWALK TEXTURE (Screenshot 1 exact white crosswalk bars!)
  const crossCanvas = document.createElement('canvas');
  crossCanvas.width = 256;
  crossCanvas.height = 128;
  const cctx = crossCanvas.getContext('2d');
  cctx.drawImage(roadCanvas, 0, 0);
  // Pave over shoulders for side-street apron
  cctx.fillStyle = track.asphaltBase;
  cctx.fillRect(0, 18, 36, 92);
  cctx.fillRect(220, 18, 36, 92);
  //Erase center yellow inside intersection box & draw crisp white parallel crosswalk bars
  cctx.fillStyle = track.asphaltBase;
  cctx.fillRect(36, 16, 184, 96);
  cctx.fillStyle = '#e5e7eb';
  // Two horizontal white crosswalk lines (exact match to Screenshot 1!) + subtle zebra blocks
  cctx.fillRect(35, 14, 186, 6);
  cctx.fillRect(35, 34, 186, 5);
  cctx.fillRect(35, 92, 186, 5);
  cctx.fillRect(35, 110, 186, 6);
  for (let x = 42; x < 214; x += 16) {
    cctx.fillStyle = 'rgba(232,235,240,0.85)';
    cctx.fillRect(x, 18, 8, 16);
    cctx.fillRect(x, 96, 8, 14);
  }

  // 3. CHECKERED FINISH LINE ROAD TEXTURE
  const finishCanvas = document.createElement('canvas');
  finishCanvas.width = 256;
  finishCanvas.height = 128;
  const fctx = finishCanvas.getContext('2d');
  fctx.drawImage(roadCanvas, 0, 0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 22; col++) {
      fctx.fillStyle = (row + col) % 2 === 0 ? '#f8fafc' : '#111827';
      fctx.fillRect(35 + col * 8.4, 44 + row * 10, 8.5, 10);
    }
  }

  // 4. TERRAIN EMBANKMENT TEXTURES (Pixel-dithered 1996 SVGA grass, cliff, ocean, vineyard, sidewalk)
  function buildTerrainTex(kind) {
    const tc = document.createElement('canvas');
    tc.width = 128;
    tc.height = 128;
    const ctx = tc.getContext('2d');
    const img = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 4;
        const n1 = Math.sin(x * 0.22 + y * 0.13) * 0.5 + 0.5;
        const n2 = rng();
        let r = 70, g = 105, b = 58;

        if (kind === 'grass' || kind === 'pine_hill') {
          // Authentic 1996 speckled sage/olive/emerald hill texture (Screenshots 1 & 4!)
          const shade = n1 * 28 + (n2 - 0.5) * 38;
          r = (kind === 'pine_hill' ? 52 : 66) + shade * 0.85;
          g = (kind === 'pine_hill' ? 84 : 102) + shade;
          b = (kind === 'pine_hill' ? 56 : 56) + shade * 0.65;
          if (((x ^ y) & 3) === 0 && n2 > 0.65) {
            r += 24;
            g += 22;
            b += 14;
          }
        } else if (kind === 'cliff') {
          // Layered brown/ochre rock strata (Screenshot 2 left cliff!)
          const strata = Math.sin(y * 0.35 + Math.sin(x * 0.14) * 2.2) * 22 + (n2 - 0.5) * 32;
          r = 126 + strata;
          g = 98 + strata * 0.85;
          b = 74 + strata * 0.7;
        } else if (kind === 'ocean') {
          // Shimmering Pacific surf with whitecap foam streaks (Screenshot 2 right side!)
          const wave = Math.sin(y * 0.45 + x * 0.15) * 18 + (n2 - 0.5) * 20;
          r = 46 + wave * 0.8;
          g = 108 + wave;
          b = 178 + wave * 1.1;
          if (wave > 18 && n2 > 0.55) {
            r = 215;
            g = 232;
            b = 248;
          }
        } else if (kind === 'vineyard') {
          // Napa green/gold striped vineyard rows
          const rowBand = Math.sin(x * 0.52) > 0.15;
          const v = (n2 - 0.5) * 28;
          r = (rowBand ? 68 : 118) + v;
          g = (rowBand ? 112 : 98) + v;
          b = (rowBand ? 46 : 58) + v;
        } else {
          // Urban concrete lot / plaza pavement
          const v = (n2 - 0.5) * 16;
          r = 112 + v;
          g = 112 + v;
          b = 118 + v;
          if (x % 32 === 0 || y % 32 === 0) {
            r -= 18;
            g -= 18;
            b -= 18;
          }
        }
        img.data[i] = Math.max(0, Math.min(255, r));
        img.data[i + 1] = Math.max(0, Math.min(255, g));
        img.data[i + 2] = Math.max(0, Math.min(255, b));
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return makeNearestTexture(tc, 4, 2);
  }

  // 5. CORRUGATED STEEL GUARDRAIL TEXTURE (Screenshots 2 & 4!)
  const railCanvas = document.createElement('canvas');
  railCanvas.width = 128;
  railCanvas.height = 64;
  const gctx = railCanvas.getContext('2d');
  gctx.clearRect(0, 0, 128, 64);
  // Wooden support posts at intervals
  for (let px of [14, 78]) {
    gctx.fillStyle = '#6b3e20';
    gctx.fillRect(px, 14, 14, 50);
    gctx.fillStyle = '#8c532b';
    gctx.fillRect(px + 2, 14, 5, 50);
    gctx.fillStyle = '#3f220f';
    gctx.fillRect(px + 10, 14, 4, 50);
  }
  // W-beam corrugated horizontal steel rail
  const railGrad = gctx.createLinearGradient(0, 12, 0, 38);
  railGrad.addColorStop(0, '#cbd5e1');
  railGrad.addColorStop(0.28, '#f1f5f9');
  railGrad.addColorStop(0.5, '#64748b');
  railGrad.addColorStop(0.75, '#e2e8f0');
  railGrad.addColorStop(1, '#475569');
  gctx.fillStyle = railGrad;
  gctx.fillRect(0, 12, 128, 25);
  // Bolts & weathering pixel grain
  gctx.fillStyle = '#334155';
  for (let bx = 6; bx < 128; bx += 32) {
    gctx.fillRect(bx, 18, 3, 3);
    gctx.fillRect(bx, 28, 3, 3);
  }

  // 6. SAN FRANCISCO 1996 BUILDING FACADE TEXTURES (Screenshots 3 & 6!)
  const buildingStyles = [
    { wall: '#8f5b3c', trim: '#c79e7e', win: '#1d2432', shop: '#231f20' }, // Terra-cotta brownstone
    { wall: '#4f6d9a', trim: '#8aa8d6', win: '#17253b', shop: '#1b2838' }, // Blue-steel SF midrise (Screenshot 3!)
    { wall: '#b8b2a6', trim: '#dfd9cc', win: '#262930', shop: '#1c1d22' }, // Classical stone archway block (Screenshot 6!)
    { wall: '#9c7853', trim: '#bfa07a', win: '#291d14', shop: '#1f1610' }, // Warm brick commercial
    { wall: '#6d7078', trim: '#9ca0aa', win: '#181c24', shop: '#12151c' }  // Industrial concrete loft
  ];
  const buildingTextures = buildingStyles.map((st, idx) => {
    const bc = document.createElement('canvas');
    bc.width = 128;
    bc.height = 160;
    const bctx = bc.getContext('2d');
    bctx.fillStyle = st.wall;
    bctx.fillRect(0, 0, 128, 160);

    // Subtle pixel brick/stone noise
    for (let y = 0; y < 160; y += 2) {
      for (let x = 0; x < 128; x += 2) {
        if (rng() < 0.35) {
          bctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.08)';
          bctx.fillRect(x, y, 2, 2);
        }
      }
    }
    // Roof cornice & floor ledges
    bctx.fillStyle = st.trim;
    bctx.fillRect(0, 0, 128, 7);
    bctx.fillRect(0, 118, 128, 5);
    // Vertical pilasters
    for (let px = 0; px < 128; px += 32) {
      bctx.fillStyle = st.trim;
      bctx.fillRect(px, 0, 4, 160);
    }
    // Upper floor windows (4 floors x 4 bays)
    for (let fy = 14; fy < 110; fy += 25) {
      for (let fx = 8; fx < 122; fx += 32) {
        bctx.fillStyle = st.win;
        bctx.fillRect(fx, fy, 18, 16);
        // Window reflection glint
        if (((fx + fy + idx) & 3) === 0) {
          bctx.fillStyle = 'rgba(165, 198, 245, 0.35)';
          bctx.fillRect(fx + 2, fy + 2, 6, 12);
        }
        bctx.fillStyle = st.trim;
        bctx.fillRect(fx - 1, fy + 16, 20, 2);
      }
    }
    // Ground-floor dark recessed storefront arches (exact look of Screenshot 3 & 6!)
    for (let fx = 6; fx < 122; fx += 32) {
      bctx.fillStyle = st.shop;
      bctx.fillRect(fx, 126, 22, 34);
      bctx.fillStyle = 'rgba(210, 180, 110, 0.25)';
      bctx.fillRect(fx + 3, 130, 16, 8);
    }
    return makeNearestTexture(bc, 1, 1);
  });

  // 7. SKY + PIXEL-DITHERED CLOUDS + DISTANT MOUNTAIN HORIZON PANORAMA (1024x256)
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 1024;
  skyCanvas.height = 256;
  const sctx = skyCanvas.getContext('2d');
  const skyGrad = sctx.createLinearGradient(0, 0, 0, 205);
  skyGrad.addColorStop(0, track.skyTop);
  skyGrad.addColorStop(0.72, track.skyBottom);
  skyGrad.addColorStop(1, '#c9d9fa');
  sctx.fillStyle = skyGrad;
  sctx.fillRect(0, 0, 1024, 256);

  // Chunky 90s SVGA fluffy clouds with lavender/blue undersides!
  for (let c = 0; c < 26; c++) {
    const cx = rng() * 1024;
    const cy = 22 + rng() * 98;
    const cw = 48 + rng() * 95;
    const ch = 16 + rng() * 24;
    for (let puff = 0; puff < 7; puff++) {
      const ox = (puff - 3) * (cw * 0.16);
      const oy = Math.sin(puff * 1.4) * (ch * 0.22);
      const rw = cw * (0.28 + rng() * 0.16);
      const rh = ch * (0.55 + rng() * 0.25);
      // Lavender-grey cloud shadow
      sctx.fillStyle = 'rgba(148, 166, 214, 0.75)';
      sctx.beginPath();
      sctx.ellipse((cx + ox + 1024) % 1024, cy + oy + 4, rw, rh, 0, 0, Math.PI * 2);
      sctx.fill();
      // Crisp white cloud top
      sctx.fillStyle = 'rgba(246, 250, 255, 0.92)';
      sctx.beginPath();
      sctx.ellipse((cx + ox + 1024) % 1024, cy + oy, rw * 0.92, rh * 0.85, 0, 0, Math.PI * 2);
      sctx.fill();
    }
  }

  // Distant Mountain Range Silhouette along bottom of sky dome (Screenshots 1, 2, 4, 5!)
  const mBase = hexToRgb(track.mountainColor);
  const mHi = hexToRgb(track.mountainHi);
  for (let x = 0; x < 1024; x++) {
    const u = (x / 1024) * Math.PI * 2;
    const ridge1 =
      Math.sin(u * 3) * 18 +
      Math.sin(u * 7 + 1.2) * 11 +
      Math.sin(u * 15 + 0.5) * 5;
    const topY = Math.floor(164 - ridge1);
    for (let y = topY; y < 256; y++) {
      const t = Math.min(1, (y - topY) / 38);
      const snowCap = y - topY < 10 + (rng() * 5) && (track.id === 'sierra' || track.id === 'peninsula');
      const dither = (rng() - 0.5) * 18;
      const r = (snowCap ? mHi[0] : mBase[0] * (1 - t * 0.25) + mHi[0] * (t * 0.25)) + dither;
      const g = (snowCap ? mHi[1] : mBase[1] * (1 - t * 0.25) + mHi[1] * (t * 0.25)) + dither;
      const b = (snowCap ? mHi[2] : mBase[2] * (1 - t * 0.25) + mHi[2] * (t * 0.25)) + dither;
      sctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
      sctx.fillRect(x, y, 1, 2);
    }
  }

  const skyTex = makeNearestTexture(skyCanvas, 1, 1);
  skyTex.wrapS = THREE.RepeatWrapping;

  return {
    road: makeNearestTexture(roadCanvas, 1, 1),
    crosswalk: makeNearestTexture(crossCanvas, 1, 1),
    finish: makeNearestTexture(finishCanvas, 1, 1),
    leftGround: buildTerrainTex(track.groundLeft),
    rightGround: buildTerrainTex(track.groundRight),
    guardrail: makeNearestTexture(railCanvas, 1, 1),
    buildings: buildingTextures,
    sky: skyTex
  };
}
