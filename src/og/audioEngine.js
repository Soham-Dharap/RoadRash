// Authentic 1996 Road Rash WebAudio Engine:
// 1. Original 11 kHz / 22 kHz IMA-ADPCM/PCM .WAV sound effects & 35 pedestrian voices
// 2. Real SoundFont1 (.SBK) + MIDS (.MID) Grunge Rock Sequencer (GRUNGE1..5, KLOWN)

const EFFECT_SLOTS = [
  'engrat', 'engnitro', 'engtunne', 'engother', 'engcar11', 'engother', 'engcar11', 'm_yeah',
  'f_yeah', 'chainimp', 'clubimpa', 'bounce', 'crashhar', 'crashmed', 'crashlit', 'gruntm1_',
  'gruntm2_', 'gruntm3_', 'gruntf1_', 'gruntf2_', 'gruntf3_', 'kick_mw4', 'punchhea', 'swishcha',
  'swishgen', 'skidonnr', 'skidoffr', 'footstep', 'ridersli', 'bmwlong', 'siren', 'sirenfst',
  'sk1_eatt', 'bkm1_hey', 'bsw3_hey', 'fg2_eek', 'fg1_watc', 'bkm4_pty', 'sk1_dude', 'tour_bac',
  'dm_usob', 'bsm1_tak', 'bkw3_stp', 'cm3_arrg', 'bkw1_don', 'hf_help', 'dm_holys', 'ol_aaa',
  'af1_eek', 'bkm1_huh', 'am1_dooo', 'bsw1_no', 'cw_back', 'bsw1_huh', 'bkm4_wai', 'jf_no',
  'fcyc_wat', 'tour_aaa', 'bkm2_hld', 'bkm4_rum', 'fm_slowd', 'bsm1_wat', 'bsm3_wha', 'bsm2_woa',
  'bsw2_aaa', 'jm_aiie', 'bkw2_bit', 'cm1_heym', 'ol_make'
];

const CORE_PRELOAD_SFX = [
  'engrat', 'engsport', 'engsuper', 'engnitro', 'engtunne', 'engother', 'engcar11',
  'siren', 'sirenfst', 'punchhea', 'punchlig', 'kick_mw4', 'swishgen', 'swishcha',
  'clubimpa', 'chainimp', 'bounce', 'crashlit', 'crashmed', 'crashhar',
  'skidonnr', 'skidoffr', 'ridersli', 'footstep',
  'gruntm1_', 'gruntm2_', 'gruntm3_', 'gruntf1_', 'gruntf2_', 'gruntf3_',
  'm_yeah', 'f_yeah', 'bsm2_woa', 'fg2_eek', 'tour_aaa', 'dm_holys', 'sk1_eatt'
];

export const MUSIC_TRACKS = ['GRUNGE1', 'GRUNGE2', 'GRUNGE3', 'GRUNGE4', 'GRUNGE5', 'KLOWN'];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxGain = null;
    this.musicGain = null;

    this.sfxEnabled = true;
    this.musicEnabled = true;
    this.sfxVolume = 0.78;
    this.musicVolume = 0.42;

    this.sfxBuffers = new Map();
    this.sfxPending = new Map();

    // Continuous race loops
    this.loops = new Map();

    // SoundFont + MIDI sequencer state
    this.bank = null;
    this.musicBuffers = new Map();
    this.songCache = new Map();
    this.musicReady = false;
    this.musicLoading = null;

    this.currentTrackIndex = 0;
    this.currentSong = null;
    this.songEventIdx = 0;
    this.songTickPos = 0;
    this.songUsPerQuarter = 500000;
    this.tempoIdx = 0;
    this.lastSeqTime = 0;
    this.seqTimer = null;

    // 16 MIDI channels
    this.chProg = new Uint8Array(16);
    this.chVol = new Uint8Array(16).fill(100);
    this.chPan = new Uint8Array(16).fill(64);
    this.chBend = new Float32Array(16);
    this.activeNotes = new Map();
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? this.sfxVolume : 0;
      this.musicGain.gain.value = this.musicEnabled ? this.musicVolume : 0;
      this.sfxGain.connect(this.ctx.destination);
      this.musicGain.connect(this.ctx.destination);
      this.preloadCoreAudio();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  async preloadCoreAudio() {
    CORE_PRELOAD_SFX.forEach((name) => this.loadSfx(name));
    await this.initMusicBank();
  }

  async loadSfx(name) {
    const clean = name.toLowerCase().replace(/\.wav$/, '');
    if (this.sfxBuffers.has(clean)) return this.sfxBuffers.get(clean);
    if (this.sfxPending.has(clean)) return this.sfxPending.get(clean);
    if (!this.ctx) return null;

    const p = fetch(`/og/sfx/${clean}.wav`)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((ab) => (ab && this.ctx ? this.ctx.decodeAudioData(ab) : null))
      .then((buf) => {
        if (buf) this.sfxBuffers.set(clean, buf);
        this.sfxPending.delete(clean);
        return buf;
      })
      .catch(() => {
        this.sfxPending.delete(clean);
        return null;
      });
    this.sfxPending.set(clean, p);
    return p;
  }

  playSfx(name, { volume = 0.85, rate = 1.0, pan = 0 } = {}) {
    if (!this.sfxEnabled || !this.ensureContext()) return;
    const clean = name.toLowerCase().replace(/\.wav$/, '');
    const buf = this.sfxBuffers.get(clean);
    if (!buf) {
      this.loadSfx(clean).then((loaded) => {
        if (loaded && this.sfxEnabled) this.triggerBuffer(loaded, volume, rate, pan);
      });
      return;
    }
    this.triggerBuffer(buf, volume, rate, pan);
  }

  triggerBuffer(buf, volume, rate, pan) {
    if (!this.ctx || !buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.max(0.25, Math.min(3.0, rate));

    const gain = this.ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1.5, volume));

    if (this.ctx.createStereoPanner && pan !== 0) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      src.connect(gain);
      gain.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      src.connect(gain);
      gain.connect(this.sfxGain);
    }
    src.start();
  }

  playPedVoice(voiceId, pan = 0) {
    // sound.cpp: voiceId 101..137 maps to EFFECT_SLOTS[32..68]
    const slot = voiceId - 69;
    if (slot >= 32 && slot < EFFECT_SLOTS.length) {
      this.playSfx(EFFECT_SLOTS[slot], { volume: 0.95, rate: 1.0, pan });
    } else {
      this.playSfx('bsm2_woa', { volume: 0.9, rate: 1.0, pan });
    }
  }

  setLoop(channelKey, sfxName, { active = false, volume = 0.5, rate = 1.0, pan = 0 } = {}) {
    if (!this.sfxEnabled || !active || volume <= 0.005) {
      this.stopLoop(channelKey);
      return;
    }
    if (!this.ensureContext()) return;
    const clean = sfxName.toLowerCase().replace(/\.wav$/, '');
    const existing = this.loops.get(channelKey);
    if (existing && existing.name === clean) {
      existing.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.04);
      existing.src.playbackRate.setTargetAtTime(
        Math.max(0.3, Math.min(2.8, rate)),
        this.ctx.currentTime,
        0.04
      );
      if (existing.panner) {
        existing.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime, 0.04);
      }
      return;
    }

    this.stopLoop(channelKey);
    const buf = this.sfxBuffers.get(clean);
    if (!buf) {
      this.loadSfx(clean);
      return;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = Math.max(0.3, Math.min(2.8, rate));

    const gain = this.ctx.createGain();
    gain.gain.value = volume;

    let panner = null;
    if (this.ctx.createStereoPanner) {
      panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      src.connect(gain);
      gain.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      src.connect(gain);
      gain.connect(this.sfxGain);
    }
    src.start();
    this.loops.set(channelKey, { name: clean, src, gain, panner });
  }

  stopLoop(channelKey) {
    const existing = this.loops.get(channelKey);
    if (!existing) return;
    try {
      existing.src.stop();
      existing.src.disconnect();
    } catch {
      // ignore stopped node
    }
    this.loops.delete(channelKey);
  }

  stopAllRaceLoops() {
    for (const k of Array.from(this.loops.keys())) {
      this.stopLoop(k);
    }
  }

  updateRaceLoops({
    bikeId = 0,
    rpmNorm = 0.2,
    speedMph = 0,
    inTunnel = false,
    nitroActive = false,
    skidding = false,
    offRoad = false,
    rivalDist = Infinity,
    rivalPan = 0,
    carDist = Infinity,
    carPan = 0,
    carRelSpeed = 0,
    copDist = Infinity,
    copPan = 0,
    copChasing = false
  }) {
    const baseEng = inTunnel
      ? 'engtunne'
      : bikeId < 5
        ? 'engrat'
        : bikeId < 10
          ? 'engsuper'
          : 'engsport';
    const engRate = 0.56 + rpmNorm * 1.28 + (nitroActive ? 0.22 : 0);
    const engVol = 0.34 + Math.min(0.28, rpmNorm * 0.26);
    this.setLoop('playerEngine', baseEng, { active: true, volume: engVol, rate: engRate, pan: 0 });

    this.setLoop('nitro', 'engnitro', {
      active: nitroActive,
      volume: 0.45,
      rate: 0.95 + rpmNorm * 0.45,
      pan: 0
    });

    if (skidding && speedMph > 12) {
      this.setLoop('skid', offRoad ? 'skidoffr' : 'skidonnr', {
        active: true,
        volume: Math.min(0.45, speedMph / 110),
        rate: offRoad ? 0.95 : 1.05,
        pan: 0
      });
    } else if (offRoad && speedMph > 18) {
      this.setLoop('skid', 'skidoffr', {
        active: true,
        volume: Math.min(0.26, speedMph / 160),
        rate: 0.85 + speedMph / 240,
        pan: 0
      });
    } else {
      this.stopLoop('skid');
    }

    const rivalActive = rivalDist < 3600;
    this.setLoop('rival', 'engother', {
      active: rivalActive,
      volume: rivalActive ? Math.max(0, 0.32 * (1 - rivalDist / 3600)) : 0,
      rate: 0.82 + rpmNorm * 0.5,
      pan: rivalPan
    });

    const carActive = carDist < 4200;
    const doppler = Math.max(0.65, Math.min(1.65, 1.0 + carRelSpeed * 0.0025));
    this.setLoop('car', 'engcar11', {
      active: carActive,
      volume: carActive ? Math.max(0, 0.36 * (1 - carDist / 4200)) : 0,
      rate: doppler,
      pan: carPan
    });

    const copActive = copDist < 6500;
    this.setLoop('cop', copChasing ? 'sirenfst' : 'siren', {
      active: copActive,
      volume: copActive ? Math.max(0.05, 0.44 * (1 - copDist / 6500)) : 0,
      rate: 1.0,
      pan: copPan
    });
  }

  // ==================== SOUNDFONT1 + MIDS MUSIC SEQUENCER ====================

  async initMusicBank() {
    if (this.musicReady) return true;
    if (this.musicLoading) return this.musicLoading;
    if (!this.ctx) return false;

    this.musicLoading = (async () => {
      try {
        const bank = await fetch('/og/music/bank.json').then((r) => r.json());
        this.bank = bank;
        const files = new Set();
        for (const m of bank.melodic) files.add(m.file);
        for (const d of bank.drums) files.add(d.file);
        await Promise.all(
          Array.from(files).map(async (f) => {
            const ab = await fetch(`/og/music/${f}`).then((r) => r.arrayBuffer());
            const buf = await this.ctx.decodeAudioData(ab);
            this.musicBuffers.set(f, buf);
          })
        );
        this.musicReady = true;
        return true;
      } catch {
        return false;
      }
    })();
    return this.musicLoading;
  }

  async playMusicTrack(trackNameOrIndex) {
    if (!this.ensureContext()) return;
    const name =
      typeof trackNameOrIndex === 'number'
        ? MUSIC_TRACKS[((trackNameOrIndex % MUSIC_TRACKS.length) + MUSIC_TRACKS.length) % MUSIC_TRACKS.length]
        : trackNameOrIndex;
    this.currentTrackIndex = Math.max(0, MUSIC_TRACKS.indexOf(name));

    const ok = await this.initMusicBank();
    if (!ok) return;

    let song = this.songCache.get(name);
    if (!song) {
      song = await fetch(`/og/music/${name}.json`).then((r) => r.json());
      this.songCache.set(name, song);
    }

    this.stopMusicVoices();
    this.currentSong = song;
    this.songEventIdx = 0;
    this.songTickPos = 0;
    this.tempoIdx = 0;
    this.songUsPerQuarter = song.tempo?.[0]?.[1] || 500000;
    this.chProg.fill(29);
    this.chVol.fill(100);
    this.chPan.fill(64);
    this.chBend.fill(0);
    this.lastSeqTime = performance.now();

    if (!this.seqTimer) {
      this.seqTimer = setInterval(() => this.stepSequencer(), 20);
    }
  }

  nextMusicTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % MUSIC_TRACKS.length;
    this.playMusicTrack(this.currentTrackIndex);
    return MUSIC_TRACKS[this.currentTrackIndex];
  }

  stopMusicVoices() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const v of this.activeNotes.values()) {
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setValueAtTime(v.gain.gain.value, now);
        v.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
        v.src.stop(now + 0.035);
      } catch {
        // ignore
      }
    }
    this.activeNotes.clear();
  }

  stepSequencer() {
    if (!this.musicEnabled || !this.currentSong || !this.ctx || this.ctx.state !== 'running') {
      this.lastSeqTime = performance.now();
      return;
    }

    const nowMs = performance.now();
    const dtSec = Math.min(0.1, (nowMs - this.lastSeqTime) / 1000);
    this.lastSeqTime = nowMs;

    const song = this.currentSong;
    const ticksPerSec = (song.div * 1000000) / this.songUsPerQuarter;
    this.songTickPos += dtSec * ticksPerSec;

    // Advance tempo changes
    while (
      song.tempo &&
      this.tempoIdx + 1 < song.tempo.length &&
      song.tempo[this.tempoIdx + 1][0] <= this.songTickPos
    ) {
      this.tempoIdx++;
      this.songUsPerQuarter = song.tempo[this.tempoIdx][1] || 500000;
    }

    // Dispatch MIDI events up to songTickPos
    const evs = song.ev;
    while (this.songEventIdx < evs.length && evs[this.songEventIdx][0] <= this.songTickPos) {
      const [, status, d1, d2] = evs[this.songEventIdx++];
      this.handleMidiEvent(status, d1, d2);
    }

    // Loop song seamlessly at end
    if (this.songTickPos >= song.total || this.songEventIdx >= evs.length) {
      this.stopMusicVoices();
      this.songEventIdx = 0;
      this.songTickPos = 0;
      this.tempoIdx = 0;
      this.songUsPerQuarter = song.tempo?.[0]?.[1] || 500000;
    }
  }

  findMelodicPatch(prog, note) {
    if (!this.bank) return null;
    // Exact program match first
    for (const m of this.bank.melodic) {
      if (m.prog === prog && note >= m.lo && note <= m.hi) return m;
    }
    // Nearest guitar/bass fallback for GM rock instruments:
    // Basses (32..39) -> 34/36/37, Overdrive/Distortion Guitars (29..31) -> 29/30, Clean/Lead -> 27/87
    const fallbackProg =
      prog >= 32 && prog <= 39 ? 34 : prog >= 29 && prog <= 31 ? 30 : prog >= 80 ? 87 : 29;
    for (const m of this.bank.melodic) {
      if (m.prog === fallbackProg) return m;
    }
    return this.bank.melodic[0] || null;
  }

  findDrumPatch(note) {
    if (!this.bank) return null;
    for (const d of this.bank.drums) {
      if (note >= d.lo && note <= d.hi) return d;
    }
    // Nearest percussion fallback
    let best = null;
    let bestDist = 999;
    for (const d of this.bank.drums) {
      const dist = Math.abs(d.lo - note);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  }

  handleMidiEvent(status, d1, d2) {
    const cmd = status & 0xf0;
    const ch = status & 0x0f;

    if (cmd === 0xc0) {
      this.chProg[ch] = d1;
      return;
    }
    if (cmd === 0xb0) {
      if (d1 === 7) this.chVol[ch] = d2;
      else if (d1 === 10) this.chPan[ch] = d2;
      else if (d1 === 123 || d1 === 120) this.stopChannelNotes(ch);
      return;
    }
    if (cmd === 0xe0) {
      const raw = ((d2 << 7) | d1) - 8192;
      const semis = (raw / 8192) * 2.0;
      this.chBend[ch] = semis;
      for (const [k, v] of this.activeNotes.entries()) {
        if ((k >> 8) === ch && v.baseSemis !== undefined) {
          v.src.playbackRate.value = Math.max(0.15, Math.min(4.0, Math.pow(2, (v.baseSemis + semis) / 12)));
        }
      }
      return;
    }
    if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
      this.noteOff(ch, d1);
      return;
    }
    if (cmd === 0x90) {
      this.noteOn(ch, d1, d2);
    }
  }

  stopChannelNotes(ch) {
    for (const k of Array.from(this.activeNotes.keys())) {
      if ((k >> 8) === ch) this.noteOff(ch, k & 0xff);
    }
  }

  noteOff(ch, note) {
    const key = (ch << 8) | note;
    const v = this.activeNotes.get(key);
    if (!v || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(Math.max(0.0002, v.gain.gain.value), now);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      v.src.stop(now + 0.05);
    } catch {
      // ignore
    }
    this.activeNotes.delete(key);
  }

  noteOn(ch, note, vel) {
    if (!this.ctx || !this.musicEnabled) return;
    if (this.activeNotes.size > 28) {
      const oldestKey = this.activeNotes.keys().next().value;
      if (oldestKey !== undefined) this.noteOff(oldestKey >> 8, oldestKey & 0xff);
    }

    if (ch === 9) {
      const patch = this.findDrumPatch(note);
      if (!patch) return;
      const buf = this.musicBuffers.get(patch.file);
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const semis = note - patch.root + patch.coarse + patch.fine / 100;
      src.playbackRate.value = Math.max(0.25, Math.min(3.0, Math.pow(2, semis / 12)));

      const gain = this.ctx.createGain();
      const vol = (vel / 127) * (this.chVol[ch] / 127) * (patch.atten / 127) * 0.52;
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(this.musicGain);
      src.start();
      return;
    }

    this.noteOff(ch, note);
    const patch = this.findMelodicPatch(this.chProg[ch], note);
    if (!patch) return;
    const buf = this.musicBuffers.get(patch.file);
    if (!buf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (patch.loopEnd > patch.loopStart + 0.02) {
      src.loop = true;
      src.loopStart = patch.loopStart;
      src.loopEnd = Math.min(buf.duration, patch.loopEnd);
    }
    const baseSemis = note - patch.root + patch.coarse + patch.fine / 100;
    src.playbackRate.value = Math.max(
      0.15,
      Math.min(4.0, Math.pow(2, (baseSemis + this.chBend[ch]) / 12))
    );

    const gain = this.ctx.createGain();
    const vol = (vel / 127) * (this.chVol[ch] / 127) * (patch.atten / 127) * 0.34;
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(Math.max(0.002, vol), now + 0.008);

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, (this.chPan[ch] - 64) / 64));
      src.connect(gain);
      gain.connect(panner);
      panner.connect(this.musicGain);
    } else {
      src.connect(gain);
      gain.connect(this.musicGain);
    }
    src.start();
    this.activeNotes.set((ch << 8) | note, { src, gain, baseSemis });
  }

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxEnabled ? this.sfxVolume : 0, this.ctx.currentTime);
    }
    if (!this.sfxEnabled) this.stopAllRaceLoops();
    return this.sfxEnabled;
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicEnabled ? this.musicVolume : 0, this.ctx.currentTime);
    }
    if (!this.musicEnabled) this.stopMusicVoices();
    return this.musicEnabled;
  }
}
