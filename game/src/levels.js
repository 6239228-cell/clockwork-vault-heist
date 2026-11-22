// The three vault layouts and the world built from them. Each layout lists only
// axis-aligned walls, cover, patrol waypoints, camera mounts, laser segments, loot
// and the getaway van; createWorld turns that into runtime objects.
import { ALARM, ARENA, COLORS, HUD, LASER, LOOT_VALUE, PLAYER, STEP, createRandom } from './config.js';
import { createGuard, investigate, updateGuard } from './guards.js';
import { createCamera, updateCamera } from './cameras.js';
import { createLoot, goldTaken, updateLoot } from './loot.js';
import { createPlayer, updateAlarm, updatePlayer } from './player.js';
import { circleHitsRect, pointInRect } from './geometry.js';

const outer = [
  { x: 40, y: 96, w: 1200, h: 24 },
  { x: 40, y: 96, w: 24, h: 652 },
  { x: 1216, y: 96, w: 24, h: 652 },
  { x: 40, y: 724, w: 1200, h: 24 },
];

const GEM = {
  cyan: COLORS.gemCyan,
  rose: COLORS.gemRose,
  lime: COLORS.gemLime,
  violet: COLORS.gemViolet,
};

export const LEVELS = [
  {
    name: 'The Brass Foyer',
    code: 'VAULT 01',
    objective: 'Take the gold bar from the east vault and get back to the van.',
    duration: 100,
    start: { x: 250, y: 678 },
    van: { x: 80, y: 624, w: 132, h: 78 },
    walls: [
      ...outer,
      // East vault pocket: open along the bottom, walled above and on the left.
      { x: 1070, y: 400, w: 146, h: 22 },
      { x: 1070, y: 400, w: 22, h: 150 },
    ],
    cover: [
      { kind: 'pillar', x: 330, y: 250, w: 58, h: 58 },
      { kind: 'pillar', x: 330, y: 540, w: 58, h: 58 },
      { kind: 'crate', x: 600, y: 300, w: 84, h: 62 },
      { kind: 'safe', x: 960, y: 176, w: 92, h: 58 },
      { kind: 'crate', x: 780, y: 600, w: 78, h: 58 },
      { kind: 'pillar', x: 470, y: 650, w: 52, h: 52 },
    ],
    guards: [
      { waypoints: [{ x: 180, y: 180 }, { x: 840, y: 180 }, { x: 840, y: 400 }, { x: 180, y: 400 }] },
      { waypoints: [{ x: 620, y: 680 }, { x: 980, y: 680 }, { x: 980, y: 520 }, { x: 620, y: 520 }] },
    ],
    cameras: [
      { x: 1140, y: 136, base: 1.72, sweep: 0.62, speed: 0.62, phase: 0.4 },
      { x: 80, y: 520, base: 0, sweep: 0.55, speed: 0.5, phase: 2.1 },
    ],
    lasers: [
      { x1: 520, y1: 450, x2: 520, y2: 645, offset: 0 },
    ],
    loot: [
      { kind: 'gold', x: 1160, y: 620, value: LOOT_VALUE.gold },
      { kind: 'gem', x: 720, y: 220, value: 750, color: GEM.cyan },
      { kind: 'gem', x: 430, y: 470, value: 1000, color: GEM.rose },
    ],
    coins: 3,
  },
  {
    name: 'The Ledger Hall',
    code: 'VAULT 02',
    objective: 'The bar is locked in the west ledger room. Gems are optional; the clock is not.',
    duration: 105,
    start: { x: 860, y: 420 },
    van: { x: 1080, y: 638, w: 132, h: 78 },
    walls: [
      ...outer,
      { x: 470, y: 120, w: 22, h: 210 },
      { x: 470, y: 500, w: 22, h: 224 },
      { x: 900, y: 120, w: 22, h: 180 },
      { x: 900, y: 520, w: 22, h: 204 },
    ],
    cover: [
      { kind: 'crate', x: 540, y: 620, w: 80, h: 60 },
      { kind: 'pillar', x: 740, y: 600, w: 56, h: 56 },
      { kind: 'safe', x: 260, y: 120, w: 96, h: 58 },
      { kind: 'pillar', x: 1080, y: 300, w: 56, h: 56 },
      { kind: 'crate', x: 760, y: 640, w: 76, h: 60 },
    ],
    guards: [
      { waypoints: [{ x: 160, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 440 }, { x: 160, y: 440 }] },
      { waypoints: [{ x: 980, y: 200 }, { x: 1180, y: 200 }, { x: 1180, y: 600 }, { x: 980, y: 600 }] },
      { waypoints: [{ x: 560, y: 560 }, { x: 820, y: 560 }, { x: 820, y: 200 }, { x: 560, y: 200 }] },
    ],
    cameras: [
      { x: 510, y: 136, base: 1.35, sweep: 0.7, speed: 0.55, phase: 0.8 },
      { x: 1180, y: 136, base: 1.57, sweep: 0.68, speed: 0.7, phase: 3.2 },
      { x: 640, y: 708, base: -1.57, sweep: 0.9, speed: 0.62, phase: 1.4 },
    ],
    lasers: [
      { x1: 620, y1: 335, x2: 800, y2: 335, offset: 0 },
      { x1: 710, y1: 280, x2: 710, y2: 390, offset: 0 },
    ],
    loot: [
      { kind: 'gold', x: 170, y: 180, value: LOOT_VALUE.gold },
      { kind: 'gem', x: 330, y: 600, value: 1000, color: GEM.violet },
      { kind: 'gem', x: 1030, y: 180, value: 1250, color: GEM.lime },
      { kind: 'gem', x: 760, y: 260, value: 750, color: GEM.cyan },
    ],
    coins: 3,
  },
  {
    name: 'The Clockwork Core',
    code: 'VAULT 03',
    objective: 'Crack the central vault, take the bar, and vanish before the gears stop.',
    duration: 115,
    start: { x: 260, y: 690 },
    van: { x: 100, y: 610, w: 132, h: 78 },
    walls: [
      ...outer,
      // Central vault room, one entrance on the left with a laser gate.
      { x: 520, y: 300, w: 340, h: 20 },
      { x: 520, y: 590, w: 340, h: 20 },
      { x: 840, y: 300, w: 20, h: 310 },
      { x: 520, y: 300, w: 20, h: 194 },
      { x: 520, y: 574, w: 20, h: 36 },
    ],
    cover: [
      { kind: 'pillar', x: 320, y: 380, w: 58, h: 58 },
      { kind: 'safe', x: 1060, y: 180, w: 96, h: 58 },
      { kind: 'crate', x: 760, y: 630, w: 80, h: 56 },
      { kind: 'pillar', x: 680, y: 660, w: 56, h: 56 },
      { kind: 'crate', x: 240, y: 560, w: 80, h: 58 },
    ],
    guards: [
      { waypoints: [{ x: 140, y: 150 }, { x: 430, y: 150 }, { x: 430, y: 280 }, { x: 140, y: 280 }] },
      { waypoints: [{ x: 700, y: 160 }, { x: 980, y: 160 }, { x: 980, y: 280 }, { x: 700, y: 280 }] },
      { waypoints: [{ x: 140, y: 660 }, { x: 430, y: 660 }, { x: 430, y: 470 }, { x: 140, y: 470 }] },
      { waypoints: [{ x: 940, y: 480 }, { x: 1160, y: 480 }, { x: 1160, y: 680 }, { x: 940, y: 680 }] },
    ],
    cameras: [
      { x: 600, y: 334, base: 1.57, sweep: 0.85, speed: 0.75, phase: 0.2 },
      { x: 826, y: 460, base: 3.14, sweep: 0.65, speed: 0.6, phase: 2.4 },
      { x: 1200, y: 140, base: 2.35, sweep: 0.7, speed: 0.5, phase: 4.1 },
      { x: 80, y: 400, base: 0, sweep: 0.6, speed: 0.55, phase: 1.1 },
    ],
    lasers: [
      { x1: 530, y1: 494, x2: 530, y2: 574, offset: 0.2 },
      { x1: 260, y1: 520, x2: 455, y2: 520, offset: 1.4 },
      { x1: 960, y1: 420, x2: 1140, y2: 420, offset: 2.6 },
    ],
    loot: [
      { kind: 'gold', x: 700, y: 460, value: LOOT_VALUE.gold },
      { kind: 'gem', x: 760, y: 360, value: 1000, color: GEM.rose },
      { kind: 'gem', x: 640, y: 540, value: 750, color: GEM.cyan },
      { kind: 'gem', x: 1080, y: 660, value: 1250, color: GEM.lime },
      { kind: 'gem', x: 340, y: 660, value: 750, color: GEM.violet },
    ],
    coins: 4,
  },
];

/** Total dollars available in a level, for the HUD and the win screen. */
export function levelLootTotal(index) {
  const level = LEVELS[index];
  if (!level) return 0;
  return level.loot.reduce((sum, item) => sum + (item.value ?? 0), 0);
}

export function totalLootAll() {
  return LEVELS.reduce((sum, _level, index) => sum + levelLootTotal(index), 0);
}

const clone = (value) => JSON.parse(JSON.stringify(value));

/** Laser cycle: live, then off, then a warning blink, then live again. */
export function laserStateAt(time, offset) {
  const cycle = LASER.onTime + LASER.offTime;
  const t = ((time + offset) % cycle + cycle) % cycle;
  if (t < LASER.onTime) return 'on';
  if (t >= cycle - LASER.warnTime) return 'warn';
  return 'off';
}

export function updateLaserStates(world) {
  for (const laser of world.lasers) {
    const next = laserStateAt(world.time, laser.offset);
    if (next === 'on' && laser.state !== 'on') laser.justWentLive = true;
    else laser.justWentLive = false;
    laser.state = next;
  }
}

/** Build a fresh world for a level; the same seed always gives the same vault. */
export function createWorld(index, seed = 1) {
  const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
  const walls = clone(level.walls);
  const cover = clone(level.cover);
  // The seed shifts each camera's sweep and each guard's gait, so ?seed=N replays
  // the same vault while a different N gives a different rhythm.
  const random = createRandom(seed);
  const world = {
    levelIndex: index,
    seed,
    name: level.name,
    code: level.code,
    objective: level.objective,
    duration: level.duration,
    remaining: level.duration,
    time: 0,
    phase: 'playing',
    reason: null,
    walls,
    cover,
    blockers: [...walls, ...cover],
    player: createPlayer(level.start),
    guards: level.guards.map((guard, i) => {
      const created = createGuard(guard, i);
      created.bob += random() * 2;
      return created;
    }),
    cameras: level.cameras.map((camera, i) => {
      const created = createCamera(camera, i);
      created.phase += random() * 0.7;
      return created;
    }),
    lasers: clone(level.lasers).map((laser, i) => ({
      ...laser,
      offset: laser.offset ?? i * 0.9,
      state: 'off',
      justWentLive: false,
    })),
    loot: createLoot(clone(level.loot)),
    lootTotal: level.loot.reduce((sum, item) => sum + (item.value ?? 0), 0),
    van: { ...level.van },
    coins: level.coins ?? PLAYER.startCoins,
    projectiles: [],
    pings: [],
    alarm: 0,
    spotted: false,
    alarmSource: '',
    outOfSight: 0,
    alarmSting: false,
    levelScore: 0,
    totalCollected: 0,
    goldTaken: false,
    events: [],
    banner: null,
    noiseTimer: 0,
    sprinting: false,
    cleared: false,
    durationUsed: 0,
  };
  world.start = { ...level.start };
  updateLaserStates(world);
  return world;
}

/** True when the thief (not just their centre) touches the van's loading bay. */
export function playerAtVan(world) {
  const { player, van } = world;
  return circleHitsRect(player.x, player.y, player.radius + 6, van)
    || pointInRect(player.x, player.y, van);
}

function updatePings(world, dt) {
  for (const ping of world.pings) ping.timer -= dt;
  world.pings = world.pings.filter((ping) => ping.timer > 0);
}

/** One fixed simulation step for a playing world. */
export function updateWorld(world, dt, input) {
  if (world.phase !== 'playing') return;
  world.time += dt;
  world.remaining = Math.max(0, world.remaining - dt);
  world.durationUsed += dt;

  updateLaserStates(world);
  updatePlayer(world, dt, input);
  for (const guard of world.guards) updateGuard(guard, dt, world);
  for (const camera of world.cameras) updateCamera(camera, dt, world);
  updateAlarm(world, dt);
  updateLoot(world);
  updatePings(world, dt);

  if (world.banner) {
    world.banner.time -= dt;
    if (world.banner.time <= 0) world.banner = null;
  }

  if (world.phase !== 'playing') return;

  if (goldTaken(world.loot) && playerAtVan(world)) {
    world.phase = 'clear';
    world.cleared = true;
    world.events.push({ type: 'clear' });
    return;
  }

  if (world.remaining <= 0) {
    world.phase = 'caught';
    world.reason = 'TIME UP — THE VAULT SEALED';
    world.events.push({ type: 'caught', reason: 'time' });
  }
}

/** Convenience for scripts and staging: simulate whole seconds of real rules. */
export function simulate(world, seconds, controller, step = STEP) {
  const steps = Math.max(0, Math.round(seconds / step));
  for (let i = 0; i < steps; i++) {
    if (world.phase !== 'playing') break;
    const command = controller ? controller(world, i * step) : { x: 0, y: 0, sprint: false, throwAt: null };
    updateWorld(world, step, {
      axis: () => ({ x: command.x ?? 0, y: command.y ?? 0 }),
      sprint: () => Boolean(command.sprint),
      consumeThrow: () => command.throwAt ?? null,
    });
  }
  return world;
}

/** Send every guard within `radius` of a noise to look at it. */
export function alertGuards(world, x, y, radius) {
  for (const guard of world.guards) {
    if (Math.hypot(guard.x - x, guard.y - y) <= radius) investigate(guard, x, y);
  }
}

// The arena constants are exported indirectly through the layout; keep a sanity
// export so tuning tools can see the play space without importing config twice.
export { ARENA, HUD };
