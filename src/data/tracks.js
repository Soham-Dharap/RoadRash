// All 5 Iconic 1996 Windows PC Road Rash California Courses
// Deterministic curve + elevation + intersection + prop layout generators

export const TRACKS = [
  {
    id: 'city',
    name: 'The City',
    subtitle: 'San Francisco Downtown',
    tagline: 'Dense 4-lane avenues, brick & steel blocks, steep hill jumps, busy crosswalks & jaywalkers.',
    skyTop: '#5676d4',
    skyBottom: '#9db6f2',
    fogColor: '#8da6e2',
    mountainColor: '#4c6b4d',
    mountainHi: '#6b8c63',
    groundLeft: 'sidewalk',
    groundRight: 'sidewalk',
    shoulderColor: '#787572',
    asphaltBase: '#5d5b68',
    urban: true,
    cliffLeft: false,
    oceanRight: false,
    guardrails: 'curves',
    intersectionEvery: 38, // segments (~570m) -> frequent city signalized crosswalks & pedestrians!
    pedestrianDensity: 1.45,
    curveScale: 1.0,
    hillScale: 1.25, // Classic SF steep hill crests!
    seed: 101
  },
  {
    id: 'peninsula',
    name: 'The Peninsula',
    subtitle: 'Bay Area Foothills & Crossings',
    tagline: 'Fast signalized highway intersections, rolling green pastures, curve signs & suburban traffic.',
    skyTop: '#5b78d9',
    skyBottom: '#a7bdf2',
    fogColor: '#9cb3eb',
    mountainColor: '#7a8499',
    mountainHi: '#a5afc2',
    groundLeft: 'grass',
    groundRight: 'grass',
    shoulderColor: '#7d6247',
    asphaltBase: '#635f6e',
    urban: false,
    cliffLeft: false,
    oceanRight: false,
    guardrails: 'curves',
    intersectionEvery: 52,
    pedestrianDensity: 1.0,
    curveScale: 1.1,
    hillScale: 1.05,
    seed: 202
  },
  {
    id: 'pacific',
    name: 'Pacific Highway',
    subtitle: 'California Coast Route 1',
    tagline: 'Towering rock cliffs on the left, steel guardrails & Pacific surf on the right, treacherous S-bends.',
    skyTop: '#5273db',
    skyBottom: '#a6c0f7',
    fogColor: '#9bb6ef',
    mountainColor: '#5e7358',
    mountainHi: '#859c7b',
    groundLeft: 'cliff',
    groundRight: 'ocean',
    shoulderColor: '#8d7258',
    asphaltBase: '#666373',
    urban: false,
    cliffLeft: true,
    oceanRight: true,
    guardrails: 'right_always',
    intersectionEvery: 76,
    pedestrianDensity: 0.75,
    curveScale: 1.38,
    hillScale: 1.12,
    seed: 303
  },
  {
    id: 'sierra',
    name: 'Sierra Nevada',
    subtitle: 'High Alpine Pass',
    tagline: 'Snow-capped granite ridges, tall pines, canyon guardrails, and massive high-speed crest launches.',
    skyTop: '#4c6cd1',
    skyBottom: '#9eb6f0',
    fogColor: '#97aedf',
    mountainColor: '#7a8296',
    mountainHi: '#d8e0ef',
    groundLeft: 'pine_hill',
    groundRight: 'pine_hill',
    shoulderColor: '#73583f',
    asphaltBase: '#5b5968',
    urban: false,
    cliffLeft: false,
    oceanRight: false,
    guardrails: 'both_frequent',
    intersectionEvery: 85,
    pedestrianDensity: 0.7,
    curveScale: 1.28,
    hillScale: 1.5,
    seed: 404
  },
  {
    id: 'napa',
    name: 'Napa Valley',
    subtitle: 'Wine Country Backroads',
    tagline: 'Sunlit vineyard hills, long nitro straightaways, rural crossroads, and relentless pack brawls.',
    skyTop: '#5f80de',
    skyBottom: '#b0c7f7',
    fogColor: '#a3b9ec',
    mountainColor: '#5d7349',
    mountainHi: '#8aa36c',
    groundLeft: 'vineyard',
    groundRight: 'vineyard',
    shoulderColor: '#826444',
    asphaltBase: '#65616e',
    urban: false,
    cliffLeft: false,
    oceanRight: false,
    guardrails: 'curves',
    intersectionEvery: 60,
    pedestrianDensity: 0.9,
    curveScale: 1.05,
    hillScale: 0.95,
    seed: 505
  }
];

// Seeded deterministic PRNG
export function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEGMENT_LENGTH = 15; // meters per road segment
export const ROAD_HALF_WIDTH = 9.0; // 18m total 4-lane highway width (-9 to +9)
export const SHOULDER_WIDTH = 3.2;

/**
 * Generates the complete 3D centerline spline, elevation profile, intersections,
 * guardrails, buildings, trees, signs, and pedestrian crossings for a race.
 */
export function buildCourseData(track, distanceKm) {
  const rng = mulberry32(track.seed + Math.round(distanceKm * 10));
  const raceSegments = Math.ceil((distanceKm * 1000) / SEGMENT_LENGTH);
  const runoutSegments = 45; // post-finish coasting segments
  const totalSegments = raceSegments + runoutSegments;

  const curvatures = new Float32Array(totalSegments);
  const elevations = new Float32Array(totalSegments);

  // Build organic Road Rash curve blocks (straights, sweepers, S-bends, hairpins)
  let seg = 14; // straight starting grid
  while (seg < raceSegments - 18) {
    const roll = rng();
    const len = 16 + Math.floor(rng() * 28);
    const hold = 10 + Math.floor(rng() * 22);
    let targetCurve = 0;
    if (roll > 0.24) {
      const dir = rng() < 0.5 ? -1 : 1;
      const strength = (0.0022 + rng() * 0.0052) * track.curveScale * dir;
      targetCurve = strength;
    }
    const totalLen = len * 2 + hold;
    for (let i = 0; i < totalLen && seg + i < raceSegments - 10; i++) {
      let factor = 1;
      if (i < len) factor = 0.5 - 0.5 * Math.cos((Math.PI * i) / len);
      else if (i >= len + hold) {
        const outIdx = i - (len + hold);
        factor = 0.5 + 0.5 * Math.cos((Math.PI * outIdx) / len);
      }
      curvatures[seg + i] = targetCurve * factor;
    }
    seg += totalLen + Math.floor(rng() * 10);
  }

  // Build hills & jump crests! (Steep crests give genuine OG airborne launches at speed!)
  let hSeg = 16;
  let currentY = 0;
  while (hSeg < totalSegments - 25) {
    const hillLen = 22 + Math.floor(rng() * 34);
    const deltaY = (rng() - 0.48) * 28 * track.hillScale;
    const sharpCrest = rng() < 0.35; // Steep San Francisco / Sierra crest!
    const startY = currentY;
    const endY = Math.max(-20, Math.min(75, startY + deltaY));
    for (let i = 0; i < hillLen && hSeg + i < totalSegments; i++) {
      const u = i / hillLen;
      const shaped = sharpCrest
        ? u < 0.55
          ? Math.sin(((u / 0.55) * Math.PI) / 2) * 1.18
          : 1.18 - 0.18 * ((u - 0.55) / 0.45)
        : 0.5 - 0.5 * Math.cos(Math.PI * u);
      elevations[hSeg + i] = startY + (endY - startY) * shaped;
    }
    currentY = elevations[Math.min(totalSegments - 1, hSeg + hillLen - 1)];
    for (let k = hSeg + hillLen; k < Math.min(totalSegments, hSeg + hillLen + 10); k++) {
      elevations[k] = currentY;
    }
    hSeg += hillLen + 8;
  }

  // Smooth elevation slightly while keeping crisp crests so motorcycles can catch air
  const smoothedY = new Float32Array(totalSegments);
  for (let i = 0; i < totalSegments; i++) {
    const y0 = elevations[Math.max(0, i - 1)];
    const y1 = elevations[i];
    const y2 = elevations[Math.min(totalSegments - 1, i + 1)];
    smoothedY[i] = y0 * 0.22 + y1 * 0.56 + y2 * 0.22;
  }

  // Integrate 3D world coordinates along road heading
  const segments = [];
  let wx = 0;
  let wz = 0;
  let heading = 0; // 0 = along -Z

  for (let i = 0; i < totalSegments; i++) {
    const wy = smoothedY[i];
    const isCrosswalk =
      i === 16 || (i > 20 && i < raceSegments - 18 && i % track.intersectionEvery === 0);
    const isIntersection =
      isCrosswalk ||
      i === 17 ||
      (i > 20 && i < raceSegments - 18 && i % track.intersectionEvery === 1);

    // Flatten road curvature slightly inside intersections
    if (isIntersection) curvatures[i] *= 0.2;

    const sinH = Math.sin(heading);
    const cosH = Math.cos(heading);
    // Forward unit vector: (sinH, 0, -cosH), Right unit vector: (cosH, 0, sinH)
    const fx = sinH;
    const fz = -cosH;
    const rx = cosH;
    const rz = sinH;

    const absCurve = Math.abs(curvatures[i]);
    let guardrailLeft = false;
    let guardrailRight = false;
    if (!isIntersection) {
      if (track.guardrails === 'right_always') {
        guardrailRight = true;
        guardrailLeft = absCurve > 0.0038 && !track.cliffLeft;
      } else if (track.guardrails === 'both_frequent') {
        guardrailLeft = absCurve > 0.002 || i % 28 < 14;
        guardrailRight = absCurve > 0.002 || i % 28 < 14;
      } else if (!track.urban) {
        guardrailLeft = curvatures[i] > 0.0028;
        guardrailRight = curvatures[i] < -0.0028;
      }
    }

    segments.push({
      index: i,
      s: i * SEGMENT_LENGTH,
      x: wx,
      y: wy,
      z: wz,
      heading,
      curve: curvatures[i],
      pitch: 0,
      fx,
      fz,
      rx,
      rz,
      isIntersection,
      isCrosswalk,
      isFinish: i === raceSegments,
      guardrailLeft,
      guardrailRight
    });

    heading += curvatures[i] * SEGMENT_LENGTH;
    wx += Math.sin(heading) * SEGMENT_LENGTH;
    wz += -Math.cos(heading) * SEGMENT_LENGTH;
  }

  for (let i = 0; i < totalSegments - 1; i++) {
    segments[i].pitch = Math.atan2(segments[i + 1].y - segments[i].y, SEGMENT_LENGTH);
  }

  // Generate roadside props, city buildings, signs, traffic lights & finish banner
  const props = [];
  const buildings = [];
  const pedestrianSpawns = [];

  for (let i = 6; i < totalSegments - 8; i++) {
    const segObj = segments[i];

    // Crosswalk traffic signals + jaywalker / crosswalk spawns!
    if (segObj.isCrosswalk) {
      props.push({ seg: i, offset: -(ROAD_HALF_WIDTH + 1.8), type: 'traffic_light', solid: true, radius: 0.65 });
      props.push({ seg: i, offset: ROAD_HALF_WIDTH + 1.8, type: 'traffic_light', solid: true, radius: 0.65 });
      props.push({ seg: i - 2, offset: ROAD_HALF_WIDTH + 2.5, type: 'sign_crosswalk', solid: true, radius: 0.45 });

      // Spawn 2-4 pedestrians crossing at every intersection crosswalk!
      const pedCount = 2 + Math.floor(rng() * 3);
      for (let p = 0; p < pedCount; p++) {
        pedestrianSpawns.push({
          s: segObj.s + (p - 1) * 2.4,
          startX: (rng() < 0.5 ? -1 : 1) * (ROAD_HALF_WIDTH + 1.6 + rng() * 2.5),
          dir: rng() < 0.5 ? 1 : -1,
          speed: 2.1 + rng() * 1.6,
          variant: Math.floor(rng() * 4),
          crosswalk: true
        });
      }
      continue;
    }

    if (segObj.isIntersection) continue;

    // Curve warning yellow diamond signs ahead of sharp bends (exact match to Screenshot 1 & 4!)
    const lookAhead = segments[Math.min(totalSegments - 1, i + 10)];
    if (i % 14 === 0 && Math.abs(lookAhead.curve) > 0.0032 && Math.abs(segObj.curve) < 0.0022) {
      const turnRight = lookAhead.curve > 0;
      props.push({
        seg: i,
        offset: ROAD_HALF_WIDTH + 2.3,
        type: turnRight ? 'sign_curve_right' : 'sign_curve_left',
        solid: true,
        radius: 0.5
      });
    }

    // Highway green exit sign or large roadside billboard (Screenshot 2 & 5!)
    if (!track.urban && i % 43 === 18) {
      const side = track.oceanRight ? -1 : rng() < 0.5 ? -1 : 1;
      if (!(side < 0 && track.cliffLeft)) {
        props.push({
          seg: i,
          offset: side * (ROAD_HALF_WIDTH + 4.8),
          type: rng() < 0.5 ? 'billboard' : 'highway_sign',
          solid: true,
          radius: 1.2
        });
      }
    }

    // Urban buildings + street trees + trashcans + occasional mid-block jaywalkers!
    if (track.urban) {
      if (i % 3 === 0) {
        buildings.push({
          seg: i,
          side: -1,
          width: 14 + rng() * 6,
          depth: SEGMENT_LENGTH * 2.85,
          height: 18 + Math.floor(rng() * 4) * 6,
          style: Math.floor(rng() * 5)
        });
        buildings.push({
          seg: i,
          side: 1,
          width: 14 + rng() * 6,
          depth: SEGMENT_LENGTH * 2.85,
          height: 18 + Math.floor(rng() * 4) * 6,
          style: Math.floor(rng() * 5)
        });
      }
      if (i % 5 === 2) {
        props.push({ seg: i, offset: -(ROAD_HALF_WIDTH + 1.9), type: 'city_tree', solid: true, radius: 0.65 });
        props.push({ seg: i, offset: ROAD_HALF_WIDTH + 1.9, type: 'city_tree', solid: true, radius: 0.65 });
      }
      if (i % 7 === 4) {
        const side = rng() < 0.5 ? -1 : 1;
        props.push({ seg: i, offset: side * (ROAD_HALF_WIDTH + 1.5), type: 'trash_can', solid: false, radius: 0.55 });
      }
      // Mid-block jaywalkers & sidewalk walkers in The City!
      if (i % 9 === 5 && rng() < 0.72 * track.pedestrianDensity) {
        pedestrianSpawns.push({
          s: segObj.s,
          startX: (rng() < 0.5 ? -1 : 1) * (ROAD_HALF_WIDTH + 0.8 + rng() * 2.2),
          dir: rng() < 0.5 ? 1 : -1,
          speed: 1.9 + rng() * 1.8,
          variant: Math.floor(rng() * 4),
          crosswalk: rng() < 0.68 // 68% brazenly jaywalk right across the 4 lanes!
        });
      }
    } else {
      // Rural trees, pines, rocks, telephone poles, and occasional hikers/jaywalkers
      if (i % 3 === 0) {
        if (!track.cliffLeft || rng() < 0.35) {
          const dLeft = ROAD_HALF_WIDTH + (track.cliffLeft ? 2.1 : 3.4 + rng() * 9.5);
          props.push({
            seg: i,
            offset: -dLeft,
            type: track.id === 'sierra' ? 'pine_tree' : 'oak_tree',
            solid: dLeft < ROAD_HALF_WIDTH + 4.5,
            radius: 0.8
          });
        }
        if (!track.oceanRight) {
          const dRight = ROAD_HALF_WIDTH + 3.4 + rng() * 9.5;
          props.push({
            seg: i,
            offset: dRight,
            type: track.id === 'sierra' ? 'pine_tree' : 'oak_tree',
            solid: dRight < ROAD_HALF_WIDTH + 4.5,
            radius: 0.8
          });
        }
      }
      // Telephone poles on Peninsula / Napa
      if ((track.id === 'peninsula' || track.id === 'napa') && i % 8 === 1) {
        props.push({
          seg: i,
          offset: ROAD_HALF_WIDTH + 2.4,
          type: 'pole',
          solid: true,
          radius: 0.45
        });
      }
      // Low roadside boulder/rock on shoulder (acts as a mini-ramp bump just like OG Road Rash!)
      if (i % 19 === 9 && rng() < 0.55) {
        const side = track.oceanRight ? -1 : rng() < 0.5 ? -1 : 1;
        props.push({
          seg: i,
          offset: side * (ROAD_HALF_WIDTH + 0.9 + rng() * 1.1),
          type: 'boulder_ramp',
          solid: false,
          isRamp: true,
          radius: 0.95
        });
      }
      // Rural jaywalking hikers / pedestrians!
      if (i % 15 === 7 && rng() < 0.58 * track.pedestrianDensity) {
        pedestrianSpawns.push({
          s: segObj.s,
          startX: -(ROAD_HALF_WIDTH + 1.4),
          dir: 1,
          speed: 1.8 + rng() * 1.5,
          variant: Math.floor(rng() * 4),
          crosswalk: true
        });
      }
    }
  }

  return {
    track,
    segments,
    raceSegments,
    totalSegments,
    finishS: raceSegments * SEGMENT_LENGTH,
    totalS: (totalSegments - 1) * SEGMENT_LENGTH,
    props,
    buildings,
    pedestrianSpawns
  };
}
