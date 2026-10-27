import { BIKES, CHARACTERS, WEAPONS, LEVEL_ECONOMY } from './data/roster.js';
import { TRACKS } from './data/tracks.js';
import { getBikerSpriteSet } from './graphics/sprites.js';
import { DashboardHUD } from './graphics/hud.js';
import { SoundEngine } from './audio/sound.js';
import { World3DRenderer } from './game/world3d.js';
import { RaceEngine } from './game/raceEngine.js';

const SAVE_KEY = 'roadrash_96_career_v1';

class RoadRashApp {
  constructor() {
    this.gameCanvas = document.getElementById('game-canvas');
    this.hudCanvas = document.getElementById('hud-canvas');
    this.uiLayer = document.getElementById('ui-layer');
    this.topBar = document.getElementById('race-top-bar');
    this.touchLayer = document.getElementById('touch-controls');

    this.sound = new SoundEngine();
    this.world3d = new World3DRenderer(this.gameCanvas);
    this.hud = new DashboardHUD(this.hudCanvas);
    this.race = new RaceEngine(this.world3d, this.sound);

    this.mode = 'menu'; // 'menu' | 'racing' | 'paused' | 'results'
    this.gameType = 'thrash'; // 'thrash' | 'career'
    this.thrashLevel = 1;
    this.thrashTrackId = 'city';
    this.trafficEnabled = true;
    this.touchControlsVisible = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.career = this.loadCareer();
    this.shopClassFilter = 'Rat';

    this.controls = {
      accel: false,
      brake: false,
      left: false,
      right: false
    };
    this.lastAccelPress = 0;

    this.bindEvents();
    this.handleResize();

    // Launch live 3D San Francisco attract-mode race behind the 1996 Title Menu!
    this.startBackgroundDemo();
    this.renderMainMenu();

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  loadCareer() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  saveCareer() {
    if (!this.career) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.career));
    } catch (_) {}
  }

  createNewCareer(charId) {
    const ch = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
    this.career = {
      charId: ch.id,
      name: ch.name,
      cash: ch.cash,
      bikeId: ch.startBike,
      weapon: ch.startWeapon,
      level: 1,
      qualifiedTracks: {}, // { '1_city': 1, ... }
      wins: 0,
      races: 0
    };
    this.saveCareer();
  }

  startBackgroundDemo() {
    this.sound.gameplaySfxEnabled = false;
    this.race.attractMode = true;
    this.race.startRace({
      track: TRACKS[0], // The City (San Francisco)
      level: 2,
      playerChar: CHARACTERS[0],
      playerBike: BIKES[2],
      playerWeapon: 'chain',
      trafficEnabled: true
    });
    this.race.countdown = 0;
  }

  bindEvents() {
    window.addEventListener('resize', () => this.handleResize());

    // Unlock audio on first pointer or key interaction
    const unlockOnce = () => {
      this.sound.unlock();
    };
    window.addEventListener('pointerdown', unlockOnce, { passive: true });
    window.addEventListener('keydown', unlockOnce);

    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'racing' && this.mode !== 'paused') return;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (this.mode === 'racing') this.pauseRace();
        else if (this.mode === 'paused') this.resumeRace();
        return;
      }

      if (this.mode !== 'racing') return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      // Double-tap Accelerate for OG Nitro boost!
      if ((e.code === 'ArrowUp' || e.code === 'KeyW') && !e.repeat) {
        const now = performance.now();
        if (now - this.lastAccelPress < 250) {
          this.race.triggerNitro(this.race.player);
        }
        this.lastAccelPress = now;
      }

      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.controls.accel = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.controls.brake = true;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.controls.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.controls.right = true;

      if (!e.repeat) {
        // Punch / Backhand / Swing Equipped Weapon
        if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyJ') {
          const kind = this.controls.accel && e.code === 'KeyB' ? 'backhand' : 'punch';
          this.race.startAttack(this.race.player, kind, 0);
        } else if (e.code === 'KeyQ') {
          this.race.startAttack(this.race.player, 'punch', -1);
        } else if (e.code === 'KeyE') {
          this.race.startAttack(this.race.player, 'punch', 1);
        } else if (e.code === 'KeyB') {
          this.race.startAttack(this.race.player, 'backhand', 0);
        }
        // Side Kick (High lateral knockback shove into cars/guardrails/poles!)
        else if (e.code === 'KeyX' || e.code === 'KeyC' || e.code === 'KeyK' || e.code === 'Enter') {
          this.race.startAttack(this.race.player, 'kick', 0);
        }
        // Nitro Boost
        else if (e.code === 'KeyN' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          this.race.triggerNitro(this.race.player);
        }
        // Camera / Cockpit HUD View Switch
        else if (e.code === 'KeyV') {
          this.race.cameraMode = (this.race.cameraMode + 1) % 3;
          const labels = ['1996 COCKPIT CHASE CAM', 'CLEAN CHASE CAM', 'HANDLEBAR FIRST-PERSON'];
          this.race.showCallout(labels[this.race.cameraMode], '#fde047', 1.2);
        }
        // Rearview Mirror Toggle
        else if (e.code === 'KeyM') {
          this.race.mirrorOn = !this.race.mirrorOn;
        }
        // Jukebox Next Grunge Song
        else if (e.code === 'KeyT') {
          const songName = this.sound.nextTrack();
          this.race.showCallout(`♫ ${songName.toUpperCase()}`, '#4ade80', 1.6);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.controls.accel = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.controls.brake = false;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.controls.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.controls.right = false;
    });

    // Top-left HUD quick buttons
    document.getElementById('btn-pause-race').addEventListener('click', () => this.pauseRace());
    document.getElementById('btn-cam-toggle').addEventListener('click', () => {
      this.race.cameraMode = (this.race.cameraMode + 1) % 3;
    });
    document.getElementById('btn-mirror-toggle').addEventListener('click', () => {
      this.race.mirrorOn = !this.race.mirrorOn;
    });
    document.getElementById('btn-music-next').addEventListener('click', () => {
      const songName = this.sound.nextTrack();
      this.race.showCallout(`♫ ${songName.toUpperCase()}`, '#4ade80', 1.6);
    });

    // Mobile Touch Controls
    this.touchLayer.querySelectorAll('[data-control]').forEach((btn) => {
      const key = btn.dataset.control;
      const setOn = (e) => {
        e.preventDefault();
        this.controls[key] = true;
      };
      const setOff = (e) => {
        e.preventDefault();
        this.controls[key] = false;
      };
      btn.addEventListener('pointerdown', setOn);
      btn.addEventListener('pointerup', setOff);
      btn.addEventListener('pointerleave', setOff);
      btn.addEventListener('pointercancel', setOff);
    });

    this.touchLayer.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const act = btn.dataset.action;
        if (act === 'punch') this.race.startAttack(this.race.player, 'punch', 0);
        else if (act === 'kick') this.race.startAttack(this.race.player, 'kick', 0);
        else if (act === 'nitro') this.race.triggerNitro(this.race.player);
      });
    });
  }

  handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.world3d.resize(w, h);
    this.hud.resize(w, h);
  }

  getSpriteDataUrl(palette) {
    const set = getBikerSpriteSet(palette);
    return set.idle.image.toDataURL();
  }

  // =========================================================================
  // MENUS & SCREENS
  // =========================================================================
  renderMainMenu() {
    this.mode = 'menu';
    this.topBar.classList.add('hidden');
    this.touchLayer.classList.add('hidden');

    const hasSave = !!this.career;
    this.uiLayer.innerHTML = `
      <div class="menu-shell">
        <div class="hazard-strip"></div>
        <div class="rr-logo-wrap">
          <div class="rr-logo">ROAD RASH</div>
          <div class="rr-sub">1996 CALIFORNIA PC EDITION • FULL OG PHYSICS & COMBAT</div>
        </div>

        <div class="menu-grid-main">
          <div class="btn-stack">
            <button class="rr-btn primary" id="act-quick-race">
              <span>▶ INSTANT THRASH</span>
              <span class="sub">JUMP STRAIGHT ON THE CITY LINE</span>
            </button>
            <button class="rr-btn" id="act-thrash-menu">
              <span>🏁 THRASH MODE</span>
              <span class="sub">5 CALIFORNIA COURSES • LEVELS 1–5</span>
            </button>
            <button class="rr-btn" id="act-big-game">
              <span>💰 BIG GAME CAREER</span>
              <span class="sub">${hasSave ? `CONTINUE: ${this.career.name.toUpperCase()} ($${this.career.cash.toLocaleString()})` : '8 RASHERS • 15 BIKES • CASH & UPGRADES'}</span>
            </button>
            <button class="rr-btn" id="act-options">
              <span>⚙ OPTIONS & JUKEBOX</span>
              <span class="sub">CONTROLS • TRAFFIC • RETRO SVGA</span>
            </button>
          </div>

          <div class="info-card">
            <h3>TRUE OG 1996 MECHANICS</h3>
            <ul class="mechanic-list">
              <li><b>Kicks Shove Bikes:</b> Press <b>[X/C]</b> to boot rivals sideways into oncoming cars, poles, or guardrails!</li>
              <li><b>Punches & Weapon Snatching:</b> Press <b>[SPACE/Z]</b> mid-windup to rip Clubs, Chains & Crowbars out of a rival's hand!</li>
              <li><b>Downed-Bike Ramp Bumps:</b> Fallen motorcycles stay smoking on the asphalt — hit one at speed to <b>BOUNCE / LAUNCH AIRBORNE</b>!</li>
              <li><b>Jaywalkers & Running Riders:</b> Clip crosswalk pedestrians or bowl over fallen riders sprinting back to their bikes!</li>
              <li><b>Highway Patrol:</b> Fight off motorcycle cops — or crash near one and get <b>BUSTED</b>!</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    document.getElementById('act-quick-race').onclick = () => {
      this.gameType = 'thrash';
      this.thrashTrackId = 'city';
      this.thrashLevel = 1;
      this.launchRace({
        track: TRACKS[0],
        level: 1,
        playerChar: CHARACTERS[0],
        playerBike: BIKES[2], // Iconic purple Kahuna 500
        playerWeapon: 'fist'
      });
    };

    document.getElementById('act-thrash-menu').onclick = () => this.renderThrashMenu();
    document.getElementById('act-big-game').onclick = () => {
      if (this.career) this.renderCareerHub();
      else this.renderCharacterSelect();
    };
    document.getElementById('act-options').onclick = () => this.renderOptionsMenu();
  }

  renderThrashMenu() {
    const levelBikes = [BIKES[2], BIKES[5], BIKES[7], BIKES[10], BIKES[13]];
    const matchedBike = levelBikes[this.thrashLevel - 1];

    this.uiLayer.innerHTML = `
      <div class="menu-shell">
        <div class="section-header">
          <h2>THRASH MODE — PICK COURSE & LEVEL</h2>
          <button class="rr-btn small" id="back-main">◄ MAIN MENU</button>
        </div>

        <div class="toolbar-row" style="margin-bottom:14px;">
          <div class="level-pills">
            ${[1, 2, 3, 4, 5]
              .map(
                (lv) =>
                  `<button class="pill-btn ${this.thrashLevel === lv ? 'active' : ''}" data-lv="${lv}">LEVEL ${lv} (${LEVEL_ECONOMY[lv - 1].baseDistanceKm} KM)</button>`
              )
              .join('')}
          </div>
          <div class="badge">ASSIGNED BIKE: ${matchedBike.name.toUpperCase()} (${matchedBike.topSpeedKmh} KM/H)</div>
        </div>

        <div class="card-grid">
          ${TRACKS.map(
            (t) => `
            <div class="select-card ${this.thrashTrackId === t.id ? 'active' : ''}" data-track="${t.id}">
              <h4>${t.name} <span class="badge">${t.subtitle.split(' ')[0]}</span></h4>
              <p>${t.tagline}</p>
            </div>
          `
          ).join('')}
        </div>

        <div class="toolbar-row">
          <button class="pill-btn ${this.trafficEnabled ? 'active' : ''}" id="toggle-traffic">
            TRAFFIC: ${this.trafficEnabled ? 'ON (AUTHENTIC)' : 'OFF'}
          </button>
          <button class="rr-btn primary small" id="go-thrash">▶ HIT THE STARTING LINE!</button>
        </div>
      </div>
    `;

    document.getElementById('back-main').onclick = () => this.renderMainMenu();
    document.getElementById('toggle-traffic').onclick = () => {
      this.trafficEnabled = !this.trafficEnabled;
      this.renderThrashMenu();
    };
    this.uiLayer.querySelectorAll('[data-lv]').forEach((b) => {
      b.onclick = () => {
        this.thrashLevel = Number(b.dataset.lv);
        this.renderThrashMenu();
      };
    });
    this.uiLayer.querySelectorAll('[data-track]').forEach((c) => {
      c.onclick = () => {
        this.thrashTrackId = c.dataset.track;
        this.renderThrashMenu();
      };
    });
    document.getElementById('go-thrash').onclick = () => {
      this.gameType = 'thrash';
      const track = TRACKS.find((t) => t.id === this.thrashTrackId) || TRACKS[0];
      this.launchRace({
        track,
        level: this.thrashLevel,
        playerChar: CHARACTERS[0],
        playerBike: matchedBike,
        playerWeapon: 'fist'
      });
    };
  }

  renderCharacterSelect() {
    this.uiLayer.innerHTML = `
      <div class="menu-shell">
        <div class="section-header">
          <h2>BIG GAME MODE — SELECT YOUR RASHER</h2>
          <button class="rr-btn small" id="back-main">◄ BACK</button>
        </div>
        <div class="card-grid">
          ${CHARACTERS.map((ch) => {
            const bike = BIKES.find((b) => b.id === ch.startBike);
            const imgUrl = this.getSpriteDataUrl({
              bikeColor: bike.color,
              suitMain: ch.suitMain,
              suitShoulder: ch.suitShoulder,
              helmetColor: ch.helmetColor,
              pantsColor: ch.pantsColor
            });
            return `
              <div class="select-card" data-char="${ch.id}">
                <div class="sprite-preview-box"><img src="${imgUrl}" alt="${ch.name}" /></div>
                <h4>${ch.name} <span class="badge green">$${ch.cash.toLocaleString()}</span></h4>
                <p><b>Bike:</b> ${bike.name} • <b>Weapon:</b> ${WEAPONS[ch.startWeapon].name}</p>
                <p>${ch.bio}</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.getElementById('back-main').onclick = () => this.renderMainMenu();
    this.uiLayer.querySelectorAll('[data-char]').forEach((card) => {
      card.onclick = () => {
        this.createNewCareer(card.dataset.char);
        this.renderCareerHub();
      };
    });
  }

  renderCareerHub() {
    const ch = CHARACTERS.find((c) => c.id === this.career.charId) || CHARACTERS[0];
    const bike = BIKES.find((b) => b.id === this.career.bikeId) || BIKES[0];
    const lv = this.career.level;

    this.uiLayer.innerHTML = `
      <div class="menu-shell">
        <div class="section-header">
          <h2>BIG GAME — LEVEL ${lv} CIRCUIT</h2>
          <div style="display:flex; gap:8px;">
            <button class="rr-btn small" id="btn-new-career">NEW RASHER</button>
            <button class="rr-btn small" id="back-main">◄ MENU</button>
          </div>
        </div>

        <div class="toolbar-row" style="margin-bottom:14px;">
          <div class="badge green" style="font-size:15px; padding:6px 12px;">BANKROLL: $${this.career.cash.toLocaleString()}</div>
          <div class="badge" style="font-size:13px; padding:6px 12px;">
            RASHER: ${ch.name.toUpperCase()} • BIKE: ${bike.name.toUpperCase()} (${bike.topSpeedKmh} KM/H) • WEAPON: ${WEAPONS[this.career.weapon || 'fist'].name.toUpperCase()}
          </div>
          <button class="rr-btn small primary" id="open-bike-shop">🔧 BIKE SHOP (15 BIKES)</button>
        </div>

        <p style="font-family:monospace; font-size:12px; color:#cbd5e1; margin-bottom:10px;">
          Finish <b>1st, 2nd, or 3rd</b> on all 5 California tracks to advance to Level ${Math.min(5, lv + 1)}!1st Purse: <b>$${LEVEL_ECONOMY[lv - 1].purses[0].toLocaleString()}</b>.
        </p>

        <div class="card-grid">
          ${TRACKS.map((t) => {
            const qKey = `${lv}_${t.id}`;
            const bestRank = this.career.qualifiedTracks[qKey];
            return `
              <div class="select-card" data-race-track="${t.id}">
                <h4>
                  ${t.name}
                  ${bestRank ? `<span class="badge green">✓ #${bestRank}</span>` : `<span class="badge">UNQUALIFIED</span>`}
                </h4>
                <p>${t.tagline}</p>
                <span class="badge" style="align-self:flex-start;">CLICK TO RACE (${LEVEL_ECONOMY[lv - 1].baseDistanceKm} KM)</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.getElementById('back-main').onclick = () => this.renderMainMenu();
    document.getElementById('btn-new-career').onclick = () => this.renderCharacterSelect();
    document.getElementById('open-bike-shop').onclick = () => this.renderBikeShop();

    this.uiLayer.querySelectorAll('[data-race-track]').forEach((card) => {
      card.onclick = () => {
        this.gameType = 'career';
        const track = TRACKS.find((t) => t.id === card.dataset.raceTrack) || TRACKS[0];
        this.launchRace({
          track,
          level: this.career.level,
          playerChar: ch,
          playerBike: bike,
          playerWeapon: this.career.weapon || 'fist'
        });
      };
    });
  }

  renderBikeShop() {
    const ch = CHARACTERS.find((c) => c.id === this.career.charId) || CHARACTERS[0];
    const currentBike = BIKES.find((b) => b.id === this.career.bikeId) || BIKES[0];
    const tradeIn = Math.round(currentBike.price * 0.55);
    const filtered = BIKES.filter((b) => b.class === this.shopClassFilter);

    this.uiLayer.innerHTML = `
      <div class="menu-shell">
        <div class="section-header">
          <h2>OL' SKOOL BIKE SHOP — ${this.shopClassFilter.toUpperCase()} CLASS</h2>
          <button class="rr-btn small" id="back-career">◄ BACK TO CIRCUIT</button>
        </div>

        <div class="toolbar-row" style="margin-bottom:14px;">
          <div class="level-pills">
            ${['Rat', 'Sport', 'Super']
              .map(
                (cls) =>
                  `<button class="pill-btn ${this.shopClassFilter === cls ? 'active' : ''}" data-cls="${cls}">${cls.toUpperCase()} BIKES</button>`
              )
              .join('')}
          </div>
          <div class="badge green">CASH: $${this.career.cash.toLocaleString()} (+ $${tradeIn.toLocaleString()} TRADE-IN)</div>
        </div>

        <div class="card-grid">
          ${filtered
            .map((b) => {
              const owned = b.id === currentBike.id;
              const netCost = Math.max(0, b.price - tradeIn);
              const canAfford = this.career.cash >= netCost;
              const imgUrl = this.getSpriteDataUrl({
                bikeColor: b.color,
                suitMain: ch.suitMain,
                suitShoulder: ch.suitShoulder,
                helmetColor: ch.helmetColor,
                pantsColor: ch.pantsColor
              });
              return `
                <div class="select-card ${owned ? 'active' : ''}">
                  <div class="sprite-preview-box"><img src="${imgUrl}" alt="${b.name}" /></div>
                  <h4>${b.name} <span class="badge ${owned ? 'green' : ''}">${owned ? 'OWNED' : `$${b.price.toLocaleString()}`}</span></h4>
                  <div class="stat-bar-row"><span>SPEED</span><div class="stat-track"><div class="stat-fill" style="width:${(b.topSpeedKmh / 355) * 100}%"></div></div></div>
                  <div class="stat-bar-row"><span>ACCEL</span><div class="stat-track"><div class="stat-fill" style="width:${(b.accel / 80) * 100}%"></div></div></div>
                  <div class="stat-bar-row"><span>NITRO</span><div class="stat-track"><div class="stat-fill" style="width:${(b.nitroCharges / 10) * 100}%"></div></div></div>
                  <p>${b.topSpeedKmh} km/h • ${b.nitroCharges > 0 ? `${b.nitroCharges}x N2O` : 'No N2O'} — ${b.desc}</p>
                  ${
                    owned
                      ? `<span class="badge green">CURRENT RIDE</span>`
                      : `<button class="pill-btn ${canAfford ? 'active' : ''}" data-buy="${b.id}" ${canAfford ? '' : 'disabled'}>
                          ${canAfford ? `BUY (NET $${netCost.toLocaleString()})` : `NEED $${(netCost - this.career.cash).toLocaleString()} MORE`}
                        </button>`
                  }
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;

    document.getElementById('back-career').onclick = () => this.renderCareerHub();
    this.uiLayer.querySelectorAll('[data-cls]').forEach((btn) => {
      btn.onclick = () => {
        this.shopClassFilter = btn.dataset.cls;
        this.renderBikeShop();
      };
    });
    this.uiLayer.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.onclick = () => {
        const target = BIKES.find((b) => b.id === btn.dataset.buy);
        if (!target) return;
        const netCost = Math.max(0, target.price - tradeIn);
        if (this.career.cash >= netCost) {
          this.career.cash -= netCost;
          this.career.bikeId = target.id;
          this.saveCareer();
          this.sound.playSnatch();
          this.renderBikeShop();
        }
      };
    });
  }

  renderOptionsMenu() {
    this.uiLayer.innerHTML = `
      <div class="menu-shell">
        <div class="section-header">
          <h2>OPTIONS, CONTROLS & 90s GRUNGE JUKEBOX</h2>
          <button class="rr-btn small" id="back-main">◄ BACK</button>
        </div>

        <div class="menu-grid-main">
          <div class="btn-stack">
            <button class="rr-btn" id="opt-retro">
              <span>GRAPHICS FILTER</span>
              <span class="sub">${this.world3d.retroMode ? 'AUTHENTIC 1996 480P SVGA PIXELS' : 'CRISP NATIVE HD'}</span>
            </button>
            <button class="rr-btn" id="opt-traffic">
              <span>HIGHWAY TRAFFIC</span>
              <span class="sub">${this.trafficEnabled ? 'ON (2-WAY CARS & TRUCKS)' : 'OFF'}</span>
            </button>
            <button class="rr-btn" id="opt-music-toggle">
              <span>GRUNGE MUSIC</span>
              <span class="sub">${this.sound.musicEnabled ? 'ON' : 'MUTED'}</span>
            </button>
            <button class="rr-btn" id="opt-next-song">
              <span>JUKEBOX TRACK</span>
              <span class="sub">${this.sound.getCurrentTrackName().toUpperCase()}</span>
            </button>
            <button class="rr-btn" id="opt-touch">
              <span>ON-SCREEN TOUCH PAD</span>
              <span class="sub">${this.touchControlsVisible ? 'VISIBLE IN RACE' : 'AUTO / HIDDEN'}</span>
            </button>
          </div>

          <div class="info-card">
            <h3>KEYBOARD CONTROLS</h3>
            <p>
              <b>W / ↑</b> — Accelerate (Double-tap for Nitro!)<br/>
              <b>S / ↓</b> — Brake (or pause sprint on foot)<br/>
              <b>A / D or ← / →</b> — Steer & Lean Bike<br/>
              <b>SPACE / Z / J</b> — Punch or Swing Equipped Weapon<br/>
              <b>B</b> — Heavy Backhand • <b>Q / E</b> — Left/Right Punch<br/>
              <b>X / C / K / ENTER</b> — Side Boot Kick (Shoves Bikes!)<br/>
              <b>N / SHIFT</b> — Fire Nitrous Oxide (N2O)<br/>
              <b>V</b> — Switch 1996 Cockpit / Clean / 1st-Person View<br/>
              <b>M</b> — Toggle Rearview Mirror • <b>T</b> — Next Song<br/>
              <b>ESC / P</b> — Pause Race
            </p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('back-main').onclick = () => this.renderMainMenu();
    document.getElementById('opt-retro').onclick = () => {
      this.world3d.retroMode = !this.world3d.retroMode;
      this.handleResize();
      this.renderOptionsMenu();
    };
    document.getElementById('opt-traffic').onclick = () => {
      this.trafficEnabled = !this.trafficEnabled;
      this.renderOptionsMenu();
    };
    document.getElementById('opt-music-toggle').onclick = () => {
      this.sound.musicEnabled = !this.sound.musicEnabled;
      this.renderOptionsMenu();
    };
    document.getElementById('opt-next-song').onclick = () => {
      this.sound.unlock();
      this.sound.nextTrack();
      this.renderOptionsMenu();
    };
    document.getElementById('opt-touch').onclick = () => {
      this.touchControlsVisible = !this.touchControlsVisible;
      this.renderOptionsMenu();
    };
  }

  // =========================================================================
  // RACE LIFECYCLE
  // =========================================================================
  launchRace(cfg) {
    this.lastRaceCfg = cfg;
    this.sound.unlock();
    this.sound.gameplaySfxEnabled = true;

    this.controls = { accel: false, brake: false, left: false, right: false };
    this.race.attractMode = false;
    this.race.startRace({
      ...cfg,
      trafficEnabled: this.trafficEnabled
    });

    this.mode = 'racing';
    this.uiLayer.innerHTML = '';
    this.topBar.classList.remove('hidden');
    if (this.touchControlsVisible) this.touchLayer.classList.remove('hidden');
    else this.touchLayer.classList.add('hidden');
  }

  pauseRace() {
    if (this.mode !== 'racing') return;
    this.mode = 'paused';
    this.sound.updateRaceLoops({ active: false });

    this.uiLayer.innerHTML = `
      <div class="menu-shell" style="max-width:520px;">
        <div class="section-header">
          <h2>RACE PAUSED</h2>
        </div>
        <div class="btn-stack">
          <button class="rr-btn primary" id="pause-resume">▶ RESUME RACE</button>
          <button class="rr-btn" id="pause-restart">↻ RESTART TRACK</button>
          <button class="rr-btn" id="pause-cam">🎥 SWITCH CAMERA VIEW [V]</button>
          <button class="rr-btn" id="pause-touch">📱 TOGGLE TOUCH BUTTONS</button>
          <button class="rr-btn" id="pause-quit">✖ QUIT TO MENU</button>
        </div>
      </div>
    `;

    document.getElementById('pause-resume').onclick = () => this.resumeRace();
    document.getElementById('pause-restart').onclick = () => this.launchRace(this.lastRaceCfg);
    document.getElementById('pause-cam').onclick = () => {
      this.race.cameraMode = (this.race.cameraMode + 1) % 3;
      this.resumeRace();
    };
    document.getElementById('pause-touch').onclick = () => {
      this.touchControlsVisible = !this.touchControlsVisible;
      if (this.touchControlsVisible) this.touchLayer.classList.remove('hidden');
      else this.touchLayer.classList.add('hidden');
      this.resumeRace();
    };
    document.getElementById('pause-quit').onclick = () => {
      this.startBackgroundDemo();
      if (this.gameType === 'career' && this.career) this.renderCareerHub();
      else this.renderMainMenu();
    };
  }

  resumeRace() {
    this.mode = 'racing';
    this.uiLayer.innerHTML = '';
  }

  showRaceResults() {
    this.mode = 'results';
    this.sound.updateRaceLoops({ active: false });
    this.topBar.classList.add('hidden');
    this.touchLayer.classList.add('hidden');

    const p = this.race.player;
    const outcome = this.race.finishOutcome;
    const econ = this.race.economy;
    const rank = p.position || 15;

    let headline = '';
    let subNote = '';
    let cashDelta = 0;

    if (outcome === 'wrecked') {
      const repair = Math.round(p.bike.price * 0.18);
      cashDelta = -repair;
      headline = '💥 BIKE WRECKED!';
      subNote = `Tow truck hauled your smoking frame back to the garage. Repair bill: -$${repair.toLocaleString()}.`;
    } else if (outcome === 'busted') {
      cashDelta = -econ.fine;
      headline = '🚓 BUSTED BY HIGHWAY PATROL!';
      subNote = `Officer slapped cuffs on you before you reached your bike. Citation fine: -$${econ.fine.toLocaleString()}.`;
    } else {
      const purse = econ.purses[rank - 1] || 100;
      cashDelta = purse;
      headline = rank <= 3 ? `🏆 ${rank === 1 ? '1ST PLACE VICTORY!' : `FINISHED #${rank} — QUALIFIED!`}` : `🏁 FINISHED #${rank} OF 15`;
      subNote =
        rank <= 3
          ? `Top-3 podium finish! Earned $${purse.toLocaleString()} prize purse!`
          : `Collected $${purse.toLocaleString()} consolation cash. Finish Top 3 to qualify!`;
    }

    let promotedMsg = '';
    if (this.gameType === 'career' && this.career) {
      this.career.races++;
      this.career.cash = Math.max(0, this.career.cash + cashDelta);
      // Keep any snatched weapon for future races!
      if (p.weapon && p.weapon !== 'fist') {
        this.career.weapon = p.weapon;
      }
      if (outcome === 'qualified') {
        if (rank === 1) this.career.wins++;
        const qKey = `${this.career.level}_${this.lastRaceCfg.track.id}`;
        const prev = this.career.qualifiedTracks[qKey];
        if (!prev || rank < prev) this.career.qualifiedTracks[qKey] = rank;

        // Check if all 5 California tracks are qualified on this level!
        const allFive = TRACKS.every((t) => !!this.career.qualifiedTracks[`${this.career.level}_${t.id}`]);
        if (allFive && this.career.level < 5) {
          this.career.level++;
          promotedMsg = `🔥 ALL 5 COURSES CONQUERED! PROMOTED TO LEVEL ${this.career.level}!`;
        } else if (allFive && this.career.level === 5) {
          promotedMsg = `👑 CONGRATULATIONS! YOU WON THE ENTIRE BIG GAME CHAMPIONSHIP!`;
        }
      }
      this.saveCareer();
    }

    const standings = [...this.race.racers]
      .sort((a, b) => (a.position || 99) - (b.position || 99))
      .slice(0, 8);

    this.uiLayer.innerHTML = `
      <div class="menu-shell" style="max-width:700px;">
        <div class="hazard-strip"></div>
        <div class="section-header">
          <h2>${headline}</h2>
          <span class="badge">${this.lastRaceCfg.track.name.toUpperCase()} • LVL ${this.lastRaceCfg.level}</span>
        </div>

        <div class="info-card" style="margin-bottom:12px;">
          <p>${subNote}</p>
          ${
            this.gameType === 'career' && this.career
              ? `<p style="margin-top:6px; color:#4ade80;"><b>CAREER BANKROLL: $${this.career.cash.toLocaleString()}</b> • Equipped Weapon: <b>${WEAPONS[this.career.weapon].name}</b></p>`
              : ''
          }
          ${promotedMsg ? `<p style="margin-top:6px; color:#fde047; font-weight:bold;">${promotedMsg}</p>` : ''}
        </div>

        <table class="results-table">
          <thead>
            <tr><th>POS</th><th>RASHER</th><th>BIKE</th><th>WEAPON</th></tr>
          </thead>
          <tbody>
            ${standings
              .map(
                (r, idx) => `
              <tr class="${r.isPlayer ? 'me' : ''}">
                <td>#${idx + 1}</td>
                <td>${r.name} ${r.isPlayer ? '(YOU)' : ''}</td>
                <td>${r.bike.name}</td>
                <td>${WEAPONS[r.weapon]?.name || 'Fist'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="toolbar-row" style="margin-top:16px;">
          <button class="rr-btn small" id="res-retry">↻ RACE AGAIN</button>
          ${
            this.gameType === 'career'
              ? `<button class="rr-btn primary small" id="res-hub">▶ BACK TO BIG GAME HUB</button>`
              : `<button class="rr-btn primary small" id="res-thrash">▶ PICK ANOTHER COURSE</button>`
          }
        </div>
      </div>
    `;

    document.getElementById('res-retry').onclick = () => this.launchRace(this.lastRaceCfg);
    const hubBtn = document.getElementById('res-hub');
    if (hubBtn) {
      hubBtn.onclick = () => {
        this.startBackgroundDemo();
        this.renderCareerHub();
      };
    }
    const thrashBtn = document.getElementById('res-thrash');
    if (thrashBtn) {
      thrashBtn.onclick = () => {
        this.startBackgroundDemo();
        this.renderThrashMenu();
      };
    }
  }

  // =========================================================================
  // MAIN 60 FPS GAME LOOP
  // =========================================================================
  loop(now) {
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (this.mode === 'racing') {
      this.race.update(dt, this.controls);
      this.hud.render(this.race.getHUDState());

      if (this.race.finished && this.race.finishDelayTimer <= 0) {
        this.showRaceResults();
      }
    } else if (this.mode === 'menu' || this.mode === 'results') {
      // Keep live 3D attract-mode action running in background!
      this.race.update(dt, null);
      if (this.race.finished) {
        this.startBackgroundDemo();
      }
      this.hud.ctx.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new RoadRashApp();
});
