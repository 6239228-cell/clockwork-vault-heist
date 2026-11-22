// Small 2D collision and visibility helpers. Walls and cover are all axis-aligned
// rectangles, so every question here is either a circle-vs-box push or a
// segment-vs-box slab test. Nothing in this file draws.

/** True when a point sits inside (or on the edge of) a rectangle. */
export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

/** Closest point on a rectangle to (px, py). */
export function closestPoint(px, py, rect) {
  return {
    x: Math.max(rect.x, Math.min(px, rect.x + rect.w)),
    y: Math.max(rect.y, Math.min(py, rect.y + rect.h)),
  };
}

/** True when a circle overlaps a rectangle (touching counts). */
export function circleHitsRect(cx, cy, radius, rect) {
  const near = closestPoint(cx, cy, rect);
  const dx = cx - near.x;
  const dy = cy - near.y;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * Push a circle out of one rectangle along the shallowest axis and report whether
 * anything moved. Mutates `body` ({x, y}), which keeps the response stable even when
 * two walls meet in a corner.
 */
export function pushCircleOut(body, radius, rect) {
  const near = closestPoint(body.x, body.y, rect);
  let dx = body.x - near.x;
  let dy = body.y - near.y;
  let dist = Math.hypot(dx, dy);
  if (dist >= radius) return false;

  if (dist > 0.0001) {
    // Outside the box: push straight out from the closest edge point.
    const overlap = radius - dist;
    body.x += (dx / dist) * overlap;
    body.y += (dy / dist) * overlap;
    return true;
  }

  // Centre is inside the box: escape through the nearest face.
  const left = body.x - rect.x;
  const right = rect.x + rect.w - body.x;
  const top = body.y - rect.y;
  const bottom = rect.y + rect.h - body.y;
  const min = Math.min(left, right, top, bottom);
  if (min === left) body.x = rect.x - radius;
  else if (min === right) body.x = rect.x + rect.w + radius;
  else if (min === top) body.y = rect.y - radius;
  else body.y = rect.y + rect.h + radius;
  return true;
}

/** Resolve a circle against every rectangle in the list. */
export function collideCircle(body, radius, rects) {
  let hit = false;
  for (const rect of rects) {
    if (pushCircleOut(body, radius, rect)) hit = true;
  }
  return hit;
}

/**
 * Segment vs axis-aligned rectangle. Returns the fraction (0..1) of the first hit,
 * or Infinity when the segment misses. A segment starting inside the box returns 0.
 */
export function segmentRectT(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;

  if (Math.abs(dx) < 1e-9) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return Infinity;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }

  if (Math.abs(dy) < 1e-9) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return Infinity;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }

  return tmin;
}

/** True when the straight segment is cut by any rectangle (line of sight blocked). */
export function segmentBlocked(x1, y1, x2, y2, rects) {
  for (const rect of rects) {
    if (segmentRectT(x1, y1, x2, y2, rect) < 1) return true;
  }
  return false;
}

/** Distance a ray travels before hitting a rectangle (Infinity when nothing blocks). */
export function rayDistance(ox, oy, dx, dy, maxLength, rects) {
  let nearest = maxLength;
  for (const rect of rects) {
    const t = segmentRectT(ox, oy, ox + dx * maxLength, oy + dy * maxLength, rect);
    if (t < 1) nearest = Math.min(nearest, t * maxLength);
  }
  return nearest;
}

/**
 * Build the visible wedge of a vision cone, clipped by the level's blockers.
 * Returns { points, edgeA, edgeB, distA, distB } — enough to fill the cone and
 * draw its two crisp boundary rays.
 */
export function visionWedge(ox, oy, angle, halfAngle, length, rects, rays = 26) {
  const points = [{ x: ox, y: oy }];
  const edgeA = rayDistance(ox, oy, Math.cos(angle - halfAngle), Math.sin(angle - halfAngle), length, rects);
  const edgeB = rayDistance(ox, oy, Math.cos(angle + halfAngle), Math.sin(angle + halfAngle), length, rects);
  for (let i = 0; i <= rays; i++) {
    const t = i / rays;
    const a = angle - halfAngle + (halfAngle * 2 * t);
    const dist = rayDistance(ox, oy, Math.cos(a), Math.sin(a), length, rects);
    points.push({ x: ox + Math.cos(a) * dist, y: oy + Math.sin(a) * dist });
  }
  return { points, edgeA, edgeB, distA: edgeA, distB: edgeB };
}

/** Distance between two circles' centres. */
export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
