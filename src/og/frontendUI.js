// Authentic 1996 Road Rash 640x480 Frontend UI
// Uses exact FRONTEND.RSC bottom-bar coordinates (y = 402..480 / 420..480) from frontend.json
// so all 1996 .RRI photography, showroom bikes, postcards & caricatures stay 100% unobstructed!

import { MUSIC_TRACKS } from './audioEngine.js';
import { OG_WEAPONS } from './raceSimulation.js';

const SAVE_STORAGE_KEY = 'roadrash_96_biggame_v3';
const INITIAL_MILLION_CASH = 1000000;

export const COURSE_DEFS = [
  { id: 0, key: 'CITY', post: 'city', qpost: 'qcity', nameSlot: 16, descSlot: 21 },
  { id: 1, key: 'HIWAY', post: 'sierra', qpost: 'qsierra', nameSlot: 17, descSlot: 22 },
  { id: 2, key: 'MEDLY', post: 'penin', qpost: 'qpenin', nameSlot: 18, descSlot: 23 },
  { id: 3, key: 'NAPA', post: 'napa', qpost: 'qnapa', nameSlot: 19, descSlot: 24 },
  { id: 4, key: 'CANYN', post: 'pch', qpost: 'qpch', nameSlot: 20, descSlot: 25 },
  {
    id: 5,
    key: 'INTERCEPT',
    post: 'sierrar',
    qpost: 'qsierrar',
    customName: 'Interceptor Beltway',
    customDesc:
      'Custom 6-lane Metro Freeway, twin echo highway tunnels, Pacific cliff drop-offs & Sierra sweepers built for high-speed Police Interceptor takedowns!',
    customMiles: [5.5, 7.2, 9.0, 10.8, 12.6]
  }
];

export const CHAR_DEFS = [
  { id: 0, slug: 'axle', nameSlot: 32, bioSlot: 40, startBike: 1, cashIdx: 1, female: false, statsIdx: 0 },
  { id: 1, slug: 'bose', nameSlot: 33, bioSlot: 41, startBike: 1, cashIdx: 2, female: false, statsIdx: 1 },
  { id: 2, slug: 'cydney', nameSlot: 34, bioSlot: 42, startBike: 2, cashIdx: 3, female: true, statsIdx: 2 },
  { id: 3, slug: 'jon', nameSlot: 35, bioSlot: 43, startBike: 4, cashIdx: 4, female: false, statsIdx: 3 },
  { id: 4, slug: 'pearl', nameSlot: 36, bioSlot: 44, startBike: 4, cashIdx: 5, female: true, statsIdx: 4 },
  { id: 5, slug: 'rhonda', nameSlot: 37, bioSlot: 45, startBike: 1, cashIdx: 6, female: true, statsIdx: 5 },
  { id: 6, slug: 'jim', nameSlot: 38, bioSlot: 46, startBike: 1, cashIdx: 7, female: false, statsIdx: 6 },
  { id: 7, slug: 'mike', nameSlot: 39, bioSlot: 47, startBike: 2, cashIdx: 8, female: false, statsIdx: 7 }
];

export const SHOWROOM_BIKES = [
  // Rat Bikes (Screen 21 order in FRONTEND.RSC: Banzai, Kamikaze, Killer Rat / Corsair, Perro)
  { slot: 0, bikeId: 0, cls: 'rat', slug: 'banzai', nameSlot: 128, shortSlot: 96, subSlot: 112, descSlot: 144 },
  { slot: 1, bikeId: 1, cls: 'rat', slug: 'corsair', nameSlot: 129, shortSlot: 97, subSlot: 113, descSlot: 145 },
  { slot: 2, bikeId: 2, cls: 'rat', slug: 'kamikaze', nameSlot: 130, shortSlot: 98, subSlot: 114, descSlot: 146 },
  { slot: 3, bikeId: 4, cls: 'rat', slug: 'perro', nameSlot: 131, shortSlot: 99, subSlot: 115, descSlot: 147 },
  { slot: 4, bikeId: 3, cls: 'rat', slug: 'killer', nameSlot: 132, shortSlot: 100, subSlot: 116, descSlot: 148 },
  // Sport Bikes (Screen 22)
  { slot: 5, bikeId: 10, cls: 'sport', slug: 'diablo', nameSlot: 133, shortSlot: 101, subSlot: 117, descSlot: 149 },
  { slot: 6, bikeId: 12, cls: 'sport', slug: 'kamikaze', nameSlot: 134, shortSlot: 102, subSlot: 118, descSlot: 150 },
  { slot: 7, bikeId: 14, cls: 'sport', slug: 'stiletto', nameSlot: 135, shortSlot: 103, subSlot: 119, descSlot: 151 },
  { slot: 8, bikeId: 11, cls: 'sport', slug: 'dmg', nameSlot: 136, shortSlot: 104, subSlot: 120, descSlot: 152 },
  { slot: 9, bikeId: 13, cls: 'sport', slug: 'perro', nameSlot: 137, shortSlot: 105, subSlot: 121, descSlot: 153 },
  // Super Bikes (Screen 23)
  { slot: 10, bikeId: 5, cls: 'super', slug: 'banzai', nameSlot: 138, shortSlot: 106, subSlot: 122, descSlot: 154 },
  { slot: 11, bikeId: 7, cls: 'super', slug: 'diablo', nameSlot: 139, shortSlot: 107, subSlot: 123, descSlot: 155 },
  { slot: 12, bikeId: 9, cls: 'super', slug: 'stiletto', nameSlot: 140, shortSlot: 108, subSlot: 124, descSlot: 156 },
  { slot: 13, bikeId: 6, cls: 'super', slug: 'corsair', nameSlot: 141, shortSlot: 109, subSlot: 125, descSlot: 157 },
  { slot: 14, bikeId: 8, cls: 'super', slug: 'kamikaze', nameSlot: 142, shortSlot: 110, subSlot: 126, descSlot: 158 }
];

export function bikeDefById(bikeId) {
  return SHOWROOM_BIKES.find((b) => b.bikeId === bikeId) || SHOWROOM_BIKES[0];
}

export class FrontendUI {
  constructor(assets, audio, onStartRace, displayCallbacks = {}) {
    this.assets = assets;
    this.audio = audio;
    this.onStartRace = onStartRace;
    this.displayCallbacks = {
      getAspect: () => '4:3',
      setAspect: () => {},
      toggleFullscreen: () => {},
      isFullscreen: () => false,
      ...displayCallbacks
    };

    this.screen = 'splash';
    this.returnScreen = 'main';
    this.focus = 3; // Default focus on "Start Game" button on splash!
    this.mode = 'thrash'; // 'thrash' | 'biggame' | 'copchase'

    this.thrashLevel = 0; // 0..4 -> Level 1..5
    this.thrashCourse = 0; // 0..5
    this.thrashBikeSlot = 4; // Authentic OG Level 1 Rat bike default (all 15 bikes unlocked via Bike/Wpn or TAB!)
    this.thrashCustomBike = false;
    this.selectedWeapon = 2; // All OG weapons unlocked! Default Steel Chain (or Police Baton in Police Mode)

    this.policeLevel = 1; // Level 2 default for exciting chase pacing
    this.policeCourse = 5; // Default to brand-new Interceptor Beltway!
    this.policeWeapon = 3; // Police Nightstick default!

    this.career = this.loadCareer() || this.createCareer(0);

    this.showroomClass = 0; // 0=rat, 1=sport, 2=super
    this.inspectSlot = 0;
    this.noticeTitle = '';
    this.noticeBody = '';
    this.noticeNext = 'street';
    this.schmoozeChar = 0;
    this.schmoozeMood = 'f';
    this.schmoozeText = '';
    this.restroomBg = 'restroom/rest1.jpg';
    this.editingName = false;
    this.lastRaceResult = null;
    this.loadingInfo = null;
    this.lastOffsetX = 0;

    this.hitRects = [];
  }

  createCareer(charIdx = 0) {
    const ch = CHAR_DEFS[charIdx] || CHAR_DEFS[0];
    return {
      active: false,
      charIdx: ch.id,
      playerName: this.assets.str(ch.nameSlot) || 'Axle',
      level: 0,
      bikeId: ch.startBike,
      ownedBikes: [ch.startBike],
      cash: INITIAL_MILLION_CASH,
      qualified: [false, false, false, false, false],
      racesRun: 0,
      wins: 0
    };
  }

  loadCareer() {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.cash === 'number' && Array.isArray(parsed.qualified)) {
        if (!Array.isArray(parsed.ownedBikes)) {
          parsed.ownedBikes = [parsed.bikeId ?? 0];
        }
        return parsed;
      }
    } catch {
      // ignore corrupted save
    }
    return null;
  }

  saveCareer() {
    try {
      this.career.active = true;
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(this.career));
    } catch {
      // ignore storage quota errors
    }
  }

  resetCareer() {
    try {
      localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch {
      // ignore
    }
    this.career = this.createCareer(0);
  }

  bikePrice(bikeId) {
    return this.assets.frontend?.career?.bikePrice?.[bikeId] ?? 3500;
  }

  tradeInValue() {
    return Math.floor(this.bikePrice(this.career.bikeId) * 0.5);
  }

  courseName(cdef) {
    if (!cdef) return 'The City';
    return cdef.customName || this.assets.str(cdef.nameSlot) || cdef.key;
  }

  courseDesc(cdef) {
    if (!cdef) return '';
    if (cdef.customDesc) return cdef.customDesc;
    return this.assets.str(cdef.descSlot).split('Length')[0].replace(/\n+/g, ' ').trim();
  }

  courseMiles(level, courseId) {
    const cdef = COURSE_DEFS[courseId];
    if (cdef?.customMiles) {
      return (cdef.customMiles[level] ?? 7.2).toFixed(1);
    }
    const arr = this.assets.frontend?.courseLength;
    const raw = arr ? arr[level * 5 + (courseId % 5)] : 55;
    return (raw / 10).toFixed(1);
  }

  go(nextScreen, defaultFocus = 0) {
    this.editingName = false;
    this.screen = nextScreen;
    this.focus = defaultFocus;
    if (nextScreen === 'restroom') {
      const n = 1 + Math.floor(Math.random() * 6);
      this.restroomBg = `restroom/rest${n}.jpg`;
      this.assets.preloadUI(this.restroomBg);
    } else if (nextScreen === 'street') {
      this.assets.preloadUI('street.jpg');
      this.assets.preloadUI('street/klub.jpg');
      this.assets.preloadUI('street/olley.jpg');
      this.assets.preloadUI('street/home.jpg');
    } else if (nextScreen === 'panzer') {
      this.assets.preloadUI('panzer.jpg');
    } else if (nextScreen === 'olleys') {
      this.assets.preloadUI('olleys.jpg');
    } else if (nextScreen === 'char_select') {
      CHAR_DEFS.forEach((c) => this.assets.preloadUI(`chars/${c.slug}-n.jpg`));
    } else if (
      nextScreen === 'thrash_tracks' ||
      nextScreen === 'biggame_tracks' ||
      nextScreen === 'police_tracks'
    ) {
      this.assets.preloadUI('postcard.jpg');
      COURSE_DEFS.forEach((c) => {
        this.assets.preloadUI(`postcard/${c.post}.jpg`);
        this.assets.preloadUI(`postcard/${c.qpost}.jpg`);
      });
      this.assets.preloadUI('postcard/klub.jpg');
      this.assets.preloadUI('postcard/resta.jpg');
    }
  }

  pickSchmooze() {
    const otherChars = CHAR_DEFS.filter((c) => c.id !== this.career.charIdx);
    const ch = otherChars[Math.floor(Math.random() * otherChars.length)] || CHAR_DEFS[0];
    const moods = ['f', 'n', 'h'];
    this.schmoozeChar = ch.id;
    this.schmoozeMood = moods[Math.floor(Math.random() * moods.length)];
    this.assets.preloadUI(`chars/${ch.slug}-${this.schmoozeMood}.jpg`);

    const S = this.assets.frontend?.strings || {};
    const quotes = [];
    for (let id = 860; id <= 985; id++) {
      const txt = S[String(id)];
      if (txt && txt.length > 14 && !txt.includes('%')) quotes.push(txt);
    }
    this.schmoozeText =
      quotes[Math.floor(Math.random() * quotes.length)] ||
      "Watch your back out on Pacific Highway — one boot kick near the cliff and it's curtains!";
  }

  // ==================== EXACT 1996 FRONTEND.RSC SCREEN SPECS ====================

  currentMenuSpec() {
    const S = (id) => this.assets.str(id);
    const curAspect = this.displayCallbacks.getAspect();
    const isFull = this.displayCallbacks.isFullscreen();

    // Starting Splash Screen with interactive 4:3 OG / 16:9 Widescreen / Fullscreen / Start buttons!
    if (this.screen === 'splash') {
      return {
        bg: 'splash.jpg',
        items: [
          {
            rect: [12, 426, 138, 44],
            centered: true,
            label: curAspect === '4:3' ? '★ 4:3 OG' : '4:3 OG',
            desc: '',
            action: () => {
              this.displayCallbacks.setAspect('4:3');
            }
          },
          {
            rect: [158, 426, 152, 44],
            centered: true,
            label: curAspect === '16:9' ? '★ 16:9 Wide' : '16:9 Wide',
            desc: '',
            action: () => {
              this.displayCallbacks.setAspect('16:9');
            }
          },
          {
            rect: [318, 426, 146, 44],
            centered: true,
            label: isFull ? 'Exit Full' : 'Fullscreen',
            desc: '',
            action: () => {
              this.displayCallbacks.toggleFullscreen();
            }
          },
          {
            rect: [472, 426, 156, 44],
            centered: true,
            label: 'Start Game ▶',
            desc: '',
            action: () => {
              this.audio.playSfx('punchhea', { volume: 0.65 });
              this.audio.playMusicTrack('KLOWN');
              this.go('main', 0);
            }
          }
        ]
      };
    }

    // Screen 9: Main Menu (5 horizontal dock buttons across y = 420..480, biker 100% uncovered!)
    if (this.screen === 'main') {
      const hasSave = Boolean(this.career?.active);
      return {
        bg: 'main.jpg',
        showAuthorBadge: true,
        titleRect: [14, 14, 306, 76],
        title: S(70) || 'Game Mode',
        titleFontSize: 52,
        descRect: [14, 98, 306, 250],
        descFontSize: 20,
        items: [
          {
            rect: [0, 420, 128, 60],
            label: 'Thrash',
            desc: `${S(3)}\n\nAll 15 Bikes + All 4 OG Weapons Unlocked + Nitro Speed Boost!`,
            action: () => {
              this.mode = 'thrash';
              this.go('thrash_tracks', this.thrashCourse);
            }
          },
          {
            rect: [128, 420, 128, 60],
            label: 'Big Game',
            desc: hasSave
              ? `${S(5)}\n\nSaved: ${this.career.playerName} • Lv.${this.career.level + 1} • $${this.career.cash.toLocaleString()}`
              : `${S(5)}\n\nStarts with $1,000,000 Cash & All 15 Bikes Unlocked!`,
            action: () => {
              this.mode = 'biggame';
              if (this.career.active) this.go('street', 0);
              else this.go('char_select', 0);
            }
          },
          {
            rect: [256, 420, 134, 60],
            label: 'Police Mode',
            desc: 'SPECIAL POLICE INTERCEPTOR MODE!\nRide as Highway Patrol Officer on the new Interceptor Beltway (or any track) and BUST ALL 14 RACERS before anyone wins!',
            action: () => {
              this.mode = 'copchase';
              this.go('police_tracks', this.policeCourse);
            }
          },
          {
            rect: [390, 420, 125, 60],
            label: curAspect === '16:9' ? '16:9 Wide' : '4:3 OG',
            desc: `Current Display: ${curAspect === '16:9' ? '16:9 Widescreen (854x480 True Wide FOV)' : '4:3 Original 1996 Aspect (640x480)'}.\nClick to switch between 4:3 OG and 16:9 Widescreen! (F11 = Fullscreen)`,
            action: () => {
              this.displayCallbacks.setAspect(curAspect === '16:9' ? '4:3' : '16:9');
            }
          },
          {
            rect: [515, 420, 125, 60],
            label: S(6) || 'Restroom',
            desc: 'Options, Weapon & Bike Loadout, Jukebox, Fullscreen, and How To Rash Controls Guide.',
            action: () => {
              this.returnScreen = 'main';
              this.go('restroom', 0);
            }
          }
        ]
      };
    }

    if (this.screen === 'help') {
      return {
        bg: 'main.jpg',
        titleRect: [16, 12, 608, 64],
        title: 'Controls, Weapons & Modes',
        titleFontSize: 44,
        customBody: [
          'RIDE & STEER: Arrow Keys or W/A/S/D  •  N, B, CTRL or Double-Tap UP = Nitro Speed Boost (ALL Bikes!).',
          'ALL OG WEAPONS UNLOCKED: Press Q, E, or Keys 1-4 mid-race to switch Fists, Club, Chain & Police Baton!',
          'MELEE & BOOT KICK: SPACE/ENTER = Smart Swing  •  Z/C = Left/Right  •  X/SHIFT = Lateral Boot-Kick Shove!',
          'POLICE MODE: Ride the Highway Patrol Interceptor & BUST ALL 14 RACERS before a single outlaw finishes!',
          'NEW MAP — INTERCEPTOR BELTWAY: 6-lane Metro Freeway, twin echo tunnels & Pacific cliff drop-offs!',
          '$1,000,000 BANKROLL: All 15 bikes unlocked at Olley\'s Showroom & selectable on Track Select!',
          'DISPLAY & NAVIGATION: Switch 4:3 OG vs 16:9 Widescreen & Fullscreen anytime from Start/Top Bar!'
        ],
        items: [
          {
            rect: [0, 430, 640, 50],
            centered: true,
            label: '◀ Back',
            desc: '',
            action: () => this.go(this.returnScreen || 'main', 0)
          }
        ]
      };
    }

    // Screen 14: Character Select (3x3 bottom dock y = 402..480, character portrait 100% uncovered!)
    if (this.screen === 'char_select') {
      const charIdx = this.focus < 8 ? this.focus : 0;
      const ch = CHAR_DEFS[charIdx] || CHAR_DEFS[0];
      const st = this.assets.frontend?.riderStats?.[ch.statsIdx] || { height: 72, weight: 175 };
      const ft = Math.floor(st.height / 12);
      const inch = st.height % 12;
      const bikeName = S(bikeDefById(ch.startBike).nameSlot);
      const cash = INITIAL_MILLION_CASH;
      const rawBio = S(ch.bioSlot)
        .replace('%s', `${ft}'${inch}"`)
        .replace('%s', `${st.weight} lbs`)
        .replace('%s', bikeName)
        .replace('%d', cash.toLocaleString());

      const charRects = [
        [0, 402, 213, 26],
        [0, 428, 213, 26],
        [0, 454, 213, 26],
        [213, 402, 213, 26],
        [213, 428, 213, 26],
        [213, 454, 213, 26],
        [426, 402, 214, 26],
        [426, 428, 214, 26]
      ];

      return {
        bg: `chars/${ch.slug}-n.jpg`,
        titleRect: [14, 12, 276, 58],
        title: S(ch.nameSlot),
        titleFontSize: 42,
        descRect: [14, 78, 276, 312],
        descFontSize: 19,
        items: [
          ...CHAR_DEFS.map((c, idx) => ({
            rect: charRects[idx],
            label: S(c.nameSlot),
            desc: rawBio,
            action: () => {
              this.career = this.createCareer(c.id);
              this.saveCareer();
              this.go('street', 0);
            }
          })),
          {
            rect: [426, 454, 214, 26],
            label: S(204) || 'Cancel',
            desc: 'Return to Main Menu.',
            action: () => this.go('main', 1)
          }
        ]
      };
    }

    // Screen 15: The Street (3 horizontal buttons across y = 420..480, neon street 100% uncovered!)
    if (this.screen === 'street') {
      const overlays = ['street/klub.jpg', 'street/olley.jpg', 'street/home.jpg'];
      return {
        bg: 'street.jpg',
        overlay: { path: overlays[this.focus] || overlays[0], x: 146, y: 230 },
        statusBanner: `${this.career.playerName}  •  Lv.${this.career.level + 1}  •  $${this.career.cash.toLocaleString()}  •  ${S(bikeDefById(this.career.bikeId).nameSlot)}`,
        descRect: [16, 46, 286, 118],
        descFontSize: 20,
        items: [
          {
            rect: [0, 420, 213, 60],
            label: S(48) || 'Der Panzer Klub',
            desc: S(49),
            action: () => this.go('panzer', 2)
          },
          {
            rect: [213, 420, 213, 60],
            label: S(50) || "Olley's Skoot",
            desc: S(51),
            action: () => this.go('olleys', 0)
          },
          {
            rect: [426, 420, 214, 60],
            label: S(8) || 'Go Home',
            desc: S(9),
            action: () => {
              this.saveCareer();
              this.go('main', 1);
            }
          }
        ]
      };
    }

    // Screen 25: Der Panzer Klub (exact 2x2 bottom dock y = 420..480 + side caps!)
    if (this.screen === 'panzer') {
      const qualCount = this.career.qualified.filter(Boolean).length;
      return {
        bg: 'panzer.jpg',
        statusBanner: `${this.career.playerName}  •  Level ${this.career.level + 1} (${qualCount}/5 Qualified)  •  Cash: $${this.career.cash.toLocaleString()}`,
        descRect: [16, 48, 280, 136],
        descFontSize: 20,
        extraDarkRects: [
          [0, 420, 80, 60],
          [280, 420, 80, 60],
          [560, 420, 80, 60]
        ],
        items: [
          {
            rect: [80, 420, 200, 30],
            label: S(52) || 'Schmooze',
            desc: S(53),
            action: () => {
              this.pickSchmooze();
              this.go('schmooze', 0);
            }
          },
          {
            rect: [360, 420, 200, 30],
            label: S(6) || 'Restroom',
            desc: S(7),
            action: () => {
              this.returnScreen = 'panzer';
              this.go('restroom', 0);
            }
          },
          {
            rect: [80, 450, 200, 30],
            label: S(54) || 'Bulletin Board',
            desc: S(55),
            action: () => {
              const firstUnq = this.career.qualified.findIndex((q) => !q);
              this.go('biggame_tracks', firstUnq >= 0 ? firstUnq : 0);
            }
          },
          {
            rect: [360, 450, 200, 30],
            label: S(56) || 'The Street',
            desc: S(57),
            action: () => this.go('street', 0)
          }
        ]
      };
    }

    // Screen 26: Schmooze (character portrait uncovered, quote in bottom 640x96 dock!)
    if (this.screen === 'schmooze') {
      const ch = CHAR_DEFS[this.schmoozeChar] || CHAR_DEFS[0];
      return {
        bg: `chars/${ch.slug}-${this.schmoozeMood}.jpg`,
        titleRect: [14, 12, 270, 56],
        title: S(ch.nameSlot),
        titleFontSize: 40,
        descRect: [12, 344, 616, 72],
        descFontSize: 21,
        items: [
          {
            rect: [0, 420, 320, 60],
            label: 'Schmooze Again',
            desc: `“${this.schmoozeText}”`,
            action: () => this.pickSchmooze()
          },
          {
            rect: [320, 420, 320, 60],
            label: S(48) || 'Back to Klub',
            desc: `“${this.schmoozeText}”`,
            action: () => this.go('panzer', 0)
          }
        ]
      };
    }

    // Screen 20: Olley's Entrance (exact 2x2 bottom dock y = 420..480!)
    if (this.screen === 'olleys') {
      return {
        bg: 'olleys.jpg',
        statusBanner: `Cash: $${this.career.cash.toLocaleString()}  •  Trade-In: +$${this.tradeInValue().toLocaleString()}  •  Current: ${S(bikeDefById(this.career.bikeId).nameSlot)}`,
        descRect: [16, 48, 290, 148],
        descFontSize: 19,
        extraDarkRects: [
          [0, 420, 80, 60],
          [280, 420, 80, 60],
          [560, 420, 80, 60]
        ],
        items: [
          {
            rect: [80, 420, 200, 30],
            label: S(58) || 'Rat Bikes',
            desc: S(59),
            action: () => {
              this.showroomClass = 0;
              this.preloadShowroom(0);
              this.go('showroom', 0);
            }
          },
          {
            rect: [360, 420, 200, 30],
            label: S(62) || 'Super Bikes',
            desc: S(63),
            action: () => {
              this.showroomClass = 2;
              this.preloadShowroom(2);
              this.go('showroom', 0);
            }
          },
          {
            rect: [80, 450, 200, 30],
            label: S(60) || 'Sport Bikes',
            desc: S(61),
            action: () => {
              this.showroomClass = 1;
              this.preloadShowroom(1);
              this.go('showroom', 0);
            }
          },
          {
            rect: [360, 450, 200, 30],
            label: S(56) || 'The Street',
            desc: S(57),
            action: () => this.go('street', 1)
          }
        ]
      };
    }

    // Screens 21-23: Rat / Sport / Super Showroom (exact 3x2 bottom dock y = 420..480, bikes 100% uncovered!)
    if (this.screen === 'showroom') {
      const clsNames = ['rat', 'sport', 'super'];
      const clsKey = clsNames[this.showroomClass] || 'rat';
      const baseSlot = this.showroomClass * 5;
      const bikes = SHOWROOM_BIKES.slice(baseSlot, baseSlot + 5);
      const focusedBike = this.focus < 5 ? bikes[this.focus] : null;
      const bg = focusedBike
        ? `showroom/${clsKey}/${focusedBike.slug}.jpg`
        : `showroom/${clsKey}/bikes.jpg`;

      const showroomRects = [
        [0, 420, 213, 30],
        [0, 450, 213, 30],
        [213, 420, 213, 30],
        [213, 450, 213, 30],
        [426, 420, 214, 30]
      ];
      const ownedSet = new Set(this.career.ownedBikes || [this.career.bikeId]);
      const buyingPower = this.career.cash + this.tradeInValue();
      const priceStr = focusedBike
        ? `${S(focusedBike.nameSlot)} [NITRO] — $${this.bikePrice(focusedBike.bikeId).toLocaleString()}${
            focusedBike.bikeId === this.career.bikeId
              ? ' (RIDING)'
              : ownedSet.has(focusedBike.bikeId)
                ? ' (OWNED)'
                : ' (UNLOCKED)'
          }`
        : 'All 15 bikes unlocked w/ $1,000,000 bankroll — pick any motorcycle to inspect & ride';

      return {
        bg,
        statusBanner: `${priceStr}  •  Cash: $${this.career.cash.toLocaleString()} (w/ Trade: $${buyingPower.toLocaleString()})`,
        items: [
          ...bikes.map((b, idx) => ({
            rect: showroomRects[idx],
            label: `${S(b.shortSlot)} ${S(b.subSlot)}${b.bikeId === this.career.bikeId ? ' ★' : ownedSet.has(b.bikeId) ? ' ✓' : ''}`,
            desc: '',
            action: () => {
              this.inspectSlot = b.slot;
              this.assets.preloadUI(`bikes/${b.cls}/${b.slug}.jpg`);
              this.go('bike_inspect', 0);
            }
          })),
          {
            rect: [426, 450, 214, 30],
            label: S(90) || 'Showroom',
            desc: '',
            action: () => this.go('olleys', 0)
          }
        ]
      };
    }

    // Screen 24: Bike Close-Up Inspect & Buy
    if (this.screen === 'bike_inspect') {
      const b = SHOWROOM_BIKES[this.inspectSlot] || SHOWROOM_BIKES[0];
      const ownedSet = new Set(this.career.ownedBikes || [this.career.bikeId]);
      const alreadyOwned = ownedSet.has(b.bikeId);
      const price = this.bikePrice(b.bikeId);
      const netCost = alreadyOwned ? 0 : Math.max(0, price - this.tradeInValue());
      const rawSpec = S(b.descSlot).replace('%d', price.toLocaleString());
      const specLines = rawSpec.split('\n');
      const formattedDesc =
        specLines.length >= 6
          ? `${specLines[0]}\n${specLines[1]}  •  ${specLines[2]}  •  ${specLines[3]}  •  ${specLines[4]}  •  ${specLines[5]}`
          : rawSpec;

      return {
        bg: `bikes/${b.cls}/${b.slug}.jpg`,
        statusBanner: `${S(b.nameSlot)} [NITRO BOOST]  •  ${alreadyOwned ? 'OWNED IN GARAGE ($0 Switch)' : `Price: $${price.toLocaleString()} (Net: $${netCost.toLocaleString()})`}  •  Cash: $${this.career.cash.toLocaleString()}`,
        descRect: [16, 326, 608, 88],
        descFontSize: 16,
        extraDarkRects: [
          [0, 420, 80, 60],
          [80, 420, 200, 30],
          [280, 420, 80, 60],
          [360, 420, 200, 30],
          [560, 420, 80, 60]
        ],
        items: [
          {
            rect: [80, 450, 200, 30],
            label: alreadyOwned
              ? `Ride Now ($0)`
              : `${S(217) || 'Buy'} ($${netCost.toLocaleString()})`,
            desc: formattedDesc,
            action: () => this.tryBuyBike(b)
          },
          {
            rect: [360, 450, 200, 30],
            label: S(218) || 'Exit',
            desc: formattedDesc,
            action: () => this.go('showroom', this.inspectSlot % 5)
          }
        ]
      };
    }

    if (this.screen === 'notice') {
      return {
        bg: 'olleys.jpg',
        titleRect: [40, 96, 560, 74],
        title: this.noticeTitle,
        descRect: [40, 184, 560, 150],
        items: [
          {
            rect: [0, 420, 640, 60],
            centered: true,
            label: S(205) || 'OK',
            desc: this.noticeBody,
            action: () => this.go(this.noticeNext, 0)
          }
        ]
      };
    }

    // Screens 10, 27 & Police Pursuit: Postcard Track Select (4x2 bottom dock y = 420..480, right postcard 100% uncovered!)
    if (
      this.screen === 'thrash_tracks' ||
      this.screen === 'biggame_tracks' ||
      this.screen === 'police_tracks'
    ) {
      const isBig = this.screen === 'biggame_tracks';
      const isPolice = this.screen === 'police_tracks';
      const level = isPolice ? this.policeLevel : isBig ? this.career.level : this.thrashLevel;
      const focusedCourse = this.focus < COURSE_DEFS.length ? COURSE_DEFS[this.focus] : null;

      let rightPost = isBig ? 'postcard/klub.jpg' : 'postcard/resta.jpg';
      if (focusedCourse) {
        const qual = isBig && focusedCourse.id < 5 && this.career.qualified[focusedCourse.id];
        rightPost = `postcard/${qual ? focusedCourse.qpost : focusedCourse.post}.jpg`;
      }

      // Clean 4x2 grid across y = 420..480 (160px x 30px each — 8 buttons total!)
      const gridRects = [
        [0, 420, 160, 30],
        [0, 450, 160, 30],
        [160, 420, 160, 30],
        [160, 450, 160, 30],
        [320, 420, 160, 30],
        [320, 450, 160, 30],
        [480, 420, 160, 30],
        [480, 450, 160, 30]
      ];

      const activeWeaponId = isPolice ? this.policeWeapon : this.selectedWeapon;
      const wDef = OG_WEAPONS[activeWeaponId] || OG_WEAPONS[0];
      const thrashBikeDef = SHOWROOM_BIKES[this.thrashBikeSlot] || SHOWROOM_BIKES[11];
      const activeBikeName = isPolice
        ? 'Highway Patrol Interceptor'
        : isBig
          ? S(bikeDefById(this.career.bikeId).nameSlot)
          : S(thrashBikeDef.nameSlot);

      return {
        bg: 'postcard.jpg',
        overlay: { path: rightPost, x: 243, y: 0 },
        descRect: [12, 12, 222, 398],
        descFontSize: 18,
        items: [
          ...COURSE_DEFS.map((c, idx) => {
            const qual = isBig && c.id < 5 && this.career.qualified[c.id];
            const miles = this.courseMiles(level, c.id);
            const rawDesc = this.courseDesc(c);
            const cName = this.courseName(c);
            const shortLabel =
              c.id === 5
                ? isPolice
                  ? '★ Beltway (NEW)'
                  : 'Beltway (NEW)'
                : `${cName}${qual ? ' ★' : ''}`;
            const modeLine = isPolice
              ? `POLICE PURSUIT • Lv.${level + 1}\nBust ALL 14 Outlaws!\nWpn: ${wDef.name} [Q]`
              : `Level ${level + 1}${qual ? ' (QUALIFIED)' : ''}${isBig && c.id === 5 ? ' (BONUS PURSE)' : ''}\nBike: ${activeBikeName}\nWpn: ${wDef.name} [Q]`;
            return {
              rect: gridRects[idx],
              label: shortLabel,
              desc: `${cName}\n${modeLine}\n\n${rawDesc}\n\nLength: ${miles} ${S(27) || 'miles'}`,
              action: () => {
                if (isPolice) this.policeCourse = c.id;
                else if (!isBig) this.thrashCourse = c.id;
                this.launchRace(c.id);
              }
            };
          }),
          // Slot 6: Loadout Quick-Toggle (Weapon / Bike / Level clickable button!)
          isPolice
            ? {
                rect: gridRects[6],
                label: `Wpn: ${wDef.key}`,
                desc: `Equipped Weapon: ${wDef.name} (All 4 OG Weapons Unlocked!).\nClick to cycle Weapon, or press TAB to change Pursuit Level (Currently Lv.${this.policeLevel + 1}).`,
                action: () => {
                  this.policeWeapon = (this.policeWeapon + 1) % OG_WEAPONS.length;
                }
              }
            : isBig
              ? {
                  rect: gridRects[6],
                  label: `Wpn: ${wDef.key}`,
                  desc: `Starting Weapon: ${wDef.name} (All 4 OG Weapons Unlocked — switch anytime mid-race with Q/E or 1-4!).\nClick to cycle Fists, Club, Chain & Police Baton!`,
                  action: () => {
                    this.selectedWeapon = (this.selectedWeapon + 1) % OG_WEAPONS.length;
                  }
                }
              : {
                  rect: gridRects[6],
                  label: `Bike/Wpn ↻`,
                  desc: `Bike: ${activeBikeName} [NITRO] (15/15 Unlocked)\nWeapon: ${wDef.name} [Q to cycle]\nLevel: ${level + 1} [L to cycle]\n\nClick or press TAB to switch Bike (Rat / Sport / Super)!`,
                  action: () => {
                    this.thrashCustomBike = true;
                    this.thrashBikeSlot = (this.thrashBikeSlot + 1) % SHOWROOM_BIKES.length;
                  }
                },
          // Slot 7: Back Navigation Button
          {
            rect: gridRects[7],
            label: isBig ? '◀ Panzer Klub' : '◀ Main Menu',
            desc: isBig
              ? 'Return to Der Panzer Klub.'
              : isPolice
                ? 'Return to Main Menu. (Tip: Press TAB here to change Pursuit Level 1–5!)'
                : 'Return to Main Menu.',
            action: () => {
              if (isBig) this.go('panzer', 2);
              else this.go('main', isPolice ? 2 : 0);
            }
          }
        ]
      };
    }

    // Screen 16: Restroom (Options, Display Ratio, Weapon & Bike Loadout, Jukebox & Help)
    if (this.screen === 'restroom') {
      const trackName = MUSIC_TRACKS[this.audio.currentTrackIndex] || 'GRUNGE1';
      const alias = this.career.playerName || 'Axle';
      const thrashBike = SHOWROOM_BIKES[this.thrashBikeSlot] || SHOWROOM_BIKES[11];
      const wDef = OG_WEAPONS[this.selectedWeapon] || OG_WEAPONS[2];
      return {
        bg: this.restroomBg,
        titleRect: [0, 8, 640, 56],
        title: S(6) || 'Restroom & Options',
        titleFontSize: 46,
        items: [
          {
            rect: [0, 72, 320, 32],
            centered: true,
            label: `Display Ratio: ${curAspect === '16:9' ? '16:9 Wide' : '4:3 OG'}`,
            desc: '',
            action: () => {
              this.displayCallbacks.setAspect(curAspect === '16:9' ? '4:3' : '16:9');
            }
          },
          {
            rect: [320, 72, 320, 32],
            centered: true,
            label: isFull ? 'Windowed Mode' : 'Fullscreen Mode',
            desc: '',
            action: () => {
              this.displayCallbacks.toggleFullscreen();
            }
          },
          {
            rect: [0, 108, 320, 32],
            centered: true,
            label: `Thrash Level: Lv.${this.thrashLevel + 1}`,
            desc: '',
            action: () => {
              this.thrashLevel = (this.thrashLevel + 1) % 5;
            }
          },
          {
            rect: [320, 108, 320, 32],
            centered: true,
            label: `Start Weapon: ${wDef.name}`,
            desc: '',
            action: () => {
              this.selectedWeapon = (this.selectedWeapon + 1) % OG_WEAPONS.length;
            }
          },
          {
            rect: [0, 144, 640, 32],
            centered: true,
            label: `Thrash Bike (15 Unlocked): ${S(thrashBike.nameSlot)}`,
            desc: '',
            action: () => {
              this.thrashBikeSlot = (this.thrashBikeSlot + 1) % SHOWROOM_BIKES.length;
            }
          },
          {
            rect: [0, 180, 640, 32],
            centered: true,
            label: this.editingName
              ? `Player Name: ${alias}_  (Type & Enter)`
              : `Player Name: ${alias}  (Click to Edit)`,
            desc: '',
            action: () => {
              this.editingName = !this.editingName;
              if (!this.editingName) this.saveCareer();
            }
          },
          {
            rect: [0, 216, 640, 32],
            centered: true,
            label: `Jukebox Track: ${trackName}`,
            desc: '',
            action: () => {
              this.audio.nextMusicTrack();
            }
          },
          {
            rect: [0, 252, 320, 32],
            centered: true,
            label: `Rock Music: ${this.audio.musicEnabled ? 'ON' : 'OFF'}`,
            desc: '',
            action: () => {
              this.audio.toggleMusic();
            }
          },
          {
            rect: [320, 252, 320, 32],
            centered: true,
            label: `Sound FX: ${this.audio.sfxEnabled ? 'ON' : 'OFF'}`,
            desc: '',
            action: () => {
              this.audio.toggleSfx();
            }
          },
          {
            rect: [0, 288, 640, 32],
            centered: true,
            label: 'Reset Big Game Career ($1,000,000 Fresh Start)',
            desc: '',
            action: () => {
              this.resetCareer();
              this.mode = 'biggame';
              this.go('char_select', 0);
            }
          },
          {
            rect: [0, 324, 640, 32],
            centered: true,
            label: 'Controls, Weapons & Police Mode Guide',
            desc: '',
            action: () => {
              this.go('help', 0);
            }
          },
          {
            rect: [0, 424, 640, 56],
            centered: true,
            label: `◀ ${S(86) || 'Done'}`,
            desc: '',
            action: () => this.go(this.returnScreen || 'main', 0)
          }
        ]
      };
    }

    // Screen 8: Pre-Race Loading
    if (this.screen === 'loading') {
      const ch = CHAR_DEFS[this.mode === 'biggame' ? this.career.charIdx : 0] || CHAR_DEFS[0];
      return {
        bg: `chars/${ch.slug}-f.jpg`,
        titleRect: [80, 168, 480, 76],
        title: this.mode === 'copchase' ? 'UNIT DISPATCHING' : S(206) || 'GAME LOADING',
        descRect: [100, 256, 440, 84],
        items: [],
        fixedDesc: `${this.loadingInfo?.courseName || ''}\n${
          this.mode === 'copchase'
            ? 'Siren Hot! Bust all 14 outlaw racers before anyone crosses the finish!'
            : S(207) || 'Get ready to race!'
        }`
      };
    }

    // Screens 28-32: Post-Race Caricature (full-width bottom bar [0, 410, 640, 70], caricature 100% uncovered!)
    if (this.screen === 'post_race') {
      const r = this.lastRaceResult || {};
      return {
        bg: r.art || 'results/win1.jpg',
        titleRect: [16, 10, 608, 64],
        title: r.headline || 'WINNER!',
        titleFontSize: 48,
        descRect: [0, 348, 640, 62],
        descFontSize: 20,
        items: [
          {
            rect: [0, 410, 640, 70],
            centered: true,
            label: 'View Race Standings  ▶',
            desc: r.message || '',
            action: () => this.go('standings', 0)
          }
        ]
      };
    }

    // Screen 34: 15-Rider Race Results Standings
    if (this.screen === 'standings') {
      const r = this.lastRaceResult || {};
      return {
        bg: r.art || 'results/win1.jpg',
        titleRect: [16, 8, 608, 56],
        title: this.mode === 'copchase' ? 'Pursuit Report' : S(183) || 'Race Results',
        titleFontSize: 44,
        standings: r.standings || [],
        items: [
          {
            rect: [0, 430, 640, 50],
            centered: true,
            label: 'Continue  ▶',
            desc: '',
            action: () => {
              if (this.mode === 'biggame') {
                if (r.gameOver) {
                  this.resetCareer();
                  this.go('main', 1);
                } else {
                  this.go('panzer', 2);
                }
              } else if (this.mode === 'copchase') {
                this.go('police_tracks', this.policeCourse);
              } else {
                this.go('thrash_tracks', this.thrashCourse);
              }
            }
          }
        ]
      };
    }

    return { bg: 'main.jpg', items: [] };
  }

  preloadShowroom(clsIndex) {
    const clsNames = ['rat', 'sport', 'super'];
    const cls = clsNames[clsIndex] || 'rat';
    this.assets.preloadUI(`showroom/${cls}/bikes.jpg`);
    SHOWROOM_BIKES.slice(clsIndex * 5, clsIndex * 5 + 5).forEach((b) => {
      this.assets.preloadUI(`showroom/${cls}/${b.slug}.jpg`);
      this.assets.preloadUI(`bikes/${cls}/${b.slug}.jpg`);
    });
  }

  tryBuyBike(b) {
    const S = (id) => this.assets.str(id);
    if (b.bikeId === this.career.bikeId) {
      this.noticeTitle = S(187) || 'WAKE UP!';
      this.noticeBody = S(188) || 'You are already riding this bike.';
      this.noticeNext = 'showroom';
      this.go('notice', 0);
      return;
    }
    if (!Array.isArray(this.career.ownedBikes)) {
      this.career.ownedBikes = [this.career.bikeId];
    }
    const alreadyOwned = this.career.ownedBikes.includes(b.bikeId);
    const price = this.bikePrice(b.bikeId);
    const netCost = alreadyOwned ? 0 : Math.max(0, price - this.tradeInValue());
    if (this.career.cash < netCost) {
      this.noticeTitle = S(185) || 'IN YOUR DREAMS!';
      this.noticeBody = `${S(186)}\nNeed $${netCost.toLocaleString()} after trade-in (you have $${this.career.cash.toLocaleString()}).`;
      this.noticeNext = 'showroom';
      this.go('notice', 0);
      return;
    }
    this.career.cash -= netCost;
    this.career.bikeId = b.bikeId;
    if (!alreadyOwned) {
      this.career.ownedBikes.push(b.bikeId);
    }
    this.saveCareer();
    this.audio.playSfx('m_yeah', { volume: 0.9 });
    this.noticeTitle = S(189) || 'CONGRATULATIONS!';
    this.noticeBody = `${S(190)}\nNew Ride: ${S(b.nameSlot)} [NITRO BOOST] • Cash Left: $${this.career.cash.toLocaleString()}`;
    this.noticeNext = 'street';
    this.go('notice', 0);
  }

  launchRace(courseId) {
    const cdef = COURSE_DEFS[courseId] || COURSE_DEFS[0];
    const isBig = this.mode === 'biggame';
    const isPolice = this.mode === 'copchase';
    const level = isPolice ? this.policeLevel : isBig ? this.career.level : this.thrashLevel;
    const ch = CHAR_DEFS[isBig ? this.career.charIdx : 0] || CHAR_DEFS[0];

    const thrashBikeDef = SHOWROOM_BIKES[this.thrashBikeSlot] || SHOWROOM_BIKES[11];
    const bikeId = isPolice ? 9 : isBig ? this.career.bikeId : thrashBikeDef.bikeId;
    const weaponId = isPolice ? this.policeWeapon : this.selectedWeapon;
    const playerName = isBig
      ? this.career.playerName
      : this.career.playerName || this.assets.str(ch.nameSlot) || 'Axle';
    const cName = this.courseName(cdef);

    this.loadingInfo = {
      courseName: isPolice
        ? `${cName} — Police Pursuit Lv.${level + 1}`
        : `${cName} — Level ${level + 1}`
    };
    this.go('loading', 0);

    setTimeout(() => {
      this.onStartRace({
        mode: this.mode,
        level,
        courseId,
        courseKey: cdef.key,
        courseName: cName,
        bikeId,
        weaponId,
        playerName,
        female: ch.female,
        charIdx: ch.id
      });
    }, 100);
  }

  handleRaceFinished(outcome) {
    const S = (id) => this.assets.str(id);
    const pick6 = (prefix) => {
      const p = `results/${prefix}${1 + Math.floor(Math.random() * 6)}.jpg`;
      this.assets.preloadUI(p);
      return p;
    };

    const isBig = this.mode === 'biggame';
    const isPolice = this.mode === 'copchase' || outcome.isPoliceMode;
    const level = isPolice ? this.policeLevel : isBig ? this.career.level : this.thrashLevel;
    const prizes =
      this.assets.frontend?.career?.prize || [1000, 750, 500, 400, 300, 250, 200, 160, 130, 100, 70, 50, 30, 20, 10];
    const levelMult = [1, 2, 4, 8, 15][level] || 1;

    let art = 'results/win1.jpg';
    let headline = S(178) || 'WINNER!';
    let message = '';
    let gameOver = false;

    if (outcome.status === 'cop_win') {
      art = pick6('bust');
      headline = 'HIGHWAY SECURED!';
      const bounty = 25000 * levelMult;
      message = `ALL ${outcome.totalOutlaws || 14} OUTLAW RACERS BUSTED! Zero racers escaped! Department Bounty: +$${bounty.toLocaleString()}`;
    } else if (outcome.status === 'cop_escaped') {
      art = pick6('lose');
      headline = 'OUTLAW ESCAPED!';
      message = `${outcome.escapedOutlawName || 'An outlaw'} crossed the finish line! You busted ${outcome.bustedCount || 0}/${outcome.totalOutlaws || 14} racers — use Nitro [N] to intercept the leader!`;
    } else if (outcome.status === 'wrecked') {
      art = pick6('wreck');
      headline = S(176) || 'WRECKED!';
      const repair = Math.max(80, Math.floor(this.bikePrice(isBig ? this.career.bikeId : 1) * 0.12));
      if (isBig) {
        if (this.career.cash < repair) {
          headline = S(182) || 'TOTALLED!';
          message = `${S(198)}  (Repair bill: $${repair.toLocaleString()})`;
          gameOver = true;
        } else {
          this.career.cash -= repair;
          message = `${S(192)}  Repair Bill: $${repair.toLocaleString()} • Cash: $${this.career.cash.toLocaleString()}`;
          this.saveCareer();
        }
      } else {
        message = isPolice
          ? `Patrol Interceptor wrecked! Busted ${outcome.bustedCount || 0}/${outcome.totalOutlaws || 14} outlaws before going down.`
          : S(192);
      }
    } else if (outcome.status === 'busted') {
      art = pick6('bust');
      headline = S(177) || 'BUSTED!';
      const fine = 150 * levelMult;
      if (isBig) {
        if (this.career.cash < fine) {
          message = `${S(198)}  (Police fine: $${fine.toLocaleString()})`;
          gameOver = true;
        } else {
          this.career.cash -= fine;
          message = `${S(195)}  Fine: $${fine.toLocaleString()} • Cash: $${this.career.cash.toLocaleString()}`;
          this.saveCareer();
        }
      } else {
        message = S(195);
      }
    } else {
      const place = outcome.place || 1;
      const purse = (prizes[Math.max(0, Math.min(14, place - 1))] || 10) * levelMult;
      if (place <= 3) {
        art = pick6('win');
        headline = place === 1 ? S(178) || 'WINNER!' : S(181) || 'QUALIFIED!';
        const placeStr =
          place === 1
            ? S(201).replace('%s', outcome.playerName)
            : place === 2
              ? S(202).replace('%s', outcome.playerName)
              : S(203).replace('%s', outcome.playerName);
        message = `${placeStr}   Prize Purse: +$${purse.toLocaleString()}`;

        if (isBig) {
          this.career.cash += purse;
          this.career.wins += 1;
          if (outcome.courseId >= 0 && outcome.courseId < 5) {
            this.career.qualified[outcome.courseId] = true;
          }
          if (this.career.qualified.every(Boolean)) {
            if (this.career.level < 4) {
              const lvlArt = `results/level${this.career.level + 1}.jpg`;
              this.assets.preloadUI(lvlArt);
              art = lvlArt;
              this.career.level += 1;
              this.career.qualified = [false, false, false, false, false];
              headline = S(180) || 'LEVEL PROGRESSION!';
              message = `All 5 tracks qualified! Advancing to Level ${this.career.level + 1}! (+$${purse.toLocaleString()})`;
            } else {
              this.assets.preloadUI('results/finale.jpg');
              art = 'results/finale.jpg';
              headline = 'YOU REIGN SUPREME!';
              message = `You conquered all 5 levels of Big Game Road Rash! Bankroll: $${this.career.cash.toLocaleString()}`;
            }
          }
          this.saveCareer();
        }
      } else {
        art = pick6('lose');
        headline = S(179) || 'LOSER!';
        if (isBig) {
          this.career.cash += purse;
          this.saveCareer();
        }
        message = `Finished #${place} (Top 3 required to qualify). Consolation: +$${purse.toLocaleString()}`;
      }
    }

    this.lastRaceResult = {
      art,
      headline,
      message,
      gameOver,
      standings: outcome.standings || []
    };
    this.go('post_race', 0);
  }

  // ==================== 2D GRID NAVIGATION & INPUT ====================

  moveFocusDirectional(dx, dy, items) {
    if (!items.length) return;
    const cur = items[this.focus]?.rect;
    if (!cur) {
      this.focus = 0;
      return;
    }
    const cx = cur[0] + cur[2] * 0.5;
    const cy = cur[1] + cur[3] * 0.5;

    let bestIdx = -1;
    let bestScore = Infinity;
    for (let i = 0; i < items.length; i++) {
      if (i === this.focus) continue;
      const r = items[i].rect;
      const ox = r[0] + r[2] * 0.5 - cx;
      const oy = r[1] + r[3] * 0.5 - cy;
      const dot = ox * dx + oy * dy;
      if (dot <= 8) continue;
      const perp = Math.abs(ox * dy - oy * dx);
      const score = dot + perp * 2.4;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      this.focus = bestIdx;
    } else {
      // Fallback wrap
      const step = dx > 0 || dy > 0 ? 1 : -1;
      this.focus = (this.focus + step + items.length) % items.length;
    }
  }

  onKeyDown(e) {
    this.audio.ensureContext();

    // Live Player Name typing inside Restroom
    if (this.editingName) {
      if (e.code === 'Enter' || e.code === 'Escape') {
        this.editingName = false;
        if (!this.career.playerName.trim()) this.career.playerName = 'Axle';
        this.saveCareer();
      } else if (e.code === 'Backspace') {
        this.career.playerName = this.career.playerName.slice(0, -1);
      } else if (e.key && e.key.length === 1 && this.career.playerName.length < 12) {
        this.career.playerName += e.key;
      }
      e.preventDefault();
      return;
    }

    const spec = this.currentMenuSpec();
    const items = spec.items || [];
    if (!items.length) return;

    if (e.code === 'Tab') {
      if (this.screen === 'thrash_tracks') {
        const step = e.shiftKey ? -1 : 1;
        this.thrashCustomBike = true;
        this.thrashBikeSlot =
          (this.thrashBikeSlot + step + SHOWROOM_BIKES.length) % SHOWROOM_BIKES.length;
        this.audio.playSfx('punchlig', { volume: 0.55, rate: 1.15 });
        e.preventDefault();
        return;
      }
      if (this.screen === 'police_tracks') {
        const step = e.shiftKey ? -1 : 1;
        this.policeLevel = (this.policeLevel + step + 5) % 5;
        this.audio.playSfx('punchlig', { volume: 0.55, rate: 1.15 });
        e.preventDefault();
        return;
      }
    }

    if (e.code === 'KeyL' && (this.screen === 'thrash_tracks' || this.screen === 'police_tracks')) {
      const step = e.shiftKey ? -1 : 1;
      if (this.screen === 'thrash_tracks') {
        this.thrashLevel = (this.thrashLevel + step + 5) % 5;
        if (!this.thrashCustomBike) {
          this.thrashBikeSlot = [4, 4, 5, 10, 11][this.thrashLevel];
        }
      } else {
        this.policeLevel = (this.policeLevel + step + 5) % 5;
      }
      this.audio.playSfx('punchlig', { volume: 0.55, rate: 1.15 });
      e.preventDefault();
      return;
    }

    if (
      e.code === 'KeyQ' &&
      (this.screen === 'thrash_tracks' ||
        this.screen === 'biggame_tracks' ||
        this.screen === 'police_tracks')
    ) {
      if (this.screen === 'police_tracks') {
        this.policeWeapon = (this.policeWeapon + 1) % OG_WEAPONS.length;
      } else {
        this.selectedWeapon = (this.selectedWeapon + 1) % OG_WEAPONS.length;
      }
      this.audio.playSfx('swishcha', { volume: 0.5, rate: 1.1 });
      e.preventDefault();
      return;
    }

    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      this.moveFocusDirectional(-1, 0, items);
      this.audio.playSfx('swishgen', { volume: 0.42, rate: 1.3 });
      e.preventDefault();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      this.moveFocusDirectional(1, 0, items);
      this.audio.playSfx('swishgen', { volume: 0.42, rate: 1.3 });
      e.preventDefault();
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      this.moveFocusDirectional(0, -1, items);
      this.audio.playSfx('swishgen', { volume: 0.42, rate: 1.3 });
      e.preventDefault();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      this.moveFocusDirectional(0, 1, items);
      this.audio.playSfx('swishgen', { volume: 0.42, rate: 1.3 });
      e.preventDefault();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      this.audio.playSfx('punchlig', { volume: 0.65 });
      items[this.focus]?.action();
      e.preventDefault();
    } else if (e.code === 'Escape' || e.code === 'Backspace') {
      if (this.screen !== 'main' && this.screen !== 'splash') {
        this.audio.playSfx('swishgen', { volume: 0.45, rate: 0.9 });
        items[items.length - 1]?.action();
      }
      e.preventDefault();
    }
  }

  onPointerMove(canvasX, y480) {
    const x640 = canvasX - this.lastOffsetX;
    for (let i = 0; i < this.hitRects.length; i++) {
      const [rx, ry, rw, rh] = this.hitRects[i];
      if (x640 >= rx && x640 <= rx + rw && y480 >= ry && y480 <= ry + rh) {
        if (this.focus !== i) {
          this.focus = i;
          this.audio.playSfx('swishgen', { volume: 0.3, rate: 1.35 });
        }
        return;
      }
    }
  }

  onPointerClick(canvasX, y480) {
    this.audio.ensureContext();
    const x640 = canvasX - this.lastOffsetX;
    const spec = this.currentMenuSpec();

    for (let i = 0; i < this.hitRects.length; i++) {
      const [rx, ry, rw, rh] = this.hitRects[i];
      if (x640 >= rx && x640 <= rx + rw && y480 >= ry && y480 <= ry + rh) {
        this.focus = i;
        this.audio.playSfx('punchlig', { volume: 0.65 });
        spec.items[i]?.action();
        return;
      }
    }

    // Clicking anywhere on the Splash artwork above the bottom display bar starts the game too!
    if (this.screen === 'splash' && y480 < 418) {
      this.audio.playSfx('punchhea', { volume: 0.65 });
      this.audio.playMusicTrack('KLOWN');
      this.go('main', 0);
    }
  }

  // ==================== 4:3 (640x480) & 16:9 (854x480) RENDERING ====================

  render(ctx) {
    const viewW = ctx.canvas?.width || 640;
    const offsetX = Math.floor((viewW - 640) * 0.5);
    this.lastOffsetX = offsetX;

    ctx.save();
    ctx.clearRect(0, 0, viewW, 480);

    const spec = this.currentMenuSpec();
    const bgAsset = this.assets.getUI(spec.bg);

    // Widescreen pillar backdrop: darkened atmospheric bleed + crisp frame border, zero stretch!
    if (offsetX > 0) {
      ctx.fillStyle = '#07080c';
      ctx.fillRect(0, 0, viewW, 480);
      if (bgAsset?.dark || bgAsset?.bright) {
        ctx.save();
        ctx.globalAlpha = 0.26;
        ctx.drawImage(bgAsset.dark || bgAsset.bright, 0, 0, viewW, 480);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
      ctx.fillRect(0, 0, offsetX, 480);
      ctx.fillRect(offsetX + 640, 0, viewW - (offsetX + 640), 480);
    }

    ctx.translate(offsetX, 0);

    if (bgAsset?.bright) {
      ctx.drawImage(bgAsset.bright, 0, 0, 640, 480);
    } else {
      ctx.fillStyle = '#090b0f';
      ctx.fillRect(0, 0, 640, 480);
    }

    if (spec.overlay) {
      const ov = this.assets.getUI(spec.overlay.path);
      if (ov?.bright) {
        ctx.drawImage(ov.bright, spec.overlay.x, spec.overlay.y);
      }
    }

    const drawDarkRect = (x, y, w, h) => {
      if (bgAsset?.dark && !spec.overlay) {
        ctx.drawImage(bgAsset.dark, x, y, w, h, x, y, w, h);
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = 'rgba(255, 140, 60, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };

    // Starting Splash Screen ("Made By Soham" + interactive 4:3 / 16:9 / Fullscreen / Start buttons!)
    if (this.screen === 'splash') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.76)';
      ctx.fillRect(190, 12, 260, 38);
      ctx.strokeStyle = '#ff6432';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(190.5, 12.5, 259, 37);

      ctx.font = '26px RRBadloc, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000000';
      ctx.fillText('Made By Soham', 322, 33);
      ctx.fillStyle = '#ff9d2e';
      ctx.fillText('Made By Soham', 320, 31);

      const pulse = 0.72 + 0.28 * Math.sin(performance.now() * 0.005);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(92, 392, 456, 26);
      ctx.font = '15px RRFuturaBold, sans-serif';
      ctx.fillStyle = '#000000';
      ctx.fillText('CHOOSE DISPLAY RATIO BELOW OR PRESS ENTER TO RASH!', 322, 406);
      ctx.fillStyle = `rgba(225, 225, 128, ${pulse.toFixed(2)})`;
      ctx.fillText('CHOOSE DISPLAY RATIO BELOW OR PRESS ENTER TO RASH!', 320, 405);
    }

    // Main Menu "Made By Soham" signature badge (top-right, clear of biker face!)
    if (spec.showAuthorBadge) {
      drawDarkRect(424, 14, 202, 34);
      ctx.font = '22px RRBadloc, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000000';
      ctx.fillText('Made By Soham', 527, 33);
      ctx.fillStyle = '#ff9d2e';
      ctx.fillText('Made By Soham', 525, 31);
    }

    if (spec.extraDarkRects) {
      for (const [ex, ey, ew, eh] of spec.extraDarkRects) {
        drawDarkRect(ex, ey, ew, eh);
      }
    }

    if (spec.statusBanner) {
      drawDarkRect(12, 8, 616, 28);
      this.drawShadowText(ctx, spec.statusBanner, 22, 13, '16px RRFuturaDemi, sans-serif', '#e1e180');
    }

    if (spec.title && spec.titleRect) {
      const [tx, ty, tw, th] = spec.titleRect;
      drawDarkRect(tx, ty, tw, th);
      const tSize = spec.titleFontSize || 50;
      this.drawWrappedBox(ctx, spec.title, tx + 8, ty + 6, tw - 16, th - 8, {
        font: `${tSize}px RRBadloc, sans-serif`,
        color: '#ff6432',
        lineHeight: tSize * 0.96,
        align: 'center'
      });
    }

    const focusedItem = spec.items?.[this.focus];
    const descText = spec.fixedDesc || focusedItem?.desc || '';
    if (descText && spec.descRect) {
      const [dx, dy, dw, dh] = spec.descRect;
      drawDarkRect(dx, dy, dw, dh);
      const fSize = spec.descFontSize || 21;
      this.drawWrappedBox(ctx, descText, dx + 10, dy + 8, dw - 20, dh - 12, {
        font: `${fSize}px RRFuturaRegular, sans-serif`,
        color: '#defff0',
        lineHeight: Math.round(fSize * 1.18),
        align: 'left'
      });
    }

    if (spec.customBody) {
      drawDarkRect(16, 88, 608, 330);
      let cy = 98;
      for (const bullet of spec.customBody) {
        cy =
          this.drawWrappedBox(ctx, '• ' + bullet, 28, cy, 584, 52, {
            font: '16px RRFuturaDemi, sans-serif',
            color: '#defff0',
            lineHeight: 19,
            align: 'left'
          }) + 4;
      }
    }

    if (spec.standings) {
      drawDarkRect(20, 72, 600, 348);
      const rows = spec.standings;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const col = i < 8 ? 0 : 1;
        const r = i % 8;
        const rx = col === 0 ? 36 : 332;
        const ry = 84 + r * 40;
        const color = row.isPlayer ? '#ffff40' : i < 3 ? '#ffb86c' : '#defff0';
        this.drawShadowText(
          ctx,
          `${i + 1}. ${row.name}`,
          rx,
          ry,
          '18px RRFuturaBold, sans-serif',
          color
        );
        this.drawShadowText(
          ctx,
          row.timeStr,
          rx + 184,
          ry,
          '17px RRFuturaDemi, sans-serif',
          color
        );
      }
    }

    // Menu buttons + yellow focus arrow (frontend.cpp::draw_scale1)
    this.hitRects = [];
    if (spec.items) {
      for (let i = 0; i < spec.items.length; i++) {
        const it = spec.items[i];
        const [bx, by, bw, bh] = it.rect;
        this.hitRects.push(it.rect);
        drawDarkRect(bx, by, bw, bh);

        const isFocused = i === this.focus;
        const labelColor = isFocused ? '#e1e180' : '#defff0';
        const fontSize = bh >= 50 ? 21 : bh <= 26 ? 17 : 19;

        if (it.centered) {
          ctx.font = `${fontSize + 2}px RRFuturaBold, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const midY = by + bh * 0.5;
          ctx.fillStyle = '#000000';
          ctx.fillText(it.label, bx + bw * 0.5 + 2, midY + 2);
          ctx.fillStyle = labelColor;
          ctx.fillText(it.label, bx + bw * 0.5, midY);
          if (isFocused) {
            const textW = ctx.measureText(it.label).width;
            this.drawFocusArrow(ctx, Math.max(bx + 10, bx + bw * 0.5 - textW * 0.5 - 22), midY - 8);
          }
        } else {
          if (isFocused) {
            this.drawFocusArrow(ctx, bx + 7, by + Math.floor((bh - 16) * 0.5));
          }
          this.drawShadowText(
            ctx,
            it.label,
            bx + 23,
            by + Math.floor((bh - (fontSize + 2)) * 0.5),
            `${fontSize}px RRFuturaBold, sans-serif`,
            labelColor
          );
        }
      }
    }

    ctx.restore();
  }

  drawFocusArrow(ctx, x, y) {
    const tri = (ox, oy, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + 10, oy + 8);
      ctx.lineTo(ox, oy + 16);
      ctx.closePath();
      ctx.fill();
    };
    tri(x + 2, y + 2, '#000000');
    tri(x, y, '#ffff00');
  }

  drawShadowText(ctx, text, x, y, font, color) {
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  drawWrappedBox(ctx, text, x, y, maxW, maxH, { font, color, lineHeight, align = 'left' }) {
    ctx.font = font;
    ctx.textBaseline = 'top';
    ctx.textAlign = align;
    const paragraphs = String(text).split('\n');
    let curY = y;
    const drawX = align === 'center' ? x + maxW / 2 : x;

    for (const para of paragraphs) {
      if (!para.trim()) {
        curY += Math.round(lineHeight * 0.55);
        continue;
      }
      const words = para.split(/\s+/);
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxW && line) {
          if (curY + lineHeight <= y + maxH + 6) {
            ctx.fillStyle = '#000000';
            ctx.fillText(line, drawX + 2, curY + 2);
            ctx.fillStyle = color;
            ctx.fillText(line, drawX, curY);
          }
          curY += lineHeight;
          line = word;
        } else {
          line = test;
        }
      }
      if (line && curY + lineHeight <= y + maxH + 6) {
        ctx.fillStyle = '#000000';
        ctx.fillText(line, drawX + 2, curY + 2);
        ctx.fillStyle = color;
        ctx.fillText(line, drawX, curY);
        curY += lineHeight;
      }
    }
    return curY;
  }
}
