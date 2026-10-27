// 1996 Road Rash Web Audio Engine: Multi-gear Motorcycle Synth, Grunge Guitar Jukebox,
// Visceral Melee Combat, Pedestrian Yelp, Downed-Bike Ramp Crunch, and Police Siren!

const GRUNGE_TRACKS = [
  {
    name: 'Track 01: Rusty Throttle (Drop-D Grunge)',
    bpm: 132,
    notes: [73.42, 73.42, 87.31, 98.0, 73.42, 110.0, 103.83, 98.0, 73.42, 73.42, 130.81, 110.0, 98.0, 87.31, 82.41, 73.42]
  },
  {
    name: 'Track 02: Bay Area Asphalt',
    bpm: 144,
    notes: [82.41, 82.41, 98.0, 110.0, 123.47, 110.0, 98.0, 82.41, 73.42, 73.42, 87.31, 98.0, 110.0, 98.0, 87.31, 82.41]
  },
  {
    name: 'Track 03: Sierra Redline',
    bpm: 152,
    notes: [110.0, 110.0, 130.81, 146.83, 155.56, 146.83, 130.81, 98.0, 110.0, 110.0, 98.0, 87.31, 82.41, 87.31, 98.0, 103.83]
  }
];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.sfxVolume = 0.75;
    this.musicVolume = 0.35;
    this.musicEnabled = true;
    this.gameplaySfxEnabled = true;
    this.trackIndex = 0;

    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;

    this.sirenOsc = null;
    this.sirenGain = null;

    this.musicTimer = null;
    this.musicStep = 0;
    this.noiseBuffer = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.buildNoiseBuffer();
      this.setupContinuousLoops();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.startMusicLoop();
  }

  buildNoiseBuffer() {
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  makeDistortionCurve(amount = 36) {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  setupContinuousLoops() {
    // Motorcycle twin-oscillator engine synth
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'square';
    this.engineOsc1.frequency.value = 55;
    this.engineOsc2.frequency.value = 110;

    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 380;
    this.engineFilter.Q.value = 3.2;

    this.engineGain.gain.value = 0;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc1.start();
    this.engineOsc2.start();

    // Police wailing siren loop
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenGain = this.ctx.createGain();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 680;
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);
    this.sirenOsc.start();
  }

  updateRaceLoops({ active, rpm = 1500, nitro = false, copProximity = 0 }) {
    if (!this.ctx || !this.engineGain) return;
    const now = this.ctx.currentTime;

    if (!active) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.sirenGain.gain.setTargetAtTime(0, now, 0.06);
      return;
    }

    const baseFreq = 36 + (rpm / 12000) * 168 + (nitro ? 32 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.03);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.03);
    this.engineFilter.frequency.setTargetAtTime(280 + (rpm / 12000) * 1650 + (nitro ? 700 : 0), now, 0.04);
    this.engineGain.gain.setTargetAtTime(0.11 * this.sfxVolume, now, 0.04);

    if (copProximity > 0.02) {
      const wail = 640 + Math.sin(performance.now() * 0.011) * 260;
      this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.03);
      this.sirenGain.gain.setTargetAtTime(Math.min(0.12, copProximity * 0.13) * this.sfxVolume, now, 0.05);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.08);
    }
  }

  startMusicLoop() {
    if (this.musicTimer) return;
    const tick = () => {
      if (this.ctx && this.musicEnabled && this.musicVolume > 0.01 && this.ctx.state === 'running') {
        const song = GRUNGE_TRACKS[this.trackIndex % GRUNGE_TRACKS.length];
        const stepDur = 60 / song.bpm / 2; // 8th notes
        const root = song.notes[this.musicStep % song.notes.length];
        this.playPowerChord(root, stepDur * 0.92);
        if (this.musicStep % 4 === 0) this.playDrumKick();
        if (this.musicStep % 4 === 2) this.playDrumSnare();
        this.musicStep++;
        this.musicTimer = setTimeout(tick, stepDur * 1000);
      } else {
        this.musicTimer = setTimeout(tick, 350);
      }
    };
    tick();
  }

  nextTrack() {
    this.trackIndex = (this.trackIndex + 1) % GRUNGE_TRACKS.length;
    this.musicStep = 0;
    return GRUNGE_TRACKS[this.trackIndex].name;
  }

  getCurrentTrackName() {
    return GRUNGE_TRACKS[this.trackIndex % GRUNGE_TRACKS.length].name;
  }

  playPowerChord(freq, dur) {
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const shaper = this.ctx.createWaveShaper();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 1.498, now); // Power fifth!

    shaper.curve = this.makeDistortionCurve(45);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1350, now);

    const vol = 0.065 * this.musicVolume;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc1.connect(shaper);
    osc2.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.02);
    osc2.stop(now + dur + 0.02);
  }

  playDrumKick() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.11);
    g.gain.setValueAtTime(0.14 * this.musicVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playDrumSnare() {
    if (!this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 700;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08 * this.musicVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.12);
  }

  // --- GAMEPLAY SOUND EFFECTS ---
  playSwing(weapon = 'fist') {
    if (!this.ctx || !this.noiseBuffer || !this.gameplaySfxEnabled) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(weapon === 'chain' ? 1900 : 650, now);
    bp.frequency.exponentialRampToValueAtTime(280, now + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18 * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.16);
  }

  playHit(kind = 'punch') {
    if (!this.ctx || !this.gameplaySfxEnabled) return;
    const now = this.ctx.currentTime;
    // Heavy body thud
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = kind === 'chain' || kind === 'crowbar' ? 'square' : 'triangle';
    const startF = kind === 'kick' ? 165 : kind === 'chain' ? 420 : 230;
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
    g.gain.setValueAtTime(0.34 * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);

    // Impact noise slap
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.26 * this.sfxVolume, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      src.connect(ng);
      ng.connect(this.ctx.destination);
      src.start(now);
      src.stop(now + 0.1);
    }
  }

  playSnatch() {
    if (!this.ctx || !this.gameplaySfxEnabled) return;
    const now = this.ctx.currentTime;
    for (const [idx, f] of [587, 880, 1175].entries()) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + idx * 0.05);
      g.gain.setValueAtTime(0.18 * this.sfxVolume, now + idx * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.14);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.15);
    }
  }

  /**
   * Comical OG 90s "WOAH! / OOF!" yelp when clipping a jaywalking pedestrian or running rider!
   */
  playPedestrianYelp(high = false) {
    if (!this.ctx || !this.gameplaySfxEnabled) return;
    const now = this.ctx.currentTime;
    this.playHit('punch');

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    const base = high ? 440 : 290;
    osc.frequency.setValueAtTime(base, now + 0.02);
    osc.frequency.linearRampToValueAtTime(base * 1.48, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(base * 0.62, now + 0.32);

    filter.type = 'bandpass';
    filter.frequency.value = 950;
    filter.Q.value = 3.5;

    g.gain.setValueAtTime(0.24 * this.sfxVolume, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now + 0.02);
    osc.stop(now + 0.35);
  }

  /**
   * Heavy Metallic Suspension Crunch + Upward Ramp Launch Bounce when riding over a downed bike!
   */
  playRampBump() {
    if (!this.ctx || !this.gameplaySfxEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(285, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.28);
    g.gain.setValueAtTime(0.35 * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.31);

    this.playHit('crowbar');
  }

  playLandingChirp() {
    if (!this.ctx || !this.gameplaySfxEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.09);
    g.gain.setValueAtTime(0.18 * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playCrash() {
    if (!this.ctx || !this.noiseBuffer || !this.gameplaySfxEnabled) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1600, now);
    lp.frequency.exponentialRampToValueAtTime(220, now + 0.55);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.42 * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.6);
  }

  playNitro() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, now);
    bp.frequency.linearRampToValueAtTime(1400, now + 0.5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24 * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.58);
  }

  playCountdownBeep(go = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = go ? 880 : 440;
    g.gain.setValueAtTime(0.18 * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (go ? 0.35 : 0.16));
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + (go ? 0.36 : 0.18));
  }
}
