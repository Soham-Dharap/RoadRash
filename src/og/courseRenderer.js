// Authentic 1996 Road Rash Camera-Space 3D Slice Renderer + Exact Actor View Projection
// Implements road.cpp::project_road (focal=512, optical center=(320,180), cameraHeight=150),
// road_panels.cpp mirrored multi-lane UVs, building_panels.cpp 3D facades, terrain.cpp hills,
// scenery.cpp exact (rawSize / 4) object scale, traffic.cpp MIP-0 2.5x car scale,
// and actor_descriptors.cpp::select_actor_view sprite angle/lean selection!

import * as THREE from 'three';

export const SAMPLE_LEN = 256;
const VIEW_W = 640;
const VIEW_H = 480;
const HORIZON_Y = 180;
const FOCAL_PX = 512.0;
const BASE_CAM_HEIGHT = 150.0; // Exact race.cpp:4149 camera_height_ = 0x96 = 150
const NUM_SLICES = 56; // 56 slices * 256 = 14,336 world units smooth draw distance

class DynamicTexBucket {
  constructor(material, maxQuads = 600) {
    this.maxVerts = maxQuads * 6;
    this.pos = new Float32Array(this.maxVerts * 3);
    this.uv = new Float32Array(this.maxVerts * 2);
    this.col = new Float32Array(this.maxVerts * 3);
    this.vertCount = 0;

    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3);
    this.uvAttr = new THREE.BufferAttribute(this.uv, 2);
    this.colAttr = new THREE.BufferAttribute(this.col, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.uvAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('uv', this.uvAttr);
    this.geometry.setAttribute('color', this.colAttr);
    this.geometry.setDrawRange(0, 0);

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
  }

  reset() {
    this.vertCount = 0;
  }

  pushQuad(
    x0, y0, z0, u0, v0, s0,
    x1, y1, z1, u1, v1, s1,
    x2, y2, z2, u2, v2, s2,
    x3, y3, z3, u3, v3, s3
  ) {
    if (this.vertCount + 6 > this.maxVerts) return;
    let vp = this.vertCount * 3;
    let vu = this.vertCount * 2;

    const emit = (x, y, z, u, v, sh) => {
      this.pos[vp] = x;
      this.pos[vp + 1] = y;
      this.pos[vp + 2] = -z;
      this.col[vp] = sh;
      this.col[vp + 1] = sh;
      this.col[vp + 2] = sh;
      vp += 3;
      this.uv[vu] = u;
      this.uv[vu + 1] = v;
      vu += 2;
    };

    emit(x0, y0, z0, u0, v0, s0);
    emit(x1, y1, z1, u1, v1, s1);
    emit(x2, y2, z2, u2, v2, s2);

    emit(x0, y0, z0, u0, v0, s0);
    emit(x2, y2, z2, u2, v2, s2);
    emit(x3, y3, z3, u3, v3, s3);

    this.vertCount += 6;
  }

  commit() {
    this.geometry.setDrawRange(0, this.vertCount);
    if (this.vertCount > 0) {
      this.mesh.visible = true;
      this.posAttr.needsUpdate = true;
      this.uvAttr.needsUpdate = true;
      this.colAttr.needsUpdate = true;
    } else {
      this.mesh.visible = false;
    }
  }

  dispose() {
    this.geometry.dispose();
  }
}

export class CourseRenderer {
  constructor(glCanvas, assets) {
    this.glCanvas = glCanvas;
    this.assets = assets;
    this.viewW = VIEW_W;
    this.viewH = VIEW_H;
    if (this.glCanvas && this.glCanvas.style) {
      this.glCanvas.style.display = 'none';
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: glCanvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.viewW, this.viewH, false);
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();

    // Exact road.cpp projection: optical center at (viewW/2, 180), focal length = 512px!
    this.camera = new THREE.PerspectiveCamera(45, this.viewW / this.viewH, 16, 22000);
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    this.applyExactRoadRashProjection(16, 22000);

    this.courseGroup = null;
    this.matCache = new Map();
    this.buckets = new Map();

    this.course = null;
    this.horizonImg = null;
    this.level = 0;
    this.finishSample = 1800;
    this.startSample = 50;
    this.objectsBySample = [];
    this.slices = [];
    this.lastCamLat = 0;
    this.lastCamEyeHeight = BASE_CAM_HEIGHT;
  }

  setViewportWidth(width) {
    const nextW = Math.max(640, Math.round(width || VIEW_W));
    if (this.viewW === nextW) return;
    this.viewW = nextW;
    this.renderer.setSize(this.viewW, this.viewH, false);
    this.camera.aspect = this.viewW / this.viewH;
    this.applyExactRoadRashProjection(16, 22000);
  }

  applyExactRoadRashProjection(near, far) {
    const m = this.camera.projectionMatrix.elements;
    m.fill(0);
    m[0] = FOCAL_PX / (this.viewW * 0.5); // 512 / 320 in 4:3, 512 / 427 in 16:9 widescreen!
    m[5] = FOCAL_PX / (this.viewH * 0.5); // 512 / 240 = 2.1333333
    m[8] = 0;
    m[9] = -(1.0 - (HORIZON_Y / this.viewH) * 2.0); // cy = 180 -> ndcY = +0.25 at Y=0 -> m[9] = -0.25
    m[10] = -(far + near) / (far - near);
    m[11] = -1;
    m[14] = -(2 * far * near) / (far - near);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  getMaterial(texId, repeatS = true, repeatT = true, fallbackHex = 0x484a50) {
    const key = `${texId}_${repeatS ? 1 : 0}_${repeatT ? 1 : 0}_${fallbackHex}`;
    if (this.matCache.has(key)) return this.matCache.get(key);

    const tex = texId >= 0 ? this.assets.getWorldThreeTexture(texId, repeatS, repeatT) : null;
    const isKeyed = Boolean(tex && this.assets.worldMeta?.rects?.[texId]?.[4]);
    const mat = new THREE.MeshBasicMaterial({
      map: tex || null,
      color: tex ? 0xffffff : fallbackHex,
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: isKeyed,
      alphaTest: isKeyed ? 0.45 : 0
    });
    this.matCache.set(key, mat);
    return mat;
  }

  getBucket(texId, repeatS = true, repeatT = true, fallbackHex = 0x484a50, maxQuads = 600) {
    const key = `${texId}_${repeatS ? 1 : 0}_${repeatT ? 1 : 0}_${fallbackHex}`;
    let b = this.buckets.get(key);
    if (!b) {
      const mat = this.getMaterial(texId, repeatS, repeatT, fallbackHex);
      b = new DynamicTexBucket(mat, maxQuads);
      this.buckets.set(key, b);
      if (this.courseGroup) this.courseGroup.add(b.mesh);
    }
    return b;
  }

  buildCourse(course, horizonImg, level = 0) {
    this.course = course;
    this.horizonImg = horizonImg;
    this.level = level;
    this.startSample = course.startSample || 50;
    this.finishSample = course.finishSamples?.[level] || course.samples.length - 45;

    if (this.courseGroup) {
      this.scene.remove(this.courseGroup);
      for (const b of this.buckets.values()) b.dispose();
      this.buckets.clear();
    }

    this.courseGroup = new THREE.Group();
    this.scene.add(this.courseGroup);

    const n = course.samples.length;
    this.objectsBySample = Array.from({ length: n }, () => []);
    for (const obj of course.objects || []) {
      const rIdx = obj[0];
      if (rIdx >= 0 && rIdx < n) {
        this.objectsBySample[rIdx].push(obj);
      }
    }
  }

  // ==================== EXACT road.cpp::project_road SLICE INTEGRATOR ====================

  projectSlices(camSampleFloat, camLat, camEyeHeight) {
    const samples = this.course.samples;
    const total = samples.length;
    const clampedS = Math.max(0, Math.min(total - 2, camSampleFloat));
    const first = Math.floor(clampedS);
    const frac = clampedS - first;

    const s0 = samples[first];
    let rise = s0[1] || 0;
    let y = -frac * rise;
    let dx = (s0[0] || 0) * (1.0 - frac);
    let x = 0;
    // Exact road.cpp:103 continuous depth (256 - frac) — no near-clamp freeze/stutter!
    let depth = (1.0 - frac) * SAMPLE_LEN;

    const slices = [];
    let minRoadScreenY = VIEW_H;

    for (let n = 0; n < NUM_SLICES && first + n < total; n++) {
      const idx = first + n;
      const raw = samples[idx];
      if (n > 0) {
        dx += raw[0] || 0;
        rise = raw[1] || 0;
      }

      const relX = x - camLat;
      const relY = y - camEyeHeight;
      // Near-clamp only on 2D projection scale (road.cpp table.scale[0] = 163840 -> depth ~ 80)
      const scalePx = FOCAL_PX / Math.max(80.0, depth);
      const roadScreenX = this.viewW * 0.5 + relX * scalePx;
      const roadScreenY = HORIZON_Y - relY * scalePx;

      const clipCeilingY = minRoadScreenY;
      if (n >= 1 && depth >= 96.0 && roadScreenY < minRoadScreenY) {
        minRoadScreenY = roadScreenY;
      }

      slices.push({
        n,
        sampleIdx: idx,
        raw,
        depth,
        scalePx,
        worldX: x,
        worldY: y,
        relX,
        relY,
        dx,
        roadScreenX,
        roadScreenY,
        clipCeilingY
      });

      x += dx;
      y += rise;
      depth += SAMPLE_LEN;
    }

    this.slices = slices;
    return slices;
  }

  projectWorldPoint(sampleFloat, lat, heightOffset = 0) {
    const slices = this.slices;
    if (!slices.length) return null;

    const sFirst = slices[0].sampleIdx;
    const sLast = slices[slices.length - 1].sampleIdx;
    if (sampleFloat < sFirst - 0.92 || sampleFloat > sLast) return null;

    let worldX, worldY, depth, dx, clipY;
    if (sampleFloat <= sFirst) {
      const sl = slices[0];
      const back = sFirst - sampleFloat;
      depth = sl.depth - back * SAMPLE_LEN;
      if (depth < 36.0) return null;
      worldX = sl.worldX - sl.dx * back;
      worldY = sl.worldY - (sl.raw[1] || 0) * back;
      dx = sl.dx;
      clipY = VIEW_H;
    } else {
      const idxFloat = sampleFloat - sFirst;
      const i0 = Math.min(slices.length - 2, Math.max(0, Math.floor(idxFloat)));
      const t = idxFloat - i0;
      const a = slices[i0];
      const b = slices[i0 + 1];
      depth = a.depth + (b.depth - a.depth) * t;
      if (depth < 36.0) return null;
      worldX = a.worldX + (b.worldX - a.worldX) * t;
      worldY = a.worldY + (b.worldY - a.worldY) * t;
      dx = a.dx + (b.dx - a.dx) * t;
      clipY = a.clipCeilingY;
    }

    const scalePx = FOCAL_PX / Math.max(64.0, depth);
    const relX = worldX + lat - this.lastCamLat;
    const relY = worldY + heightOffset - this.lastCamEyeHeight;

    return {
      depth,
      scalePx,
      sx: this.viewW * 0.5 + relX * scalePx,
      sy: HORIZON_Y - relY * scalePx,
      roadTangentYaw: Math.atan2(dx, SAMPLE_LEN),
      clipY
    };
  }

  // ==================== BUILD DYNAMIC 3D MESH FROM SLICES ====================

  rebuildSliceMesh(slices) {
    for (const b of this.buckets.values()) b.reset();
    if (!slices.length) return;

    // Prepend 1 rear camera skirt slice behind slices[0] so Three.js near-plane (z = -16)
    // clips asphalt, shoulders, sidewalks & hills seamlessly down to y = 480 on hill crests & 16:9!
    const s0 = slices[0];
    const prevIdx = Math.max(0, s0.sampleIdx - 1);
    const prevRaw = this.course.samples[prevIdx] || s0.raw;
    const rearSlice = {
      n: -1,
      sampleIdx: prevIdx,
      raw: prevRaw,
      depth: s0.depth - SAMPLE_LEN,
      relX: s0.relX - s0.dx,
      relY: s0.relY - (prevRaw[1] || 0)
    };
    const meshSlices = [rearSlice, ...slices];

    const roadIds = this.assets.worldMeta?.roadMats?.road || [0, 1, 2, 2, 3, 1, 4, 5];
    const groundIds = this.assets.worldMeta?.roadMats?.ground || [6, 7, 8];
    const tidFinish = roadIds[0]; // FINISH
    const tidPlain = roadIds[1]; // PLAIN
    const tidStart = roadIds[2]; // START160
    const tidWhite = roadIds[6]; // WHITE (stripe at u=0!)
    const tidYellow = roadIds[7]; // YELLOW (stripe at u=0!)
    const tidCross = groundIds[0]; // SIDCRSS0
    const tidSidewalk = groundIds[1]; // SIDLANE0
    const tidWater = this.assets.worldMeta?.roadMats?.water ?? 9; // WATER128

    for (let i = 0; i < meshSlices.length - 1; i++) {
      const a = meshSlices[i];
      const b = meshSlices[i + 1];
      const ra = a.raw;
      const rb = b.raw;

      const leftA = ra[3] || 500;
      const rightA = ra[4] || 500;
      const leftB = rb[3] || 500;
      const rightB = rb[4] || 500;

      const shLA = ra[5] || 220;
      const shRA = ra[6] || 220;
      const shLB = rb[5] || 220;
      const shRB = rb[6] || 220;

      const hLA = ra[7] || 0;
      const hRA = ra[8] || 0;
      const hLB = rb[7] || 0;
      const hRB = rb[8] || 0;

      const flags = ra[9] || 0;
      const tunnelA = ra[10] === 1;
      const tunnelB = rb[10] === 1;
      const ttype = ra[11] || 0;

      const distFadeA = i > NUM_SLICES - 12 ? Math.max(0.58, 1.0 - (i - (NUM_SLICES - 12)) * 0.036) : 1.0;
      const distFadeB = i + 1 > NUM_SLICES - 12 ? Math.max(0.58, 1.0 - (i + 1 - (NUM_SLICES - 12)) * 0.036) : 1.0;
      const shA = tunnelA ? 0.38 : distFadeA;
      const shB = tunnelB ? 0.38 : distFadeB;

      const zA = a.depth;
      const zB = b.depth;
      const rxA = a.relX;
      const ryA = a.relY;
      const rxB = b.relX;
      const ryB = b.relY;

      const vA = a.sampleIdx;
      const vB = a.sampleIdx + 1;

      // ---- 1. ROAD SURFACE PANELS (exact road_panels.cpp 1.0 tile per 16-ft sample & mirrored UVs!) ----
      const isStart = Math.abs(a.sampleIdx - this.startSample) <= 1;
      const isFinish = Math.abs(a.sampleIdx - this.finishSample) <= 1;
      const isCrosswalk = (flags & 8) !== 0;
      const fourLane = leftA >= 420 && rightA >= 420 && !isCrosswalk;

      if (isStart || isFinish) {
        const bk = this.getBucket(isStart ? tidStart : tidFinish, false, false, 0x444444, 64);
        bk.pushQuad(
          rxA - leftA, ryA, zA, 0, 0, shA,
          rxA + rightA, ryA, zA, 1, 0, shA,
          rxB + rightB, ryB, zB, 1, 1, shB,
          rxB - leftB, ryB, zB, 0, 1, shB
        );
      } else if (isCrosswalk) {
        const bk = this.getBucket(tidCross, true, false, 0x555555, 128);
        bk.pushQuad(
          rxA - leftA, ryA, zA, 0, 0, shA,
          rxA + rightA, ryA, zA, 4, 0, shA,
          rxB + rightB, ryB, zB, 4, 1, shB,
          rxB - leftB, ryB, zB, 0, 1, shB
        );
      } else if (fourLane) {
        const hLA2 = leftA * 0.5;
        const hLB2 = leftB * 0.5;
        const hRA2 = rightA * 0.5;
        const hRB2 = rightB * 0.5;
        const dashWhite = (a.sampleIdx & 1) === 0;
        const outerTid = dashWhite ? tidWhite : tidPlain;
        const centerTid = (flags & 16) && !(flags & 32) ? (dashWhite ? tidWhite : tidPlain) : tidYellow;

        const bkOuter = this.getBucket(outerTid, false, true, 0x3b3d42, 300);
        const bkCenter = this.getBucket(centerTid, false, true, 0x3b3d42, 300);

        // Outer left (-left .. -half): u=1 at curb, u=0 at white lane divider!
        bkOuter.pushQuad(
          rxA - leftA, ryA, zA, 1, vA, shA,
          rxA - hLA2, ryA, zA, 0, vA, shA,
          rxB - hLB2, ryB, zB, 0, vB, shB,
          rxB - leftB, ryB, zB, 1, vB, shB
        );
        // Outer right (+half .. +right): u=0 at white lane divider, u=1 at curb!
        bkOuter.pushQuad(
          rxA + hRA2, ryA, zA, 0, vA, shA,
          rxA + rightA, ryA, zA, 1, vA, shA,
          rxB + rightB, ryB, zB, 1, vB, shB,
          rxB + hRB2, ryB, zB, 0, vB, shB
        );
        // Inner left (-half .. 0): u=0.82 -> u=0 (double yellow line dead center!)
        bkCenter.pushQuad(
          rxA - hLA2, ryA, zA, 0.82, vA, shA,
          rxA, ryA, zA, 0, vA, shA,
          rxB, ryB, zB, 0, vB, shB,
          rxB - hLB2, ryB, zB, 0.82, vB, shB
        );
        // Inner right (0 .. +half): u=0 -> u=0.82
        bkCenter.pushQuad(
          rxA, ryA, zA, 0, vA, shA,
          rxA + hRA2, ryA, zA, 0.82, vA, shA,
          rxB + hRB2, ryB, zB, 0.82, vB, shB,
          rxB, ryB, zB, 0, vB, shB
        );
      } else {
        const dash = (a.sampleIdx & 1) === 0;
        const centerTid = flags & 16 ? (dash ? tidWhite : tidPlain) : tidYellow;
        const bkRoad = this.getBucket(centerTid, false, true, 0x3b3d42, 300);
        // Mirrored around lat = 0 so yellow stripe at u=0 sits dead-center!
        bkRoad.pushQuad(
          rxA - leftA, ryA, zA, 1, vA, shA,
          rxA, ryA, zA, 0, vA, shA,
          rxB, ryB, zB, 0, vB, shB,
          rxB - leftB, ryB, zB, 1, vB, shB
        );
        bkRoad.pushQuad(
          rxA, ryA, zA, 0, vA, shA,
          rxA + rightA, ryA, zA, 1, vA, shA,
          rxB + rightB, ryB, zB, 1, vB, shB,
          rxB, ryB, zB, 0, vB, shB
        );
      }

      // ---- 2. SHOULDERS & CURB STEPS ----
      const shTexL = ra[16] >= 0 ? ra[16] : tidSidewalk;
      const shTexR = ra[17] >= 0 ? ra[17] : tidSidewalk;
      const slXA = rxA - leftA - shLA;
      const slXB = rxB - leftB - shLB;
      const srXA = rxA + rightA + shRA;
      const srXB = rxB + rightB + shRB;

      const bkShL = this.getBucket(shTexL, true, true, 0x767062, 300);
      if (hLA > 2) {
        bkShL.pushQuad(
          rxA - leftA, ryA, zA, 0, vA, shA * 0.8,
          rxA - leftA, ryA + hLA, zA, 0.25, vA, shA * 0.8,
          rxB - leftB, ryB + hLB, zB, 0.25, vB, shB * 0.8,
          rxB - leftB, ryB, zB, 0, vB, shB * 0.8
        );
      }
      bkShL.pushQuad(
        slXA, ryA + hLA, zA, 0, vA, shA * 0.94,
        rxA - leftA, ryA + hLA, zA, 1, vA, shA * 0.94,
        rxB - leftB, ryB + hLB, zB, 1, vB, shB * 0.94,
        slXB, ryB + hLB, zB, 0, vB, shB * 0.94
      );

      const bkShR = this.getBucket(shTexR, true, true, 0x767062, 300);
      if (hRA > 2) {
        bkShR.pushQuad(
          rxA + rightA, ryA, zA, 0, vA, shA * 0.8,
          rxA + rightA, ryA + hRA, zA, 0.25, vA, shA * 0.8,
          rxB + rightB, ryB + hRB, zB, 0.25, vB, shB * 0.8,
          rxB + rightB, ryB, zB, 0, vB, shB * 0.8
        );
      }
      bkShR.pushQuad(
        rxA + rightA, ryA + hRA, zA, 0, vA, shA * 0.94,
        srXA, ryA + hRA, zA, 1, vA, shA * 0.94,
        srXB, ryB + hRB, zB, 1, vB, shB * 0.94,
        rxB + rightB, ryB + hRB, zB, 0, vB, shB * 0.94
      );

      // ---- 3. GUARDRAILS (ra[24]) ----
      const railH = ra[24] || 0;
      if (railH > 8) {
        const bkRail = this.getBucket(-1, true, true, 0xb8bec6, 160);
        bkRail.pushQuad(
          rxA - leftA - 22, ryA + railH * 0.35, zA, 0, 0, shA,
          rxA - leftA - 22, ryA + railH, zA, 0, 1, shA,
          rxB - leftB - 22, ryB + railH, zB, 1, 1, shB,
          rxB - leftB - 22, ryB + railH * 0.35, zB, 1, 0, shB
        );
        bkRail.pushQuad(
          rxA + rightA + 22, ryA + railH * 0.35, zA, 0, 0, shA,
          rxA + rightA + 22, ryA + railH, zA, 0, 1, shA,
          rxB + rightB + 22, ryB + railH, zB, 1, 1, shB,
          rxB + rightB + 22, ryB + railH * 0.35, zB, 1, 0, shB
        );
      }

      // ---- 4. ENCLOSED HIGHWAY TUNNELS ----
      if (tunnelA) {
        const tunTid = ra[14] >= 0 ? ra[14] : shTexL;
        const bkTun = this.getBucket(tunTid, true, true, 0x353330, 160);
        const bkCeil = this.getBucket(-1, true, true, 0x1a1918, 120);
        const tunH = 540;
        bkTun.pushQuad(
          slXA, ryA + hLA, zA, 0, 1, 0.42,
          rxA - leftA - shLA * 0.6, ryA + tunH, zA, 0, 0, 0.28,
          rxB - leftB - shLB * 0.6, ryB + tunH, zB, 1, 0, 0.28,
          slXB, ryB + hLB, zB, 1, 1, 0.42
        );
        bkTun.pushQuad(
          srXA, ryA + hRA, zA, 0, 1, 0.42,
          rxA + rightA + shRA * 0.6, ryA + tunH, zA, 0, 0, 0.28,
          rxB + rightB + shRB * 0.6, ryB + tunH, zB, 1, 0, 0.28,
          srXB, ryB + hRB, zB, 1, 1, 0.42
        );
        bkCeil.pushQuad(
          rxA - leftA - shLA * 0.6, ryA + tunH, zA, 0, 0, 1.0,
          rxA + rightA + shRA * 0.6, ryA + tunH, zA, 1, 0, 1.0,
          rxB + rightB + shRB * 0.6, ryB + tunH, zB, 1, 1, 1.0,
          rxB - leftB - shLB * 0.6, ryB + tunH, zB, 0, 1, 1.0
        );
      }

      // ---- 5. BUILDINGS, COASTAL CLIFFS/OCEAN & ROLLING HILLS ----
      if (ttype === 0) {
        const bHL = Math.max(420, ra[12] || 720);
        const bHR = Math.max(420, ra[13] || 720);
        const bTexL = ra[14];
        const bTexR = ra[15];

        // Alley ground apron beyond sidewalks
        const bkAlley = this.getBucket(shTexL, true, true, 0x484848, 250);
        bkAlley.pushQuad(
          slXA - 2200, ryA + hLA, zA, 0, vA, shA * 0.78,
          slXA, ryA + hLA, zA, 4, vA, shA * 0.85,
          slXB, ryB + hLB, zB, 4, vB, shB * 0.85,
          slXB - 2200, ryB + hLB, zB, 0, vB, shB * 0.78
        );
        bkAlley.pushQuad(
          srXA, ryA + hRA, zA, 0, vA, shA * 0.85,
          srXA + 2200, ryA + hRA, zA, 4, vA, shA * 0.78,
          srXB + 2200, ryB + hRB, zB, 4, vB, shB * 0.78,
          srXB, ryB + hRB, zB, 0, vB, shB * 0.85
        );

        const u0 = (a.sampleIdx % 4) * 0.25;
        if (bTexL >= 0) {
          const bkBL = this.getBucket(bTexL, true, false, 0x8c7362, 250);
          bkBL.pushQuad(
            slXA, ryA + hLA, zA, u0, 1, shA,
            slXA, ryA + hLA + bHL, zA, u0, 0, shA,
            slXB, ryB + hLB + bHL, zB, u0 + 0.25, 0, shB,
            slXB, ryB + hLB, zB, u0 + 0.25, 1, shB
          );
          const prevTexL = i > 0 ? slices[i - 1].raw[14] : bTexL;
          if (prevTexL < 0) {
            bkBL.pushQuad(
              slXA - 850, ryA + hLA, zA, 0, 1, shA * 0.76,
              slXA, ryA + hLA, zA, 1, 1, shA * 0.76,
              slXA, ryA + hLA + bHL, zA, 1, 0, shA * 0.76,
              slXA - 850, ryA + hLA + bHL, zA, 0, 0, shA * 0.76
            );
          }
        }
        if (bTexR >= 0) {
          const bkBR = this.getBucket(bTexR, true, false, 0x8c7362, 250);
          bkBR.pushQuad(
            srXA, ryA + hRA, zA, u0, 1, shA,
            srXA, ryA + hRA + bHR, zA, u0, 0, shA,
            srXB, ryB + hRB + bHR, zB, u0 + 0.25, 0, shB,
            srXB, ryB + hRB, zB, u0 + 0.25, 1, shB
          );
          const prevTexR = i > 0 ? slices[i - 1].raw[15] : bTexR;
          if (prevTexR < 0) {
            bkBR.pushQuad(
              srXA, ryA + hRA, zA, 0, 1, shA * 0.76,
              srXA + 850, ryA + hRA, zA, 1, 1, shA * 0.76,
              srXA + 850, ryA + hRA + bHR, zA, 1, 0, shA * 0.76,
              srXA, ryA + hRA + bHR, zA, 0, 0, shA * 0.76
            );
          }
        }
      } else if (ttype === 1 || ttype === 3) {
        // Coastal Highway / Canyon: sheer rock wall on high side + Pacific Ocean water on drop side!
        const wallHL = ra[22] || 0;
        const wallHR = ra[23] || 0;
        const hillTexL = ra[18] >= 0 ? ra[18] : shTexL;
        const hillTexR = ra[19] >= 0 ? ra[19] : shTexR;

        if (wallHL > 40) {
          const bkWL = this.getBucket(hillTexL, true, true, 0x736350, 250);
          bkWL.pushQuad(
            slXA - 360, ryA + wallHL, zA, 0, vA, shA,
            slXA, ryA + hLA, zA, 1, vA, shA,
            slXB, ryB + hLB, zB, 1, vB, shB,
            slXB - 360, ryB + (rb[22] || wallHL), zB, 0, vB, shB
          );
        } else {
          const bkCliff = this.getBucket(hillTexL, true, true, 0x6a5b48, 250);
          const bkOcean = this.getBucket(tidWater, true, true, 0x1c4e80, 250);
          bkCliff.pushQuad(
            slXA - 190, ryA - 260, zA, 0, vA, shA * 0.88,
            slXA, ryA + hLA, zA, 1, vA, shA,
            slXB, ryB + hLB, zB, 1, vB, shB,
            slXB - 190, ryB - 260, zB, 0, vB, shB * 0.88
          );
          bkOcean.pushQuad(
            slXA - 4800, ryA - 260, zA, 0, vA, shA * 0.94,
            slXA - 190, ryA - 260, zA, 7, vA, shA * 0.94,
            slXB - 190, ryB - 260, zB, 7, vB, shB * 0.94,
            slXB - 4800, ryB - 260, zB, 0, vB, shB * 0.94
          );
        }

        if (wallHR > 40) {
          const bkWR = this.getBucket(hillTexR, true, true, 0x736350, 250);
          bkWR.pushQuad(
            srXA, ryA + hRA, zA, 0, vA, shA,
            srXA + 360, ryA + wallHR, zA, 1, vA, shA,
            srXB + 360, ryB + (rb[23] || wallHR), zB, 1, vB, shB,
            srXB, ryB + hRB, zB, 0, vB, shB
          );
        } else {
          const bkHR = this.getBucket(hillTexR, true, true, 0x5c6e42, 250);
          bkHR.pushQuad(
            srXA, ryA + hRA, zA, 0, vA, shA,
            srXA + 3400, ryA + 360, zA, 4, vA, shA * 0.88,
            srXB + 3400, ryB + 360, zB, 4, vB, shB * 0.88,
            srXB, ryB + hRB, zB, 0, vB, shB
          );
        }
      } else {
        // Rolling hills / timberland / Napa vineyards (ttype === 4)
        const hillTexL0 = ra[18] >= 0 ? ra[18] : shTexL;
        const hillTexR0 = ra[19] >= 0 ? ra[19] : shTexR;
        const hillTexL1 = ra[20] >= 0 ? ra[20] : hillTexL0;
        const hillTexR1 = ra[21] >= 0 ? ra[21] : hillTexR0;

        const lMidXA = rxA + Math.min(-leftA - shLA - 700, ra[27] || -1400);
        const lMidYA = ryA + Math.max(-220, Math.min(950, ra[28] || 180));
        const lMidXB = rxB + Math.min(-leftB - shLB - 700, rb[27] || -1400);
        const lMidYB = ryB + Math.max(-220, Math.min(950, rb[28] || 180));

        const rMidXA = rxA + Math.max(rightA + shRA + 700, ra[31] || 1400);
        const rMidYA = ryA + Math.max(-220, Math.min(950, ra[32] || 180));
        const rMidXB = rxB + Math.max(rightB + shRB + 700, rb[31] || 1400);
        const rMidYB = ryB + Math.max(-220, Math.min(950, rb[32] || 180));

        this.getBucket(hillTexL0, true, true, 0x4f6d3a, 250).pushQuad(
          lMidXA, lMidYA, zA, 0, vA, shA,
          slXA, ryA + hLA, zA, 3, vA, shA,
          slXB, ryB + hLB, zB, 3, vB, shB,
          lMidXB, lMidYB, zB, 0, vB, shB
        );
        this.getBucket(hillTexL1, true, true, 0x456033, 250).pushQuad(
          lMidXA - 2600, lMidYA + 160, zA, 0, vA, shA * 0.88,
          lMidXA, lMidYA, zA, 4, vA, shA,
          lMidXB, lMidYB, zB, 4, vB, shB,
          lMidXB - 2600, lMidYB + 160, zB, 0, vB, shB * 0.88
        );
        this.getBucket(hillTexR0, true, true, 0x4f6d3a, 250).pushQuad(
          srXA, ryA + hRA, zA, 0, vA, shA,
          rMidXA, rMidYA, zA, 3, vA, shA,
          rMidXB, rMidYB, zB, 3, vB, shB,
          srXB, ryB + hRB, zB, 0, vB, shB
        );
        this.getBucket(hillTexR1, true, true, 0x456033, 250).pushQuad(
          rMidXA, rMidYA, zA, 0, vA, shA,
          rMidXA + 2600, rMidYA + 160, zA, 4, vA, shA * 0.88,
          rMidXB + 2600, rMidYB + 160, zB, 4, vB, shB * 0.88,
          rMidXB, rMidYB, zB, 0, vB, shB
        );
      }
    }

    for (const b of this.buckets.values()) b.commit();
  }

  // ==================== EXACT actor_descriptors.cpp::select_actor_view ====================

  selectActorView(rDesc, views, leanNorm = 0, relYawNorm = 0, compassAngle = 0) {
    if (!rDesc || !views || !views.length) return { frameIdx: 3, flags: 0 };
    const base = (rDesc[0] | (rDesc[1] << 8) | (rDesc[2] << 16) | (rDesc[3] << 24)) >>> 0;
    const d4 = rDesc[4] < 128 ? rDesc[4] : rDesc[4] - 256;
    const d5 = rDesc[5] < 128 ? rDesc[5] : rDesc[5] - 256;
    const d6 = rDesc[6] < 128 ? rDesc[6] : rDesc[6] - 256;
    const d8 = rDesc[8];
    const d9 = rDesc[9];

    // Exact actor_descriptors.cpp:173-220:
    // d[6] (view) selects yaw group (base + yawIdx, e.g. riderViews[2..10] where 6 is straight rear view),
    // d[5] (elevation) selects motorcycle lean subframe (0 = hard left, 3 = upright, 6 = hard right)!
    if (d9 && d5 >= 2) {
      const yawCount = Math.max(1, d6);
      const yawMid = (yawCount - 1) * 0.5;
      const clampedYaw = Math.max(-0.72, Math.min(0.72, relYawNorm));
      const yawIdx = Math.max(0, Math.min(yawCount - 1, Math.round(yawMid + clampedYaw * yawMid)));

      const leanCount = Math.max(1, d5);
      const leanMid = (leanCount - 1) * 0.5;
      const clampedLean = Math.max(-1, Math.min(1, leanNorm));
      const leanIdx = Math.max(0, Math.min(leanCount - 1, Math.round(leanMid + clampedLean * leanMid)));

      const grp = views[Math.min(views.length - 1, base + yawIdx)] || views[0];
      const sub = Math.max(0, Math.min(grp.length - 1, d4 + leanIdx));
      const entry = grp[sub] || grp[Math.min(grp.length - 1, 3)] || grp[0];
      return { frameIdx: entry[0], flags: entry[1] };
    }

    const grp = views[Math.min(views.length - 1, base)] || views[0];
    const count = Math.max(1, d6 || grp.length);
    let viewIdx = 0;

    if (d8 >= 240 && count >= 2) {
      if (count === 2) {
        viewIdx = Math.sin(compassAngle) < 0 ? 1 : 0;
      } else {
        const norm = ((compassAngle + Math.PI) / (2 * Math.PI)) % 1.0;
        viewIdx = Math.max(0, Math.min(count - 1, Math.floor((norm < 0 ? norm + 1 : norm) * count)));
      }
    } else if (count >= 2) {
      // Single-group narrow-angle / lean tables (e.g. LOCOP copAnim[2]: d6=7, d8=42, d9=0,
      // and HIBOB attack animations): combine leanNorm + subtle camera yaw!
      const mid = (count - 1) * 0.5;
      const combined = d8 >= 30
        ? Math.max(-1, Math.min(1, leanNorm + relYawNorm * 0.35))
        : Math.max(-1, Math.min(1, relYawNorm));
      viewIdx = Math.max(0, Math.min(count - 1, Math.round(mid + combined * mid)));
    }

    const sub = Math.max(0, Math.min(grp.length - 1, d4 + viewIdx));
    const entry = grp[sub] || grp[0];
    return { frameIdx: entry[0], flags: entry[1] };
  }

  // ==================== MAIN RACE FRAME RENDER ====================

  renderRaceFrame(ctx2d, sim, alpha = 1) {
    if (!this.course) return;

    const a = sim.paused ? 1 : Math.max(0, Math.min(1, alpha));
    const lerp = (prev, cur) =>
      prev !== undefined && Math.abs(cur - prev) < 8 ? prev + (cur - prev) * a : cur;

    const camSample = Math.max(1, lerp(sim.prevCameraSample, sim.cameraSample));
    const camLat =
      sim.prevCameraLat !== undefined
        ? sim.prevCameraLat + (sim.cameraLat - sim.prevCameraLat) * a
        : sim.cameraLat;
    const camEyeHeight =
      BASE_CAM_HEIGHT +
      (sim.prevCameraHeightOffset !== undefined
        ? sim.prevCameraHeightOffset + (sim.cameraHeightOffset - sim.prevCameraHeightOffset) * a
        : sim.cameraHeightOffset);
    const headingAccum =
      sim.prevHeadingAccum !== undefined
        ? sim.prevHeadingAccum + (sim.headingAccum - sim.prevHeadingAccum) * a
        : sim.headingAccum;

    this.lastCamLat = camLat;
    this.lastCamEyeHeight = camEyeHeight;

    // Exact road.cpp: camera roll is strictly 0 (only the motorcycle sprite leans!)
    // so 3D road, horizon, and all 2D world sprites stay 100% locked together!
    this.camera.rotation.z = 0;

    const slices = this.projectSlices(camSample, camLat, camEyeHeight);
    this.rebuildSliceMesh(slices);
    this.renderer.render(this.scene, this.camera);

    ctx2d.save();
    ctx2d.imageSmoothingEnabled = false;

    const inTunnel = slices[0]?.raw?.[10] === 1;
    this.drawHorizonAndClouds(ctx2d, headingAccum, inTunnel);
    ctx2d.drawImage(this.glCanvas, 0, 0, this.viewW, this.viewH);

    this.drawWorldSprites(ctx2d, sim, a);
    this.drawRearViewMirror(ctx2d, sim);

    ctx2d.restore();
  }

  drawHorizonAndClouds(ctx2d, headingAccum, inTunnel) {
    // Safety ground backstop below y = 320 so steep downhill transitions never show black voids
    ctx2d.fillStyle = inTunnel ? '#09090d' : '#2a3024';
    ctx2d.fillRect(0, 0, this.viewW, this.viewH);

    if (inTunnel) {
      ctx2d.fillStyle = '#09090d';
      ctx2d.fillRect(0, 0, this.viewW, HORIZON_Y + 24);
      return;
    }

    // Exact course_scene.cpp:425: 720x320 horizon bitmap has sky/clouds/mountains/skyline
    // in y = 0..180 (HORIZON_Y = 180) and horizon ground fill in y = 180..320!
    const hz = this.horizonImg;
    if (hz) {
      const w = hz.width || 720;
      const h = hz.height || 320;
      const centerOff = (w - this.viewW) * 0.5;
      const scrollX = (((centerOff + headingAccum * 0.44) % w) + w) % w;
      for (let x = -scrollX; x < this.viewW; x += w) {
        ctx2d.drawImage(hz, 0, 0, w, h, Math.floor(x), 0, w, h);
      }
      // Extend bottom-most horizon row below y = 320 as seamless distant earth color
      if (h < this.viewH) {
        for (let x = -scrollX; x < this.viewW; x += w) {
          ctx2d.drawImage(hz, 0, h - 2, w, 2, Math.floor(x), h, w, this.viewH - h);
        }
      }
    } else {
      const g = ctx2d.createLinearGradient(0, 0, 0, HORIZON_Y + 8);
      g.addColorStop(0, '#3264b8');
      g.addColorStop(1, '#9dc4eb');
      ctx2d.fillStyle = g;
      ctx2d.fillRect(0, 0, this.viewW, HORIZON_Y + 8);
    }
  }

  drawWorldSprites(ctx2d, sim, alpha = 1) {
    const drawList = [];
    const slices = this.slices;
    if (!slices.length) return;

    const interp = (prev, cur, maxJump = 8) =>
      prev !== undefined && Math.abs(cur - prev) < maxJump ? prev + (cur - prev) * alpha : cur;

    // 1. Roadside Scenery Objects (exact scenery.cpp:103 scale: (rawSize / 4) * scalePx)
    for (let i = 0; i < slices.length - 1; i++) {
      const sl = slices[i];
      const objs = this.objectsBySample[sl.sampleIdx];
      if (!objs || !objs.length) continue;

      const hL = sl.raw[7] || 0;
      const hR = sl.raw[8] || 0;

      for (let j = 0; j < objs.length; j++) {
        const [rIdx, lat, texId, rawSize, mirror, , hx, hy, w, h] = objs[j];
        const groundY = lat < 0 ? hL : hR;
        const proj = this.projectWorldPoint(rIdx, lat, groundY);
        if (!proj || proj.sx < -320 || proj.sx > this.viewW + 320) continue;

        const sizeMul = rawSize > 0 ? rawSize * 0.25 : 1.75;
        const pxScale = sizeMul * proj.scalePx;
        const dw = w * pxScale;
        const dh = h * pxScale;
        if (dw < 1.5 || dh < 1.5) continue;

        const img = this.assets.getWorldCanvas(texId);
        if (!img) continue;

        const ax = mirror ? w - hx : hx;
        const dx = proj.sx - ax * pxScale;
        const dy = proj.sy - hy * pxScale;
        const clipY = Math.min(VIEW_H, proj.clipY + 4);

        drawList.push({
          depth: proj.depth,
          draw: () => this.drawClippedCanvas(ctx2d, img, dx, dy, dw, dh, Boolean(mirror), clipY)
        });
      }
    }

    // 2. Traffic Cars / Trucks / Taxis / Porsches + Cross-Intersection Cars
    for (const car of sim.traffic) {
      if (!car.active) continue;
      const cs = interp(car.prevSample, car.sample, 6);
      const cl = interp(car.prevLat, car.lat, 120);
      const proj = this.projectWorldPoint(cs, cl, 0);
      if (!proj || proj.sx < -320 || proj.sx > this.viewW + 320) continue;
      drawList.push({
        depth: proj.depth,
        draw: () => this.drawCarSprite(ctx2d, car, proj)
      });
    }

    // 3. Pedestrians
    for (const ped of sim.pedestrians) {
      if (!ped.active) continue;
      const pl = interp(ped.prevLat, ped.lat, 80);
      const proj = this.projectWorldPoint(ped.sample, pl, ped.airY || 0);
      if (!proj || proj.sx < -180 || proj.sx > this.viewW + 180) continue;
      drawList.push({
        depth: proj.depth,
        draw: () => this.drawPedestrianSprite(ctx2d, ped, proj)
      });
    }

    // 4. Downed Motorcycles lying on asphalt
    for (const db of sim.downedBikes) {
      if (!db.active) continue;
      const dbs = interp(db.prevSample, db.sample, 4);
      const dbl = interp(db.prevLat, db.lat, 80);
      const proj = this.projectWorldPoint(dbs, dbl, 0);
      if (!proj || proj.sx < -220 || proj.sx > this.viewW + 220) continue;
      drawList.push({
        depth: proj.depth,
        draw: () => this.drawDownedBikeSprite(ctx2d, db, proj)
      });
    }

    // 5. Motorcycle Police Officer
    for (const cop of sim.cops) {
      if (!cop.active) continue;
      const cps = interp(cop.prevSample, cop.sample, 4);
      const cpl = interp(cop.prevLat, cop.lat, 90);
      const proj = this.projectWorldPoint(cps, cpl, cop.airY || 0);
      if (!proj || proj.depth < 185 || proj.sx < -220 || proj.sx > this.viewW + 220) continue;
      drawList.push({
        depth: proj.depth,
        draw: () => this.drawCopSprite(ctx2d, cop, proj)
      });
    }

    // 6. All 15 Riders (14 Outlaw/AI Rivals + Player / Police Interceptor)
    for (const r of sim.riders) {
      if (r.state === 'busted' && !r.isPlayer) continue;
      const rs = interp(r.prevSample, r.sample, 4);
      const rl = interp(r.prevLat, r.lat, 90);
      const ray = interp(r.prevAirY, r.airY || 0, 40);
      const proj = this.projectWorldPoint(rs, rl, ray);
      if (!proj || (!r.isPlayer && proj.depth < 185) || proj.sx < -260 || proj.sx > this.viewW + 260) {
        continue;
      }
      const clipY = r.isPlayer ? VIEW_H : Math.min(VIEW_H, proj.clipY + 4);
      drawList.push({
        depth: proj.depth - (r.isPlayer ? 2 : 0),
        draw: () => this.drawRiderSprite(ctx2d, r, proj, clipY)
      });
    }

    drawList.sort((a, b) => b.depth - a.depth);
    for (const item of drawList) {
      item.draw();
    }
  }

  drawClippedCanvas(ctx2d, img, dx, dy, dw, dh, mirror, clipY) {
    if (dw < 1 || dh < 1 || dy >= clipY) return;
    let visRatio = 1.0;
    if (dy + dh > clipY) {
      visRatio = (clipY - dy) / dh;
      if (visRatio <= 0.02) return;
    }
    const sw = img.width;
    const sh = Math.max(1, Math.floor(img.height * visRatio));
    const useDH = dh * visRatio;

    if (mirror) {
      ctx2d.save();
      ctx2d.translate(dx + dw, dy);
      ctx2d.scale(-1, 1);
      ctx2d.drawImage(img, 0, 0, sw, sh, 0, 0, dw, useDH);
      ctx2d.restore();
    } else {
      ctx2d.drawImage(img, 0, 0, sw, sh, dx, dy, dw, useDH);
    }
  }

  drawCarSprite(ctx2d, car, proj) {
    const courseKey = this.course.carPool || this.course.name;
    const cList =
      this.assets.carsMeta?.courses?.[courseKey] || this.assets.carsMeta?.courses?.CITY;
    if (!cList || !cList.length) return;
    const cDesc = cList[car.kind % cList.length];

    // views[2] is full-resolution MIP 0!
    const mip0Group = cDesc.views[2] || cDesc.views[0];
    if (!mip0Group || !mip0Group.length) return;

    const relXNorm = Math.max(-1, Math.min(1, (proj.sx - this.viewW * 0.5) / 290));
    let subIdx = 0;

    if (car.crossDir) {
      // *S intersection cross-traffic car (2 views: 0 = right-to-left, 1 = left-to-right)
      subIdx = car.crossDir > 0 ? Math.min(mip0Group.length - 1, 1) : 0;
    } else if (mip0Group.length >= 16) {
      // *C oncoming headlights car (view[2][7..8] = straight oncoming headlights!)
      subIdx = Math.max(4, Math.min(11, Math.round(7.5 + relXNorm * 2.4)));
    } else if (mip0Group.length >= 9) {
      // *G same-direction rear taillights car (view[2][4] = straight rear taillights!)
      subIdx = Math.max(1, Math.min(7, Math.round(4 - relXNorm * 2.2)));
    } else {
      subIdx = car.dir < 0 ? 0 : Math.min(mip0Group.length - 1, 1);
    }

    const [fIdx, vFlags] = mip0Group[subIdx] || mip0Group[0];
    const fMeta = cDesc.frames[fIdx] || cDesc.frames[0];
    const [rectIdx, ox, oy, nw, nh] = fMeta;
    const carImg = this.assets.getCarCanvas(rectIdx);
    if (!carImg) return;

    // Exact traffic.cpp:1071 + actor_render.cpp:38-41 (size = 0x500 -> 5.0x logical, ~4.2x clean lane fit)
    let sizeMul = 4.2;
    if (vFlags & 0x10000) sizeMul *= 2;
    if (vFlags & 0x20000) sizeMul *= 4;
    const carScale = sizeMul * proj.scalePx;
    const dw = nw * carScale;
    const dh = nh * carScale;
    if (dw < 2 || dh < 2) return;

    const mirror = (vFlags & 1) !== 0;
    const ax = mirror ? nw - ox : ox;
    const dx = proj.sx - ax * carScale;
    const anchorY = Math.max(oy, nh * 0.88);
    const dy = proj.sy - anchorY * carScale;
    const clipY = Math.min(VIEW_H, proj.clipY + 4);

    if (proj.sy < clipY) {
      ctx2d.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx2d.beginPath();
      ctx2d.ellipse(proj.sx, proj.sy - 2, dw * 0.45, Math.max(2, dh * 0.11), 0, 0, Math.PI * 2);
      ctx2d.fill();
    }

    this.drawClippedCanvas(ctx2d, carImg, dx, dy, dw, dh, mirror, clipY);
  }

  drawPedestrianSprite(ctx2d, ped, proj) {
    const peds = this.assets.worldMeta?.pedestrians;
    if (!peds || !peds.length) return;
    const pDesc = peds[ped.type % peds.length] || peds[0];

    const animIdx = ped.state === 'down' || ped.state === 'hit' ? 3 : ped.moving ? 0 : 1;
    const seq = pDesc.anims[animIdx] || pDesc.anims[0] || [];
    const step = seq.length ? seq[Math.min(seq.length - 1, ped.animStep)] : null;

    let fMeta = pDesc.frames[0];
    let mirror = ped.vx < 0;
    let cellFlags = 0;
    if (step?.r && pDesc.views?.length) {
      const compass = ped.vx > 0 ? Math.PI * 0.5 : ped.vx < 0 ? -Math.PI * 0.5 : 0;
      const sel = this.selectActorView(step.r, pDesc.views, 0, 0, compass);
      fMeta = pDesc.frames[Math.min(pDesc.frames.length - 1, sel.frameIdx)] || pDesc.frames[0];
      cellFlags = sel.flags || 0;
      mirror = (cellFlags & 1) !== 0;
    }

    const [tid, ox, oy, nw, nh] = fMeta;
    const img = this.assets.getWorldCanvas(tid);
    if (!img) return;

    // Exact pedestrians.cpp:91 (size = 0x200 -> 2.0 * proj.scalePx, human standing height!)
    let sizeMul = 1.85;
    if (cellFlags & 0x10000) sizeMul *= 2;
    if (cellFlags & 0x20000) sizeMul *= 4;
    const pedScale = sizeMul * proj.scalePx;
    const dw = nw * pedScale;
    const dh = nh * pedScale;
    if (dw < 1.5 || dh < 1.5) return;

    const clipY = Math.min(VIEW_H, proj.clipY + 4);
    const dx = mirror ? proj.sx - (nw - ox) * pedScale : proj.sx - ox * pedScale;
    const dy = proj.sy - oy * pedScale;
    this.drawClippedCanvas(ctx2d, img, dx, dy, dw, dh, mirror, clipY);
  }

  drawDownedBikeSprite(ctx2d, db, proj) {
    const bm = this.assets.bikersMeta;
    const grp = bm?.riderViews?.[11];
    if (!grp) return;

    const sub = grp[db.spinStep % grp.length] || grp[0];
    const frameIdx = sub[0];
    const cellFlags = sub[1] || 0;
    const mirror = (cellFlags & 1) !== 0;
    const img = this.assets.getRiderCanvas(db.colorIdx, frameIdx);
    const meta = bm.riderFrames[frameIdx];
    if (!img || !meta) return;

    const [ox, oy, nw, nh] = meta;
    let sizeMul = 1.9;
    if (cellFlags & 0x10000) sizeMul *= 2;
    if (cellFlags & 0x20000) sizeMul *= 4;
    const bikeScale = sizeMul * proj.scalePx;
    const dw = nw * bikeScale;
    const dh = nh * bikeScale;
    const ax = mirror ? nw - ox : ox;
    const dx = proj.sx - ax * bikeScale;
    const dy = proj.sy - oy * bikeScale;
    const clipY = Math.min(VIEW_H, proj.clipY + 4);

    if (proj.sy < clipY) {
      ctx2d.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx2d.beginPath();
      ctx2d.ellipse(proj.sx, proj.sy - 2, dw * 0.46, Math.max(2, dh * 0.2), 0, 0, Math.PI * 2);
      ctx2d.fill();
    }

    this.drawClippedCanvas(ctx2d, img, dx, dy, dw, dh, mirror, clipY);
  }

  drawCopSprite(ctx2d, cop, proj, clipYOverride = null) {
    const bm = this.assets.bikersMeta;
    if (!bm) return;

    let frameIdx = 3; // copView[1] center upright frame is 3!
    let cellFlags = 0;
    let mirror = false;
    const useAnimId = cop.animId && bm.copAnims?.[cop.animId] ? cop.animId : 2;
    const animSeq = bm.copAnims?.[useAnimId];
    if (animSeq && animSeq.length) {
      const step = animSeq[cop.animStep % animSeq.length];
      const relYaw = cop.isPlayer
        ? 0
        : Math.max(-0.65, Math.min(0.65, (this.viewW * 0.5 - proj.sx) / 340));
      const sel = this.selectActorView(step.r, bm.copViews, cop.lean, relYaw, cop.runCompass || 0);
      frameIdx = sel.frameIdx;
      cellFlags = sel.flags || 0;
      mirror = (cellFlags & 1) !== 0;
    } else {
      const absLean = Math.abs(cop.lean);
      frameIdx = absLean > 0.62 ? 0 : absLean > 0.36 ? 1 : absLean > 0.14 ? 2 : 3;
      mirror = cop.lean < -0.14;
    }
    if (cop.forceMirror !== null && cop.forceMirror !== undefined) {
      mirror = cop.forceMirror;
    }

    let img = this.assets.getCopCanvas(frameIdx);
    let meta = bm.copFrames[frameIdx];
    if (!img || !meta || meta[2] <= 1) {
      frameIdx = 3;
      img = this.assets.getCopCanvas(3);
      meta = bm.copFrames[3];
    }
    if (!img || !meta) return;

    // Exact actor_render.cpp:35-46 hotspot anchoring [ox, oy, nw, nh]:
    // swinging the Police Nightstick (frame 5: ox=49, nw=64) NEVER shifts the bike tire sideways!
    const [ox, oy, nw, nh] = meta;
    let sizeMul = cop.isPlayer ? 1.72 : 1.70;
    if (cellFlags & 0x10000) sizeMul *= 2;
    if (cellFlags & 0x20000) sizeMul *= 4;
    const copScale = sizeMul * proj.scalePx;
    const dw = nw * copScale;
    const dh = nh * copScale;
    if (dw < 2 || dh < 2) return;

    const ax = mirror ? nw - ox : ox;
    const dx = proj.sx - ax * copScale;
    const dy = proj.sy - oy * copScale;
    const clipY = clipYOverride ?? Math.min(VIEW_H, proj.clipY + 4);

    // Exact copShadowFrames hotspot anchoring
    const shImg = this.assets.getCopShadowCanvas(frameIdx);
    const shMeta = bm.copShadowFrames?.[frameIdx];
    if (shImg && shMeta && shMeta[2] > 1 && proj.sy < clipY) {
      const groundProj = (cop.airY || 0) > 1 ? this.projectWorldPoint(cop.sample, cop.lat, 0) : proj;
      if (groundProj) {
        const [sox, soy, sw, sh] = shMeta;
        const shScale = sizeMul * groundProj.scalePx;
        const sdw = sw * shScale;
        const sdh = sh * shScale;
        const sax = mirror ? sw - sox : sox;
        this.drawClippedCanvas(
          ctx2d,
          shImg,
          groundProj.sx - sax * shScale,
          groundProj.sy - soy * shScale,
          sdw,
          sdh,
          mirror,
          clipY
        );
      }
    }

    this.drawClippedCanvas(ctx2d, img, dx, dy, dw, dh, mirror, clipY);

    if ((cop.chasing || cop.sirenOn) && cop.state !== 'crashing' && dy < clipY) {
      const flashRed = (Math.floor(performance.now() / 100) & 1) === 0;
      const rPx = Math.max(2.4, 4.8 * proj.scalePx);
      const barY = proj.sy - Math.min(dh * 0.62, 34 * copScale);
      ctx2d.fillStyle = flashRed ? 'rgba(255, 36, 36, 0.94)' : 'rgba(38, 138, 255, 0.94)';
      ctx2d.beginPath();
      ctx2d.arc(proj.sx - 10 * copScale, barY, rPx, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.fillStyle = flashRed ? 'rgba(38, 138, 255, 0.94)' : 'rgba(255, 36, 36, 0.94)';
      ctx2d.beginPath();
      ctx2d.arc(proj.sx + 10 * copScale, barY, rPx, 0, Math.PI * 2);
      ctx2d.fill();
    }

    if (cop.hitSparkTimer > 0 && dy < clipY) {
      ctx2d.save();
      const spX = proj.sx + (cop.lastHitSide || 1) * 18 * copScale;
      const spY = proj.sy - 32 * copScale;
      const rad = Math.max(4, 14 * proj.scalePx);
      ctx2d.fillStyle = '#ffff55';
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2 + cop.hitSparkTimer * 0.6;
        ctx2d.fillRect(spX + Math.cos(ang) * rad - 2, spY + Math.sin(ang) * rad - 2, 4, 4);
      }
      ctx2d.restore();
    }

    if (cop.nitroTicks > 0 && cop.state === 'riding' && dy < clipY) {
      const flameH = (12 + ((cop.nitroTicks * 7) % 9)) * proj.scalePx;
      const flameW = Math.max(4, 8.5 * proj.scalePx);
      ctx2d.fillStyle = cop.nitroTicks & 1 ? '#38b6ff' : '#ffee44';
      ctx2d.beginPath();
      ctx2d.ellipse(proj.sx, proj.sy - 9 * copScale, flameW, flameH, 0, 0, Math.PI * 2);
      ctx2d.fill();
    }
  }

  drawRiderSprite(ctx2d, r, proj, clipY) {
    if (r.isPolice && r.state !== 'running') {
      this.drawCopSprite(ctx2d, r, proj, clipY);
      return;
    }

    const bm = this.assets.bikersMeta;
    if (!bm) return;

    const animId = r.animId ?? 2;
    const seq = bm.riderAnims[animId] || bm.riderAnims[bm.fallback[animId] ?? 2] || bm.riderAnims[2];
    const step = seq[r.animStep % seq.length] || seq[0];

    const relYaw = r.isPlayer
      ? 0
      : Math.max(-0.62, Math.min(0.62, (this.viewW * 0.5 - proj.sx) / 360));

    const sel = this.selectActorView(step.r, bm.riderViews, r.lean, relYaw, r.runCompass || 0);
    let frameIdx = sel.frameIdx;
    let cellFlags = sel.flags || 0;
    let mirror = (cellFlags & 1) !== 0;
    if (r.forceMirror !== null && r.forceMirror !== undefined) {
      mirror = r.forceMirror;
    }

    let img = this.assets.getRiderCanvas(r.colorIdx, frameIdx);
    let meta = bm.riderFrames[frameIdx];
    if (!img || !meta || meta[2] <= 1) {
      frameIdx = 3; // upright straight-ahead rear view!
      cellFlags = 0;
      img = this.assets.getRiderCanvas(r.colorIdx, 3);
      meta = bm.riderFrames[3];
    }
    if (!img || !meta) return;

    // Exact actor_render.cpp:35-46 hotspot anchoring [ox, oy, nw, nh]:
    // weapon swings (club/chain/baton/kick) extend out from the bike without shifting the tire!
    const [ox, oy, nw, nh] = meta;
    let sizeMul = r.isPlayer ? 1.74 : 1.82;
    if (cellFlags & 0x10000) sizeMul *= 2;
    if (cellFlags & 0x20000) sizeMul *= 4;
    const riderScale = sizeMul * proj.scalePx;
    const dw = nw * riderScale;
    const dh = nh * riderScale;
    if (dw < 2 || dh < 2) return;

    const ax = mirror ? nw - ox : ox;
    const dx = proj.sx - ax * riderScale;
    const dy = proj.sy - oy * riderScale;

    // Exact shadowFrames hotspot anchoring [sox, soy, sw, sh]
    const shImg = this.assets.getRiderShadowCanvas(frameIdx);
    const shMeta = bm.shadowFrames?.[frameIdx];
    if (shImg && shMeta && shMeta[2] > 1 && proj.sy < clipY) {
      const groundProj = (r.airY || 0) > 1 ? this.projectWorldPoint(r.sample, r.lat, 0) : proj;
      if (groundProj) {
        const [sox, soy, sw, sh] = shMeta;
        const shScale = sizeMul * groundProj.scalePx;
        const sdw = sw * shScale;
        const sdh = sh * shScale;
        const sax = mirror ? sw - sox : sox;
        this.drawClippedCanvas(
          ctx2d,
          shImg,
          groundProj.sx - sax * shScale,
          groundProj.sy - soy * shScale,
          sdw,
          sdh,
          mirror,
          clipY
        );
      }
    }

    this.drawClippedCanvas(ctx2d, img, dx, dy, dw, dh, mirror, clipY);

    if (r.hitSparkTimer > 0 && dy < clipY) {
      ctx2d.save();
      const spX = proj.sx + (r.lastHitSide || 1) * 18 * riderScale;
      const spY = proj.sy - 28 * riderScale;
      const rad = Math.max(4, 14 * proj.scalePx);
      ctx2d.fillStyle = '#ffff55';
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2 + r.hitSparkTimer * 0.6;
        ctx2d.fillRect(spX + Math.cos(ang) * rad - 2, spY + Math.sin(ang) * rad - 2, 4, 4);
      }
      ctx2d.restore();
    }

    if (r.nitroTicks > 0 && r.state === 'riding' && dy < clipY) {
      const flameH = (12 + ((r.nitroTicks * 7) % 9)) * proj.scalePx;
      const flameW = Math.max(4, 8.5 * proj.scalePx);
      ctx2d.fillStyle = r.nitroTicks & 1 ? '#ff7b00' : '#ffee44';
      ctx2d.beginPath();
      ctx2d.ellipse(proj.sx, proj.sy - 8 * riderScale, flameW, flameH, 0, 0, Math.PI * 2);
      ctx2d.fill();
    }
  }

  // ==================== COCKPIT REAR-VIEW MIRROR ====================

  drawRearViewMirror(ctx2d, sim) {
    const p = sim.player;
    let closestBehind = null;
    let bestDist = 11.0;

    for (const r of sim.riders) {
      if (r.isPlayer || r.finished || r.state !== 'riding') continue;
      const behind = p.sample - r.sample;
      if (behind > 0.15 && behind < bestDist) {
        bestDist = behind;
        closestBehind = { kind: 'rider', actor: r, behind };
      }
    }
    for (const cop of sim.cops) {
      if (!cop.active) continue;
      const behind = p.sample - cop.sample;
      if (behind > 0.15 && behind < bestDist) {
        bestDist = behind;
        closestBehind = { kind: 'cop', actor: cop, behind };
      }
    }

    if (!closestBehind) return;

    const mw = 140;
    const mh = 42;
    const mx = Math.floor((this.viewW - mw) * 0.5);
    const my = 6;

    ctx2d.save();
    ctx2d.fillStyle = '#182438';
    ctx2d.fillRect(mx, my, mw, mh);
    ctx2d.fillStyle = '#4c525e';
    ctx2d.fillRect(mx, my + mh * 0.52, mw, mh * 0.48);
    ctx2d.fillStyle = '#d5b73b';
    ctx2d.fillRect(mx + mw * 0.5 - 1, my + mh * 0.54, 2, mh * 0.42);

    const relLat = -(closestBehind.actor.lat - p.lat);
    const bx = Math.max(mx + 14, Math.min(mx + mw - 14, mx + mw * 0.5 + (relLat / 360) * (mw * 0.44)));
    const scale = Math.max(0.24, Math.min(0.85, 1.9 / (closestBehind.behind + 1.4)));

    if (closestBehind.kind === 'cop') {
      const flash = (Math.floor(performance.now() / 100) & 1) === 0;
      ctx2d.fillStyle = flash ? '#ff2a2a' : '#2f8cff';
      ctx2d.beginPath();
      ctx2d.arc(bx, my + mh * 0.64 - 8 * scale, 5 * scale + 2, 0, Math.PI * 2);
      ctx2d.fill();
      const copImg = this.assets.getCopCanvas(3) || this.assets.getCopCanvas(0);
      if (copImg) {
        const dw = Math.max(8, 22 * scale);
        const dh = Math.max(12, 30 * scale);
        ctx2d.drawImage(copImg, bx - dw * 0.5, my + mh - dh - 2, dw, dh);
      }
    } else {
      const riderImg = this.assets.getRiderCanvas(closestBehind.actor.colorIdx, 3);
      if (riderImg) {
        const dw = Math.max(8, 22 * scale);
        const dh = Math.max(12, 32 * scale);
        ctx2d.drawImage(riderImg, bx - dw * 0.5, my + mh - dh - 2, dw, dh);
      }
    }

    ctx2d.strokeStyle = '#c8d0dc';
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(mx + 1, my + 1, mw - 2, mh - 2);
    ctx2d.font = '10px RRFuturaBold, sans-serif';
    ctx2d.fillStyle = closestBehind.kind === 'cop' ? '#ff5555' : '#e1e180';
    ctx2d.textAlign = 'left';
    ctx2d.fillText(closestBehind.kind === 'cop' ? 'COP!' : 'REAR', mx + 5, my + 11);
    ctx2d.restore();
  }
}
