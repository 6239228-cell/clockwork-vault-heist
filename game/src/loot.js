// Loot: the one mandatory gold bar plus optional gems. Values are dollars and the
// collected value is the level score.
import { LOOT_VALUE, PLAYER } from './config.js';

/**
 * Turn a level's loot definitions into runtime items. Gem values are explicit per
 * level (750 / 1000 / 1250); the gold bar is always the big payday.
 */
export function createLoot(defs) {
  return defs.map((def, index) => ({
    id: index,
    kind: def.kind,
    x: def.x,
    y: def.y,
    value: def.value ?? (def.kind === 'gold' ? LOOT_VALUE.gold : LOOT_VALUE.gem),
    color: def.color ?? '#58e6ff',
    label: def.label ?? (def.kind === 'gold' ? 'GOLD BAR' : 'GEM'),
    collected: false,
    bob: index * 0.9,
  }));
}

/** Sum of the values a level offers, used by the HUD's "$x of $y". */
export function lootTotal(items) {
  return items.reduce((sum, item) => sum + item.value, 0);
}

/** All the gold in a loot list has been taken. */
export function goldTaken(items) {
  const gold = items.find((item) => item.kind === 'gold');
  return !gold || gold.collected;
}

/** Pick up anything under the thief and return the values collected this frame. */
export function updateLoot(world) {
  const { player } = world;
  let picked = 0;
  for (const item of world.loot) {
    if (item.collected) continue;
    const d = Math.hypot(item.x - player.x, item.y - player.y);
    if (d > PLAYER.pickupRadius + 6) continue;
    item.collected = true;
    picked += item.value;
    world.levelScore += item.value;
    world.totalCollected += item.value;
    world.events.push({ type: 'loot', kind: item.kind, value: item.value });
    if (item.kind === 'gold') {
      world.goldTaken = true;
      world.banner = { text: 'GOLD SECURED — GET TO THE VAN', time: 2.6 };
    }
  }
  return picked;
}

/** The gold bar item, if the level has one. */
export function findGold(items) {
  return items.find((item) => item.kind === 'gold') ?? null;
}
