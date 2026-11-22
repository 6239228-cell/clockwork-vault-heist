// Guards: fixed patrol routes, a pause-and-scan at each waypoint, yellow vision
// cones that walls and cover cut off, and an investigate state used by both the
// coin distraction and the thief's sprint noise.
import { GUARD, approachAngle, clamp } from './config.js';
import { collideCircle, segmentBlocked, visionWedge } from './geometry.js';

export function createGuard(def, index) {
  const first = def.waypoints[0];
  return {
    id: index,
    x: first.x,
    y: first.y,
    angle: 0,
    radius: GUARD.radius,
    waypoints: def.waypoints.map((p) => ({ x: p.x, y: p.y })),
    waypoint: 0,
    state: 'pause',
    pauseTimer: GUARD.pause * 0.5,
    searchTimer: 0,
    scanBase: 0,
    scanTime: 0,
    target: null,
    returnTo: 0,
    seesPlayer: false,
    alert: 0,
    bob: index * 1.7,
  };
}

/** Vision wedge for rendering: clipped polygon plus the two boundary rays. */
export function guardWedge(guard, blockers) {
  return visionWedge(
    guard.x, guard.y, guard.angle, GUARD.visionHalfAngle,
    GUARD.visionLength, blockers, 24,
  );
}

/** True when the guard can see the thief right now (range, angle and line of sight). */
export function guardSeesPlayer(guard, player, blockers) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.visionLength) return false;
  if (dist < 0.001) return true;
  const toPlayer = Math.atan2(dy, dx);
  let delta = Math.abs(toPlayer - guard.angle) % (Math.PI * 2);
  if (delta > Math.PI) delta = Math.PI * 2 - delta;
  if (delta > GUARD.visionHalfAngle) return false;
  return !segmentBlocked(guard.x, guard.y, player.x, player.y, blockers);
}

/** Send a guard to a point (coin ping or sprint noise). */
export function investigate(guard, x, y) {
  guard.state = 'investigate';
  guard.target = { x, y };
  guard.alert = 1;
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return 0;
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  const want = Math.atan2(dy, dx);
  guard.angle = approachAngle(guard.angle, want, GUARD.turnRate * dt);
  return dist - step;
}

export function updateGuard(guard, dt, world) {
  guard.scanTime += dt;
  guard.alert = Math.max(0, guard.alert - dt * 0.25);

  switch (guard.state) {
    case 'move': {
      const wp = guard.waypoints[guard.waypoint];
      const left = moveToward(guard, wp.x, wp.y, GUARD.speed, dt);
      if (left <= GUARD.arrival) {
        guard.state = 'pause';
        guard.pauseTimer = GUARD.pause;
        guard.scanBase = guard.angle;
        guard.scanTime = 0;
      }
      break;
    }
    case 'pause': {
      guard.pauseTimer -= dt;
      guard.angle = guard.scanBase + Math.sin(guard.scanTime * 2.1) * GUARD.scanArc;
      if (guard.pauseTimer <= 0) {
        guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
        guard.state = 'move';
      }
      break;
    }
    case 'investigate': {
      if (!guard.target) {
        guard.state = 'return';
        break;
      }
      const left = moveToward(guard, guard.target.x, guard.target.y, GUARD.investigateSpeed, dt);
      if (left <= GUARD.arrival) {
        guard.state = 'search';
        guard.searchTimer = GUARD.searchSeconds;
        guard.scanBase = guard.angle;
        guard.scanTime = 0;
        guard.target = null;
      }
      break;
    }
    case 'search': {
      guard.searchTimer -= dt;
      guard.angle = guard.scanBase + Math.sin(guard.scanTime * 2.6) * (GUARD.scanArc * 1.35);
      if (guard.searchTimer <= 0) {
        // Head for the closest patrol point, then resume the route from there.
        let best = guard.waypoint;
        let bestDist = Infinity;
        for (let i = 0; i < guard.waypoints.length; i++) {
          const d = Math.hypot(guard.waypoints[i].x - guard.x, guard.waypoints[i].y - guard.y);
          if (d < bestDist) { bestDist = d; best = i; }
        }
        guard.waypoint = best;
        guard.state = 'return';
      }
      break;
    }
    case 'return': {
      const wp = guard.waypoints[guard.waypoint];
      const left = moveToward(guard, wp.x, wp.y, GUARD.speed, dt);
      if (left <= GUARD.arrival) {
        guard.state = 'pause';
        guard.pauseTimer = GUARD.pause * 0.6;
        guard.scanBase = guard.angle;
        guard.scanTime = 0;
      }
      break;
    }
    default:
      guard.state = 'move';
  }

  // Guards never walk through walls or cover, even after a distraction.
  collideCircle(guard, guard.radius - 1, world.blockers);
  guard.x = clamp(guard.x, 8, 1272);
  guard.y = clamp(guard.y, 8, 792);
  guard.seesPlayer = guardSeesPlayer(guard, world.player, world.blockers);
}
