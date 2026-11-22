// The thief: acceleration-based movement with wall sliding, sprint noise, coin
// throws, and the alarm meter that every guard / camera / laser feeds.
import {
  ALARM, COIN, GUARD, LASER, NOISE, PLAYER, clamp, pointSegmentDistance,
} from './config.js';
import { circleHitsRect, collideCircle } from './geometry.js';
import { investigate } from './guards.js';

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: PLAYER.radius,
    walkPhase: 0,
    throwCooldown: 0,
    speedNow: 0,
    lastThrow: null,
  };
}

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

/** Aim the throw at the pointer but never beyond the arm's useful range. */
function clampThrow(player, at) {
  const dx = at.x - player.x;
  const dy = at.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= COIN.maxThrow || dist === 0) return { x: at.x, y: at.y };
  return {
    x: player.x + (dx / dist) * COIN.maxThrow,
    y: player.y + (dy / dist) * COIN.maxThrow,
  };
}

function throwCoin(world, at) {
  const { player } = world;
  if (world.coins <= 0 || player.throwCooldown > 0) return false;
  const target = clampThrow(player, at);
  world.coins -= 1;
  player.throwCooldown = 0.28;
  player.lastThrow = { x: target.x, y: target.y };
  world.projectiles.push({
    fromX: player.x,
    fromY: player.y,
    x: player.x,
    y: player.y,
    toX: target.x,
    toY: target.y,
    time: 0,
    duration: COIN.flightSeconds,
  });
  world.events.push({ type: 'coin' });
  return true;
}

function landCoin(world, coin) {
  world.pings.push({ x: coin.toX, y: coin.toY, timer: COIN.pingSeconds });
  world.events.push({ type: 'coinLand' });
  for (const guard of world.guards) {
    if (Math.hypot(guard.x - coin.toX, guard.y - coin.toY) <= COIN.distractRadius) {
      investigate(guard, coin.toX, coin.toY);
    }
  }
}

function updateProjectiles(world, dt) {
  for (const coin of world.projectiles) {
    coin.time += dt;
    const t = Math.min(1, coin.time / coin.duration);
    coin.x = coin.fromX + (coin.toX - coin.fromX) * t;
    coin.y = coin.fromY + (coin.toY - coin.fromY) * t;
    if (t >= 1) coin.done = true;
  }
  for (const coin of world.projectiles) {
    if (coin.done) landCoin(world, coin);
  }
  world.projectiles = world.projectiles.filter((coin) => !coin.done);
}

export function updatePlayer(world, dt, input) {
  const { player } = world;
  player.throwCooldown = Math.max(0, player.throwCooldown - dt);

  const axis = input.axis();
  const wantsMove = axis.x !== 0 || axis.y !== 0;
  const sprint = input.sprint() && wantsMove;
  const topSpeed = sprint ? PLAYER.sprintSpeed : PLAYER.speed;
  world.sprinting = sprint;

  if (wantsMove) {
    const targetX = axis.x * topSpeed;
    const targetY = axis.y * topSpeed;
    player.vx = approach(player.vx, targetX, PLAYER.accel * dt);
    player.vy = approach(player.vy, targetY, PLAYER.accel * dt);
  } else {
    player.vx = approach(player.vx, 0, PLAYER.friction * dt);
    player.vy = approach(player.vy, 0, PLAYER.friction * dt);
  }

  // Move one axis at a time and push out of every blocker, which gives clean
  // wall sliding around pillars and vault corners.
  player.x += player.vx * dt;
  collideCircle(player, player.radius, world.blockers);
  player.y += player.vy * dt;
  collideCircle(player, player.radius, world.blockers);
  player.x = clamp(player.x, PLAYER.radius + 2, 1278 - PLAYER.radius);
  player.y = clamp(player.y, PLAYER.radius + 2, 798 - PLAYER.radius);

  const speed = Math.hypot(player.vx, player.vy);
  player.speedNow = speed;
  if (speed > 6) player.angle = Math.atan2(player.vy, player.vx);
  player.walkPhase += speed * dt * 0.055;

  // Sprint noise: a visible ring that pulls nearby guards toward the thief.
  if (sprint && speed > 30) {
    world.noiseTimer -= dt;
    if (world.noiseTimer <= 0) {
      world.noiseTimer = NOISE.interval;
      for (const guard of world.guards) {
        if (Math.hypot(guard.x - player.x, guard.y - player.y) <= NOISE.hearRadius) {
          investigate(guard, player.x, player.y);
        }
      }
      world.events.push({ type: 'noise' });
    }
  } else {
    world.noiseTimer = 0;
  }

  const at = input.consumeThrow();
  if (at) throwCoin(world, at);

  updateProjectiles(world, dt);
}

/** True while the thief is standing in a live beam. */
export function laserOnPlayer(world) {
  const { player } = world;
  const reach = LASER.beamWidth / 2 + player.radius;
  for (const laser of world.lasers) {
    if (laser.state !== 'on') continue;
    const d = pointSegmentDistance(player.x, player.y, laser.x1, laser.y1, laser.x2, laser.y2);
    if (d <= reach) return true;
  }
  return false;
}

/**
 * The alarm meter. Every source that currently sees the thief adds its rate, capped
 * at 90/s; once nothing sees them for the grace period, it bleeds back down at 19/s.
 */
export function updateAlarm(world, dt) {
  let rate = 0;
  let guardCount = 0;
  let cameraCount = 0;

  for (const guard of world.guards) {
    if (guard.seesPlayer) { rate += ALARM.guardRate; guardCount += 1; }
  }
  for (const camera of world.cameras) {
    if (camera.seesPlayer) { rate += ALARM.cameraRate; cameraCount += 1; }
  }
  const laser = laserOnPlayer(world);
  if (laser) rate += ALARM.laserRate;

  world.laserHit = laser;

  if (rate > 0) {
    world.alarm = Math.min(ALARM.max, world.alarm + Math.min(rate, 90) * dt);
    world.outOfSight = 0;
    world.spotted = true;
    if (guardCount && cameraCount) world.alarmSource = 'GUARD + CAMERA';
    else if (guardCount) world.alarmSource = 'GUARD';
    else if (cameraCount) world.alarmSource = 'CAMERA';
    else world.alarmSource = 'LASER GRID';
    if (!world.alarmSting && world.alarm >= ALARM.stingAt) {
      world.alarmSting = true;
      world.events.push({ type: 'sting' });
    }
  } else {
    world.spotted = false;
    world.alarmSource = '';
    world.outOfSight += dt;
    if (world.outOfSight >= ALARM.grace) {
      world.alarm = Math.max(0, world.alarm - ALARM.decay * dt);
      if (world.alarm < ALARM.max * 0.5) world.alarmSting = false;
    }
  }

  if (world.alarm >= ALARM.max) {
    world.alarm = ALARM.max;
    world.phase = 'caught';
    world.reason = world.laserHit
      ? 'LASER GRID BREACH — LOCKDOWN'
      : 'ALARM AT 100% — LOCKDOWN';
    world.events.push({ type: 'caught', reason: 'alarm' });
  }
}

/** Distance to the nearest guard, used by the audio mix for footsteps. */
export function nearestGuardDistance(world) {
  let nearest = Infinity;
  for (const guard of world.guards) {
    const d = Math.hypot(guard.x - world.player.x, guard.y - world.player.y);
    if (d < nearest) nearest = d;
  }
  return nearest;
}

/** True when the thief is behind cover relative to a guard or camera. */
export function isHidden(world) {
  if (world.spotted) return false;
  const { player, guards, blockers } = world;
  for (const guard of guards) {
    if (circleHitsRect(player.x, player.y, GUARD.visionLength, {
      x: guard.x - 4, y: guard.y - 4, w: 8, h: 8,
    })) return true;
  }
  // If a vision source is nearby but the alarm is not rising, the player is hidden.
  return false;
}
