// Everything you hear is synthesised with WebAudio — no samples, no files, no
// network. The context is created on the first gesture (browser policy) and M mutes.
import { ALARM, clamp } from './config.js';
import { nearestGuardDistance } from './player.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let hum = null;
  let buzz = null;
  let siren = null;
  let muted = false;
  let stepTimer = 0;
  let laserWasLive = false;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);

      // Camera hum: a low sawtooth bed that fades up when the alarm is warm.
      hum = ctx.createOscillator();
      const humGain = ctx.createGain();
      hum.type = 'sawtooth';
      hum.frequency.value = 54;
      humGain.gain.value = 0.012;
      hum.connect(humGain).connect(master);
      hum.start();
      hum.userData = { gain: humGain };

      // Laser buzz: a square wave, silent until a beam is live.
      buzz = ctx.createOscillator();
      const buzzGain = ctx.createGain();
      buzz.type = 'square';
      buzz.frequency.value = 122;
      buzzGain.gain.value = 0;
      buzz.connect(buzzGain).connect(master);
      buzz.start();
      buzz.userData = { gain: buzzGain };

      // Alarm siren: only audible while the meter is climbing.
      siren = ctx.createOscillator();
      const sirenGain = ctx.createGain();
      siren.type = 'triangle';
      siren.frequency.value = 640;
      sirenGain.gain.value = 0;
      siren.connect(sirenGain).connect(master);
      siren.start();
      siren.userData = { gain: sirenGain };
    } catch {
      ctx = null;
    }
  }

  function tone(freq, duration, options = {}) {
    if (!ctx || muted) return;
    const {
      type = 'sine', volume = 0.14, delay = 0, slideTo = null,
    } = options;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  function burst(duration, volume, frequency, type = 'lowpass') {
    if (!ctx || muted) return;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  function play(name, detail = {}) {
    if (!ctx || muted) return;
    switch (name) {
      case 'loot':
        tone(880, 0.1, { type: 'triangle', volume: 0.12 });
        tone(1320, 0.16, { type: 'triangle', volume: 0.1, delay: 0.06 });
        if (detail.kind === 'gold') {
          tone(1760, 0.35, { type: 'sine', volume: 0.12, delay: 0.12 });
          tone(2200, 0.4, { type: 'sine', volume: 0.07, delay: 0.17 });
        }
        break;
      case 'coin':
        tone(1500, 0.06, { type: 'square', volume: 0.05 });
        break;
      case 'coinLand':
        tone(2100, 0.12, { type: 'triangle', volume: 0.06, slideTo: 1200 });
        burst(0.08, 0.03, 2400);
        break;
      case 'sting':
        tone(660, 0.22, { type: 'square', volume: 0.12 });
        tone(520, 0.3, { type: 'square', volume: 0.1, delay: 0.18 });
        tone(390, 0.5, { type: 'square', volume: 0.08, delay: 0.36 });
        break;
      case 'caught':
        tone(320, 0.5, { type: 'sawtooth', volume: 0.14, slideTo: 70 });
        tone(160, 0.8, { type: 'square', volume: 0.08, delay: 0.1, slideTo: 45 });
        burst(0.6, 0.06, 400);
        break;
      case 'clear':
        tone(523, 0.12, { type: 'triangle', volume: 0.11 });
        tone(659, 0.12, { type: 'triangle', volume: 0.11, delay: 0.1 });
        tone(784, 0.3, { type: 'triangle', volume: 0.12, delay: 0.2 });
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => {
          tone(f, 0.28, { type: 'triangle', volume: 0.13, delay: i * 0.13 });
        });
        tone(1318, 0.6, { type: 'sine', volume: 0.1, delay: 0.55 });
        tone(1568, 0.8, { type: 'sine', volume: 0.07, delay: 0.62 });
        break;
      case 'laser':
        tone(140, 0.09, { type: 'sawtooth', volume: 0.05, slideTo: 300 });
        break;
      case 'noise':
        burst(0.12, 0.035, 700);
        break;
      case 'start':
        tone(392, 0.1, { type: 'triangle', volume: 0.08 });
        tone(523, 0.18, { type: 'triangle', volume: 0.1, delay: 0.08 });
        break;
      default:
        break;
    }
  }

  function update(world, dt) {
    if (!ctx || !world) return;

    // Guard footsteps: louder and faster as the nearest patrol closes in.
    const guardDistance = nearestGuardDistance(world);
    if (guardDistance < 300) {
      stepTimer -= dt;
      if (stepTimer <= 0) {
        const closeness = 1 - clamp(guardDistance / 300, 0, 1);
        stepTimer = 0.28 + (1 - closeness) * 0.5;
        burst(0.09, 0.03 * closeness + 0.004, 150);
      }
    } else {
      stepTimer = 0;
    }

    const anyLive = world.lasers.some((laser) => laser.state === 'on');
    if (anyLive && !laserWasLive) play('laser');
    laserWasLive = anyLive;

    if (buzz) {
      const target = anyLive ? 0.014 : 0;
      buzz.userData.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
      buzz.frequency.setTargetAtTime(anyLive ? 122 : 84, ctx.currentTime, 0.1);
    }
    if (siren) {
      const level = world.spotted ? clamp(world.alarm / ALARM.max, 0, 1) : 0;
      const target = level > 0.02 ? 0.012 + level * 0.018 : 0;
      siren.userData.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.12);
      siren.frequency.setTargetAtTime(560 + level * 240, ctx.currentTime, 0.2);
    }
    if (hum) {
      const tension = clamp(world.alarm / ALARM.max, 0, 1);
      hum.userData.gain.gain.setTargetAtTime(0.01 + tension * 0.014, ctx.currentTime, 0.3);
    }
  }

  return {
    unlock,
    play,
    update,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.6;
      return muted;
    },
  };
}
