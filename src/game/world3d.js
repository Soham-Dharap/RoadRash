import * as THREE from 'three';
import { SEGMENT_LENGTH, ROAD_HALF_WIDTH, SHOULDER_WIDTH } from '../data/tracks.js';
import { createTrackTextures } from '../graphics/textures.js';
import { getPropSprites } from '../graphics/sprites.js';

export function sampleCourse(course, s) {
  const clampedS = Math.max(0, Math.min(course.totalS - 0.01, s));
  const fIdx = clampedS / SEGMENT_LENGTH;
  const i0 = Math.min(course.totalSegments - 2, Math.floor(fIdx));
  const i1 = i0 + 1;
  const t = fIdx - i0;

  const a = course.segments[i0];
  const b = course.segments[i1];

  const x = a.x + (b.x - a.x) * t;
  const roadY = a.y + (b.y - a.y) * t;
  const z = a.z + (b.z - a.z) * t;

  // Interpolate heading smoothly
  let dh = b.heading - a.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const heading = a.heading + dh * t;

  const fx = Math.sin(heading);
  const fz = -Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = Math.sin(heading);

  return {
    s: clampedS,
    segIndex: i0,
    x,
    roadY,
    z,
    heading,
    curve: a.curve + (b.curve - a.curve) * t,
    pitch: a.pitch + (b.pitch - a.pitch) * t,
    fx,
    fz,
    rx,
    rz,
    guardrailLeft: a.guardrailLeft,
    guardrailRight: a.guardrailRight,
    isIntersection: a.isIntersection
  };
}

export class World3DRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.retroMode = true; // Authentic 480p SVGA crisp pixel mode by default!

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(56, 4 / 3, 0.4, 760);

    this.skyMesh = null;
    this.dynamicGroup = new THREE.Group();
    this.staticGroup = new THREE.Group();
    this.scene.add(this.staticGroup);
    this.scene.add(this.dynamicGroup);

    // Particle pool (sparks, smoke, hit flashes, nitro flames)
    this.particles = [];
    this.particleTex = this.createSquarePixelTex();
  }

  createSquarePixelTex() {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 8, 8);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    return t;
  }

  resize(viewW, viewH) {
    const aspect = Math.max(1.1, viewW / Math.max(1, viewH));
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    if (this.retroMode) {
      // Authentic 1996 Windows SVGA 480p vertical resolution scaled crisp via CSS pixelated!
      const targetH = 480;
      const targetW = Math.round(targetH * aspect);
      this.renderer.setSize(targetW, targetH, false);
    } else {
      this.renderer.setSize(viewW, viewH, false);
    }
  }

  clearSceneGroups() {
    for (const grp of [this.staticGroup, this.dynamicGroup]) {
      while (grp.children.length > 0) {
        const obj = grp.children.pop();
        if (obj.geometry) obj.geometry.dispose();
      }
    }
    if (this.skyMesh) {
      this.scene.remove(this.skyMesh);
      this.skyMesh.geometry.dispose();
      this.skyMesh = null;
    }
    this.particles = [];
  }

  buildCourseScene(course) {
    this.clearSceneGroups();
    this.course = course;
    const { track, segments } = course;
    const tex = createTrackTextures(track);
    this.textures = tex;

    // Subtle distance haze matching horizon
    this.scene.fog = new THREE.Fog(track.fogColor, 260, 620);
    this.renderer.setClearColor(track.skyBottom);

    // 1. 360° Sky + Fluffy Clouds + Distant Mountain Horizon Cylinder
    const skyGeo = new THREE.CylinderGeometry(670, 670, 340, 48, 1, true);
    skyGeo.scale(-1, 1, 1); // inward normals
    const skyMat = new THREE.MeshBasicMaterial({ map: tex.sky, fog: false, depthWrite: false });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.skyMesh.renderOrder = -10;
    this.scene.add(this.skyMesh);

    // Lighting for buildings & terrain slopes
    const amb = new THREE.AmbientLight(0xffffff, 0.86);
    const sun = new THREE.DirectionalLight(0xfffbeb, 0.52);
    sun.position.set(-80, 140, 60);
    this.staticGroup.add(amb);
    this.staticGroup.add(sun);

    const halfRibbon = ROAD_HALF_WIDTH + SHOULDER_WIDTH; // 12.2m

    // 2. Build Road Ribbon buckets (normal asphalt, crosswalk intersections, finish checkered)
    const normalPos = [], normalUV = [];
    const crossPos = [], crossUV = [];
    const finishPos = [], finishUV = [];

    // Left & Right 3D Terrain Embankments
    const leftPos = [], leftUV = [];
    const rightPos = [], rightUV = [];

    // Continuous 3D Guardrails
    const railPos = [], railUV = [];

    const pushQuad = (posArr, uvArr, p00, p10, p01, p11, u0, v0, u1, v1) => {
      posArr.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      uvArr.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    };

    const getBermOuter = (seg, side) => {
      const dist = 88;
      let lift = 0;
      if (side < 0) {
        if (track.cliffLeft) lift = 34 + Math.sin(seg.index * 0.25) * 4;
        else if (track.urban) lift = 0.15;
        else lift = 8 + Math.sin(seg.index * 0.09 + 0.5) * 9 + Math.cos(seg.index * 0.04) * 5;
      } else {
        if (track.oceanRight) lift = -3.8;
        else if (track.urban) lift = 0.15;
        else lift = 7 + Math.cos(seg.index * 0.08) * 9 + Math.sin(seg.index * 0.035) * 5;
      }
      return [seg.x + seg.rx * side * dist, seg.y + lift, seg.z + seg.rz * side * dist];
    };

    for (let i = 0; i < segments.length - 1; i++) {
      const a = segments[i];
      const b = segments[i + 1];

      const aL = [a.x - a.rx * halfRibbon, a.y, a.z - a.rz * halfRibbon];
      const aR = [a.x + a.rx * halfRibbon, a.y, a.z + a.rz * halfRibbon];
      const bL = [b.x - b.rx * halfRibbon, b.y, b.z - b.rz * halfRibbon];
      const bR = [b.x + b.rx * halfRibbon, b.y, b.z + b.rz * halfRibbon];

      if (a.isFinish) {
        pushQuad(finishPos, finishUV, aL, aR, bL, bR, 0, 0, 1, 1);
      } else if (a.isCrosswalk) {
        pushQuad(crossPos, crossUV, aL, aR, bL, bR, 0, 0, 1, 1);
      } else {
        pushQuad(normalPos, normalUV, aL, aR, bL, bR, 0, 0, 1, 1);
      }

      // Left & Right 3D Embankment Strips
      const aOutL = getBermOuter(a, -1);
      const bOutL = getBermOuter(b, -1);
      pushQuad(leftPos, leftUV, aOutL, aL, bOutL, bL, 0, (i % 4) * 0.25, 1, ((i % 4) + 1) * 0.25);

      const aOutR = getBermOuter(a, 1);
      const bOutR = getBermOuter(b, 1);
      pushQuad(rightPos, rightUV, aR, aOutR, bR, bOutR, 0, (i % 4) * 0.25, 1, ((i % 4) + 1) * 0.25);

      // 3D Corrugated Steel Guardrails along curves/cliffs (Screenshots 2 & 4!)
      const railOffset = ROAD_HALF_WIDTH + 1.3;
      const railH = 1.08;
      if (a.guardrailLeft) {
        const g0 = [a.x - a.rx * railOffset, a.y, a.z - a.rz * railOffset];
        const g1 = [b.x - b.rx * railOffset, b.y, b.z - b.rz * railOffset];
        const g0Top = [g0[0], g0[1] + railH, g0[2]];
        const g1Top = [g1[0], g1[1] + railH, g1[2]];
        pushQuad(railPos, railUV, g0, g1, g0Top, g1Top, 0, 0, 1, 1);
      }
      if (a.guardrailRight) {
        const g0 = [a.x + a.rx * railOffset, a.y, a.z + a.rz * railOffset];
        const g1 = [b.x + b.rx * railOffset, b.y, b.z + b.rz * railOffset];
        const g0Top = [g0[0], g0[1] + railH, g0[2]];
        const g1Top = [g1[0], g1[1] + railH, g1[2]];
        pushQuad(railPos, railUV, g1, g0, g1Top, g0Top, 0, 0, 1, 1);
      }
    }

    const addBuiltMesh = (pos, uv, mapTex, opts = {}) => {
      if (pos.length === 0) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.computeVertexNormals();
      const mat = new THREE.MeshLambertMaterial({
        map: mapTex,
        side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
        alphaTest: opts.alphaTest || 0
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.staticGroup.add(mesh);
    };

    addBuiltMesh(normalPos, normalUV, tex.road);
    addBuiltMesh(crossPos, crossUV, tex.crosswalk);
    addBuiltMesh(finishPos, finishUV, tex.finish);
    addBuiltMesh(leftPos, leftUV, tex.leftGround, { doubleSide: true });
    addBuiltMesh(rightPos, rightUV, tex.rightGround, { doubleSide: true });
    addBuiltMesh(railPos, railUV, tex.guardrail, { doubleSide: true, alphaTest: 0.45 });

    // 3. Urban San Francisco 3D Buildings (Screenshots 3 & 6!)
    const bMats = tex.buildings.map((bt) => new THREE.MeshLambertMaterial({ map: bt }));
    for (const bld of course.buildings) {
      const seg = segments[bld.seg];
      if (!seg) continue;
      const geo = new THREE.BoxGeometry(bld.width, bld.height, bld.depth);
      const mesh = new THREE.Mesh(geo, bMats[bld.style % bMats.length]);
      const lateral = bld.side * (halfRibbon + bld.width * 0.5 + 0.6);
      mesh.position.set(
        seg.x + seg.rx * lateral,
        seg.y + bld.height * 0.5 - 1.0,
        seg.z + seg.rz * lateral
      );
      mesh.rotation.y = -seg.heading;
      this.staticGroup.add(mesh);
    }

    // 4. Static Roadside Prop Sprites (Trees, Curve Warning Signs, Traffic Lights, Highway Signs, Billboards)
    const propTexMap = getPropSprites();
    const propMats = {};
    for (const [k, pTex] of Object.entries(propTexMap)) {
      propMats[k] = new THREE.SpriteMaterial({ map: pTex, fog: true, alphaTest: 0.35 });
    }

    const propDimensions = {
      traffic_light: [2.4, 5.4],
      sign_curve_left: [2.3, 4.1],
      sign_curve_right: [2.3, 4.1],
      sign_crosswalk: [2.0, 3.8],
      highway_sign: [5.4, 5.4],
      billboard: [7.6, 6.0],
      oak_tree: [6.8, 8.6],
      pine_tree: [6.4, 9.8],
      city_tree: [5.2, 6.8],
      pole: [2.8, 7.6],
      trash_can: [1.2, 1.6],
      boulder_ramp: [2.2, 1.5]
    };

    this.trafficLightSprites = [];
    for (const p of course.props) {
      const seg = segments[p.seg];
      if (!seg) continue;
      const mat = propMats[p.type] || propMats.oak_tree;
      const sp = new THREE.Sprite(mat);
      const [pw, ph] = propDimensions[p.type] || [3, 4];
      sp.scale.set(pw, ph, 1);
      sp.center.set(0.5, 0.04);
      sp.position.set(seg.x + seg.rx * p.offset, seg.y, seg.z + seg.rz * p.offset);
      this.staticGroup.add(sp);

      if (p.type === 'traffic_light') {
        this.trafficLightSprites.push({ sprite: sp, segIndex: p.seg, mats: propMats });
      }
    }

    // Finish Checkered Banner Arch at finish segment!
    const finSeg = segments[course.raceSegments];
    if (finSeg) {
      const postGeo = new THREE.BoxGeometry(0.6, 7.5, 0.6);
      const postMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(
          finSeg.x + finSeg.rx * side * (ROAD_HALF_WIDTH + 1.2),
          finSeg.y + 3.75,
          finSeg.z + finSeg.rz * side * (ROAD_HALF_WIDTH + 1.2)
        );
        this.staticGroup.add(post);
      }
      const bannerGeo = new THREE.BoxGeometry((ROAD_HALF_WIDTH + 1.4) * 2, 1.5, 0.4);
      const bannerMat = new THREE.MeshBasicMaterial({ map: tex.finish });
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.set(finSeg.x, finSeg.y + 7.1, finSeg.z);
      banner.rotation.y = -finSeg.heading;
      this.staticGroup.add(banner);
    }
  }

  createEntitySprite(tex, w, h) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      fog: true,
      alphaTest: 0.35
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(w, h, 1);
    sp.center.set(0.5, 0.05);
    this.dynamicGroup.add(sp);
    return sp;
  }

  spawnSparks(worldPos, count = 10, colorHex = 0xfbbf24, upward = 5) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.particleTex,
        color: i % 2 === 0 ? colorHex : 0xffffff
      });
      const sp = new THREE.Sprite(mat);
      const sz = 0.16 + Math.random() * 0.22;
      sp.scale.set(sz, sz, 1);
      sp.position.set(worldPos.x, worldPos.y + 0.5, worldPos.z);
      this.dynamicGroup.add(sp);
      this.particles.push({
        sprite: sp,
        vx: (Math.random() - 0.5) * 9,
        vy: upward * (0.4 + Math.random() * 0.9),
        vz: (Math.random() - 0.5) * 9,
        gravity: 22,
        life: 0.28 + Math.random() * 0.25
      });
    }
  }

  spawnSmoke(worldPos, colorHex = 0xd1d5db, scale = 0.55) {
    const mat = new THREE.SpriteMaterial({
      map: this.particleTex,
      color: colorHex,
      transparent: true,
      opacity: 0.65
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(scale, scale, 1);
    sp.position.set(worldPos.x + (Math.random() - 0.5) * 0.5, worldPos.y + 0.35, worldPos.z);
    this.dynamicGroup.add(sp);
    this.particles.push({
      sprite: sp,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 1.4 + Math.random() * 1.5,
      vz: (Math.random() - 0.5) * 1.6,
      gravity: -1.2,
      life: 0.38 + Math.random() * 0.22
    });
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.dynamicGroup.remove(p.sprite);
        p.sprite.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
    }
  }

  renderFrame(camState, dt) {
    this.updateParticles(dt);

    // Toggle intersection traffic lights periodically
    if (this.trafficLightSprites && this.trafficLightSprites.length > 0) {
      const phase = Math.floor(performance.now() / 4500);
      for (const tl of this.trafficLightSprites) {
        const isGreen = (phase + Math.floor(tl.segIndex / 20)) % 3 !== 0;
        tl.sprite.material = isGreen
          ? tl.mats.traffic_light_green
          : tl.mats.traffic_light_red;
      }
    }

    this.camera.position.set(camState.x, camState.y, camState.z);
    this.camera.lookAt(camState.lookX, camState.lookY, camState.lookZ);
    // Subtle camera roll when leaning hard into turns!
    this.camera.rotation.z = camState.roll || 0;

    if (this.skyMesh) {
      this.skyMesh.position.set(camState.x, camState.y + 85, camState.z);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
