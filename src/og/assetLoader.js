import * as THREE from 'three';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

async function decodeIndexedBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch indexed PNG: ${url}`);
  const blob = await res.blob();

  let source;
  let width = 0;
  let height = 0;
  if (typeof createImageBitmap === 'function') {
    try {
      source = await createImageBitmap(blob, {
        colorSpaceConversion: 'none',
        premultiplyAlpha: 'none'
      });
      width = source.width;
      height = source.height;
    } catch {
      source = null;
    }
  }
  if (!source) {
    source = await loadImage(url);
    width = source.naturalWidth || source.width;
    height = source.naturalHeight || source.height;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  if (source.close) source.close();

  const rgba = ctx.getImageData(0, 0, width, height).data;
  const indices = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < indices.length; i++, p += 4) {
    indices[i] = rgba[p];
  }
  return { width, height, indices };
}

export class AssetManager {
  constructor() {
    this.frontend = null;
    this.bikersMeta = null;
    this.carsMeta = null;
    this.worldMeta = null;

    this.hibob = null;
    this.hishadow = null;
    this.locop = null;
    this.hishadoc = null;
    this.worldIndexed = null;
    this.carsAtlas = null;

    this.bigMeter = null;
    this.bigMeterOpaque = null;
    this.bigCloud = null;

    this.uiBrightCache = new Map();
    this.uiDarkCache = new Map();
    this.uiLoading = new Map();

    this.riderCanvasCache = new Map();
    this.riderShadowCache = new Map();
    this.copCanvasCache = new Map();
    this.copShadowCache = new Map();
    this.carCanvasCache = new Map();
    this.worldCanvasCache = new Map();
    this.worldTexCache = new Map();

    this.courseCache = new Map();
    this.horizonCache = new Map();
    this.dashCache = new Map();
  }

  async loadBootAssets(onProgress = () => {}) {
    onProgress(0.05, 'Loading 1996 fonts & game tables...');
    if (document.fonts && document.fonts.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 1500))
      ]);
    }

    const [frontend, bikersMeta, carsMeta, worldMeta] = await Promise.all([
      fetch('/og/data/frontend.json').then((r) => r.json()),
      fetch('/og/sprites/bikers_meta.json').then((r) => r.json()),
      fetch('/og/sprites/cars_meta.json').then((r) => r.json()),
      fetch('/og/sprites/world_meta.json').then((r) => r.json())
    ]);
    this.frontend = frontend;
    this.bikersMeta = bikersMeta;
    this.carsMeta = carsMeta;
    this.worldMeta = worldMeta;

    onProgress(0.28, 'Loading splash & menu artwork...');
    await Promise.all([
      this.preloadUI('splash.jpg'),
      this.preloadUI('main.jpg'),
      this.preloadUI('postcard.jpg'),
      this.preloadUI('postcard/city.jpg')
    ]);

    onProgress(0.52, 'Decoding digitized biker & police sprites...');
    const [hibob, hishadow, locop, hishadoc, carsAtlas, bigMeter, bigCloud] = await Promise.all([
      decodeIndexedBytes('/og/sprites/hibob_indexed.png'),
      decodeIndexedBytes('/og/sprites/hishadow_indexed.png'),
      decodeIndexedBytes('/og/sprites/locop_indexed.png'),
      decodeIndexedBytes('/og/sprites/hishadoc_indexed.png'),
      loadImage('/og/sprites/cars_atlas.png'),
      loadImage('/og/hud/bigmeter.png'),
      loadImage('/og/horizons/bigcloud.png')
    ]);
    this.hibob = hibob;
    this.hishadow = hishadow;
    this.locop = locop;
    this.hishadoc = hishadoc;
    this.carsAtlas = carsAtlas;
    this.bigMeter = bigMeter;
    this.bigCloud = bigCloud;

    // Create an opaque version of bigmeter.png (index 0 in palette is pure black #000000 when non-keyed!)
    const bmCanvas = document.createElement('canvas');
    bmCanvas.width = bigMeter.width;
    bmCanvas.height = bigMeter.height;
    const bmCtx = bmCanvas.getContext('2d');
    bmCtx.fillStyle = '#000000';
    bmCtx.fillRect(0, 0, bmCanvas.width, bmCanvas.height);
    bmCtx.drawImage(bigMeter, 0, 0);
    this.bigMeterOpaque = bmCanvas;

    onProgress(0.78, 'Decoding 1996 world & pedestrian textures...');
    this.worldIndexed = await decodeIndexedBytes('/og/sprites/world_indexed.png');

    onProgress(1.0, 'Ready!');
  }

  str(id) {
    if (!this.frontend || !this.frontend.strings) return '';
    return this.frontend.strings[String(id)] ?? '';
  }

  async preloadUI(relPath) {
    if (this.uiBrightCache.has(relPath)) return this.uiBrightCache.get(relPath);
    if (this.uiLoading.has(relPath)) return this.uiLoading.get(relPath);

    const p = loadImage(`/og/ui/${relPath}`)
      .then((img) => {
        this.uiBrightCache.set(relPath, img);
        // Build 50% darkened RGB555 version matching frontend.cpp::darken555
        const dark = document.createElement('canvas');
        dark.width = img.naturalWidth || img.width;
        dark.height = img.naturalHeight || img.height;
        const dctx = dark.getContext('2d');
        dctx.drawImage(img, 0, 0);
        const id = dctx.getImageData(0, 0, dark.width, dark.height);
        const px = id.data;
        for (let i = 0; i < px.length; i += 4) {
          px[i] = (px[i] >> 1) & 0xf8;
          px[i + 1] = (px[i + 1] >> 1) & 0xf8;
          px[i + 2] = (px[i + 2] >> 1) & 0xf8;
        }
        dctx.putImageData(id, 0, 0);
        this.uiDarkCache.set(relPath, dark);
        this.uiLoading.delete(relPath);
        return img;
      })
      .catch(() => {
        this.uiLoading.delete(relPath);
        return null;
      });
    this.uiLoading.set(relPath, p);
    return p;
  }

  getUI(relPath) {
    if (!relPath) return null;
    if (!this.uiBrightCache.has(relPath)) {
      this.preloadUI(relPath);
      return null;
    }
    return {
      bright: this.uiBrightCache.get(relPath),
      dark: this.uiDarkCache.get(relPath)
    };
  }

  getRiderCanvas(remapIdx, frameIdx) {
    const r = ((remapIdx % 15) + 15) % 15;
    const key = r * 1024 + frameIdx;
    if (this.riderCanvasCache.has(key)) return this.riderCanvasCache.get(key);
    const rects = this.bikersMeta?.hibobRects;
    if (!rects || frameIdx < 0 || frameIdx >= rects.length) return null;
    const [sx, sy, w, h] = rects[frameIdx];
    if (w <= 0 || h <= 0) return null;

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    const out = imgData.data;
    const pal = this.bikersMeta.palette;
    const remap = this.bikersMeta.remaps[r];
    const sheetW = this.hibob.width;
    const src = this.hibob.indices;

    for (let y = 0; y < h; y++) {
      let srcOff = (sy + y) * sheetW + sx;
      let dstOff = y * w * 4;
      for (let x = 0; x < w; x++, srcOff++, dstOff += 4) {
        const idx = src[srcOff];
        if (idx === 0) continue;
        const cidx = remap[idx];
        const rgb = pal[cidx];
        out[dstOff] = rgb[0];
        out[dstOff + 1] = rgb[1];
        out[dstOff + 2] = rgb[2];
        out[dstOff + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    this.riderCanvasCache.set(key, c);
    return c;
  }

  getRiderShadowCanvas(frameIdx) {
    if (this.riderShadowCache.has(frameIdx)) return this.riderShadowCache.get(frameIdx);
    const rects = this.bikersMeta?.hishadowRects;
    if (!rects || frameIdx < 0 || frameIdx >= rects.length) return null;
    const [sx, sy, w, h] = rects[frameIdx];
    if (w <= 0 || h <= 0) return null;

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    const out = imgData.data;
    const sheetW = this.hishadow.width;
    const src = this.hishadow.indices;

    for (let y = 0; y < h; y++) {
      let srcOff = (sy + y) * sheetW + sx;
      let dstOff = y * w * 4;
      for (let x = 0; x < w; x++, srcOff++, dstOff += 4) {
        if (src[srcOff] === 0) continue;
        out[dstOff] = 0;
        out[dstOff + 1] = 0;
        out[dstOff + 2] = 0;
        out[dstOff + 3] = 128;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    this.riderShadowCache.set(frameIdx, c);
    return c;
  }

  getCopCanvas(frameIdx) {
    if (this.copCanvasCache.has(frameIdx)) return this.copCanvasCache.get(frameIdx);
    const rects = this.bikersMeta?.locopRects;
    if (!rects || frameIdx < 0 || frameIdx >= rects.length) return null;
    const [sx, sy, w, h] = rects[frameIdx];
    if (w <= 0 || h <= 0) return null;

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    const out = imgData.data;
    const pal = this.bikersMeta.palette;
    const sheetW = this.locop.width;
    const src = this.locop.indices;

    for (let y = 0; y < h; y++) {
      let srcOff = (sy + y) * sheetW + sx;
      let dstOff = y * w * 4;
      for (let x = 0; x < w; x++, srcOff++, dstOff += 4) {
        const idx = src[srcOff];
        if (idx === 0) continue;
        const rgb = pal[idx];
        out[dstOff] = rgb[0];
        out[dstOff + 1] = rgb[1];
        out[dstOff + 2] = rgb[2];
        out[dstOff + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    this.copCanvasCache.set(frameIdx, c);
    return c;
  }

  getCopShadowCanvas(frameIdx) {
    if (this.copShadowCache.has(frameIdx)) return this.copShadowCache.get(frameIdx);
    const rects = this.bikersMeta?.hishadocRects;
    if (!rects || frameIdx < 0 || frameIdx >= rects.length) return null;
    const [sx, sy, w, h] = rects[frameIdx];
    if (w <= 0 || h <= 0) return null;

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    const out = imgData.data;
    const sheetW = this.hishadoc.width;
    const src = this.hishadoc.indices;

    for (let y = 0; y < h; y++) {
      let srcOff = (sy + y) * sheetW + sx;
      let dstOff = y * w * 4;
      for (let x = 0; x < w; x++, srcOff++, dstOff += 4) {
        if (src[srcOff] === 0) continue;
        out[dstOff] = 0;
        out[dstOff + 1] = 0;
        out[dstOff + 2] = 0;
        out[dstOff + 3] = 128;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    this.copShadowCache.set(frameIdx, c);
    return c;
  }

  getCarCanvas(rectIdx) {
    if (this.carCanvasCache.has(rectIdx)) return this.carCanvasCache.get(rectIdx);
    const rects = this.carsMeta?.rects;
    if (!rects || rectIdx < 0 || rectIdx >= rects.length) return null;
    const [sx, sy, w, h] = rects[rectIdx];
    if (w <= 0 || h <= 0) return null;

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.carsAtlas, sx, sy, w, h, 0, 0, w, h);
    this.carCanvasCache.set(rectIdx, c);
    return c;
  }

  getWorldCanvas(texId) {
    if (texId < 0) return null;
    if (this.worldCanvasCache.has(texId)) return this.worldCanvasCache.get(texId);
    const rects = this.worldMeta?.rects;
    if (!rects || texId >= rects.length) return null;
    const [sx, sy, w, h, keyed] = rects[texId];
    if (w <= 0 || h <= 0) return null;

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    const out = imgData.data;
    const pal = this.bikersMeta.palette;
    const sheetW = this.worldIndexed.width;
    const src = this.worldIndexed.indices;

    for (let y = 0; y < h; y++) {
      let srcOff = (sy + y) * sheetW + sx;
      let dstOff = y * w * 4;
      for (let x = 0; x < w; x++, srcOff++, dstOff += 4) {
        const idx = src[srcOff];
        if (keyed && idx === 0) continue;
        const rgb = pal[idx];
        out[dstOff] = rgb[0];
        out[dstOff + 1] = rgb[1];
        out[dstOff + 2] = rgb[2];
        out[dstOff + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    this.worldCanvasCache.set(texId, c);
    return c;
  }

  getWorldThreeTexture(texId, repeatS = true, repeatT = true) {
    if (texId < 0) return null;
    const cacheKey = `${texId}_${repeatS ? 1 : 0}_${repeatT ? 1 : 0}`;
    if (this.worldTexCache.has(cacheKey)) return this.worldTexCache.get(cacheKey);
    const canvas = this.getWorldCanvas(texId);
    if (!canvas) return null;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = repeatS ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = repeatT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this.worldTexCache.set(cacheKey, tex);
    return tex;
  }

  async loadCourse(courseKey) {
    if (this.courseCache.has(courseKey)) {
      const course = this.courseCache.get(courseKey);
      const horizon = this.horizonCache.get(course.horizon);
      return { course, horizon };
    }
    const course = await fetch(`/og/data/courses/${courseKey}.json`).then((r) => r.json());
    this.courseCache.set(courseKey, course);
    let horizon = this.horizonCache.get(course.horizon);
    if (!horizon) {
      horizon = await loadImage(`/og/horizons/${course.horizon}.png`);
      this.horizonCache.set(course.horizon, horizon);
    }
    return { course, horizon };
  }

  async loadDash(bikeId, metric = false) {
    const cls = bikeId < 5 ? 'rat' : bikeId < 10 ? 'super' : 'sport';
    const unit = metric ? 'kph' : 'mph';
    const key = `${cls}_${unit}`;
    if (this.dashCache.has(key)) return this.dashCache.get(key);
    const img = await loadImage(`/og/hud/dash_${key}.png`);
    this.dashCache.set(key, img);
    return img;
  }
}
