// Ceiling cameras: fixed mounts with a slow sinusoidal sweep. Their red cones are
// clipped by the same walls and cover as the guards' yellow ones.
import { CAMERA, angleDelta, approachAngle } from './config.js';
import { segmentBlocked, visionWedge } from './geometry.js';

export function createCamera(def, index) {
  return {
    id: index,
    x: def.x,
    y: def.y,
    base: def.base ?? Math.PI / 2,
    sweep: def.sweep ?? 0.8,
    speed: def.speed ?? 0.7,
    phase: def.phase ?? index * 1.37,
    angle: def.base ?? Math.PI / 2,
    seesPlayer: false,
    blink: index * 0.6,
  };
}

export function updateCamera(camera, dt, world) {
  const target = camera.base + Math.sin(world.time * camera.speed + camera.phase) * camera.sweep;
  camera.angle = approachAngle(camera.angle, target, CAMERA.turnSpeed * 2.4 * dt);
  // Keep the sweep exact once it has caught up, so a paused camera is deterministic.
  if (Math.abs(angleDelta(camera.angle, target)) < 0.002) camera.angle = target;
  camera.blink += dt;
  camera.seesPlayer = cameraSeesPlayer(camera, world.player, world.blockers);
}

export function cameraSeesPlayer(camera, player, blockers) {
  const dx = player.x - camera.x;
  const dy = player.y - camera.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CAMERA.visionLength) return false;
  if (dist < 0.001) return true;
  const toPlayer = Math.atan2(dy, dx);
  let delta = Math.abs(toPlayer - camera.angle) % (Math.PI * 2);
  if (delta > Math.PI) delta = Math.PI * 2 - delta;
  if (delta > CAMERA.visionHalfAngle) return false;
  return !segmentBlocked(camera.x, camera.y, player.x, player.y, blockers);
}

export function cameraWedge(camera, blockers) {
  return visionWedge(
    camera.x, camera.y, camera.angle, CAMERA.visionHalfAngle,
    CAMERA.visionLength, blockers, 30,
  );
}
