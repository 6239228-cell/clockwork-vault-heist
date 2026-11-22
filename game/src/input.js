// Keyboard and pointer input. The canvas is a fixed 1280x800 surface scaled by CSS,
// so pointer positions are converted back into world pixels before the game sees them.
import { VIEW } from './config.js';

const BLOCK = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight',
]);

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const state = {
    down,
    pressed,
    x: VIEW.width / 2,
    y: VIEW.height / 2,
    hasPointer: false,
    throwAt: null,
    anyPress: false,
  };

  window.addEventListener('keydown', (event) => {
    if (BLOCK.has(event.code)) event.preventDefault();
    if (!down.has(event.code)) pressed.add(event.code);
    down.add(event.code);
    state.anyPress = true;
  });

  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
  });

  // Losing focus must not leave the thief sprinting forever.
  window.addEventListener('blur', () => down.clear());

  function toWorld(event) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? VIEW.width / rect.width : 1;
    const sy = rect.height > 0 ? VIEW.height / rect.height : 1;
    return {
      x: (event.clientX - rect.left) * sx,
      y: (event.clientY - rect.top) * sy,
    };
  }

  canvas.addEventListener('pointermove', (event) => {
    const p = toWorld(event);
    state.x = p.x;
    state.y = p.y;
    state.hasPointer = true;
  });

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const p = toWorld(event);
    state.x = p.x;
    state.y = p.y;
    state.hasPointer = true;
    state.anyPress = true;
    if (event.button === 0 || event.pointerType !== 'mouse') {
      state.throwAt = { x: p.x, y: p.y };
    }
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    state,
    /** Normalised WASD / arrow direction. */
    axis() {
      let x = 0;
      let y = 0;
      if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
      if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
      if (down.has('KeyW') || down.has('ArrowUp')) y -= 1;
      if (down.has('KeyS') || down.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    sprint() {
      return down.has('ShiftLeft') || down.has('ShiftRight');
    },
    wasPressed(code) {
      return pressed.has(code);
    },
    /** Eat the pending click so one click throws one coin. */
    consumeThrow() {
      const at = state.throwAt;
      state.throwAt = null;
      return at;
    },
    endFrame() {
      pressed.clear();
      state.anyPress = false;
    },
  };
}
