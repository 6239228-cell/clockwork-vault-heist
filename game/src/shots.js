// Deterministic staged frames for the four hand-in screenshots. Every scene is
// built from a fresh world and advanced with the real sim (simulate/updateWorld),
// then posed with the game's own state fields so the cone and timer framing reads.
import { CAMERA, STEP } from './config.js';
import { simulate, updateLaserStates } from './levels.js';

function place(world, x, y, angle = 0) {
  const { player } = world;
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = 0;
  player.angle = angle;
  player.speedNow = 0;
}

function freezeGuard(guard, x, y, angle, state = 'pause') {
  guard.x = x;
  guard.y = y;
  guard.angle = angle;
  guard.scanBase = angle;
  guard.state = state;
  guard.pauseTimer = 99;
  guard.searchTimer = 99;
  guard.seesPlayer = true;
}

function walk(seconds, x, y, sprint = false) {
  const command = { x, y, sprint };
  return () => command;
}

/** Scene 1 — level 1 mid-game: guard cone, camera cone, laser, loot and van. */
function stageCover(world) {
  // A little real play first so the scene is not a cold start.
  simulate(world, 3.2, walk(1, 0.3));
  simulate(world, 2.0, walk(0, -1, true));

  world.time = 24.6;
  world.remaining = 72;
  world.alarm = 45;
  world.spotted = true;
  world.alarmSource = 'GUARD + CAMERA';
  world.levelScore = 0;
  world.coins = 2;
  updateLaserStates(world);

  place(world, 330, 470, 0.15);
  freezeGuard(world.guards[0], 480, 470, Math.PI);
  world.guards[1].x = 900;
  world.guards[1].y = 690;
  world.guards[1].angle = Math.PI;
  world.guards[1].seesPlayer = false;

  const camera = world.cameras[1];
  camera.angle = Math.atan2(470 - camera.y, 330 - camera.x);
  camera.seesPlayer = true;
  world.cameras[0].seesPlayer = false;

  world.player.lastThrow = null;
  return 'playing';
}

/** Scene 2 — level 2 near miss: red cone edge on the thief, laser in warning. */
function stagePlay(world) {
  simulate(world, 3.0, walk(-0.65, 0.35));
  simulate(world, 1.6, walk(-0.4, 0.2, true));

  world.time = 30.9; // 27s elapsed, and inside the lasers' 0.55s warning window
  world.remaining = 78;
  world.alarm = 55;
  world.spotted = true;
  world.alarmSource = 'CAMERA';
  world.coins = 2;
  updateLaserStates(world);

  place(world, 700, 450, Math.PI);
  const camera = world.cameras[2];
  const toPlayer = Math.atan2(450 - camera.y, 700 - camera.x);
  // Aim the sweep just past the thief: the cone edge grazes them.
  camera.angle = toPlayer - CAMERA.visionHalfAngle * 0.94;
  camera.seesPlayer = true;
  for (const other of world.cameras) other.seesPlayer = false;
  world.cameras[1].angle = Math.PI;
  world.guards[2].x = 830;
  world.guards[2].y = 480;
  world.guards[2].angle = 0;
  world.guards[2].seesPlayer = false;
  return 'playing';
}

/** Scene 3 — lockdown: alarm 100, guard and camera both staring at the thief. */
function stageCaught(world) {
  simulate(world, 4.0, walk(0.8, 0.4));

  world.time = 31.2;
  world.remaining = 41;
  world.alarm = 100;
  world.spotted = true;
  world.alarmSource = 'GUARD + CAMERA';
  world.levelScore = 1750;
  world.loot[1].collected = true; // $750 cyan gem
  world.loot[2].collected = true; // $1,000 rose gem
  world.phase = 'caught';
  world.reason = 'ALARM AT 100% — LOCKDOWN';
  world.events.length = 0;
  updateLaserStates(world);

  place(world, 1020, 330, Math.PI * 0.85);
  freezeGuard(world.guards[0], 880, 330, 0);
  world.guards[1].x = 760;
  world.guards[1].y = 640;
  world.guards[1].angle = 0;
  world.guards[1].seesPlayer = false;

  const camera = world.cameras[0];
  camera.angle = Math.atan2(330 - camera.y, 1020 - camera.x);
  camera.seesPlayer = true;
  world.cameras[1].seesPlayer = false;
  return 'caught';
}

/** Scene 4 — victory: level 3 cleared, thief at the van, win screen with score. */
function stageWin(world) {
  simulate(world, 2.0, walk(0.4, 0.6));
  world.time = 46.4;
  world.remaining = 34;
  world.alarm = 0;
  world.spotted = false;
  world.alarmSource = '';
  world.goldTaken = true;
  for (const item of world.loot) item.collected = true;
  world.levelScore = 8750;
  world.totalCollected = 23500;
  world.gemsCollected = 9;
  world.gemTotal = 9;
  world.coins = 1;
  world.phase = 'won';
  updateLaserStates(world);
  place(world, 160, 650, 0);
  return 'won';
}

export function stageShot(name, world) {
  switch (String(name)) {
    case '1': return stageCover(world);
    case '2': return stagePlay(world);
    case '3': return stageCaught(world);
    case '4': return stageWin(world);
    default: return stageCover(world);
  }
}
