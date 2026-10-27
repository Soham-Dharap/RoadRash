import { AssetManager } from './og/assetLoader.js';
import { AudioEngine, MUSIC_TRACKS } from './og/audioEngine.js';
import { FrontendUI } from './og/frontendUI.js';
import { CourseRenderer } from './og/courseRenderer.js';
import { HudRenderer } from './og/hudRenderer.js';
import { RaceSimulation } from './og/raceSimulation.js';

const glCanvas = document.getElementById('gl-canvas');
const uiCanvas = document.getElementById('ui-canvas');
const uiCtx = uiCanvas.getContext('2d', { alpha: false });
const touchControlsEl = document.getElementById('touch-controls');

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

async function startRace(raceConfig) {
  lastRaceConfig = raceConfig;
  appState = 'loading_race';
  clearInputs();

  try {
    const [{ course, horizon }, dashImg] = await Promise.all([
      assets.loadCourse(raceConfig.courseKey),
      assets.loadDash(raceConfig.bikeId, false)
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
        // Smart OG Melee: swings Fist/Club/Chain toward closest rival/cop beside you!
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

function quitRaceToMenu() {
  audio.stopAllRaceLoops();
  raceSim = null;
  appState = 'frontend';
  touchControlsEl.classList.remove('active');
  audio.playMusicTrack('KLOWN');
  if (frontend.mode === 'biggame') {
    frontend.go('panzer', 2);
  } else {
    frontend.go('main', 0);
  }
}

function eventTo640(e) {
  const rect = uiCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 640;
  const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 480;
  return [x, y];
}

uiCanvas.addEventListener('pointermove', (e) => {
  if (appState === 'frontend' && frontend) {
    const [x, y] = eventTo640(e);
    frontend.onPointerMove(x, y);
  }
});

uiCanvas.addEventListener('pointerdown', (e) => {
  const [x, y] = eventTo640(e);
  if (appState === 'frontend' && frontend) {
    frontend.onPointerClick(x, y);
    return;
  }
  if (appState === 'racing' && raceSim && raceSim.paused) {
    for (let i = 0; i < 3; i++) {
      const by = 205 + i * 44;
      if (x >= 190 && x <= 450 && y >= by && y <= by + 34) {
        if (i === 0) raceSim.paused = false;
        else if (i === 1) startRace(lastRaceConfig);
        else quitRaceToMenu();
        return;
      }
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
      if (act === 'punchL') {
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

btnMusic.addEventListener('click', () => {
  audio.ensureContext();
  const on = audio.toggleMusic();
  btnMusic.textContent = `MUSIC: ${on ? 'ON' : 'OFF'}`;
});

btnMute.addEventListener('click', () => {
  audio.ensureContext();
  const on = audio.toggleSfx();
  btnMute.textContent = `SFX: ${on ? 'ON' : 'OFF'}`;
});

function toggleFullscreen() {
  const root = document.getElementById('viewport-shell');
  if (!document.fullscreenElement) {
    root.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}
btnFullscreen.addEventListener('click', toggleFullscreen);

// ==================== 60HZ FIXED-STEP MAIN LOOP ====================

const FIXED_DT = 1000 / 60;
let lastFrameMs = performance.now();
let accumulatorMs = 0;

function renderBootScreen() {
  uiCtx.fillStyle = '#07080a';
  uiCtx.fillRect(0, 0, 640, 480);

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
    if (appState === 'racing' && raceSim) {
      courseRenderer.renderRaceFrame(uiCtx, raceSim);
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
  frontend = new FrontendUI(assets, audio, startRace);
  appState = 'frontend';
}

boot();
