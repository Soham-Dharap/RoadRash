// Authentic 1996 PC Road Rash-inspired Bikes, Rashers, Rivals, and Weapons

export const WEAPONS = {
  fist: {
    id: 'fist',
    name: 'Bare Fist',
    damage: 14,
    shove: 1.4,
    reach: 2.35,
    windup: 0.11,
    active: 0.14,
    cooldown: 0.20,
    color: '#e5e7eb'
  },
  backhand: {
    id: 'backhand',
    name: 'Backhand',
    damage: 18,
    shove: 2.0,
    reach: 2.45,
    windup: 0.13,
    active: 0.15,
    cooldown: 0.24,
    color: '#f3f4f6'
  },
  kick: {
    id: 'kick',
    name: 'Side Kick',
    damage: 13,
    shove: 12.8, // Huge lateral bike shove across lanes into oncoming cars, guardrails, or poles!
    reach: 2.85,
    windup: 0.11,
    active: 0.18,
    cooldown: 0.25,
    color: '#fbbf24'
  },
  club: {
    id: 'club',
    name: 'Oak Club',
    damage: 32,
    shove: 3.4,
    reach: 2.85,
    windup: 0.22, // Window where opponent can punch to SNATCH the weapon!
    active: 0.17,
    cooldown: 0.30,
    color: '#b45309'
  },
  chain: {
    id: 'chain',
    name: 'Steel Chain',
    damage: 36,
    shove: 3.0,
    reach: 3.15,
    windup: 0.24,
    active: 0.18,
    cooldown: 0.32,
    color: '#cbd5e1'
  },
  crowbar: {
    id: 'crowbar',
    name: 'Crowbar',
    damage: 40,
    shove: 4.2,
    reach: 2.8,
    windup: 0.25,
    active: 0.17,
    cooldown: 0.34,
    color: '#64748b'
  },
  nunchaku: {
    id: 'nunchaku',
    name: 'Nunchaku',
    damage: 34,
    shove: 2.8,
    reach: 2.75,
    windup: 0.18,
    active: 0.16,
    cooldown: 0.24,
    color: '#d97706'
  }
};

export const BIKES = [
  // RAT CLASS (5 bikes)
  {
    id: 'rat_1',
    name: 'Scavenger 250',
    class: 'Rat',
    price: 1800,
    topSpeedKmh: 205,
    accel: 34,
    handling: 1.08,
    durability: 115,
    weight: 0.92,
    nitroCharges: 0,
    color: '#c81e1e',
    accent: '#1f2937',
    desc: 'Light street brawler. Easy to throw into tight city corners and cheap to fix.'
  },
  {
    id: 'rat_2',
    name: 'Perro 400',
    class: 'Rat',
    price: 2900,
    topSpeedKmh: 218,
    accel: 37,
    handling: 1.05,
    durability: 120,
    weight: 0.98,
    nitroCharges: 0,
    color: '#2563eb',
    accent: '#cbd5e1',
    desc: 'Stiffened steel frame absorbs traffic scrapes and rough shoulder landings.'
  },
  {
    id: 'rat_3',
    name: 'Kahuna 500',
    class: 'Rat',
    price: 4200,
    topSpeedKmh: 232,
    accel: 40,
    handling: 1.03,
    durability: 125,
    weight: 1.02,
    nitroCharges: 0,
    color: '#7e22ce',
    accent: '#d946ef',
    desc: 'The iconic purple street-fighter. Balanced punch, planted rear tire, heavy kick leverage.'
  },
  {
    id: 'rat_4',
    name: 'Banzai 600',
    class: 'Rat',
    price: 5800,
    topSpeedKmh: 244,
    accel: 43,
    handling: 1.0,
    durability: 130,
    weight: 1.06,
    nitroCharges: 0,
    color: '#16a34a',
    accent: '#facc15',
    desc: 'Bored-out inline four with aggressive mid-range pull up steep coastal hills.'
  },
  {
    id: 'rat_5',
    name: 'Stiletto 650',
    class: 'Rat',
    price: 7600,
    topSpeedKmh: 256,
    accel: 46,
    handling: 1.02,
    durability: 135,
    weight: 1.1,
    nitroCharges: 2,
    color: '#dc2626',
    accent: '#f8fafc',
    desc: 'Top of the Rat pile, sneaking two emergency N2O bottles under the seat.'
  },

  // SPORT CLASS (5 bikes)
  {
    id: 'sport_1',
    name: 'Razor 600RR',
    class: 'Sport',
    price: 10500,
    topSpeedKmh: 266,
    accel: 49,
    handling: 1.15,
    durability: 115,
    weight: 0.96,
    nitroCharges: 3,
    color: '#eab308',
    accent: '#7c3aed',
    desc: 'Track-bred twin-spar chassis that carves hairpins without washing out.'
  },
  {
    id: 'sport_2',
    name: 'Tsunami 750',
    class: 'Sport',
    price: 14200,
    topSpeedKmh: 278,
    accel: 52,
    handling: 1.14,
    durability: 118,
    weight: 1.0,
    nitroCharges: 4,
    color: '#22c55e',
    accent: '#1d4ed8',
    desc: 'Screaming 12,000 RPM green missile with four shots of nitrous.'
  },
  {
    id: 'sport_3',
    name: 'Vortex 850',
    class: 'Sport',
    price: 18800,
    topSpeedKmh: 288,
    accel: 55,
    handling: 1.12,
    durability: 122,
    weight: 1.03,
    nitroCharges: 5,
    color: '#e11d48',
    accent: '#f1f5f9',
    desc: 'Aero fairing slices headwinds on Pacific Highway with rock-solid jump stability.'
  },
  {
    id: 'sport_4',
    name: 'Fury 900',
    class: 'Sport',
    price: 24000,
    topSpeedKmh: 298,
    accel: 58,
    handling: 1.11,
    durability: 125,
    weight: 1.06,
    nitroCharges: 6,
    color: '#9333ea',
    accent: '#facc15',
    desc: 'Violent throttle response and heavy mass to shrug off rival side-kicks.'
  },
  {
    id: 'sport_5',
    name: 'Kamikaze 1000',
    class: 'Sport',
    price: 30000,
    topSpeedKmh: 308,
    accel: 61,
    handling: 1.1,
    durability: 128,
    weight: 1.08,
    nitroCharges: 6,
    color: '#b91c1c',
    accent: '#fbbf24',
    desc: 'Liter-class street weapon that eats Level 3 & 4 packs alive.'
  },

  // SUPER CLASS (5 bikes)
  {
    id: 'super_1',
    name: 'Diablo 996',
    class: 'Super',
    price: 38000,
    topSpeedKmh: 316,
    accel: 64,
    handling: 1.06,
    durability: 132,
    weight: 1.12,
    nitroCharges: 7,
    color: '#dc2626',
    accent: '#fde047',
    desc: 'Italian V-twin thunder with brutal N2O surge.'
  },
  {
    id: 'super_2',
    name: 'Valkyrie 1100',
    class: 'Super',
    price: 48000,
    topSpeedKmh: 325,
    accel: 67,
    handling: 1.05,
    durability: 136,
    weight: 1.16,
    nitroCharges: 8,
    color: '#0284c7',
    accent: '#e2e8f0',
    desc: 'Heavy highway interceptor built to launch off crests at 300+ km/h.'
  },
  {
    id: 'super_3',
    name: 'Phantom 1150',
    class: 'Super',
    price: 60000,
    topSpeedKmh: 334,
    accel: 70,
    handling: 1.04,
    durability: 140,
    weight: 1.2,
    nitroCharges: 8,
    color: '#1e293b',
    accent: '#ef4444',
    desc: 'Jet-black outlaw missile. Almost impossible to shove off its line.'
  },
  {
    id: 'super_4',
    name: 'Nemesis 1200',
    class: 'Super',
    price: 74000,
    topSpeedKmh: 342,
    accel: 74,
    handling: 1.03,
    durability: 145,
    weight: 1.22,
    nitroCharges: 9,
    color: '#15803d',
    accent: '#a3e635',
    desc: '1200cc monster tuned specifically for Level 5 carnage.'
  },
  {
    id: 'super_5',
    name: 'Blackbird 1300X',
    class: 'Super',
    price: 92000,
    topSpeedKmh: 352,
    accel: 78,
    handling: 1.07,
    durability: 155,
    weight: 1.25,
    nitroCharges: 10,
    color: '#111827',
    accent: '#f59e0b',
    desc: 'The ultimate Road Rash hyperbike. Ten shots of N2O and unmatched top end.'
  }
];

// 8 Classic Big Game Mode Characters (matching iconic 1996 suit colorways!)
export const CHARACTERS = [
  {
    id: 'mike',
    name: 'Mike',
    cash: 2500,
    startBike: 'rat_3', // Iconic purple bike + yellow/magenta leathers from Screenshots 1, 2, 4!
    startWeapon: 'fist',
    suitMain: '#c026d3',
    suitShoulder: '#ca8a04',
    helmetColor: '#a16207',
    pantsColor: '#86198f',
    bio: 'Balanced California street veteran. Starts on the purple Kahuna 500.'
  },
  {
    id: 'axle',
    name: 'Axle',
    cash: 1900,
    startBike: 'rat_1',
    startWeapon: 'chain',
    suitMain: '#dc2626',
    suitShoulder: '#18181b',
    helmetColor: '#cbd5e1',
    pantsColor: '#18181b',
    bio: 'Broke, mean, and carries a heavy steel chain from Mile 0.'
  },
  {
    id: 'natasha',
    name: 'Natasha',
    cash: 4200,
    startBike: 'rat_2',
    startWeapon: 'club',
    suitMain: '#2563eb',
    suitShoulder: '#facc15',
    helmetColor: '#ef4444',
    pantsColor: '#1e3a8a',
    bio: 'Deep bankroll and an oak club tucked on the handlebars.'
  },
  {
    id: 'charley',
    name: 'Charley',
    cash: 3100,
    startBike: 'rat_2',
    startWeapon: 'crowbar',
    suitMain: '#16a34a',
    suitShoulder: '#2563eb',
    helmetColor: '#15803d',
    pantsColor: '#14532d',
    bio: 'Scrapyard mechanic who swings an iron crowbar in traffic.'
  },
  {
    id: 'ikira',
    name: 'Ikira',
    cash: 2200,
    startBike: 'rat_4',
    startWeapon: 'nunchaku',
    suitMain: '#eab308',
    suitShoulder: '#7c3aed',
    helmetColor: '#ca8a04',
    pantsColor: '#581c87',
    bio: 'Starts with the fast Banzai 600 and lightning nunchaku strikes.'
  },
  {
    id: 'rhonda',
    name: 'Rhonda',
    cash: 5000,
    startBike: 'rat_1',
    startWeapon: 'fist',
    suitMain: '#db2777',
    suitShoulder: '#f8fafc',
    helmetColor: '#be185d',
    pantsColor: '#831843',
    bio: 'Highest starting cash—save up one race and jump straight to Sport class.'
  },
  {
    id: 'bose',
    name: 'Bose',
    cash: 2800,
    startBike: 'rat_3',
    startWeapon: 'club',
    suitMain: '#ea580c',
    suitShoulder: '#1f2937',
    helmetColor: '#f97316',
    pantsColor: '#111827',
    bio: 'Heavy-booted bruiser who loves kicking rivals into oncoming sedans.'
  },
  {
    id: 'slim',
    name: 'Slim',
    cash: 3600,
    startBike: 'rat_2',
    startWeapon: 'chain',
    suitMain: '#0d9488',
    suitShoulder: '#fef08a',
    helmetColor: '#0f766e',
    pantsColor: '#134e4a',
    bio: 'Cool-headed canyon runner armed with a long-reach chain.'
  }
];

// 14 Named AI Opponents (including the exact HUD names seen in 1996 PC Road Rash!)
export const AI_RIVALS = [
  { name: 'Charley', suitMain: '#dc2626', suitShoulder: '#18181b', helmetColor: '#cbd5e1', bikeColor: '#dc2626', weapon: 'chain', aggro: 0.85, skill: 0.94 },
  { name: 'Mr. Moby', suitMain: '#16a34a', suitShoulder: '#2563eb', helmetColor: '#15803d', bikeColor: '#22c55e', weapon: 'club', aggro: 0.78, skill: 0.91 },
  { name: 'Axle', suitMain: '#eab308', suitShoulder: '#9333ea', helmetColor: '#a16207', bikeColor: '#7e22ce', weapon: 'crowbar', aggro: 0.92, skill: 0.89 },
  { name: 'Sam', suitMain: '#27272a', suitShoulder: '#71717a', helmetColor: '#52525b', bikeColor: '#ea580c', weapon: 'club', aggro: 0.80, skill: 0.86 },
  { name: 'Natasha', suitMain: '#e11d48', suitShoulder: '#f8fafc', helmetColor: '#be185d', bikeColor: '#e11d48', weapon: 'fist', aggro: 0.68, skill: 0.96 },
  { name: 'Ikira', suitMain: '#2563eb', suitShoulder: '#facc15', helmetColor: '#1d4ed8', bikeColor: '#2563eb', weapon: 'nunchaku', aggro: 0.75, skill: 0.93 },
  { name: 'Viper', suitMain: '#9333ea', suitShoulder: '#fde047', helmetColor: '#6b21a8', bikeColor: '#9333ea', weapon: 'chain', aggro: 0.90, skill: 0.84 },
  { name: 'Bull', suitMain: '#ea580c', suitShoulder: '#18181b', helmetColor: '#9a3412', bikeColor: '#b91c1c', weapon: 'club', aggro: 0.95, skill: 0.80 },
  { name: 'Rhonda', suitMain: '#db2777', suitShoulder: '#fde047', helmetColor: '#9d174d', bikeColor: '#c026d3', weapon: 'fist', aggro: 0.62, skill: 0.88 },
  { name: 'Slater', suitMain: '#0284c7', suitShoulder: '#e2e8f0', helmetColor: '#0369a1', bikeColor: '#0284c7', weapon: 'crowbar', aggro: 0.74, skill: 0.82 },
  { name: 'Teflon', suitMain: '#ca8a04', suitShoulder: '#1f2937', helmetColor: '#eab308', bikeColor: '#eab308', weapon: 'fist', aggro: 0.58, skill: 0.79 },
  { name: 'Helga', suitMain: '#059669', suitShoulder: '#fef08a', helmetColor: '#047857', bikeColor: '#16a34a', weapon: 'club', aggro: 0.72, skill: 0.76 },
  { name: 'Spike', suitMain: '#b91c1c', suitShoulder: '#f8fafc', helmetColor: '#dc2626', bikeColor: '#1f2937', weapon: 'chain', aggro: 0.86, skill: 0.73 },
  { name: 'Cobra', suitMain: '#4f46e5', suitShoulder: '#f43f5e', helmetColor: '#3730a3', bikeColor: '#4f46e5', weapon: 'fist', aggro: 0.65, skill: 0.70 }
];

// Prize money purses & fines by Level (1-5)
export const LEVEL_ECONOMY = [
  { level: 1, baseDistanceKm: 5.5, purses: [2500, 1600, 1000, 400, 200], fine: 500, trafficMult: 1.0, copCount: 2, bikeTierRange: [0, 3] },
  { level: 2, baseDistanceKm: 6.8, purses: [5200, 3400, 2100, 800, 400], fine: 1100, trafficMult: 1.22, copCount: 3, bikeTierRange: [2, 6] },
  { level: 3, baseDistanceKm: 8.2, purses: [10500, 6800, 4200, 1500, 750], fine: 2400, trafficMult: 1.42, copCount: 4, bikeTierRange: [5, 9] },
  { level: 4, baseDistanceKm: 9.8, purses: [22000, 14500, 9000, 3000, 1500], fine: 5000, trafficMult: 1.65, copCount: 5, bikeTierRange: [8, 12] },
  { level: 5, baseDistanceKm: 11.5, purses: [45000, 30000, 18500, 6000, 3000], fine: 10000, trafficMult: 1.9, copCount: 6, bikeTierRange: [11, 14] }
];
