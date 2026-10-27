// Authentic 1996 Road Rash 640x480 Frontend UI (matching frontend.cpp::draw_scale1)
import { MUSIC_TRACKS } from './audioEngine.js';

const SAVE_STORAGE_KEY = 'roadrash_96_biggame_v2';

export const COURSE_DEFS = [
  { id: 0, key: 'CITY', post: 'city', qpost: 'qcity', nameSlot: 16, descSlot: 21 },
  { id: 1, key: 'HIWAY', post: 'sierra', qpost: 'qsierra', nameSlot: 17, descSlot: 22 },
  { id: 2, key: 'MEDLY', post: 'penin', qpost: 'qpenin', nameSlot: 18, descSlot: 23 },
  { id: 3, key: 'NAPA', post: 'napa', qpost: 'qnapa', nameSlot: 19, descSlot: 24 },
  { id: 4, key: 'CANYN', post: 'pch', qpost: 'qpch', nameSlot: 20, descSlot: 25 }
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

// Showroom slots 0..14 -> internal bikeId + UI image paths
export const SHOWROOM_BIKES = [
  // Rat Bikes (showroom 0)
  { slot: 0, bikeId: 0, cls: 'rat', slug: 'banzai', nameSlot: 128, shortSlot: 96, subSlot: 112, descSlot: 144 },
  { slot: 1, bikeId: 1, cls: 'rat', slug: 'corsair', nameSlot: 129, shortSlot: 97, subSlot: 113, descSlot: 145 },
  { slot: 2, bikeId: 2, cls: 'rat', slug: 'kamikaze', nameSlot: 130, shortSlot: 98, subSlot: 114, descSlot: 146 },
  { slot: 3, bikeId: 4, cls: 'rat', slug: 'perro', nameSlot: 131, shortSlot: 99, subSlot: 115, descSlot: 147 },
  { slot: 4, bikeId: 3, cls: 'rat', slug: 'killer', nameSlot: 132, shortSlot: 100, subSlot: 116, descSlot: 148 },
  // Sport Bikes (showroom 1)
  { slot: 5, bikeId: 10, cls: 'sport', slug: 'diablo', nameSlot: 133, shortSlot: 101, subSlot: 117, descSlot: 149 },
  { slot: 6, bikeId: 12, cls: 'sport', slug: 'kamikaze', nameSlot: 134, shortSlot: 102, subSlot: 118, descSlot: 150 },
  { slot: 7, bikeId: 14, cls: 'sport', slug: 'stiletto', nameSlot: 135, shortSlot: 103, subSlot: 119, descSlot: 151 },
  { slot: 8, bikeId: 11, cls: 'sport', slug: 'dmg', nameSlot: 136, shortSlot: 104, subSlot: 120, descSlot: 152 },
  { slot: 9, bikeId: 13, cls: 'sport', slug: 'perro', nameSlot: 137, shortSlot: 105, subSlot: 121, descSlot: 153 },
  // Super Bikes (showroom 2)
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
  constructor(assets, audio, onStartRace) {
    this.assets = assets;
    this.audio = audio;
    this.onStartRace = onStartRace;

    this.screen = 'splash';
    this.returnScreen = 'main';
    this.focus = 0;
    this.mode = 'thrash'; // 'thrash' | 'biggame'

    // Thrash settings
    this.thrashLevel = 0; // 0..4 -> Level 1..5
    this.thrashCourse = 0; // 0..4

    // Big Game persistent state
    this.career = this.loadCareer() || this.createCareer(0);

    // Showroom / Schmooze / Result transient state
    this.showroomClass = 0; // 0=rat, 1=sport, 2=super
    this.inspectSlot = 0;
    this.noticeTitle = '';
    this.noticeBody = '';
    this.noticeNext = 'street';
    this.schmoozeChar = 0;
    this.schmoozeMood = 'f';
    this.schmoozeText = '';
    this.restroomBg = 'restroom/rest1.jpg';
    this.lastRaceResult = null;
    this.loadingInfo = null;

    this.hitRects = [];
  }

  createCareer(charIdx = 0) {
    const ch = CHAR_DEFS[charIdx] || CHAR_DEFS[0];
    const cashArr = this.assets.frontend?.career?.startCash || [500, 200, 500, 1000, 400, 750, 800, 600, 500];
    const cash = cashArr[ch.cashIdx] ?? 500;
    return {
      active: false,
      charIdx: ch.id,
      playerName: this.assets.str(ch.nameSlot) || 'Axle',
      level: 0, // 0..4 (Level 1..5)
      bikeId: ch.startBike,
      cash,
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

  courseMiles(level, courseId) {
    const arr = this.assets.frontend?.courseLength;
    const raw = arr ? arr[level * 5 + courseId] : 55;
    return (raw / 10).toFixed(1);
  }

  go(nextScreen, defaultFocus = 0) {
    this.screen = nextScreen;
    this.focus = defaultFocus;
    if (nextScreen === 'restroom' || nextScreen === 'jukebox') {
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
    } else if (nextScreen === 'thrash_tracks' || nextScreen === 'biggame_tracks') {
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

    // Pull authentic 900-series schmooze strings from frontend.json
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

  // ==================== MENU DEFINITIONS ====================

  currentMenuSpec() {
    const S = (id) => this.assets.str(id);

    if (this.screen === 'splash') {
      return { bg: 'splash.jpg', items: [] };
    }

    if (this.screen === 'main') {
      const hasSave = Boolean(this.career?.active);
      return {
        bg: 'main.jpg',
        titleRect: [20, 15, 294, 156],
        title: 'Road Rash',
        descRect: [20, 186, 294, 279],
        items: [
          {
            rect: [338, 254, 282, 30],
            label: S(2) || 'Thrash Mode',
            desc: S(3),
            action: () => {
              this.mode = 'thrash';
              this.go('thrash_tracks', this.thrashCourse);
            }
          },
          {
            rect: [338, 298, 282, 30],
            label: hasSave ? `${S(4)} (Lv.${this.career.level + 1})` : S(4) || 'Big Game Mode',
            desc: hasSave
              ? `Continue ${this.career.playerName}'s Big Game career ($${this.career.cash.toLocaleString()}, Level ${this.career.level + 1}) or start fresh from Restroom.`
              : S(5),
            action: () => {
              this.mode = 'biggame';
              if (this.career.active) {
                this.go('street', 0);
              } else {
                this.go('char_select', 0);
              }
            }
          },
          {
            rect: [338, 342, 282, 30],
            label: 'Controls & Combat',
            desc: 'Master punches, club/chain weapon snatching, lateral boot-kick shoves, pedestrians & downed-bike ramp jumps.',
            action: () => {
              this.returnScreen = 'main';
              this.go('help', 0);
            }
          },
          {
            rect: [338, 386, 282, 30],
            label: S(6) || 'Restroom',
            desc: S(7),
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
        titleRect: [20, 15, 600, 76],
        title: 'Road Rash Rules',
        customBody: [
          'STEERING & THROTTLE: Arrow Keys or W/A/S/D. Hold UP/W for gas, DOWN/S for brakes.',
          'MELEE COMBAT (Z = Left, C = Right): Punch & backhand rivals to drain their stamina meter!',
          'WEAPON SNATCHING: Time a punch right as a club- or chain-wielding biker winds up to steal their weapon!',
          'BOOT KICK SHOVE (X): Physically shoves rival bikes sideways across lanes into oncoming cars, buildings & signs!',
          'PEDESTRIANS & FALLEN RIDERS: Clip jaywalkers or crashed bikers sprinting back to their bikes!',
          'DOWNED-BIKE RAMPS: Crashed motorcycles on the road act as physical ramps — hit straight to launch airborne!',
          'SUPERBIKE NITRO: Press SPACE (or N) on Nitro-equipped bikes for an explosive burst of top speed!'
        ],
        items: [
          {
            rect: [200, 424, 240, 32],
            label: S(86) || 'Done',
            desc: '',
            action: () => this.go(this.returnScreen || 'main', 0)
          }
        ]
      };
    }

    if (this.screen === 'char_select') {
      const ch = CHAR_DEFS[this.focus] || CHAR_DEFS[0];
      const st = this.assets.frontend?.riderStats?.[ch.statsIdx] || { height: 72, weight: 175 };
      const ft = Math.floor(st.height / 12);
      const inch = st.height % 12;
      const bikeName = S(bikeDefById(ch.startBike).nameSlot);
      const cashArr = this.assets.frontend?.career?.startCash || [500, 200, 500, 1000, 400, 750, 800, 600, 500];
      const cash = cashArr[ch.cashIdx] ?? 500;
      const rawBio = S(ch.bioSlot)
        .replace('%s', `${ft}'${inch}"`)
        .replace('%s', `${st.weight} lbs`)
        .replace('%s', bikeName)
        .replace('%d', String(cash));

      return {
        bg: `chars/${ch.slug}-n.jpg`,
        titleRect: [20, 15, 344, 78],
        title: S(78) || 'Select Character',
        descRect: [20, 108, 344, 357],
        descFontSize: 22,
        items: CHAR_DEFS.map((c) => ({
          rect: [380, 108 + c.id * 45, 240, 30],
          label: S(c.nameSlot),
          desc: rawBio,
          action: () => {
            this.career = this.createCareer(c.id);
            this.saveCareer();
            this.go('street', 0);
          }
        }))
      };
    }

    if (this.screen === 'street') {
      const overlays = ['street/klub.jpg', 'street/olley.jpg', 'street/home.jpg'];
      return {
        bg: 'street.jpg',
        overlay: { path: overlays[this.focus] || overlays[0], x: 146, y: 230 },
        statusBanner: `${this.career.playerName}  •  Level ${this.career.level + 1}  •  $${this.career.cash.toLocaleString()}  •  ${S(bikeDefById(this.career.bikeId).nameSlot)}`,
        descRect: [20, 48, 360, 172],
        items: [
          {
            rect: [400, 48, 220, 30],
            label: S(48) || 'Der Panzer Klub',
            desc: S(49),
            action: () => this.go('panzer', 2)
          },
          {
            rect: [400, 92, 220, 30],
            label: S(50) || "Olley's Skoot-A-Rama",
            desc: S(51),
            action: () => this.go('olleys', 0)
          },
          {
            rect: [400, 136, 220, 30],
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

    if (this.screen === 'panzer') {
      return {
        bg: 'panzer.jpg',
        titleRect: [20, 15, 344, 78],
        title: S(48) || 'Der Panzer Klub',
        descRect: [20, 110, 344, 345],
        items: [
          {
            rect: [390, 254, 230, 30],
            label: S(52) || 'Schmooze',
            desc: S(53),
            action: () => {
              this.pickSchmooze();
              this.go('schmooze', 0);
            }
          },
          {
            rect: [390, 298, 230, 30],
            label: S(6) || 'Restroom',
            desc: S(7),
            action: () => {
              this.returnScreen = 'panzer';
              this.go('restroom', 0);
            }
          },
          {
            rect: [390, 342, 230, 30],
            label: S(54) || 'Bulletin Board',
            desc: S(55),
            action: () => {
              const firstUnq = this.career.qualified.findIndex((q) => !q);
              this.go('biggame_tracks', firstUnq >= 0 ? firstUnq : 0);
            }
          },
          {
            rect: [390, 386, 230, 30],
            label: S(56) || 'The Street',
            desc: S(57),
            action: () => this.go('street', 0)
          }
        ]
      };
    }

    if (this.screen === 'schmooze') {
      const ch = CHAR_DEFS[this.schmoozeChar] || CHAR_DEFS[0];
      return {
        bg: `chars/${ch.slug}-${this.schmoozeMood}.jpg`,
        titleRect: [20, 15, 360, 72],
        title: S(ch.nameSlot),
        descRect: [20, 290, 600, 118],
        descFontSize: 26,
        items: [
          {
            rect: [180, 424, 130, 30],
            label: 'Talk Again',
            desc: `“${this.schmoozeText}”`,
            action: () => this.pickSchmooze()
          },
          {
            rect: [330, 424, 130, 30],
            label: S(86) || 'Done',
            desc: `“${this.schmoozeText}”`,
            action: () => this.go('panzer', 0)
          }
        ]
      };
    }

    if (this.screen === 'olleys') {
      return {
        bg: 'olleys.jpg',
        titleRect: [20, 15, 344, 78],
        title: S(90) || 'Showroom',
        descRect: [20, 108, 344, 345],
        items: [
          {
            rect: [390, 260, 230, 30],
            label: S(58) || 'Rat Bikes',
            desc: `${S(59)}\n\nCash: $${this.career.cash.toLocaleString()}  •  Trade-in: +$${this.tradeInValue().toLocaleString()}`,
            action: () => {
              this.showroomClass = 0;
              this.preloadShowroom(0);
              this.go('showroom', 0);
            }
          },
          {
            rect: [390, 304, 230, 30],
            label: S(60) || 'Sport Bikes',
            desc: `${S(61)}\n\nCash: $${this.career.cash.toLocaleString()}  •  Trade-in: +$${this.tradeInValue().toLocaleString()}`,
            action: () => {
              this.showroomClass = 1;
              this.preloadShowroom(1);
              this.go('showroom', 0);
            }
          },
          {
            rect: [390, 348, 230, 30],
            label: S(62) || 'Super Bikes',
            desc: `${S(63)}\n\nCash: $${this.career.cash.toLocaleString()}  •  Trade-in: +$${this.tradeInValue().toLocaleString()}`,
            action: () => {
              this.showroomClass = 2;
              this.preloadShowroom(2);
              this.go('showroom', 0);
            }
          },
          {
            rect: [390, 392, 230, 30],
            label: S(56) || 'The Street',
            desc: S(57),
            action: () => this.go('street', 1)
          }
        ]
      };
    }

    if (this.screen === 'showroom') {
      const clsNames = ['rat', 'sport', 'super'];
      const clsKey = clsNames[this.showroomClass] || 'rat';
      const baseSlot = this.showroomClass * 5;
      const bikes = SHOWROOM_BIKES.slice(baseSlot, baseSlot + 5);
      const focusedBike = this.focus < 5 ? bikes[this.focus] : null;
      const bg = focusedBike
        ? `showroom/${clsKey}/${focusedBike.slug}.jpg`
        : `showroom/${clsKey}/bikes.jpg`;

      const ownedDef = bikeDefById(this.career.bikeId);
      const buyingPower = this.career.cash + this.tradeInValue();

      return {
        bg,
        statusBanner: `Cash: $${this.career.cash.toLocaleString()}  •  Trade: $${this.tradeInValue().toLocaleString()}  •  Bike: ${S(ownedDef.nameSlot)}`,
        descRect: [20, 336, 370, 124],
        descFontSize: 20,
        items: [
          ...bikes.map((b) => {
            const price = this.bikePrice(b.bikeId);
            const tag = b.bikeId === this.career.bikeId ? ' [OWNED]' : '';
            return {
              rect: [404, 210 + (b.slot - baseSlot) * 40, 220, 30],
              label: `${S(b.shortSlot)} ${S(b.subSlot)}${tag}`,
              desc: `${S(b.nameSlot)}\nPrice: $${price.toLocaleString()} (Buying Power: $${buyingPower.toLocaleString()})`,
              action: () => {
                this.inspectSlot = b.slot;
                this.assets.preloadUI(`bikes/${b.cls}/${b.slug}.jpg`);
                this.go('bike_inspect', 0);
              }
            };
          }),
          {
            rect: [404, 418, 220, 30],
            label: S(218) || 'Exit',
            desc: 'Return to Olley’s showroom entrance.',
            action: () => this.go('olleys', this.showroomClass)
          }
        ]
      };
    }

    if (this.screen === 'bike_inspect') {
      const b = SHOWROOM_BIKES[this.inspectSlot] || SHOWROOM_BIKES[0];
      const price = this.bikePrice(b.bikeId);
      const netCost = price - this.tradeInValue();
      return {
        bg: `bikes/${b.cls}/${b.slug}.jpg`,
        titleRect: [20, 15, 600, 66],
        title: S(b.nameSlot),
        titleFontSize: 44,
        descRect: [20, 294, 430, 166],
        descFontSize: 20,
        items: [
          {
            rect: [468, 364, 152, 32],
            label: S(217) || 'Buy',
            desc: `${S(b.descSlot)}\nPrice: $${price.toLocaleString()}  •  Net w/ Trade: $${Math.max(0, netCost).toLocaleString()}`,
            action: () => this.tryBuyBike(b)
          },
          {
            rect: [468, 412, 152, 32],
            label: S(218) || 'Exit',
            desc: `${S(b.descSlot)}\nPrice: $${price.toLocaleString()}  •  Cash: $${this.career.cash.toLocaleString()}`,
            action: () => this.go('showroom', this.inspectSlot % 5)
          }
        ]
      };
    }

    if (this.screen === 'notice') {
      return {
        bg: 'olleys.jpg',
        titleRect: [40, 80, 560, 82],
        title: this.noticeTitle,
        descRect: [40, 184, 560, 160],
        items: [
          {
            rect: [220, 378, 200, 34],
            label: S(205) || 'OK',
            desc: this.noticeBody,
            action: () => this.go(this.noticeNext, 0)
          }
        ]
      };
    }

    if (this.screen === 'thrash_tracks' || this.screen === 'biggame_tracks') {
      const isBig = this.screen === 'biggame_tracks';
      const level = isBig ? this.career.level : this.thrashLevel;
      const focusedCourse = this.focus < 5 ? COURSE_DEFS[this.focus] : null;

      let rightPost = isBig ? 'postcard/klub.jpg' : 'postcard/resta.jpg';
      if (focusedCourse) {
        const qual = isBig && this.career.qualified[focusedCourse.id];
        rightPost = `postcard/${qual ? focusedCourse.qpost : focusedCourse.post}.jpg`;
      }

      return {
        bg: 'postcard.jpg',
        overlay: { path: rightPost, x: 243, y: 0 },
        descRect: [20, 18, 212, 212],
        descFontSize: 20,
        items: [
          ...COURSE_DEFS.map((c) => {
            const qual = isBig && this.career.qualified[c.id];
            const miles = this.courseMiles(level, c.id);
            const rawDesc = S(c.descSlot).replace(/\n+/g, '\n');
            return {
              rect: [14, 244 + c.id * 36, 220, 28],
              label: `${S(c.nameSlot)}${qual ? ' ★' : ''}`,
              desc: `Level ${level + 1} • ${miles} ${S(27)}\n${rawDesc.split('Length')[0].trim()}`,
              action: () => {
                if (!isBig) this.thrashCourse = c.id;
                this.launchRace(c.id);
              }
            };
          }),
          {
            rect: [14, 430, 220, 30],
            label: isBig ? S(48) || 'Der Panzer Klub' : S(6) || 'Restroom / Back',
            desc: isBig ? 'Return to Der Panzer Klub.' : 'Change Thrash Level or return to Main Menu.',
            action: () => {
              if (isBig) this.go('panzer', 2);
              else this.go('main', 0);
            }
          }
        ]
      };
    }

    if (this.screen === 'restroom') {
      const trackName = MUSIC_TRACKS[this.audio.currentTrackIndex] || 'GRUNGE1';
      return {
        bg: this.restroomBg,
        titleRect: [20, 15, 344, 78],
        title: S(6) || 'Restroom',
        descRect: [20, 108, 344, 345],
        items: [
          {
            rect: [376, 150, 248, 30],
            label: `Thrash Level: ${this.thrashLevel + 1}`,
            desc: S(75),
            action: () => {
              this.thrashLevel = (this.thrashLevel + 1) % 5;
            }
          },
          {
            rect: [376, 194, 248, 30],
            label: `Jukebox: ${trackName}`,
            desc: S(81),
            action: () => {
              this.audio.nextMusicTrack();
            }
          },
          {
            rect: [376, 238, 248, 30],
            label: `Music: ${this.audio.musicEnabled ? 'ON' : 'OFF'}`,
            desc: 'Toggle 1996 SoundFont Grunge Rock soundtrack.',
            action: () => {
              this.audio.toggleMusic();
            }
          },
          {
            rect: [376, 282, 248, 30],
            label: `SFX: ${this.audio.sfxEnabled ? 'ON' : 'OFF'}`,
            desc: 'Toggle motorcycle engines, sirens, crashes & voices.',
            action: () => {
              this.audio.toggleSfx();
            }
          },
          {
            rect: [376, 326, 248, 30],
            label: 'New Big Game Career',
            desc: 'Start a fresh Big Game career with a new character.',
            action: () => {
              this.resetCareer();
              this.mode = 'biggame';
              this.go('char_select', 0);
            }
          },
          {
            rect: [376, 370, 248, 30],
            label: 'Controls & Rules',
            desc: 'View keyboard controls and OG Road Rash combat mechanics.',
            action: () => {
              this.go('help', 0);
            }
          },
          {
            rect: [376, 414, 248, 30],
            label: S(86) || 'Done',
            desc: S(87),
            action: () => this.go(this.returnScreen || 'main', 0)
          }
        ]
      };
    }

    if (this.screen === 'loading') {
      const ch = CHAR_DEFS[this.mode === 'biggame' ? this.career.charIdx : 0] || CHAR_DEFS[0];
      return {
        bg: `chars/${ch.slug}-f.jpg`,
        titleRect: [40, 150, 560, 86],
        title: S(206) || 'GAME LOADING',
        descRect: [120, 256, 400, 90],
        items: [],
        fixedDesc: `${this.loadingInfo?.courseName || ''}\n${S(207) || 'Get ready to race!'}`
      };
    }

    if (this.screen === 'post_race') {
      const r = this.lastRaceResult || {};
      return {
        bg: r.art || 'results/win1.jpg',
        titleRect: [20, 14, 600, 74],
        title: r.headline || 'WINNER!',
        descRect: [20, 326, 420, 134],
        descFontSize: 22,
        items: [
          {
            rect: [456, 396, 164, 36],
            label: 'Standings',
            desc: r.message || '',
            action: () => this.go('standings', 0)
          }
        ]
      };
    }

    if (this.screen === 'standings') {
      const r = this.lastRaceResult || {};
      return {
        bg: r.art || 'results/win1.jpg',
        titleRect: [20, 10, 600, 62],
        title: S(183) || 'Race Results',
        titleFontSize: 48,
        standings: r.standings || [],
        items: [
          {
            rect: [210, 434, 220, 32],
            label: 'Continue',
            desc: '',
            action: () => {
              if (this.mode === 'biggame') {
                if (r.gameOver) {
                  this.resetCareer();
                  this.go('main', 1);
                } else {
                  this.go('panzer', 2);
                }
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
      this.noticeBody = S(188) || 'You already own this bike.';
      this.noticeNext = 'showroom';
      this.go('notice', 0);
      return;
    }
    const price = this.bikePrice(b.bikeId);
    const netCost = price - this.tradeInValue();
    if (this.career.cash < netCost) {
      this.noticeTitle = S(185) || 'IN YOUR DREAMS!';
      this.noticeBody = `${S(186)}\nNeed $${netCost.toLocaleString()} after trade-in (you have $${this.career.cash.toLocaleString()}).`;
      this.noticeNext = 'showroom';
      this.go('notice', 0);
      return;
    }
    this.career.cash -= netCost;
    this.career.bikeId = b.bikeId;
    this.saveCareer();
    this.audio.playSfx('m_yeah', { volume: 0.9 });
    this.noticeTitle = S(189) || 'CONGRATULATIONS!';
    this.noticeBody = `${S(190)}\nNew Ride: ${S(b.nameSlot)} • Cash Left: $${this.career.cash.toLocaleString()}`;
    this.noticeNext = 'street';
    this.go('notice', 0);
  }

  launchRace(courseId) {
    const cdef = COURSE_DEFS[courseId] || COURSE_DEFS[0];
    const isBig = this.mode === 'biggame';
    const level = isBig ? this.career.level : this.thrashLevel;
    const ch = CHAR_DEFS[isBig ? this.career.charIdx : 0] || CHAR_DEFS[0];

    // Thrash bike picks from career.levelBike table just like 1996 Road Rash
    const lvlBikes = [1, 0, 12, 6, 9];
    const bikeId = isBig ? this.career.bikeId : lvlBikes[level] ?? 1;
    const playerName = isBig ? this.career.playerName : this.assets.str(ch.nameSlot) || 'Axle';

    this.loadingInfo = {
      courseName: `${this.assets.str(cdef.nameSlot)} — Level ${level + 1}`
    };
    this.go('loading', 0);

    setTimeout(() => {
      this.onStartRace({
        mode: this.mode,
        level,
        courseId,
        courseKey: cdef.key,
        courseName: this.assets.str(cdef.nameSlot),
        bikeId,
        playerName,
        female: ch.female,
        charIdx: ch.id
      });
    }, 120);
  }

  handleRaceFinished(outcome) {
    // outcome: { status: 'finished'|'wrecked'|'busted', place, courseId, standings }
    const S = (id) => this.assets.str(id);
    const pick6 = (prefix) => {
      const p = `results/${prefix}${1 + Math.floor(Math.random() * 6)}.jpg`;
      this.assets.preloadUI(p);
      return p;
    };

    const isBig = this.mode === 'biggame';
    const level = isBig ? this.career.level : this.thrashLevel;
    const prizes = this.assets.frontend?.career?.prize || [1000, 750, 500, 400, 300, 250, 200, 160, 130, 100, 70, 50, 30, 20, 10];
    const levelMult = [1, 2, 4, 8, 15][level] || 1;

    let art = 'results/win1.jpg';
    let headline = S(178) || 'WINNER!';
    let message = '';
    let gameOver = false;

    if (outcome.status === 'wrecked') {
      art = pick6('wreck');
      headline = S(176) || 'WRECKED!';
      const repair = Math.max(80, Math.floor(this.bikePrice(isBig ? this.career.bikeId : 1) * 0.12));
      if (isBig) {
        if (this.career.cash < repair) {
          headline = S(182) || 'TOTALLED!';
          message = `${S(198)}\nRepair bill was $${repair.toLocaleString()}.`;
          gameOver = true;
        } else {
          this.career.cash -= repair;
          message = `${S(192)}\nRepair Bill: $${repair.toLocaleString()} • Cash Left: $${this.career.cash.toLocaleString()}`;
          this.saveCareer();
        }
      } else {
        message = S(192);
      }
    } else if (outcome.status === 'busted') {
      art = pick6('bust');
      headline = S(177) || 'BUSTED!';
      const fine = 150 * levelMult;
      if (isBig) {
        if (this.career.cash < fine) {
          message = `${S(198)}\nPolice fine was $${fine.toLocaleString()}.`;
          gameOver = true;
        } else {
          this.career.cash -= fine;
          message = `${S(195)}\nPolice Fine: $${fine.toLocaleString()} • Cash Left: $${this.career.cash.toLocaleString()}`;
          this.saveCareer();
        }
      } else {
        message = S(195);
      }
    } else {
      // Finished race!
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
        message = `${placeStr}\nPrize Purse: +$${purse.toLocaleString()}`;

        if (isBig) {
          this.career.cash += purse;
          this.career.wins += 1;
          this.career.qualified[outcome.courseId] = true;
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

  // ==================== INPUT HANDLING ====================

  onKeyDown(e) {
    this.audio.ensureContext();
    if (this.screen === 'splash') {
      this.audio.playSfx('punchhea', { volume: 0.65 });
      this.audio.playMusicTrack('KLOWN');
      this.go('main', 0);
      e.preventDefault();
      return;
    }

    const spec = this.currentMenuSpec();
    const count = spec.items?.length || 0;
    if (!count) return;

    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      this.focus = (this.focus - 1 + count) % count;
      this.audio.playSfx('swishgen', { volume: 0.45, rate: 1.3 });
      e.preventDefault();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      this.focus = (this.focus + 1) % count;
      this.audio.playSfx('swishgen', { volume: 0.45, rate: 1.3 });
      e.preventDefault();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      this.audio.playSfx('punchlig', { volume: 0.6 });
      spec.items[this.focus]?.action();
      e.preventDefault();
    } else if (e.code === 'Escape' || e.code === 'Backspace') {
      if (this.screen !== 'main') {
        this.audio.playSfx('swishgen', { volume: 0.45, rate: 0.9 });
        spec.items[count - 1]?.action();
      }
      e.preventDefault();
    }
  }

  onPointerMove(x640, y480) {
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

  onPointerClick(x640, y480) {
    this.audio.ensureContext();
    if (this.screen === 'splash') {
      this.audio.playSfx('punchhea', { volume: 0.65 });
      this.audio.playMusicTrack('KLOWN');
      this.go('main', 0);
      return;
    }

    const spec = this.currentMenuSpec();
    for (let i = 0; i < this.hitRects.length; i++) {
      const [rx, ry, rw, rh] = this.hitRects[i];
      if (x640 >= rx && x640 <= rx + rw && y480 >= ry && y480 <= ry + rh) {
        this.focus = i;
        this.audio.playSfx('punchlig', { volume: 0.6 });
        spec.items[i]?.action();
        return;
      }
    }
  }

  // ==================== 640x480 RENDERING (draw_scale1) ====================

  render(ctx) {
    ctx.save();
    ctx.clearRect(0, 0, 640, 480);

    const spec = this.currentMenuSpec();
    const bgAsset = this.assets.getUI(spec.bg);

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

    if (this.screen === 'splash') {
      // Subtle pulsing prompt at bottom of splash.jpg
      const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.005);
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(140, 434, 360, 32);
      ctx.font = '20px RRFuturaBold, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText('CLICK OR PRESS ANY KEY TO RIDE', 322, 452);
      ctx.fillStyle = `rgba(225, 225, 128, ${pulse.toFixed(2)})`;
      ctx.fillText('CLICK OR PRESS ANY KEY TO RIDE', 320, 450);
      ctx.restore();
      return;
    }

    const drawDarkRect = (x, y, w, h) => {
      if (bgAsset?.dark && !spec.overlay) {
        ctx.drawImage(bgAsset.dark, x, y, w, h, x, y, w, h);
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.56)';
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };

    // Optional top status strip (Street / Showroom)
    if (spec.statusBanner) {
      drawDarkRect(16, 10, 608, 28);
      this.drawShadowText(ctx, spec.statusBanner, 26, 15, '17px RRFuturaDemi, sans-serif', '#e1e180');
    }

    // Title box (Badloc orange #ff6432 with 2px black drop shadow)
    if (spec.title && spec.titleRect) {
      const [tx, ty, tw, th] = spec.titleRect;
      drawDarkRect(tx, ty, tw, th);
      const tSize = spec.titleFontSize || 52;
      this.drawWrappedBox(ctx, spec.title, tx + 10, ty + 8, tw - 20, th - 12, {
        font: `${tSize}px RRBadloc, sans-serif`,
        color: '#ff6432',
        lineHeight: tSize * 0.96,
        align: 'center'
      });
    }

    // Description box (#defff0 Futura Regular/Demi)
    const focusedItem = spec.items?.[this.focus];
    const descText = spec.fixedDesc || focusedItem?.desc || '';
    if (descText && spec.descRect) {
      const [dx, dy, dw, dh] = spec.descRect;
      drawDarkRect(dx, dy, dw, dh);
      const fSize = spec.descFontSize || 22;
      this.drawWrappedBox(ctx, descText, dx + 10, dy + 8, dw - 20, dh - 14, {
        font: `${fSize}px RRFuturaRegular, sans-serif`,
        color: '#defff0',
        lineHeight: Math.round(fSize * 1.18),
        align: 'left'
      });
    }

    // Custom Help screen list
    if (spec.customBody) {
      drawDarkRect(20, 102, 600, 308);
      let cy = 114;
      for (const bullet of spec.customBody) {
        cy = this.drawWrappedBox(ctx, '• ' + bullet, 32, cy, 576, 60, {
          font: '17px RRFuturaDemi, sans-serif',
          color: '#defff0',
          lineHeight: 20,
          align: 'left'
        }) + 5;
      }
    }

    // Standings table (15 riders)
    if (spec.standings) {
      drawDarkRect(24, 80, 592, 342);
      const rows = spec.standings;
      ctx.font = '16px RRFuturaBold, sans-serif';
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const col = i < 8 ? 0 : 1;
        const r = i % 8;
        const rx = col === 0 ? 40 : 334;
        const ry = 94 + r * 39;
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
          rx + 185,
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
        if (isFocused) {
          // Right-pointing yellow arrow with 2px black drop shadow at (bx + 6, by + 6)
          this.drawFocusArrow(ctx, bx + 8, by + Math.floor((bh - 16) / 2));
        }
        this.drawShadowText(
          ctx,
          it.label,
          bx + 26,
          by + Math.floor((bh - 20) / 2),
          '20px RRFuturaBold, sans-serif',
          labelColor
        );
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
