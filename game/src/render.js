// All of the game's art: dark steel-blue vault floor, warm danger tints, chunky
// walls and cover, clipped vision cones, lasers, the thief, guards, cameras, the
// getaway van, the HUD strip and every overlay. Canvas shapes only.
import {
  ALARM, CAMERA, COLORS, FONT, GUARD, HUD, LASER, MONO, PLAYER, VIEW,
  clamp, formatClock, formatMoney, lerp,
} from './config.js';
import { cameraWedge } from './cameras.js';
import { guardWedge } from './guards.js';

const W = VIEW.width;
const H = VIEW.height;

function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function poly(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function text(ctx, value, x, y, options = {}) {
  const {
    size = 14, weight = 500, color = COLORS.text, align = 'left',
    baseline = 'alphabetic', family = FONT, spacing = 0,
  } = options;
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (spacing) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(value, x, y);
  ctx.restore();
}

// ---------------------------------------------------------------- floor & walls

function gear(ctx, cx, cy, radius, teeth, angle, color, width) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.strokeRect(radius - 6, -3, 14, 6);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * radius * 0.36, Math.sin(a) * radius * 0.36);
    ctx.lineTo(Math.cos(a) * radius * 0.7, Math.sin(a) * radius * 0.7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFloor(ctx, world, time) {
  const backdrop = ctx.createLinearGradient(0, 0, 0, H);
  backdrop.addColorStop(0, COLORS.backdrop);
  backdrop.addColorStop(1, '#04090d');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, W, H);

  const floor = ctx.createLinearGradient(0, 96, 0, 800);
  floor.addColorStop(0, '#102534');
  floor.addColorStop(0.55, COLORS.floor);
  floor.addColorStop(1, COLORS.floorDeep);
  ctx.fillStyle = floor;
  ctx.fillRect(40, 96, 1200, 652);

  // Plate seams.
  ctx.save();
  ctx.strokeStyle = 'rgba(43, 90, 112, 0.32)';
  ctx.lineWidth = 1;
  for (let x = 120; x < 1216; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 120);
    ctx.lineTo(x + 0.5, 724);
    ctx.stroke();
  }
  for (let y = 160; y < 724; y += 80) {
    ctx.beginPath();
    ctx.moveTo(64, y + 0.5);
    ctx.lineTo(1216, y + 0.5);
    ctx.stroke();
  }
  // Larger inset plates with a soft inner highlight.
  ctx.strokeStyle = 'rgba(67, 126, 150, 0.16)';
  for (let x = 64; x < 1216; x += 160) {
    for (let y = 120; y < 724; y += 160) {
      ctx.strokeRect(x + 10.5, y + 10.5, 140, 140);
    }
  }
  ctx.restore();

  // Faint clockwork the bank is named for.
  gear(ctx, 250, 630, 86, 18, time * 0.12, 'rgba(70, 130, 154, 0.14)', 2);
  gear(ctx, 1035, 310, 120, 22, -time * 0.08, 'rgba(70, 130, 154, 0.12)', 2);
  gear(ctx, 660, 660, 58, 14, time * 0.18, 'rgba(70, 130, 154, 0.10)', 2);

  // Warm danger tint around camera mounts.
  for (const camera of world.cameras) {
    const tint = ctx.createRadialGradient(camera.x, camera.y, 0, camera.x, camera.y, 340);
    tint.addColorStop(0, 'rgba(255, 92, 62, 0.11)');
    tint.addColorStop(1, 'rgba(255, 92, 62, 0)');
    ctx.fillStyle = tint;
    ctx.fillRect(camera.x - 340, camera.y - 340, 680, 680);
  }
  // Amber lane under each laser grid.
  for (const laser of world.lasers) {
    const live = laser.state === 'on';
    ctx.save();
    ctx.strokeStyle = live ? COLORS.laserLaneHot : COLORS.laserLane;
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(laser.x1, laser.y1);
    ctx.lineTo(laser.x2, laser.y2);
    ctx.stroke();
    ctx.restore();
  }

  // Border trim around the arena floor.
  ctx.save();
  ctx.strokeStyle = 'rgba(70, 139, 168, 0.32)';
  ctx.lineWidth = 2;
  ctx.strokeRect(64, 120, 1152, 604);
  ctx.restore();
}

function drawWalls(ctx, walls) {
  for (const wall of walls) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.restore();

    const body = ctx.createLinearGradient(0, wall.y, 0, wall.y + wall.h);
    body.addColorStop(0, COLORS.wallTop);
    body.addColorStop(0.28, COLORS.wall);
    body.addColorStop(1, COLORS.wall);
    ctx.fillStyle = body;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

    ctx.fillStyle = 'rgba(120, 190, 214, 0.28)';
    ctx.fillRect(wall.x, wall.y, wall.w, 3);
    ctx.strokeStyle = COLORS.wallEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(wall.x + 1.5, wall.y + 1.5, wall.w - 3, wall.h - 3);

    // Rivets along the long axis.
    ctx.fillStyle = COLORS.wallRivet;
    if (wall.w >= wall.h) {
      for (let x = wall.x + 16; x < wall.x + wall.w - 8; x += 48) {
        ctx.beginPath();
        ctx.arc(x, wall.y + wall.h / 2, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (let y = wall.y + 16; y < wall.y + wall.h - 8; y += 48) {
        ctx.beginPath();
        ctx.arc(wall.x + wall.w / 2, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawCover(ctx, cover) {
  for (const item of cover) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    if (item.kind === 'crate') {
      ctx.fillStyle = COLORS.crate;
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.restore();
      ctx.fillStyle = COLORS.crateTop;
      ctx.fillRect(item.x + 4, item.y + 4, item.w - 8, 7);
      ctx.strokeStyle = COLORS.crateEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(item.x + 1.5, item.y + 1.5, item.w - 3, item.h - 3);
      ctx.strokeStyle = 'rgba(255, 214, 140, 0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(item.x + 8, item.y + 12);
      ctx.lineTo(item.x + item.w - 8, item.y + item.h - 8);
      ctx.moveTo(item.x + item.w - 8, item.y + 12);
      ctx.lineTo(item.x + 8, item.y + item.h - 8);
      ctx.stroke();
    } else if (item.kind === 'safe') {
      ctx.fillStyle = COLORS.safe;
      roundRect(ctx, item.x, item.y, item.w, item.h, 7);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = COLORS.safeTop;
      roundRect(ctx, item.x + 5, item.y + 5, item.w - 10, 12, 4);
      ctx.fill();
      ctx.strokeStyle = COLORS.coverEdge;
      ctx.lineWidth = 3;
      roundRect(ctx, item.x + 1.5, item.y + 1.5, item.w - 3, item.h - 3, 7);
      ctx.stroke();
      // Dial and handle.
      ctx.strokeStyle = COLORS.safeDial;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(item.x + item.w - 24, item.y + item.h / 2 + 4, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(item.x + item.w - 24, item.y + item.h / 2 + 4);
      ctx.lineTo(item.x + item.w - 20, item.y + item.h / 2 - 3);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120, 200, 220, 0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(item.x + 10, item.y + 22, item.w * 0.38, item.h - 30);
    } else {
      // Pillar: a square base with a lighter chamfered top.
      ctx.fillStyle = COLORS.cover;
      roundRect(ctx, item.x, item.y, item.w, item.h, 8);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = COLORS.coverTop;
      roundRect(ctx, item.x + 7, item.y + 7, item.w - 14, item.h - 18, 5);
      ctx.fill();
      ctx.strokeStyle = COLORS.coverEdge;
      ctx.lineWidth = 3;
      roundRect(ctx, item.x + 1.5, item.y + 1.5, item.w - 3, item.h - 3, 8);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(150, 220, 235, 0.13)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(item.x + 12, item.y + item.h - 14);
      ctx.lineTo(item.x + 12, item.y + 12);
      ctx.lineTo(item.x + item.w - 12, item.y + 12);
      ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------- loot & van

function drawGem(ctx, x, y, color, size, time, bob) {
  const lift = Math.sin(time * 2.4 + bob) * 3;
  ctx.save();
  ctx.translate(x, y + lift);
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.82, -size * 0.18);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.82, -size * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.78);
  ctx.lineTo(size * 0.34, -size * 0.12);
  ctx.lineTo(0, size * 0.2);
  ctx.lineTo(-size * 0.34, -size * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(5, 20, 26, 0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(0, size);
  ctx.moveTo(-size * 0.82, -size * 0.18);
  ctx.lineTo(size * 0.82, -size * 0.18);
  ctx.stroke();
  ctx.restore();
}

function drawGold(ctx, x, y, time) {
  const lift = Math.sin(time * 1.9) * 3;
  ctx.save();
  ctx.translate(x, y + lift);
  ctx.shadowColor = COLORS.gold;
  ctx.shadowBlur = 24;
  const grad = ctx.createLinearGradient(0, -20, 0, 20);
  grad.addColorStop(0, COLORS.goldLight);
  grad.addColorStop(0.45, COLORS.gold);
  grad.addColorStop(1, COLORS.goldDark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-26, -12);
  ctx.lineTo(26, -12);
  ctx.lineTo(32, 12);
  ctx.lineTo(-32, 12);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillRect(-22, -10, 34, 4);
  ctx.strokeStyle = 'rgba(90, 55, 4, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-26, -12);
  ctx.lineTo(26, -12);
  ctx.lineTo(32, 12);
  ctx.lineTo(-32, 12);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = COLORS.goldLight;
  ctx.font = `700 9px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('999.9', 0, 6);
  // Sparkles.
  for (let i = 0; i < 3; i++) {
    const a = time * 1.4 + i * 2.1;
    const sx = Math.cos(a) * 34;
    const sy = Math.sin(a * 1.3) * 18 - 22;
    ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(a * 2));
    ctx.fillStyle = COLORS.goldLight;
    ctx.fillRect(sx - 1, sy - 5, 2, 10);
    ctx.fillRect(sx - 5, sy - 1, 10, 2);
  }
  ctx.restore();
}

function drawLoot(ctx, world) {
  for (const item of world.loot) {
    if (item.collected) continue;
    if (item.kind === 'gold') {
      drawGold(ctx, item.x, item.y, world.time);
      text(ctx, 'GOLD BAR  $5,000', item.x, item.y - 34, {
        size: 10, weight: 700, color: 'rgba(255, 225, 130, 0.85)', align: 'center', family: MONO,
      });
    } else {
      drawGem(ctx, item.x, item.y, item.color, 13, world.time, item.bob);
      text(ctx, formatMoney(item.value), item.x, item.y - 24, {
        size: 10, weight: 700, color: 'rgba(220, 245, 250, 0.7)', align: 'center', family: MONO,
      });
    }
  }
}

function drawPings(ctx, world) {
  for (const ping of world.pings) {
    const t = 1 - ping.timer / 4.2;
    const radius = 20 + t * 46;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 214, 90, ${0.55 * (1 - t)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ping.x, ping.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 226, 140, 0.8)';
    ctx.beginPath();
    ctx.arc(ping.x, ping.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCoinsInAir(ctx, world) {
  for (const coin of world.projectiles) {
    const t = Math.min(1, coin.time / coin.duration);
    const arc = Math.sin(t * Math.PI) * 46;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 214, 90, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(coin.fromX, coin.fromY);
    ctx.lineTo(coin.toX, coin.toY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.gold;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y - arc, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawVan(ctx, world) {
  const { van } = world;
  const armed = world.goldTaken;
  const pulse = 0.55 + 0.35 * Math.sin(world.time * 4);
  ctx.save();

  // Loading bay glow under the van.
  const glow = ctx.createRadialGradient(
    van.x + van.w / 2, van.y + van.h / 2, 10,
    van.x + van.w / 2, van.y + van.h / 2, 120,
  );
  glow.addColorStop(0, armed ? `rgba(104, 255, 197, ${0.3 * pulse})` : 'rgba(104, 255, 197, 0.14)');
  glow.addColorStop(1, 'rgba(104, 255, 197, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(van.x - 70, van.y - 70, van.w + 140, van.h + 140);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 9;
  const body = ctx.createLinearGradient(0, van.y, 0, van.y + van.h);
  body.addColorStop(0, '#79f2c6');
  body.addColorStop(0.55, COLORS.van);
  body.addColorStop(1, COLORS.vanDark);
  ctx.fillStyle = body;
  roundRect(ctx, van.x, van.y, van.w, van.h, 14);
  ctx.fill();
  ctx.restore();

  // Wheels.
  ctx.fillStyle = '#08151a';
  for (const wx of [van.x + 12, van.x + van.w - 30]) {
    roundRect(ctx, wx, van.y - 4, 18, 12, 5);
    ctx.fill();
    roundRect(ctx, wx, van.y + van.h - 8, 18, 12, 5);
    ctx.fill();
  }
  // Windshield and roof.
  ctx.fillStyle = COLORS.vanGlass;
  roundRect(ctx, van.x + van.w - 34, van.y + 12, 20, van.h - 24, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(8, 40, 34, 0.55)';
  roundRect(ctx, van.x + 14, van.y + 14, van.w - 56, van.h - 28, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 255, 225, 0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, van.x + 18, van.y + 18, van.w - 64, van.h - 36, 6);
  ctx.stroke();
  text(ctx, 'GETAWAY', van.x + van.w * 0.43, van.y + van.h / 2 + 5, {
    size: 13, weight: 800, color: 'rgba(180, 255, 230, 0.9)', align: 'center', spacing: 2,
  });
  // Rear doors face left; the glowing exit lip.
  ctx.strokeStyle = armed ? COLORS.exit : 'rgba(104, 255, 197, 0.45)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(van.x + 2, van.y + 10);
  ctx.lineTo(van.x + 2, van.y + van.h - 10);
  ctx.stroke();
  // Chevrons pointing in.
  ctx.save();
  ctx.globalAlpha = armed ? pulse : 0.3;
  ctx.strokeStyle = COLORS.exit;
  ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) {
    const x = van.x - 14 - i * 12;
    ctx.beginPath();
    ctx.moveTo(x + 8, van.y + van.h / 2 - 9);
    ctx.lineTo(x, van.y + van.h / 2);
    ctx.lineTo(x + 8, van.y + van.h / 2 + 9);
    ctx.stroke();
  }
  ctx.restore();

  text(ctx, armed ? 'EXIT OPEN' : 'EXIT', van.x + van.w / 2, van.y + van.h + 18, {
    size: 10, weight: 700, align: 'center', family: MONO,
    color: armed ? COLORS.exit : 'rgba(104, 255, 197, 0.55)',
  });
}

// --------------------------------------------------------------- vision cones

function drawCone(ctx, wedge, source, length, fill, core, edge) {
  if (wedge.points.length < 3) return;
  const grad = ctx.createRadialGradient(source.x, source.y, 8, source.x, source.y, length);
  grad.addColorStop(0, fill[0]);
  grad.addColorStop(0.55, fill[1]);
  grad.addColorStop(1, fill[2]);
  ctx.save();
  poly(ctx, wedge.points);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.clip();
  // Brighter core cone.
  const inner = ctx.createRadialGradient(source.x, source.y, 10, source.x, source.y, length * 0.9);
  inner.addColorStop(0, core[0]);
  inner.addColorStop(1, core[1]);
  ctx.fillStyle = inner;
  const first = wedge.points[1];
  const mid = wedge.points[Math.floor(wedge.points.length / 2)];
  ctx.beginPath();
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(source.x + (first.x - source.x) * 0.52, source.y + (first.y - source.y) * 0.52);
  ctx.lineTo(source.x + (mid.x - source.x) * 1.0, source.y + (mid.y - source.y) * 1.0);
  ctx.lineTo(source.x + (first.x - source.x) * 0.52, source.y + (first.y - source.y) * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(source.x, source.y);
  const last = wedge.points[wedge.points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(first.x, first.y);
  ctx.stroke();
  ctx.restore();
}

function drawVision(ctx, world) {
  for (const guard of world.guards) {
    const wedge = guardWedge(guard, world.blockers);
    drawCone(
      ctx, wedge, guard, GUARD.visionLength,
      ['rgba(255, 226, 120, 0.20)', 'rgba(247, 199, 74, 0.12)', 'rgba(247, 199, 74, 0.02)'],
      ['rgba(255, 238, 160, 0.18)', 'rgba(255, 238, 160, 0.02)'],
      COLORS.guardConeEdge,
    );
  }
  for (const camera of world.cameras) {
    const wedge = cameraWedge(camera, world.blockers);
    drawCone(
      ctx, wedge, camera, CAMERA.visionLength,
      ['rgba(255, 96, 82, 0.22)', 'rgba(255, 72, 62, 0.12)', 'rgba(255, 72, 62, 0.02)'],
      ['rgba(255, 150, 130, 0.18)', 'rgba(255, 120, 100, 0.02)'],
      COLORS.cameraConeEdge,
    );
  }
}

// ------------------------------------------------------------------ characters

function drawGuard(ctx, guard, time) {
  const bob = Math.sin(time * 7 + guard.bob) * (guard.state === 'pause' ? 0.4 : 1.4);
  ctx.save();
  ctx.translate(guard.x, guard.y + bob);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs.
  const stride = Math.sin(time * 9 + guard.bob) * 4;
  ctx.fillStyle = '#16232e';
  roundRect(ctx, -8, 6 + stride, 6, 10, 2);
  ctx.fill();
  roundRect(ctx, 2, 6 - stride, 6, 10, 2);
  ctx.fill();

  // Body.
  ctx.save();
  ctx.rotate(guard.angle);
  ctx.fillStyle = COLORS.guardBody;
  ctx.beginPath();
  ctx.arc(0, 0, GUARD.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(5, 15, 20, 0.9)';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Yellow shoulder flash and cap.
  ctx.fillStyle = COLORS.guard;
  ctx.beginPath();
  ctx.arc(0, 0, GUARD.radius - 3, -0.9, 0.9);
  ctx.lineTo(2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f7e7a8';
  ctx.beginPath();
  ctx.arc(4, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#24323c';
  ctx.beginPath();
  ctx.arc(6.5, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Alert marker while investigating.
  if (guard.state === 'investigate' || guard.state === 'search') {
    const pulse = 0.6 + 0.4 * Math.sin(time * 10);
    ctx.fillStyle = `rgba(255, 209, 74, ${pulse})`;
    ctx.beginPath();
    ctx.arc(0, -30, 10, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, '?', 0, -26, { size: 14, weight: 800, color: '#1a1300', align: 'center', baseline: 'middle' });
  }
  ctx.restore();
}

function drawCamera(ctx, camera, time) {
  ctx.save();
  ctx.translate(camera.x, camera.y);
  // Wall mount.
  ctx.fillStyle = '#101d26';
  ctx.beginPath();
  ctx.arc(0, 0, CAMERA.radius + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3b6172';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.rotate(camera.angle);
  // Housing.
  ctx.fillStyle = '#243c48';
  roundRect(ctx, -8, -9, 26, 18, 6);
  ctx.fill();
  ctx.strokeStyle = '#0a1319';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Lens.
  ctx.fillStyle = COLORS.camera;
  ctx.shadowColor = COLORS.camera;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(15, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffe4dd';
  ctx.beginPath();
  ctx.arc(16, -1.4, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Blinking status light, drawn unrotated.
  const on = Math.sin(time * 5 + camera.blink) > 0;
  ctx.fillStyle = on ? '#ff6b5c' : '#5a211c';
  ctx.beginPath();
  ctx.arc(camera.x - 7, camera.y - 10, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawThief(ctx, world) {
  const { player } = world;
  const moving = player.speedNow > 25;
  const bob = moving ? Math.sin(player.walkPhase * 2) * 2 : Math.sin(world.time * 3) * 0.8;

  // Sprint noise ring.
  if (world.sprinting && moving) {
    ctx.save();
    ctx.strokeStyle = `rgba(121, 239, 197, ${0.2 + 0.1 * Math.sin(world.time * 9)})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER.radius + 58 + Math.sin(world.time * 4) * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 15, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(player.angle);
  // Legs.
  const stride = moving ? Math.sin(player.walkPhase * 2.4) * 5 : 0;
  ctx.fillStyle = COLORS.thiefDark;
  roundRect(ctx, -7, 4 + stride, 6, 11, 3);
  ctx.fill();
  roundRect(ctx, 1, 4 - stride, 6, 11, 3);
  ctx.fill();
  // Backpack behind the body.
  ctx.fillStyle = COLORS.thiefPack;
  roundRect(ctx, -16, -9, 12, 18, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(121, 239, 197, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Body.
  ctx.fillStyle = COLORS.thief;
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(4, 28, 24, 0.95)';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Hood highlight.
  ctx.fillStyle = COLORS.thiefLight;
  ctx.beginPath();
  ctx.arc(2, -2, 8, -2.5, 0.4);
  ctx.fill();
  // Mask band.
  ctx.fillStyle = '#0a2a28';
  roundRect(ctx, 3, -5, 10, 10, 3);
  ctx.fill();
  ctx.fillStyle = '#d9fff2';
  ctx.fillRect(9, -3, 3, 2);
  ctx.fillRect(9, 1, 3, 2);
  ctx.restore();

  // Carrying the gold.
  if (world.goldTaken) {
    ctx.save();
    ctx.rotate(world.time * 1.4);
    ctx.fillStyle = COLORS.gold;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 12;
    roundRect(ctx, -5, -22, 10, 7, 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  // Throw-aim hint at the last pointer target.
  if (player.lastThrow) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 214, 90, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.lastThrow.x, player.lastThrow.y);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------- lasers

function drawLasers(ctx, world) {
  for (const laser of world.lasers) {
    const on = laser.state === 'on';
    const warn = laser.state === 'warn';
    const pulse = 0.5 + 0.5 * Math.sin(world.time * 22);

    // Emitter posts at both ends.
    for (const [ex, ey] of [[laser.x1, laser.y1], [laser.x2, laser.y2]]) {
      ctx.save();
      ctx.fillStyle = '#1a2c36';
      roundRect(ctx, ex - 7, ey - 7, 14, 14, 4);
      ctx.fill();
      ctx.strokeStyle = on ? COLORS.laser : warn ? COLORS.alarm : '#3d5765';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = on ? COLORS.laserHot : warn ? COLORS.alarm : '#40606f';
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.lineCap = 'round';
    if (on) {
      ctx.shadowColor = COLORS.laser;
      ctx.shadowBlur = 22;
      ctx.strokeStyle = 'rgba(255, 61, 51, 0.28)';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
      ctx.strokeStyle = COLORS.laser;
      ctx.lineWidth = LASER.beamWidth;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = COLORS.laserHot;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (warn) {
      ctx.strokeStyle = `rgba(255, 176, 46, ${0.35 + 0.55 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 7]);
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Warning sparks at the midpoint.
      const mx = (laser.x1 + laser.x2) / 2;
      const my = (laser.y1 + laser.y2) / 2;
      ctx.fillStyle = `rgba(255, 196, 80, ${0.4 + 0.5 * pulse})`;
      ctx.beginPath();
      ctx.arc(mx, my, 4 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, '!', mx, my + 1, {
        size: 10, weight: 900, color: '#2a1500', align: 'center', baseline: 'middle',
      });
    } else {
      ctx.strokeStyle = 'rgba(255, 176, 74, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 11]);
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------------- HUD

function drawAlarmBar(ctx, world) {
  const x = 352;
  const y = 44;
  const w = 320;
  const h = 18;
  const value = clamp(world.alarm / ALARM.max, 0, 1);
  const hot = value >= 0.85;
  const color = value < 0.5 ? COLORS.alarm : value < 0.82 ? '#ff7d2e' : COLORS.alarmHot;

  text(ctx, 'ALARM', x, y - 8, { size: 10, weight: 800, color: COLORS.muted, spacing: 2, family: MONO });
  text(ctx, `${Math.round(world.alarm)}%`, x + w, y - 8, {
    size: 10, weight: 800, color: world.spotted ? color : COLORS.muted, align: 'right', family: MONO,
  });

  ctx.save();
  roundRect(ctx, x, y, w, h, 5);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(70, 120, 140, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (value > 0) {
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, '#2f7f6a');
    grad.addColorStop(0.45, COLORS.alarm);
    grad.addColorStop(0.8, '#ff7d2e');
    grad.addColorStop(1, COLORS.alarmHot);
    ctx.save();
    roundRect(ctx, x, y, w, h, 5);
    ctx.clip();
    ctx.fillStyle = hot && world.spotted ? (Math.sin(world.time * 16) > 0 ? '#ff8a80' : grad) : grad;
    ctx.fillRect(x, y, w * value, h);
    ctx.restore();
  }
  // Segment ticks.
  ctx.strokeStyle = 'rgba(4, 16, 22, 0.65)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w / 10) * i, y + 2);
    ctx.lineTo(x + (w / 10) * i, y + h - 2);
    ctx.stroke();
  }
  ctx.restore();

  if (world.spotted) {
    const label = world.alarmSource ? `SPOTTED — ${world.alarmSource}` : 'SPOTTED';
    text(ctx, label, x + w / 2, y + h + 15, {
      size: 10, weight: 700, color: hot ? COLORS.alarmHot : COLORS.alarm, align: 'center', family: MONO,
    });
  } else if (world.alarm > 1) {
    text(ctx, 'COOLING', x + w / 2, y + h + 15, {
      size: 10, weight: 700, color: COLORS.dim, align: 'center', family: MONO,
    });
  }
}

function drawCoinIcon(ctx, x, y, filled) {
  ctx.save();
  ctx.fillStyle = filled ? COLORS.gold : 'rgba(0, 0, 0, 0)';
  ctx.strokeStyle = filled ? COLORS.goldDark : 'rgba(120, 160, 175, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHUD(ctx, game) {
  const world = game.world;
  if (!world) return;

  ctx.save();
  ctx.fillStyle = COLORS.hud;
  ctx.fillRect(0, 0, W, HUD.height);
  ctx.strokeStyle = COLORS.hudLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HUD.height - 1);
  ctx.lineTo(W, HUD.height - 1);
  ctx.stroke();
  // A subtle gear tooth pattern along the bar.
  ctx.strokeStyle = 'rgba(70, 140, 170, 0.16)';
  ctx.lineWidth = 1;
  for (let x = 10; x < W; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, HUD.height);
    ctx.lineTo(x, HUD.height - 5);
    ctx.stroke();
  }
  ctx.restore();

  // Left: vault number, name, loot.
  text(ctx, `${world.code} / 03`, 26, 26, {
    size: 10, weight: 800, color: COLORS.blue, spacing: 2, family: MONO,
  });
  text(ctx, world.name, 26, 54, { size: 23, weight: 800, color: COLORS.text });
  text(ctx, `LOOT  ${formatMoney(world.levelScore)} / ${formatMoney(world.lootTotal)}`, 26, 76, {
    size: 12, weight: 700, color: world.goldTaken ? COLORS.gold : COLORS.muted, family: MONO,
  });

  // Centre: alarm meter.
  drawAlarmBar(ctx, world);

  // Right: timer, coins.
  const timeHot = world.remaining <= 15;
  const flash = timeHot ? 0.65 + 0.35 * Math.sin(world.time * 10) : 1;
  text(ctx, 'TIME', 1254, 26, {
    size: 10, weight: 800, color: COLORS.muted, align: 'right', spacing: 2, family: MONO,
  });
  ctx.save();
  ctx.globalAlpha = flash;
  text(ctx, formatClock(world.remaining), 1254, 62, {
    size: 38, weight: 800, color: timeHot ? COLORS.alarmHot : COLORS.text,
    align: 'right', family: MONO,
  });
  ctx.restore();

  text(ctx, 'COINS', 1010, 30, { size: 10, weight: 800, color: COLORS.muted, spacing: 2, family: MONO });
  for (let i = 0; i < 5; i++) {
    drawCoinIcon(ctx, 1018 + i * 16, 52, i < world.coins);
  }
  text(ctx, `${world.coins} LEFT`, 1018, 76, {
    size: 10, weight: 700, color: world.coins > 0 ? COLORS.gold : COLORS.dim, family: MONO,
  });
  text(ctx, world.goldTaken ? 'GOLD ✓' : 'GOLD —', 1018, 90, {
    size: 10, weight: 700, color: world.goldTaken ? COLORS.good : COLORS.dim, family: MONO,
  });

  // Objective ribbon.
  const oy = HUD.objectiveTop;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 12, 18, 0.97)';
  ctx.fillRect(0, oy, W, HUD.objectiveHeight);
  ctx.strokeStyle = 'rgba(70, 140, 170, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, oy + 0.5);
  ctx.lineTo(W, oy + 0.5);
  ctx.stroke();
  // Gold diamond marker.
  ctx.fillStyle = world.goldTaken ? COLORS.good : COLORS.gold;
  ctx.beginPath();
  ctx.moveTo(28, oy + 16);
  ctx.lineTo(36, oy + 9);
  ctx.lineTo(44, oy + 16);
  ctx.lineTo(36, oy + 23);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  text(ctx, world.objective, 54, oy + 21, {
    size: 12, weight: 600, color: '#b9d3de',
  });
  text(ctx, 'WASD MOVE · SHIFT SPRINT · CLICK COIN · R RESTART · M MUTE', 1254, oy + 21, {
    size: 10, weight: 600, color: COLORS.dim, align: 'right', family: MONO,
  });

  // Event banner.
  if (world.banner) {
    const alpha = clamp(world.banner.time, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(4, 14, 20, 0.9)';
    roundRect(ctx, W / 2 - 250, 108, 500, 40, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, world.banner.text, W / 2, 133, {
      size: 14, weight: 800, color: COLORS.goldLight, align: 'center', spacing: 1, family: MONO,
    });
    ctx.restore();
  }

  // Screen-edge alarm vignette.
  if (world.alarm > 35) {
    const strength = clamp((world.alarm - 35) / 65, 0, 1);
    const pulse = 0.7 + 0.3 * Math.sin(world.time * 7);
    const vignette = ctx.createRadialGradient(W / 2, H / 2, 320, W / 2, H / 2, 760);
    vignette.addColorStop(0, 'rgba(255, 50, 40, 0)');
    vignette.addColorStop(1, `rgba(255, 50, 40, ${(0.28 * strength * pulse).toFixed(3)})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }
}

// -------------------------------------------------------------------- overlays

function drawGearDoor(ctx, cx, cy, radius, angle) {
  ctx.save();
  ctx.translate(cx, cy);
  // Outer housing.
  ctx.fillStyle = '#0a1720';
  ctx.beginPath();
  ctx.arc(0, 0, radius + 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(65, 130, 155, 0.45)';
  ctx.lineWidth = 3;
  ctx.stroke();
  const grad = ctx.createRadialGradient(-40, -60, 20, 0, 0, radius);
  grad.addColorStop(0, '#1d3d4d');
  grad.addColorStop(1, '#0c1c26');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 200, 225, 0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 8, 0, Math.PI * 2);
  ctx.stroke();
  gear(ctx, 0, 0, radius * 0.72, 20, angle, 'rgba(90, 170, 195, 0.5)', 3);
  gear(ctx, 0, 0, radius * 0.42, 12, -angle * 1.5, 'rgba(255, 210, 74, 0.55)', 3);
  // Handle spokes.
  ctx.strokeStyle = 'rgba(255, 210, 74, 0.8)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = angle + (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22);
    ctx.lineTo(Math.cos(a) * (radius * 0.62), Math.sin(a) * (radius * 0.62));
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function overlayShade(ctx, color = 'rgba(3, 9, 14, 0.82)') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}

function drawTitle(ctx, game) {
  const t = game.time;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#07131c');
  bg.addColorStop(0.55, '#050d13');
  bg.addColorStop(1, '#02070a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Faint blueprint grid.
  ctx.save();
  ctx.strokeStyle = 'rgba(60, 130, 155, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 64) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
  }
  ctx.restore();

  drawGearDoor(ctx, 640, 400, 205, t * 0.18);

  const glow = ctx.createRadialGradient(640, 400, 60, 640, 400, 420);
  glow.addColorStop(0, 'rgba(255, 210, 74, 0.12)');
  glow.addColorStop(1, 'rgba(255, 210, 74, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(220, 0, 840, 800);

  // Title plate.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(4, 12, 18, 0.78)';
  roundRect(ctx, 235, 76, 810, 214, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 210, 74, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  text(ctx, 'A CLOCKWORK HEIST', 640, 118, {
    size: 12, weight: 800, color: COLORS.blue, align: 'center', spacing: 6, family: MONO,
  });
  text(ctx, 'THE CLOCKWORK', 640, 190, {
    size: 56, weight: 800, color: COLORS.text, align: 'center', spacing: 4,
  });
  const goldGrad = ctx.createLinearGradient(0, 214, 0, 286);
  goldGrad.addColorStop(0, COLORS.goldLight);
  goldGrad.addColorStop(0.55, COLORS.gold);
  goldGrad.addColorStop(1, '#b97d10');
  ctx.save();
  ctx.font = `900 104px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = goldGrad;
  ctx.shadowColor = 'rgba(255, 200, 60, 0.35)';
  ctx.shadowBlur = 26;
  ctx.fillText('VAULT', 640, 282);
  ctx.restore();

  text(ctx, 'Three vaults. One gold bar each. A getaway van with the engine running.', 640, 336, {
    size: 16, weight: 500, color: '#9dbdcb', align: 'center',
  });
  text(ctx, 'Dodge the yellow patrol cones, slip the red camera sweeps, and time the lasers.', 640, 362, {
    size: 14, weight: 500, color: COLORS.muted, align: 'center',
  });

  const pulse = 0.55 + 0.45 * Math.sin(t * 3.4);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(ctx, 'PRESS ENTER OR CLICK TO START', 640, 618, {
    size: 20, weight: 800, color: COLORS.good, align: 'center', spacing: 3, family: MONO,
  });
  ctx.restore();

  // Controls strip.
  ctx.save();
  ctx.fillStyle = 'rgba(4, 13, 19, 0.85)';
  roundRect(ctx, 260, 662, 760, 76, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 130, 155, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  const controls = [
    ['WASD / ARROWS', 'MOVE'],
    ['SHIFT', 'SPRINT (LOUD)'],
    ['CLICK', 'THROW COIN'],
    ['R / M', 'RESTART / MUTE'],
  ];
  controls.forEach(([key, label], i) => {
    const x = 320 + i * 178;
    text(ctx, key, x, 692, {
      size: 12, weight: 800, color: COLORS.gold, align: 'center', family: MONO,
    });
    text(ctx, label, x, 712, {
      size: 10, weight: 600, color: COLORS.muted, align: 'center', family: MONO,
    });
  });

  text(ctx, 'ALARM 100% = LOCKDOWN  ·  THE GOLD IS MANDATORY  ·  GEMS ARE NOT', 640, 770, {
    size: 11, weight: 600, color: COLORS.dim, align: 'center', family: MONO, spacing: 1,
  });
}

function drawCaught(ctx, game) {
  const world = game.world;
  overlayShade(ctx, 'rgba(22, 3, 3, 0.8)');
  // Lockdown bars.
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ff2f24';
  ctx.fillRect(0, 0, W, 12);
  ctx.fillRect(0, H - 12, W, 12);
  for (let x = 0; x < W; x += 56) {
    ctx.fillRect(x, 0, 22, 46);
    ctx.fillRect(x + 28, H - 46, 22, 46);
  }
  ctx.restore();

  const shake = Math.sin(game.time * 34) * 3;
  ctx.save();
  ctx.translate(shake, 0);
  text(ctx, 'LOCKDOWN', 640, 300, {
    size: 112, weight: 900, color: COLORS.alarmHot, align: 'center', spacing: 8,
  });
  text(ctx, world?.reason ?? 'THE VAULT IS SEALED', 640, 350, {
    size: 18, weight: 700, color: '#ffb3a8', align: 'center', family: MONO,
  });
  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(10, 2, 2, 0.78)';
  roundRect(ctx, 400, 400, 480, 180, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 80, 64, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const rows = world ? [
    ['ALARM', `${Math.round(world.alarm)}%`],
    ['LOOT IN HAND', formatMoney(world.levelScore)],
    ['TIME LEFT', formatClock(world.remaining)],
  ] : [];
  rows.forEach(([label, value], i) => {
    const y = 442 + i * 42;
    text(ctx, label, 440, y, { size: 12, weight: 700, color: COLORS.muted, family: MONO, spacing: 1 });
    text(ctx, value, 840, y, { size: 22, weight: 800, color: COLORS.text, align: 'right', family: MONO });
  });

  const pulse = 0.6 + 0.4 * Math.sin(game.time * 4);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(ctx, 'PRESS R TO RETRY THE HEIST', 640, 660, {
    size: 20, weight: 800, color: COLORS.alarm, align: 'center', spacing: 2, family: MONO,
  });
  ctx.restore();
  text(ctx, 'Tip: break line of sight behind a pillar before the meter fills.', 640, 700, {
    size: 12, weight: 500, color: COLORS.muted, align: 'center',
  });
}

function drawLevelClear(ctx, game) {
  const world = game.world;
  overlayShade(ctx, 'rgba(3, 10, 14, 0.82)');
  if (world) drawGearDoor(ctx, 640, 470, 180, game.time * 0.3);

  text(ctx, 'VAULT CLEARED', 640, 250, {
    size: 78, weight: 900, color: COLORS.goldLight, align: 'center', spacing: 5,
  });
  text(ctx, world ? world.name.toUpperCase() : '', 640, 292, {
    size: 15, weight: 700, color: COLORS.blue, align: 'center', spacing: 4, family: MONO,
  });

  ctx.save();
  ctx.fillStyle = 'rgba(4, 14, 20, 0.88)';
  roundRect(ctx, 390, 330, 500, 176, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 210, 74, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  if (world) {
    const rows = [
      ['LOOT SECURED', formatMoney(world.levelScore)],
      ['VAULT TOTAL', `${formatMoney(world.levelScore)} / ${formatMoney(world.lootTotal)}`],
      ['TIME LEFT', formatClock(world.remaining)],
      ['HEIST SCORE', formatMoney(world.totalCollected)],
    ];
    rows.forEach(([label, value], i) => {
      const y = 366 + i * 36;
      text(ctx, label, 424, y, { size: 12, weight: 700, color: COLORS.muted, family: MONO, spacing: 1 });
      text(ctx, value, 856, y, {
        size: 20, weight: 800, color: i === 3 ? COLORS.gold : COLORS.text,
        align: 'right', family: MONO,
      });
    });
  }

  const pulse = 0.6 + 0.4 * Math.sin(game.time * 4);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(ctx, game.levelIndex >= 2 ? 'PRESS ENTER FOR THE FINAL SCORE' : 'PRESS ENTER — NEXT VAULT', 640, 596, {
    size: 19, weight: 800, color: COLORS.good, align: 'center', spacing: 2, family: MONO,
  });
  ctx.restore();
  text(ctx, 'Every gem you skipped stays on the table. So does its value.', 640, 640, {
    size: 12, weight: 500, color: COLORS.muted, align: 'center',
  });
}

function drawWin(ctx, game) {
  const world = game.world;
  const bg = ctx.createRadialGradient(640, 420, 80, 640, 420, 780);
  bg.addColorStop(0, '#123028');
  bg.addColorStop(0.55, '#07161a');
  bg.addColorStop(1, '#02070a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Celebration gear sparks.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + game.time * 0.12;
    const r = 280 + Math.sin(game.time * 1.4 + i) * 26;
    const x = 640 + Math.cos(a) * r;
    const y = 400 + Math.sin(a) * r * 0.62;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.3 * Math.abs(Math.sin(game.time * 2 + i));
    ctx.fillStyle = i % 3 === 0 ? COLORS.gold : i % 3 === 1 ? COLORS.good : COLORS.blue;
    ctx.translate(x, y);
    ctx.rotate(a + game.time * 0.4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }

  drawGearDoor(ctx, 640, 400, 165, game.time * 0.22);

  text(ctx, 'THE CLOCKWORK VAULT', 640, 116, {
    size: 20, weight: 800, color: COLORS.blue, align: 'center', spacing: 8, family: MONO,
  });
  text(ctx, 'IS YOURS', 640, 238, {
    size: 112, weight: 900, color: COLORS.goldLight, align: 'center', spacing: 6,
  });

  text(ctx, 'FINAL SCORE', 640, 320, {
    size: 12, weight: 800, color: COLORS.muted, align: 'center', spacing: 4, family: MONO,
  });
  text(ctx, formatMoney(world ? world.totalCollected : game.totalScore), 640, 388, {
    size: 66, weight: 900, color: COLORS.gold, align: 'center', family: MONO,
  });

  ctx.save();
  ctx.fillStyle = 'rgba(4, 14, 20, 0.8)';
  roundRect(ctx, 400, 430, 480, 118, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(100, 240, 178, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const stats = [
    ['GOLD BARS', '3 / 3'],
    ['VAULTS CLEARED', '3 / 3'],
    ['GEMS', `${world?.gemsCollected ?? (world ? world.loot.filter((l) => l.kind === 'gem' && l.collected).length : 0)} / ${world?.gemTotal ?? (world ? world.loot.filter((l) => l.kind === 'gem').length : 0)}`],
  ];
  stats.forEach(([label, value], i) => {
    const x = 470 + i * 170;
    text(ctx, value, x, 474, { size: 24, weight: 800, color: COLORS.good, align: 'center', family: MONO });
    text(ctx, label, x, 500, { size: 9, weight: 700, color: COLORS.muted, align: 'center', spacing: 1, family: MONO });
  });

  const pulse = 0.6 + 0.4 * Math.sin(game.time * 4);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(ctx, 'PRESS R TO RUN IT AGAIN', 640, 642, {
    size: 18, weight: 800, color: COLORS.good, align: 'center', spacing: 3, family: MONO,
  });
  ctx.restore();
  text(ctx, 'The gears keep turning. So does the getaway van.', 640, 684, {
    size: 12, weight: 500, color: COLORS.muted, align: 'center',
  });
}

// ------------------------------------------------------------------ main draw

export function render(ctx, game) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COLORS.backdrop;
  ctx.fillRect(0, 0, W, H);

  const world = game.world;
  if (game.screen === 'title' || !world) {
    drawTitle(ctx, game);
    ctx.restore();
    return;
  }

  drawFloor(ctx, world, world.time);
  drawVan(ctx, world);
  drawWalls(ctx, world.walls);
  drawCover(ctx, world.cover);
  drawLasers(ctx, world);
  drawVision(ctx, world);
  drawLoot(ctx, world);
  drawPings(ctx, world);
  for (const camera of world.cameras) drawCamera(ctx, camera, world.time);
  for (const guard of world.guards) drawGuard(ctx, guard, world.time);
  drawThief(ctx, world);
  drawCoinsInAir(ctx, world);

  drawHUD(ctx, game);

  if (game.screen === 'caught') drawCaught(ctx, game);
  else if (game.screen === 'levelclear') drawLevelClear(ctx, game);
  else if (game.screen === 'won') drawWin(ctx, game);

  ctx.restore();
}
