// The Clockwork Vault — game shell: screens, fixed-step loop, staging for the four
// hand-in screenshots, audio hookup and input routing.
import { STEP, VIEW } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createWorld, LEVELS, updateWorld } from './levels.js';
import { render } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam !== 0 ? seedParam : 1;
const shot = params.get('shot');

const input = createInput(canvas);
const audio = createAudio();

const game = {
  screen: 'title',
  levelIndex: 0,
  world: null,
  time: 0,
  totalScore: 0,
  seed,
};

let banked = 0;
let accumulator = 0;
let lastFrame = 0;

function setStatus(message) {
  if (statusLine) statusLine.textContent = message;
}

function startLevel(index) {
  game.levelIndex = index;
  game.world = createWorld(index, seed);
  game.world.totalCollected = banked;
  game.screen = 'playing';
  game.time = 0;
  input.consumeThrow(); // a click that started/retried the level must not throw a coin
  accumulator = 0;
  const level = LEVELS[index];
  setStatus(`Vault ${index + 1}: ${level.name}. Find the gold bar and return to the van.`);
  audio.play('start');
}

function restartRun() {
  banked = 0;
  startLevel(0);
}

function drainEvents() {
  const world = game.world;
  if (!world) return;
  for (const event of world.events) {
    if (event.type === 'loot') audio.play('loot', event);
    else if (event.type === 'coin') audio.play('coin');
    else if (event.type === 'coinLand') audio.play('coinLand');
    else if (event.type === 'sting') audio.play('sting');
    else if (event.type === 'noise') audio.play('noise');
  }
  world.events.length = 0;
}

function advanceWorld(dt) {
  const world = game.world;
  if (!world) return;
  accumulator = Math.min(accumulator + dt, STEP * 8);
  let steps = 0;
  while (accumulator >= STEP && steps < 8 && game.screen === 'playing') {
    updateWorld(world, STEP, input);
    accumulator -= STEP;
    steps += 1;
    drainEvents();
    if (world.phase === 'caught') {
      game.screen = 'caught';
      setStatus('Lockdown. The vault is sealed. Press R to retry.');
      audio.play('caught');
    } else if (world.phase === 'clear') {
      banked = world.totalCollected;
      game.totalScore = banked;
      if (game.levelIndex >= LEVELS.length - 1) {
        game.screen = 'won';
        setStatus('All three vaults cleared. The Clockwork Vault is yours.');
        audio.play('win');
      } else {
        game.screen = 'levelclear';
        setStatus(`Vault ${game.levelIndex + 1} cleared. Press Enter for the next vault.`);
        audio.play('clear');
      }
    }
  }
}

function handleScreens() {
  if (input.wasPressed('KeyM')) {
    const muted = audio.toggleMute();
    setStatus(muted ? 'Sound muted.' : 'Sound on.');
  }

  switch (game.screen) {
    case 'title': {
      const clicked = input.consumeThrow();
      if (input.wasPressed('Enter') || input.wasPressed('Space') || clicked) {
        audio.unlock();
        banked = 0;
        startLevel(0);
      }
      break;
    }
    case 'playing': {
      if (input.wasPressed('KeyR')) startLevel(game.levelIndex);
      break;
    }
    case 'levelclear': {
      if (input.wasPressed('Enter') || input.wasPressed('Space')) startLevel(game.levelIndex + 1);
      else if (input.wasPressed('KeyR')) startLevel(game.levelIndex);
      break;
    }
    case 'caught': {
      if (input.wasPressed('KeyR') || input.wasPressed('Enter') || input.wasPressed('Space')) {
        startLevel(game.levelIndex);
      }
      break;
    }
    case 'won': {
      if (input.wasPressed('KeyR') || input.wasPressed('Enter') || input.wasPressed('Space')) {
        restartRun();
      }
      break;
    }
    default:
      break;
  }
}

window.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
window.addEventListener('keydown', () => audio.unlock());

// ------------------------------------------------------------------ staged shots

function runStagedShot() {
  const index = shot === '2' ? 1 : shot === '4' ? 2 : 0;
  const world = createWorld(index, seed);
  const screen = stageShot(shot, world);
  game.world = world;
  game.levelIndex = index;
  game.screen = screen;
  game.time = world.time;
  game.totalScore = world.totalCollected;

  const draw = () => {
    game.time = world.time;
    render(ctx, game);
  };
  draw();
  // One more frame after layout guarantees the canvas has its final CSS size.
  const finish = () => {
    draw();
    window.__ready = true;
  };
  // rAF is the normal path; the timer covers a headless tab that throttles rAF.
  window.requestAnimationFrame(finish);
  window.setTimeout(finish, 120);
  window.__gameState = () => ({
    screen: game.screen,
    level: game.levelIndex + 1,
    alarm: world.alarm,
    remaining: world.remaining,
    score: world.totalCollected,
    loot: world.loot.filter((item) => item.collected).length,
    gold: world.goldTaken,
    player: { x: world.player.x, y: world.player.y },
  });
}

// ----------------------------------------------------------------------- loop

function frame(now) {
  const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  game.time += dt;

  handleScreens();

  if (game.screen === 'playing') {
    advanceWorld(dt);
    if (game.world) audio.update(game.world, dt);
  }

  render(ctx, game);
  input.endFrame();
  if (!window.__ready) window.__ready = true;
  window.requestAnimationFrame(frame);
}

if (shot) {
  runStagedShot();
} else {
  window.__gameState = () => {
    const world = game.world;
    return {
      screen: game.screen,
      level: game.levelIndex + 1,
      alarm: world ? world.alarm : 0,
      remaining: world ? world.remaining : 0,
      score: world ? world.totalCollected : 0,
      gold: world ? world.goldTaken : false,
      player: world ? { x: world.player.x, y: world.player.y } : null,
    };
  };
  render(ctx, game);
  lastFrame = performance.now();
  window.requestAnimationFrame(frame);
}
