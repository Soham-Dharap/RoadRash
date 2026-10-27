import { AssetManager } from './og/assetLoader.js';
import { AudioEngine, MUSIC_TRACKS } from './og/audioEngine.js';
import { FrontendUI } from './og/frontendUI.js';
import { CourseRenderer } from './og/courseRenderer.js';
import { HudRenderer } from './og/hudRenderer.js';
import { RaceSimulation } from './og/raceSimulation.js';

const ASPECT_STORAGE_KEY = 'roadrash_96_aspect_v5';

const viewportShell = document.getElementById('viewport-shell');
const glCanvas = document.getElementById('gl-canvas');
const uiCanvas = document.getElementById('ui-canvas');
const uiCtx = uiCanvas.getContext('2d', { alpha: false });
const touchControlsEl = document.getElementById('touch-controls');

const btnMenu = document.getElementById('btn-menu');
const btnPolice = document.getElementById('btn-police');
const btnAspect43 = document.getElementById('btn-aspect-43');
const btnAspect169 = document.getElementById('btn-aspect-169');
const btnMusic = document.getElementById('btn-music');
const btnMute = document.getElementById('btn-mute');
const btnFullscreen = document.getElementById('btn-fullscreen');

const assets = new AssetManager();
const audio = new AudioEngine();
const courseRenderer = new CourseRenderer(glCanvas, assets);
const hudRenderer = new HudRenderer(assets);

let appState = 'booting'; // 'booting' | 'frontend' | 'loading_race' | 'racing'
let bootProgress = 0;
let bootStatus = 'Initializing...';

let currentAspect = '4:3';
let currentViewW = 640;

let frontend = null;
let raceSim = null;
let activeDashImg = null;
let lastRaceConfig = null;
let lastGasTapMs = 0;

const inputState = {
  gas: false,
  brake: false,
  left: false,
  right: false
};

function clearInputs() {
  inputState.gas = false;
  inputState.brake = false;
  inputState.left = false;
  inputState.right = false;
}

// ==================== RESPONSIVE 4:3 OG vs 16:9 WIDESCREEN ====================

function setAspectMode(mode, persist = true) {
  currentAspect = mode === '16:9' ? '16:9' : '4:3';
  currentViewW = currentAspect === '16:9' ? 854 : 640;

  viewportShell.dataset.aspect = currentAspect;
  uiCanvas.width = currentViewW;
  uiCanvas.height = 480;
  courseRenderer.setViewportWidth(currentViewW);

  btnAspect43?.classList.toggle('active-opt', currentAspect === '4:3');
  btnAspect169?.classList.toggle('active-opt', currentAspect === '16:9');

  if (persist) {
    try {
      localStorage.setItem(ASPECT_STORAGE_KEY, currentAspect);
    } catch {
      // ignore storage errors
    }
  }
}

function loadInitialAspect() {
  try {
    const saved = localStorage.getItem(ASPECT_STORAGE_KEY);
    if (saved === '16:9' || saved === '4:3') {
      setAspectMode(saved, false);
      return;
    }
  } catch {
    // ignore
  }
  setAspectMode('4:3', false);
}

loadInitialAspect();

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    viewportShell.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

document.addEventListener('fullscreenchange', () => {
  const isFull = Boolean(document.fullscreenElement);
  if (btnFullscreen) {
    btnFullscreen.textContent = isFull ? 'EXIT FULL' : 'FULLSCREEN';
    btnFullscreen.classList.toggle('active-opt', isFull);
  }
});

// ==================== RACE LIFECYCLE ====================

async function startRace(raceConfig) {
  lastRaceConfig = raceConfig;
  appState = 'loading_race';
  clearInputs();

  try {
    const dashBikeId = raceConfig.mode === 'copchase' ? 9 : raceConfig.bikeId;
    const [{ course, horizon }, dashImg] = await Promise.all([
      assets.loadCourse(raceConfig.courseKey),
      assets.loadDash(dashBikeId, false)
    ]);
    activeDashImg = dashImg;
    courseRenderer.buildCourse(course, horizon, raceConfig.level);

    const grungeTrack = MUSIC_TRACKS[raceConfig.courseId % 5];
    audio.playMusicTrack(grungeTrack);

    raceSim = new RaceSimulation(assets, audio, courseRenderer, raceConfig, (outcome) => {
      appState = 'frontend';
      touchControlsEl.classList.remove('active');
      audio.playMusicTrack('KLOWN');
      frontend.handleRaceFinished(outcome);
    });

    appState = 'racing';
    touchControlsEl.classList.add('active');
  } catch (err) {
    console.error('Failed to start race:', err);
    appState = 'frontend';
    frontend.go('main', 0);
  }
}

function quitRaceToMenu() {
  audio.stopAllRaceLoops();
  raceSim = null;
  appState = 'frontend';
  touchControlsEl.classList.remove('active');
  audio.playMusicTrack('KLOWN');
  if (frontend.mode === 'biggame') {
    frontend.go('panzer', 2);
  } else if (frontend.mode === 'copchase') {
    frontend.go('police_tracks', frontend.policeCourse);
  } else {
    frontend.go('main', 0);
  }
}

// ==================== KEYBOARD & POINTER INPUT ====================

function setKeyFlag(code, down) {
  if (code === 'ArrowUp' || code === 'KeyW') {
    if (down && !inputState.gas && appState === 'racing' && raceSim && !raceSim.paused) {
      const now = performance.now();
      if (now - lastGasTapMs < 300) {
        raceSim.triggerNitro();
      }
      lastGasTapMs = now;
    }
    inputState.gas = down;
    return true;
  }
  if (code === 'ArrowDown' || code === 'KeyS') {
    inputState.brake = down;
    return true;
  }
  if (code === 'ArrowLeft' || code === 'KeyA') {
    inputState.left = down;
    return true;
  }
  if (code === 'ArrowRight' || code === 'KeyD') {
    inputState.right = down;
    return true;
  }
  return false;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'F11') {
    e.preventDefault();
    toggleFullscreen();
    return;
  }
  if (e.code === 'KeyM' && !e.repeat && !(appState === 'frontend' && frontend?.editingName)) {
    audio.ensureContext();
    const next = audio.nextMusicTrack();
    btnMusic.textContent = `MUSIC: ${next}`;
    return;
  }

  if (appState === 'frontend' && frontend) {
    frontend.onKeyDown(e);
    return;
  }

  if (appState === 'racing' && raceSim) {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!e.repeat) {
        raceSim.paused = !raceSim.paused;
        if (raceSim.paused) audio.stopAllRaceLoops();
      }
      e.preventDefault();
      return;
    }

    if (raceSim.paused) {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        raceSim.pauseFocus = (raceSim.pauseFocus + 2) % 3;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        raceSim.pauseFocus = (raceSim.pauseFocus + 1) % 3;
      } else if (e.code === 'KeyR') {
        startRace(lastRaceConfig);
      } else if (e.code === 'KeyQ') {
        quitRaceToMenu();
      } else if (e.code === 'Enter' || e.code === 'Space') {
        if (raceSim.pauseFocus === 0) raceSim.paused = false;
        else if (raceSim.pauseFocus === 1) startRace(lastRaceConfig);
        else quitRaceToMenu();
      }
      e.preventDefault();
      return;
    }

    if (setKeyFlag(e.code, true)) {
      e.preventDefault();
      return;
    }

    if (!e.repeat) {
      if (e.code === 'Space' || e.code === 'Enter') {
        // Smart OG Melee: swings Fist/Club/Chain/Nightstick toward closest rival beside you!
        raceSim.triggerAttack('smart', inputState);
        e.preventDefault();
      } else if (e.code === 'KeyZ' || e.code === 'Comma') {
        raceSim.triggerAttack('left', inputState);
        e.preventDefault();
      } else if (e.code === 'KeyC' || e.code === 'Period') {
        raceSim.triggerAttack('right', inputState);
        e.preventDefault();
      } else if (
        e.code === 'KeyX' ||
        e.code === 'Slash' ||
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight'
      ) {
        // Lateral Boot-Kick Shove across lanes!
        raceSim.triggerAttack('kick', inputState);
        e.preventDefault();
      } else if (
        e.code === 'KeyN' ||
        e.code === 'KeyB' ||
        e.code === 'ControlLeft' ||
        e.code === 'ControlRight'
      ) {
        raceSim.triggerNitro();
        e.preventDefault();
      } else if (e.code === 'KeyQ' || e.code === 'Tab') {
        raceSim.cycleWeapon(e.shiftKey ? -1 : 1);
        e.preventDefault();
      } else if (e.code === 'KeyE') {
        raceSim.cycleWeapon(1);
        e.preventDefault();
      } else if (e.code === 'Digit1') {
        raceSim.selectWeapon(0);
        e.preventDefault();
      } else if (e.code === 'Digit2') {
        raceSim.selectWeapon(1);
        e.preventDefault();
      } else if (e.code === 'Digit3') {
        raceSim.selectWeapon(2);
        e.preventDefault();
      } else if (e.code === 'Digit4') {
        raceSim.selectWeapon(3);
        e.preventDefault();
      } else if (e.code === 'KeyG') {
        raceSim.toggleSiren();
        e.preventDefault();
      } else if (e.code === 'F10' || e.code === 'KeyH') {
        hudRenderer.cycleMode();
        e.preventDefault();
      }
    }
  }
});

window.addEventListener('keyup', (e) => {
  setKeyFlag(e.code, false);
});

window.addEventListener('blur', () => clearInputs());

function eventToCanvasCoords(e) {
  const rect = uiCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * currentViewW;
  const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 480;
  return [x, y];
}

uiCanvas.addEventListener('pointermove', (e) => {
  if (appState === 'frontend' && frontend) {
    const [x, y] = eventToCanvasCoords(e);
    frontend.onPointerMove(x, y);
  }
});

uiCanvas.addEventListener('pointerdown', (e) => {
  const [x, y] = eventToCanvasCoords(e);
  if (appState === 'frontend' && frontend) {
    frontend.onPointerClick(x, y);
    return;
  }
  if (appState === 'racing' && raceSim) {
    if (raceSim.paused) {
      const bx = Math.floor((currentViewW - 260) * 0.5);
      for (let i = 0; i < 3; i++) {
        const by = 205 + i * 44;
        if (x >= bx && x <= bx + 260 && y >= by && y <= by + 34) {
          if (i === 0) raceSim.paused = false;
          else if (i === 1) startRace(lastRaceConfig);
          else quitRaceToMenu();
          return;
        }
      }
      return;
    }

    // Clickable HUD Weapon Badge (top-left) & Nitro Badge (top-right)
    if (x >= 8 && x <= 165 && y >= 34 && y <= 60) {
      raceSim.cycleWeapon(1);
    } else if (x >= currentViewW - 135 && x <= currentViewW && y >= 34 && y <= 84) {
      raceSim.triggerNitro();
    }
  }
});

// Touch Controls
touchControlsEl.querySelectorAll('button[data-action]').forEach((btn) => {
  const act = btn.dataset.action;
  const setHold = (down) => {
    btn.classList.toggle('pressed', down);
    if (act === 'left') inputState.left = down;
    else if (act === 'right') inputState.right = down;
    else if (act === 'gas') inputState.gas = down;
    else if (act === 'brake') inputState.brake = down;
    else if (down && appState === 'racing' && raceSim) {
      if (act === 'weapon') {
        raceSim.cycleWeapon(1);
      } else if (act === 'punchL') {
        raceSim.triggerAttack('smart', inputState);
      } else if (act === 'kick') {
        raceSim.triggerAttack('kick', inputState);
      } else if (act === 'nitro') {
        raceSim.triggerNitro();
      }
    }
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audio.ensureContext();
    setHold(true);
  });
  btn.addEventListener('pointerup', () => setHold(false));
  btn.addEventListener('pointercancel', () => setHold(false));
  btn.addEventListener('pointerleave', () => setHold(false));
});

// Toolbar Navigation & Display Controls
btnMenu?.addEventListener('click', () => {
  audio.ensureContext();
  if (appState === 'racing' && raceSim) {
    raceSim.paused = !raceSim.paused;
    if (raceSim.paused) audio.stopAllRaceLoops();
  } else if (appState === 'frontend' && frontend) {
    audio.playSfx('punchlig', { volume: 0.55 });
    if (frontend.screen === 'splash') {
      audio.playMusicTrack('KLOWN');
    }
    frontend.go('main', 0);
  }
});

btnPolice?.addEventListener('click', () => {
  audio.ensureContext();
  if (appState === 'racing' && raceSim) {
    audio.stopAllRaceLoops();
    raceSim = null;
    appState = 'frontend';
    touchControlsEl.classList.remove('active');
  }
  if (frontend) {
    audio.playSfx('punchhea', { volume: 0.65 });
    audio.playMusicTrack('KLOWN');
    frontend.mode = 'copchase';
    frontend.go('police_tracks', frontend.policeCourse);
  }
});

btnAspect43?.addEventListener('click', () => {
  audio.ensureContext();
  audio.playSfx('swishgen', { volume: 0.45, rate: 1.25 });
  setAspectMode('4:3');
});

btnAspect169?.addEventListener('click', () => {
  audio.ensureContext();
  audio.playSfx('swishgen', { volume: 0.45, rate: 1.25 });
  setAspectMode('16:9');
});

btnMusic?.addEventListener('click', () => {
  audio.ensureContext();
  const on = audio.toggleMusic();
  btnMusic.textContent = `MUSIC: ${on ? 'ON' : 'OFF'}`;
});

btnMute?.addEventListener('click', () => {
  audio.ensureContext();
  const on = audio.toggleSfx();
  btnMute.textContent = `SFX: ${on ? 'ON' : 'OFF'}`;
});

btnFullscreen?.addEventListener('click', toggleFullscreen);

// ==================== 60HZ FIXED-STEP MAIN LOOP ====================

const FIXED_DT = 1000 / 60;
let lastFrameMs = performance.now();
let accumulatorMs = 0;

function renderBootScreen() {
  const offsetX = Math.floor((currentViewW - 640) * 0.5);
  uiCtx.fillStyle = '#07080a';
  uiCtx.fillRect(0, 0, currentViewW, 480);

  uiCtx.save();
  uiCtx.translate(offsetX, 0);

  const splash = assets.getUI('splash.jpg');
  if (splash?.bright) {
    uiCtx.globalAlpha = 0.45;
    uiCtx.drawImage(splash.bright, 0, 0, 640, 480);
    uiCtx.globalAlpha = 1;
  }

  uiCtx.fillStyle = 'rgba(0, 0, 0, 0.80)';
  uiCtx.fillRect(110, 174, 420, 134);
  uiCtx.strokeStyle = '#ff6432';
  uiCtx.strokeRect(110.5, 174.5, 419, 133);

  uiCtx.font = '38px RRBadloc, sans-serif';
  uiCtx.textAlign = 'center';
  uiCtx.fillStyle = '#ff6432';
  uiCtx.fillText('ROAD RASH', 320, 214);

  uiCtx.font = '20px RRBadloc, sans-serif';
  uiCtx.fillStyle = '#ff9d2e';
  uiCtx.fillText('Made By Soham', 320, 240);

  uiCtx.font = '15px RRFuturaDemi, sans-serif';
  uiCtx.fillStyle = '#defff0';
  uiCtx.fillText(bootStatus, 320, 266);

  uiCtx.fillStyle = '#222';
  uiCtx.fillRect(140, 280, 360, 14);
  uiCtx.fillStyle = '#e1e180';
  uiCtx.fillRect(140, 280, Math.round(360 * bootProgress), 14);

  uiCtx.restore();
}

function frameLoop(nowMs) {
  const delta = Math.min(100, nowMs - lastFrameMs);
  lastFrameMs = nowMs;

  if (appState === 'booting') {
    renderBootScreen();
  } else if (appState === 'frontend' || appState === 'loading_race') {
    frontend.render(uiCtx);
  } else if (appState === 'racing' && raceSim) {
    accumulatorMs += delta;
    let steps = 0;
    while (accumulatorMs >= FIXED_DT && steps < 4) {
      raceSim.step(inputState);
      accumulatorMs -= FIXED_DT;
      steps++;
    }
    if (accumulatorMs > FIXED_DT) accumulatorMs = 0;
    if (appState === 'racing' && raceSim) {
      const alpha = accumulatorMs / FIXED_DT;
      courseRenderer.renderRaceFrame(uiCtx, raceSim, alpha);
      hudRenderer.render(uiCtx, raceSim, activeDashImg);
    }
  }

  requestAnimationFrame(frameLoop);
}

async function boot() {
  requestAnimationFrame(frameLoop);
  await assets.loadBootAssets((p, msg) => {
    bootProgress = p;
    bootStatus = msg;
  });
  frontend = new FrontendUI(assets, audio, startRace, {
    getAspect: () => currentAspect,
    setAspect: (mode) => setAspectMode(mode),
    toggleFullscreen,
    isFullscreen: () => Boolean(document.fullscreenElement)
  });
  appState = 'frontend';
}

boot();
