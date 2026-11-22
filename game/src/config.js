// Every tuning number, colour and the handful of maths helpers the vault game shares.
// The whole heist is one fixed 1280x800 canvas: the room, its cover, the loot and the
// getaway van are always in frame, so nothing here depends on the window size.

export const VIEW = { width: 1280, height: 800 };

/** The open floor inside the bank's outer walls. Every level rectangle lives in here. */
export const ARENA = { left: 20, top: 116, right: 1260, bottom: 748 };

/** Top status bar, bottom objective ribbon. Both are drawn over the vault. */
export const HUD = { height: 92, objectiveTop: 768, objectiveHeight: 32 };

/** Fixed simulation step: 60 updates a second whatever the display's refresh rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  speed: 198,
  sprintSpeed: 306,
  accel: 1500,
  friction: 2100,
  pickupRadius: 30,
  startCoins: 3,
};

export const GUARD = {
  radius: 14,
  speed: 58,
  investigateSpeed: 112,
  visionLength: 238,
  visionHalfAngle: 0.34,
  turnRate: 3.4,
  pause: 1.15,
  scanArc: 0.48,
  searchSeconds: 4.5,
  returnSeconds: 3.2,
  arrival: 5,
};

export const CAMERA = {
  radius: 13,
  visionLength: 300,
  visionHalfAngle: 0.245,
  turnSpeed: 1.6,
};

export const LASER = {
  onTime: 2.2,
  offTime: 1.7,
  warnTime: 0.55,
  beamWidth: 6,
  touchRadius: 9,
};

export const ALARM = {
  max: 100,
  guardRate: 31,
  cameraRate: 27,
  laserRate: 78,
  decay: 19,
  grace: 0.75,
  stingAt: 72,
};

export const NOISE = {
  radius: 168,
  hearRadius: 250,
  interval: 0.7,
};

export const COIN = {
  flightSeconds: 0.46,
  distractRadius: 320,
  pingSeconds: 4.2,
  maxThrow: 430,
};

/** Loot values in dollars. The gold bar is the payday; gems are the patient bonus. */
export const LOOT_VALUE = { gold: 5000, gem: 900 };

export const COLORS = {
  backdrop: '#050b11',
  floor: '#0d1e2a',
  floorDeep: '#08141d',
  floorPanel: '#112735',
  floorLine: '#1b3a4b',
  floorGlow: '#143244',

  wall: '#1b3444',
  wallTop: '#2b5064',
  wallEdge: '#060e14',
  wallRivet: '#3f6a80',

  cover: '#22414f',
  coverTop: '#315c6e',
  coverEdge: '#081319',
  crate: '#5b4426',
  crateTop: '#7d5f34',
  crateEdge: '#1d1408',
  safe: '#234653',
  safeTop: '#366b7c',
  safeDial: '#d7b25a',

  guard: '#f3c64f',
  guardBody: '#23384a',
  guardCone: 'rgba(247, 199, 74, 0.15)',
  guardConeCore: 'rgba(255, 222, 120, 0.24)',
  guardConeEdge: 'rgba(255, 216, 92, 0.55)',
  guardRoute: 'rgba(247, 199, 74, 0.20)',

  camera: '#ff5c52',
  cameraCone: 'rgba(255, 72, 62, 0.12)',
  cameraConeCore: 'rgba(255, 96, 82, 0.20)',
  cameraConeEdge: 'rgba(255, 104, 90, 0.48)',
  cameraDanger: 'rgba(255, 84, 66, 0.075)',

  laser: '#ff3d33',
  laserHot: '#ffd9c9',
  laserOff: 'rgba(255, 176, 74, 0.38)',
  laserLane: 'rgba(255, 150, 54, 0.10)',
  laserLaneHot: 'rgba(255, 62, 46, 0.17)',

  gold: '#ffd24a',
  goldLight: '#fff2b0',
  goldDark: '#a86f12',
  gemCyan: '#58e6ff',
  gemRose: '#ff6bc8',
  gemLime: '#8bff7a',
  gemViolet: '#b18cff',

  thief: '#79efc5',
  thiefLight: '#c8ffe9',
  thiefDark: '#0d3d35',
  thiefPack: '#12302f',

  van: '#5ce6b4',
  vanDark: '#0f5a4a',
  vanGlass: '#9ff5dc',
  exit: 'rgba(104, 255, 197, 0.9)',

  hud: 'rgba(5, 15, 22, 0.94)',
  hudLine: '#2b5a70',
  text: '#ecf7fb',
  muted: '#7d9eae',
  dim: '#4f6f7e',
  alarm: '#ffb02e',
  alarmHot: '#ff3f33',
  good: '#64f0b2',
  blue: '#6dc9ff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

/** A tiny seeded generator (mulberry32), so a seed replays the same vault. */
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

/** Shortest signed turn from `from` to `to`, in radians, in (-PI, PI]. */
export function angleDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

/** Turn `current` toward `target` by at most `maxStep`, with no wraparound jump. */
export function approachAngle(current, target, maxStep) {
  const delta = angleDelta(current, target);
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

/** Distance from a point to a line segment, used by the live laser beams. */
export function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

export function formatMoney(value) {
  return '$' + Math.round(value).toLocaleString('en-US');
}

export function formatClock(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0');
}
