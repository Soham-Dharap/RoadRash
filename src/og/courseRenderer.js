// Authentic 1996 Road Rash 3D Course + Horizon + Depth-Sorted Sprite Renderer
import * as THREE from 'three';

export const SAMPLE_LEN = 256; // longitudinal world units per .CRS sample
const CHUNK_SAMPLES = 64;
const DRAW_AHEAD_SAMPLES = 88;
const DRAW_BEHIND_SAMPLES = 10;
const FOCAL_PX = 512; // 640x480 focal length matching road.cpp depth table
const OPTICAL_CX = 320;
const OPTICAL_CY = 180; // centered in the 640x360 windshield above the dashboard

export class CourseRenderer {
  constructor(glCanvas, assets) {
    this.assets = assets;
    this.glCanvas = glCanvas;
    // Render WebGL offscreen/alpha-composited into the unified 640x480 frame
    this.glCanvas.style.display = 'none';

    this.renderer = new THREE.WebGLRenderer({
      canvas: glCanvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(640, 480, false);
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);

    // Exact 1996 frustum: optical axis at (320, 180) with focal length 512px
    const fullH = 600;
    const fovDeg = (2 * Math.atan(fullH * 0.5 / FOCAL_PX) * 180) / Math.PI;
    this.camera = new THREE.PerspectiveCamera(fovDeg, 640 / fullH, 30, SAMPLE_LEN * (DRAW_AHEAD_SAMPLES + 6));
    this.camera.setViewOffset(640, fullH, 0, 120, 640, 480);

    this.scene = new THREE.Scene();
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(this.ambientLight);

    this.course = null;
    this.horizonImg = null;
    this.centerline = []; // { x, y, z, yaw, pitch, left, right, shL, shR, tunnel }
    this.chunks = [];
    this.objectsBySample = [];
    this.materialCache = new Map();

    // Scratch vectors
    this._tmpVec = new THREE.Vector3();
    this._camInv = new THREE.Matrix4();
    this.crestClipY = new Float32Array(128);
  }

  disposeCourse() {
    for (const ch of this.chunks) {
      this.scene.remove(ch);
      ch.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
      });
    }
    this.chunks = [];
    this.centerline = [];
    this.objectsBySample = [];
  }

  getMaterial(texId, { fallbackColor = 0x555555, repeatS = true, repeatT = true, polygonOffset = false } = {}) {
    const key = `${texId}_${fallbackColor}_${repeatS ? 1 : 0}_${repeatT ? 1 : 0}_${polygonOffset ? 1 : 0}`;
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const tex = texId >= 0 ? this.assets.getWorldThreeTexture(texId, repeatS, repeatT) : null;
    const mat = new THREE.MeshBasicMaterial({
      map: tex || null,
      color: tex ? 0xffffff : fallbackColor,
      side: THREE.DoubleSide,
      transparent: Boolean(tex && this.assets.worldMeta?.rects?.[texId]?.[4]),
      alphaTest: tex && this.assets.worldMeta?.rects?.[texId]?.[4] ? 0.45 : 0,
      polygonOffset,
      polygonOffsetFactor: polygonOffset ? -1 : 0,
      polygonOffsetUnits: polygonOffset ? -2 : 0
    });
    this.materialCache.set(key, mat);
    return mat;
  }

  buildCourse(course, horizonImg, level = 0) {
    this.disposeCourse();
    this.course = course;
    this.horizonImg = horizonImg;

    const samples = course.samples;
    const n = samples.length;
    this.centerline = new Array(n);
    this.objectsBySample = Array.from({ length: n }, () => []);

    // Integrate 3D road spline matching road.cpp curvature & elevation
    let x = 0;
    let z = 0;
    let yaw = 0;
    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const bend = s[0];
      const rise = s[1];
      const elev = s[2];
      const dYaw = bend / 256;
      const pitch = Math.atan2(rise, SAMPLE_LEN);

      this.centerline[i] = {
        x,
        y: elev,
        z,
        yaw,
        pitch,
        sinYaw: Math.sin(yaw),
        cosYaw: Math.cos(yaw),
        left: s[3] || 500,
        right: s[4] || 500,
        shL: s[5] || 220,
        shR: s[6] || 220,
        hL: s[7] || 0,
        hR: s[8] || 0,
        flags: s[9] || 0,
        tunnel: s[10] === 1,
        terrainType: s[11] || 0,
        raw: s
      };

      yaw += dYaw;
      x += Math.sin(yaw) * SAMPLE_LEN;
      z -= Math.cos(yaw) * SAMPLE_LEN;
    }

    // Index roadside scenery objects by sample index for fast per-frame sprite projection
    for (const obj of course.objects || []) {
      const rIdx = obj[0];
      if (rIdx >= 0 && rIdx < n) {
        this.objectsBySample[rIdx].push(obj);
      }
    }

    // Build chunked 3D meshes (64 samples per chunk)
    const finishSample = course.finishSamples?.[level] || n - 40;
    const startSample = course.startSample || 50;
    const roadMats = this.assets.worldMeta?.roadMats?.road || [0, 1, 2, 2, 3, 1, 4, 5];
    const groundMats = this.assets.worldMeta?.roadMats?.ground || [6, 7, 8];
    const waterTexId = this.assets.worldMeta?.roadMats?.water ?? 9;

    for (let base = 0; base < n - 1; base += CHUNK_SAMPLES) {
      const end = Math.min(n - 1, base + CHUNK_SAMPLES);
      const group = new THREE.Group();
      group.visible = false;

      // Batch quads by material key inside this chunk
      const batches = new Map();
      const pushQuad = (mat, p0, p1, p2, p3, u0, v0, u1, v1) => {
        let b = batches.get(mat);
        if (!b) {
          b = { mat, pos: [], uv: [], idx: [] };
          batches.set(mat, b);
        }
        const vi = b.pos.length / 3;
        b.pos.push(
          p0[0], p0[1], p0[2],
          p1[0], p1[1], p1[2],
          p2[0], p2[1], p2[2],
          p3[0], p3[1], p3[2]
        );
        b.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
        b.idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      };

      const worldPt = (c, lat, dy = 0) => [
        c.x + c.cosYaw * lat,
        c.y + dy,
        c.z + c.sinYaw * lat
      ];

      for (let i = base; i < end; i++) {
        const c0 = this.centerline[i];
        const c1 = this.centerline[i + 1];
        const r = c0.raw;

        // 1. Road surface texture selection
        let roadTex = roadMats[1]; // PLAIN
        if (Math.abs(i - startSample) <= 1) {
          roadTex = roadMats[2]; // START160
        } else if (Math.abs(i - finishSample) <= 1) {
          roadTex = roadMats[0]; // FINISH
        } else if (c0.flags & 8) {
          roadTex = groundMats[0]; // SIDCRSS0 crosswalk
        } else if (c0.flags & 32) {
          roadTex = (c0.flags & 1) && ((i >> 1) & 1) ? roadMats[4] : roadMats[5]; // WHITE / YELLOW
        } else if (c0.flags & 16) {
          roadTex = (i >> 1) & 1 ? roadMats[4] : roadMats[1]; // dashed WHITE
        } else if ((i >> 2) & 1) {
          roadTex = roadMats[5]; // subtle center stripe on unmarked stretches
        }

        const rl0 = worldPt(c0, -c0.left, 0);
        const rr0 = worldPt(c0, c0.right, 0);
        const rr1 = worldPt(c1, c1.right, 0);
        const rl1 = worldPt(c1, -c1.left, 0);
        pushQuad(this.getMaterial(roadTex, { fallbackColor: 0x3b3d42 }), rl0, rr0, rr1, rl1, 0, 0, 1, 1);

        // 2. Left & right shoulders / sidewalks (with curb step if hL/hR > 0)
        const shTexL = r[16];
        const shTexR = r[17];
        const sl0 = worldPt(c0, -c0.left - c0.shL, c0.hL);
        const sl1 = worldPt(c1, -c1.left - c1.shL, c1.hL);
        const sr0 = worldPt(c0, c0.right + c0.shR, c0.hR);
        const sr1 = worldPt(c1, c1.right + c1.shR, c1.hR);

        if (c0.hL > 2) {
          const curbL0 = worldPt(c0, -c0.left, c0.hL);
          const curbL1 = worldPt(c1, -c1.left, c1.hL);
          pushQuad(this.getMaterial(shTexL, { fallbackColor: 0x777777 }), rl0, curbL0, curbL1, rl1, 0, 0, 0.25, 1);
          pushQuad(this.getMaterial(shTexL, { fallbackColor: 0x8a8a84 }), sl0, curbL0, curbL1, sl1, 0, 0, 1, 1);
        } else {
          pushQuad(this.getMaterial(shTexL, { fallbackColor: 0x6c6552 }), sl0, rl0, rl1, sl1, 0, 0, 1, 1);
        }

        if (c0.hR > 2) {
          const curbR0 = worldPt(c0, c0.right, c0.hR);
          const curbR1 = worldPt(c1, c1.right, c1.hR);
          pushQuad(this.getMaterial(shTexR, { fallbackColor: 0x777777 }), rr0, curbR0, curbR1, rr1, 0, 0, 0.25, 1);
          pushQuad(this.getMaterial(shTexR, { fallbackColor: 0x8a8a84 }), curbR0, sr0, sr1, curbR1, 0, 0, 1, 1);
        } else {
          pushQuad(this.getMaterial(shTexR, { fallbackColor: 0x6c6552 }), rr0, sr0, sr1, rr1, 0, 0, 1, 1);
        }

        // 3. Guardrails (railH > 0)
        const railH = r[24] || 0;
        if (railH > 8) {
          const gL0 = worldPt(c0, -c0.left - 24, railH);
          const gL1 = worldPt(c1, -c1.left - 24, railH);
          const gLb0 = worldPt(c0, -c0.left - 24, railH * 0.35);
          const gLb1 = worldPt(c1, -c1.left - 24, railH * 0.35);
          const railMat = this.getMaterial(-1, { fallbackColor: 0xb4b8be });
          pushQuad(railMat, gLb0, gL0, gL1, gLb1, 0, 0, 1, 1);

          const gR0 = worldPt(c0, c0.right + 24, railH);
          const gR1 = worldPt(c1, c1.right + 24, railH);
          const gRb0 = worldPt(c0, c0.right + 24, railH * 0.35);
          const gRb1 = worldPt(c1, c1.right + 24, railH * 0.35);
          pushQuad(railMat, gRb0, gR0, gR1, gRb1, 0, 0, 1, 1);
        }

        // 4. Tunnel enclosure (tunnel === 1)
        if (c0.tunnel) {
          const tunH = 620;
          const tunMat = this.getMaterial(r[14] >= 0 ? r[14] : shTexL, { fallbackColor: 0x353330 });
          const ceilMat = this.getMaterial(-1, { fallbackColor: 0x1e1d1c });
          const tlB0 = sl0;
          const tlB1 = sl1;
          const tlT0 = worldPt(c0, -c0.left - c0.shL * 0.65, tunH);
          const tlT1 = worldPt(c1, -c1.left - c1.shL * 0.65, tunH);
          const trB0 = sr0;
          const trB1 = sr1;
          const trT0 = worldPt(c0, c0.right + c0.shR * 0.65, tunH);
          const trT1 = worldPt(c1, c1.right + c1.shR * 0.65, tunH);
          pushQuad(tunMat, tlB0, tlT0, tlT1, tlB1, 0, 1, 1, 0);
          pushQuad(tunMat, trB0, trT0, trT1, trB1, 0, 1, 1, 0);
          pushQuad(ceilMat, tlT0, trT0, trT1, tlT1, 0, 0, 1, 1);
        }

        // 5. Outer Terrain: City Buildings (0), Coastal/Mountain Cliffs & Water (1/3), Rolling Hills (4)
        const ttype = c0.terrainType;
        if (ttype === 0) {
          const bHL = Math.max(420, r[12] || 720);
          const bHR = Math.max(420, r[13] || 720);
          const bTexL = r[14];
          const bTexR = r[15];

          // Ground apron beyond sidewalk so gaps between buildings have pavement/alley ground
          const outL0 = worldPt(c0, -c0.left - c0.shL - 1800, c0.hL);
          const outL1 = worldPt(c1, -c1.left - c1.shL - 1800, c1.hL);
          const outR0 = worldPt(c0, c0.right + c0.shR + 1800, c0.hR);
          const outR1 = worldPt(c1, c1.right + c1.shR + 1800, c1.hR);
          const alleyMat = this.getMaterial(shTexL, { fallbackColor: 0x454545 });
          pushQuad(alleyMat, outL0, sl0, sl1, outL1, 0, 0, 4, 1);
          pushQuad(alleyMat, sr0, outR0, outR1, sr1, 0, 0, 4, 1);

          if (bTexL >= 0) {
            const bMatL = this.getMaterial(bTexL, { fallbackColor: 0x8c7362, repeatS: true, repeatT: false });
            const roofMat = this.getMaterial(-1, { fallbackColor: 0x383432 });
            const fB0 = sl0;
            const fB1 = sl1;
            const fT0 = worldPt(c0, -c0.left - c0.shL, c0.hL + bHL);
            const fT1 = worldPt(c1, -c1.left - c1.shL, c1.hL + bHL);
            const backT0 = worldPt(c0, -c0.left - c0.shL - 900, c0.hL + bHL);
            const backT1 = worldPt(c1, -c1.left - c1.shL - 900, c1.hL + bHL);
            const u0 = (i % 4) * 0.25;
            pushQuad(bMatL, fB0, fT0, fT1, fB1, u0, 1, u0 + 0.25, 0);
            pushQuad(roofMat, backT0, fT0, fT1, backT1, 0, 0, 1, 1);

            // End-cap wall when building starts or stops (gives crisp 3D depth to SF city blocks!)
            const prevTexL = i > 0 ? samples[i - 1][14] : -1;
            if (prevTexL < 0) {
              const backB0 = worldPt(c0, -c0.left - c0.shL - 900, c0.hL);
              pushQuad(bMatL, backB0, fB0, fT0, backT0, 0, 1, 1, 0);
            }
          }

          if (bTexR >= 0) {
            const bMatR = this.getMaterial(bTexR, { fallbackColor: 0x8c7362, repeatS: true, repeatT: false });
            const roofMat = this.getMaterial(-1, { fallbackColor: 0x383432 });
            const fB0 = sr0;
            const fB1 = sr1;
            const fT0 = worldPt(c0, c0.right + c0.shR, c0.hR + bHR);
            const fT1 = worldPt(c1, c1.right + c1.shR, c1.hR + bHR);
            const backT0 = worldPt(c0, c0.right + c0.shR + 900, c0.hR + bHR);
            const backT1 = worldPt(c1, c1.right + c1.shR + 900, c1.hR + bHR);
            const u0 = (i % 4) * 0.25;
            pushQuad(bMatR, fB0, fT0, fT1, fB1, u0, 1, u0 + 0.25, 0);
            pushQuad(roofMat, fT0, backT0, backT1, fT1, 0, 0, 1, 1);

            const prevTexR = i > 0 ? samples[i - 1][15] : -1;
            if (prevTexR < 0) {
              const backB0 = worldPt(c0, c0.right + c0.shR + 900, c0.hR);
              pushQuad(bMatR, fB0, backB0, backT0, fT0, 0, 1, 1, 0);
            }
          }
        } else if (ttype === 1 || ttype === 3) {
          // Coastal Highway / Canyon: sheer rock wall on high side + ocean water on coastal side
          const wallHL = r[22] || 0;
          const wallHR = r[23] || 0;
          const hillTexL = r[18] >= 0 ? r[18] : shTexL;
          const hillTexR = r[19] >= 0 ? r[19] : shTexR;

          if (wallHL > 40) {
            const wt0 = worldPt(c0, -c0.left - c0.shL - 320, wallHL);
            const wt1 = worldPt(c1, -c1.left - c1.shL - 320, r[22] || wallHL);
            pushQuad(this.getMaterial(hillTexL, { fallbackColor: 0x736350 }), wt0, sl0, sl1, wt1, 0, 0, 1, 1);
          } else {
            // Coastal drop-off & Pacific Ocean water plane
            const w0 = worldPt(c0, -c0.left - c0.shL - 4200, -260);
            const w1 = worldPt(c1, -c1.left - c1.shL - 4200, -260);
            const cliff0 = worldPt(c0, -c0.left - c0.shL - 180, -260);
            const cliff1 = worldPt(c1, -c1.left - c1.shL - 180, -260);
            pushQuad(this.getMaterial(hillTexL, { fallbackColor: 0x6a5b48 }), cliff0, sl0, sl1, cliff1, 0, 0, 1, 1);
            pushQuad(this.getMaterial(waterTexId, { fallbackColor: 0x1c4e80 }), w0, cliff0, cliff1, w1, 0, 0, 6, 1);
          }

          if (wallHR > 40) {
            const wt0 = worldPt(c0, c0.right + c0.shR + 320, wallHR);
            const wt1 = worldPt(c1, c1.right + c1.shR + 320, r[23] || wallHR);
            pushQuad(this.getMaterial(hillTexR, { fallbackColor: 0x736350 }), sr0, wt0, wt1, sr1, 0, 0, 1, 1);
          } else {
            const outR0 = worldPt(c0, c0.right + c0.shR + 3200, 380);
            const outR1 = worldPt(c1, c1.right + c1.shR + 3200, 380);
            pushQuad(this.getMaterial(hillTexR, { fallbackColor: 0x5c6e42 }), sr0, outR0, outR1, sr1, 0, 0, 4, 1);
          }
        } else {
          // Rolling hills / timberland / vineyards (terrainType === 4)
          const hillTexL0 = r[18] >= 0 ? r[18] : shTexL;
          const hillTexR0 = r[19] >= 0 ? r[19] : shTexR;
          const hillTexL1 = r[20] >= 0 ? r[20] : hillTexL0;
          const hillTexR1 = r[21] >= 0 ? r[21] : hillTexR0;

          const r1 = c1.raw;
          const lMidX0 = Math.min(-c0.left - c0.shL - 700, r[27] || -1400);
          const lMidY0 = Math.max(-220, Math.min(950, r[28] || 180));
          const lMidX1 = Math.min(-c1.left - c1.shL - 700, r1[27] || -1400);
          const lMidY1 = Math.max(-220, Math.min(950, r1[28] || 180));

          const rMidX0 = Math.max(c0.right + c0.shR + 700, r[31] || 1400);
          const rMidY0 = Math.max(-220, Math.min(950, r[32] || 180));
          const rMidX1 = Math.max(c1.right + c1.shR + 700, r1[31] || 1400);
          const rMidY1 = Math.max(-220, Math.min(950, r1[32] || 180));

          const lm0 = worldPt(c0, lMidX0, lMidY0);
          const lm1 = worldPt(c1, lMidX1, lMidY1);
          const lf0 = worldPt(c0, lMidX0 - 2400, lMidY0 + 160);
          const lf1 = worldPt(c1, lMidX1 - 2400, lMidY1 + 160);

          const rm0 = worldPt(c0, rMidX0, rMidY0);
          const rm1 = worldPt(c1, rMidX1, rMidY1);
          const rf0 = worldPt(c0, rMidX0 + 2400, rMidY0 + 160);
          const rf1 = worldPt(c1, rMidX1 + 2400, rMidY1 + 160);

          pushQuad(this.getMaterial(hillTexL0, { fallbackColor: 0x4f6d3a }), lm0, sl0, sl1, lm1, 0, 0, 3, 1);
          pushQuad(this.getMaterial(hillTexL1, { fallbackColor: 0x456033 }), lf0, lm0, lm1, lf1, 0, 0, 4, 1);
          pushQuad(this.getMaterial(hillTexR0, { fallbackColor: 0x4f6d3a }), sr0, rm0, rm1, sr1, 0, 0, 3, 1);
          pushQuad(this.getMaterial(hillTexR1, { fallbackColor: 0x456033 }), rm0, rf0, rf1, rm1, 0, 0, 4, 1);
        }
      }

      for (const b of batches.values()) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
        geom.setIndex(b.idx);
        const mesh = new THREE.Mesh(geom, b.mat);
        mesh.frustumCulled = false;
        group.add(mesh);
      }

      this.scene.add(group);
      this.chunks.push(group);
    }
  }

  // O(1) interpolated world pose at continuous sample position
  samplePose(sFloat, lateral = 0, extraY = 0) {
    const n = this.centerline.length;
    if (!n) return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, left: 500, right: 500, shL: 220, shR: 220, tunnel: false };
    const clamped = Math.max(0, Math.min(n - 1.001, sFloat));
    const idx = Math.floor(clamped);
    const t = clamped - idx;
    const c0 = this.centerline[idx];
    const c1 = this.centerline[Math.min(n - 1, idx + 1)];

    const cx = c0.x + (c1.x - c0.x) * t;
    const cy = c0.y + (c1.y - c0.y) * t;
    const cz = c0.z + (c1.z - c0.z) * t;

    let dYaw = c1.yaw - c0.yaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    const yaw = c0.yaw + dYaw * t;
    const pitch = c0.pitch + (c1.pitch - c0.pitch) * t;

    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);

    return {
      x: cx + cosYaw * lateral,
      y: cy + extraY,
      z: cz + sinYaw * lateral,
      yaw,
      pitch,
      bend: c0.raw[0],
      rise: c0.raw[1],
      left: c0.left + (c1.left - c0.left) * t,
      right: c0.right + (c1.right - c0.right) * t,
      shL: c0.shL,
      shR: c0.shR,
      hL: c0.hL,
      hR: c0.hR,
      tunnel: c0.tunnel,
      terrainType: c0.terrainType,
      hasLeftWall: c0.terrainType === 0 ? c0.raw[14] >= 0 : (c0.raw[22] || 0) > 60,
      hasRightWall: c0.terrainType === 0 ? c0.raw[15] >= 0 : (c0.raw[23] || 0) > 60
    };
  }

  projectWorld(wx, wy, wz) {
    this._tmpVec.set(wx, wy, wz).applyMatrix4(this._camInv);
    const zc = -this._tmpVec.z;
    if (zc <= 32) return null;
    const scale = FOCAL_PX / zc;
    return {
      sx: OPTICAL_CX + this._tmpVec.x * scale,
      sy: OPTICAL_CY - this._tmpVec.y * scale,
      zc,
      scale
    };
  }

  renderRaceFrame(ctx, sim) {
    if (!this.course || !this.centerline.length) return;

    // 1. Update camera pose trailing 1.48 samples (~380 world units) behind player
    const camS = Math.max(2, sim.cameraSample);
    const camPose = this.samplePose(camS, sim.cameraLat, sim.cameraHeight);
    this.camera.position.set(camPose.x, camPose.y, camPose.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = -camPose.yaw;
    this.camera.rotation.x = camPose.pitch - 0.015;
    this.camera.rotation.z = -sim.player.lean * 0.055; // subtle visceral lean roll!
    this.camera.updateMatrixWorld(true);
    this._camInv.copy(this.camera.matrixWorldInverse);

    // 2. Toggle only nearby 64-sample chunks visible
    const baseSample = Math.floor(camS);
    const minChunk = Math.max(0, Math.floor((baseSample - DRAW_BEHIND_SAMPLES) / CHUNK_SAMPLES));
    const maxChunk = Math.min(
      this.chunks.length - 1,
      Math.floor((baseSample + DRAW_AHEAD_SAMPLES) / CHUNK_SAMPLES)
    );
    for (let ci = 0; ci < this.chunks.length; ci++) {
      this.chunks[ci].visible = ci >= minChunk && ci <= maxChunk;
    }

    // 3. Draw wrapping 1996 720x320 Horizon + Clouds onto ctx
    this.drawHorizon(ctx, camPose.yaw, camPose.pitch, camPose.tunnel);

    // 4. Render 3D road/buildings/hills/tunnels via WebGL and composite onto 640x480 ctx
    this.renderer.render(this.scene, this.camera);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.glCanvas, 0, 0, 640, 480);

    // 5. Compute per-sample hill-crest occlusion line ahead of camera (88 samples)
    let minRoadY = 480;
    for (let k = 0; k < DRAW_AHEAD_SAMPLES; k++) {
      const sIdx = Math.min(this.centerline.length - 1, baseSample + k);
      const c = this.centerline[sIdx];
      const pr = this.projectWorld(c.x, c.y, c.z);
      if (pr && pr.sy < minRoadY) {
        minRoadY = pr.sy;
      }
      this.crestClipY[k] = minRoadY;
    }

    // 6. Gather depth-sorted 2D sprites (scenery trees/signs, traffic cars, pedestrians, downed bikes, cop, 15 riders)
    const drawList = [];

    // 6a. Roadside scenery objects (trees, traffic lights, highway signs, barns)
    const maxObjSample = Math.min(this.centerline.length - 1, baseSample + DRAW_AHEAD_SAMPLES - 2);
    for (let sIdx = Math.max(0, baseSample - 2); sIdx <= maxObjSample; sIdx++) {
      const objs = this.objectsBySample[sIdx];
      if (!objs || !objs.length) continue;
      const c = this.centerline[sIdx];
      const clipY = this.crestClipY[Math.max(0, Math.min(DRAW_AHEAD_SAMPLES - 1, sIdx - baseSample))] + 6;

      for (let j = 0; j < objs.length; j++) {
        const [rIdx, lat, texId, rawSize, mirror, , hx, hy, w, h] = objs[j];
        const groundY = lat < 0 ? c.hL : c.hR;
        const wx = c.x + c.cosYaw * lat;
        const wy = c.y + groundY;
        const wz = c.z + c.sinYaw * lat;
        const pr = this.projectWorld(wx, wy, wz);
        if (!pr || pr.zc > SAMPLE_LEN * DRAW_AHEAD_SAMPLES) continue;

        const worldScale = rawSize > 0 ? (rawSize / 64) * 0.58 : 3.2;
        const pxScale = pr.scale * worldScale;
        const dw = w * pxScale;
        const dh = h * pxScale;
        if (dw < 2 || dh < 2) continue;

        const ax = mirror ? w - hx : hx;
        const dx = pr.sx - ax * pxScale;
        const dy = pr.sy - hy * pxScale;
        if (dx + dw < -40 || dx > 680 || dy >= clipY) continue;

        const img = this.assets.getWorldCanvas(texId);
        if (!img) continue;
        drawList.push({
          zc: pr.zc,
          img,
          dx,
          dy,
          dw,
          dh,
          mirror: mirror === 1,
          clipY
        });
      }
    }

    // Helper for crest clip lookup at continuous sample
    const clipAtSample = (sFloat) => {
      const rel = Math.floor(sFloat) - baseSample;
      if (rel <= 2) return 480;
      if (rel >= DRAW_AHEAD_SAMPLES) return this.crestClipY[DRAW_AHEAD_SAMPLES - 1];
      return this.crestClipY[rel] + 4;
    };

    // 6b. Traffic Cars & Trucks
    for (const car of sim.traffic) {
      if (Math.abs(car.sample - camS) > DRAW_AHEAD_SAMPLES) continue;
      const pose = this.samplePose(car.sample, car.lat, 0);
      const pr = this.projectWorld(pose.x, pose.y, pose.z);
      if (!pr) continue;
      const sprite = sim.resolveCarSprite(car, camPose.yaw, pose.yaw, pr.zc);
      if (!sprite) continue;

      const pxScale = pr.scale * sprite.worldScale;
      const dw = sprite.canvas.width * pxScale;
      const dh = sprite.canvas.height * pxScale;
      const ax = sprite.mirror ? sprite.canvas.width - sprite.hx : sprite.hx;
      const dx = pr.sx - ax * pxScale;
      const dy = pr.sy - sprite.hy * pxScale;
      const clipY = clipAtSample(car.sample);
      if (dy >= clipY || dx + dw < -40 || dx > 680) continue;

      drawList.push({
        zc: pr.zc,
        img: sprite.canvas,
        dx,
        dy,
        dw,
        dh,
        mirror: sprite.mirror,
        clipY,
        shadowOval: { sx: pr.sx, sy: pr.sy, rx: dw * 0.44, ry: Math.max(3, dw * 0.11) }
      });
    }

    // 6c. Walking & Tumbling Pedestrians
    for (const ped of sim.pedestrians) {
      if (!ped.active || Math.abs(ped.sample - camS) > 64) continue;
      const pose = this.samplePose(ped.sample, ped.lat, ped.airY);
      const pr = this.projectWorld(pose.x, pose.y, pose.z);
      if (!pr) continue;
      const sprite = sim.resolvePedSprite(ped);
      if (!sprite) continue;

      const pxScale = pr.scale * 2.45;
      const dw = sprite.w * pxScale;
      const dh = sprite.h * pxScale;
      const ax = sprite.mirror ? sprite.w - sprite.hx : sprite.hx;
      const dx = pr.sx - ax * pxScale;
      const dy = pr.sy - sprite.hy * pxScale;
      const clipY = clipAtSample(ped.sample);
      if (dy >= clipY) continue;

      const groundPr = ped.airY > 1 ? this.projectWorld(pose.x, pose.y - ped.airY, pose.z) : pr;
      drawList.push({
        zc: pr.zc,
        img: sprite.canvas,
        dx,
        dy,
        dw,
        dh,
        mirror: sprite.mirror,
        rotation: ped.spinAngle || 0,
        clipY,
        shadowOval: groundPr
          ? { sx: groundPr.sx, sy: groundPr.sy, rx: dw * 0.34, ry: Math.max(2, dw * 0.09) }
          : null
      });
    }

    // 6d. Downed Motorcycles lying/sliding on the road (physical ramps!)
    for (const db of sim.downedBikes) {
      if (!db.active || Math.abs(db.sample - camS) > 74) continue;
      const pose = this.samplePose(db.sample, db.lat, 0);
      const pr = this.projectWorld(pose.x, pose.y, pose.z);
      if (!pr) continue;
      const sprite = sim.resolveDownedBikeSprite(db);
      if (!sprite) continue;

      const pxScale = pr.scale * 1.48;
      const dw = sprite.canvas.width * pxScale;
      const dh = sprite.canvas.height * pxScale;
      const dx = pr.sx - dw * 0.5;
      const dy = pr.sy - dh * 0.82;
      const clipY = clipAtSample(db.sample);
      if (dy >= clipY) continue;

      drawList.push({
        zc: pr.zc + 2,
        img: sprite.canvas,
        dx,
        dy,
        dw,
        dh,
        mirror: db.mirror,
        clipY,
        shadowOval: { sx: pr.sx, sy: pr.sy, rx: dw * 0.46, ry: Math.max(3, dw * 0.11) }
      });
    }

    // 6e. Motorcycle Police Officer (LOCOP.DAT)
    if (sim.cop && sim.cop.active && Math.abs(sim.cop.sample - camS) <= 78) {
      const cop = sim.cop;
      const pose = this.samplePose(cop.sample, cop.lat, cop.airY);
      const pr = this.projectWorld(pose.x, pose.y, pose.z);
      if (pr) {
        const sprite = sim.resolveCopSprite(cop, camPose.yaw, pose.yaw);
        if (sprite) {
          const pxScale = pr.scale * 2.28;
          const dw = sprite.canvas.width * pxScale;
          const dh = sprite.canvas.height * pxScale;
          const ax = sprite.mirror ? sprite.canvas.width - sprite.hx : sprite.hx;
          const dx = pr.sx - ax * pxScale;
          const dy = pr.sy - sprite.hy * pxScale;
          const clipY = clipAtSample(cop.sample);
          if (dy < clipY) {
            drawList.push({
              zc: pr.zc,
              img: sprite.canvas,
              shadowImg: sprite.shadowCanvas,
              dx,
              dy,
              dw,
              dh,
              mirror: sprite.mirror,
              clipY,
              sirenFlash: cop.chasing ? (Math.floor(sim.ticks / 5) % 2 === 0 ? '#ff2222' : '#2266ff') : null
            });
          }
        }
      }
    }

    // 6f. All 15 Riders (Player + 14 Rivals — riding, attacking, crashing, or sprinting on foot!)
    for (const rider of sim.riders) {
      if (Math.abs(rider.sample - camS) > 80) continue;
      const pose = this.samplePose(rider.sample, rider.lat, rider.airY);
      const pr = this.projectWorld(pose.x, pose.y, pose.z);
      if (!pr) continue;

      const sprite = sim.resolveRiderSprite(rider, camPose.yaw, pose.yaw);
      if (!sprite) continue;

      const pxScale = pr.scale * 1.46;
      const dw = sprite.canvas.width * pxScale;
      const dh = sprite.canvas.height * pxScale;
      const ax = sprite.mirror ? sprite.canvas.width - sprite.hx : sprite.hx;
      const dx = pr.sx - ax * pxScale;
      const dy = pr.sy - sprite.hy * pxScale;
      const clipY = rider.isPlayer ? 480 : clipAtSample(rider.sample);
      if (dy >= clipY) continue;

      const groundPr = rider.airY > 1 ? this.projectWorld(pose.x, pose.y - rider.airY, pose.z) : pr;
      drawList.push({
        zc: rider.isPlayer ? pr.zc - 4 : pr.zc,
        img: sprite.canvas,
        shadowImg: sprite.shadowCanvas,
        groundSy: groundPr ? groundPr.sy : pr.sy,
        dx,
        dy,
        dw,
        dh,
        mirror: sprite.mirror,
        hitFlash: rider.hitFlashTicks > 0,
        clipY
      });
    }

    // 7. Painter's sort back-to-front (largest zc first)
    drawList.sort((a, b) => b.zc - a.zc);

    for (let i = 0; i < drawList.length; i++) {
      const d = drawList[i];
      ctx.save();
      if (d.clipY < 479) {
        ctx.beginPath();
        ctx.rect(0, 0, 640, d.clipY);
        ctx.clip();
      }

      // Ground shadow
      if (d.shadowImg) {
        const sw = d.dw * 0.96;
        const sh = Math.max(6, d.dh * 0.24);
        const sy = (d.groundSy ?? d.dy + d.dh) - sh * 0.55;
        ctx.drawImage(d.shadowImg, d.dx + (d.dw - sw) * 0.5, sy, sw, sh);
      } else if (d.shadowOval) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
        ctx.beginPath();
        ctx.ellipse(d.shadowOval.sx, d.shadowOval.sy, d.shadowOval.rx, d.shadowOval.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main sprite
      if (d.rotation) {
        ctx.translate(d.dx + d.dw * 0.5, d.dy + d.dh * 0.5);
        ctx.rotate(d.rotation);
        if (d.mirror) ctx.scale(-1, 1);
        ctx.drawImage(d.img, -d.dw * 0.5, -d.dh * 0.5, d.dw, d.dh);
      } else if (d.mirror) {
        ctx.translate(d.dx + d.dw, d.dy);
        ctx.scale(-1, 1);
        ctx.drawImage(d.img, 0, 0, d.dw, d.dh);
      } else {
        ctx.drawImage(d.img, d.dx, d.dy, d.dw, d.dh);
      }

      // Police roof/fairing strobe light when chasing
      if (d.sirenFlash) {
        ctx.fillStyle = d.sirenFlash;
        ctx.globalAlpha = 0.78;
        ctx.beginPath();
        ctx.arc(d.dx + d.dw * 0.5, d.dy + d.dh * 0.28, Math.max(3, d.dw * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 8. Combat sparks / impact bursts / action callouts
    for (const fx of sim.effects) {
      const pr = this.projectWorld(fx.wx, fx.wy, fx.wz);
      if (!pr) continue;
      if (fx.kind === 'spark') {
        ctx.fillStyle = fx.color || '#ffe066';
        ctx.fillRect(pr.sx - 2, pr.sy - 2, 4, 4);
      } else if (fx.kind === 'callout') {
        ctx.font = '18px RRBadloc, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText(fx.text, pr.sx + 2, pr.sy - 26);
        ctx.fillStyle = fx.color || '#ffff40';
        ctx.fillText(fx.text, pr.sx, pr.sy - 28);
      }
    }

    ctx.restore();
  }

  drawHorizon(ctx, yaw, pitch, inTunnel) {
    if (inTunnel) {
      ctx.fillStyle = '#101012';
      ctx.fillRect(0, 0, 640, 480);
      return;
    }

    // Sky top fill + earth bottom fill
    ctx.fillStyle = '#6da0d8';
    ctx.fillRect(0, 0, 640, 240);
    ctx.fillStyle = '#3b4a32';
    ctx.fillRect(0, 240, 640, 240);

    const hImg = this.horizonImg;
    if (!hImg) return;

    const hw = hImg.naturalWidth || hImg.width || 720;
    const hh = hImg.naturalHeight || hImg.height || 320;
    const pitchPx = Math.max(-90, Math.min(90, pitch * FOCAL_PX));
    const destY = Math.round(OPTICAL_CY + pitchPx - hh + 88);

    // Sample top pixel of horizon image for seamless upper sky color
    const normYaw = (((yaw / (Math.PI * 2)) % 1) + 1) % 1;
    const scrollX = Math.floor(normYaw * hw * 2) % hw;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Tile horizontally across 640px
    let drawX = -scrollX;
    while (drawX < 640) {
      ctx.drawImage(hImg, drawX, destY, hw, hh);
      drawX += hw;
    }

    // Parallax drifting bigcloud.png layer in upper sky
    if (this.assets.bigCloud && destY > -30) {
      const cw = this.assets.bigCloud.width;
      const ch = this.assets.bigCloud.height;
      const cloudScroll = Math.floor((normYaw * cw * 1.3 + performance.now() * 0.008) % cw);
      ctx.globalAlpha = 0.55;
      let cx = -cloudScroll;
      while (cx < 640) {
        ctx.drawImage(this.assets.bigCloud, cx, Math.max(-40, destY - 48), cw, ch * 0.55);
        cx += cw;
      }
    }
    ctx.restore();
  }
}
