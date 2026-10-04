/**
 * npm run demo-audio — синтезировать свою музыку и звуки (без авторских прав):
 *   audio/track.mp3       трейлерный трек 120 BPM, 75 с
 *   sfx/wind.mp3          метель
 *   sfx/snow-steps.mp3    шаги по снегу
 *   sfx/sword-hit.mp3     удар меча
 *   sfx/bell.mp3          колокол
 * Уже лежащие файлы не трогаются. --force перезаписывает.
 * Позже их можно заменить на настоящие треки и звуки с теми же именами.
 */
import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg} from './lib/media';

const root = path.resolve(import.meta.dirname, '..');
const force = process.argv.includes('--force');
const SR = 44100;

// Детерминированный шум, чтобы файл каждый раз получался одинаковым.
let seed = 12345;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rnd() * 2 - 1;

const buf = (sec: number) => new Float32Array(Math.ceil(sec * SR));
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Однополюсный ФНЧ по месту. cutoff может меняться по времени. */
const lowpass = (x: Float32Array, cutoff: (t: number) => number) => {
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    const a = 1 - Math.exp((-2 * Math.PI * cutoff(i / SR)) / SR);
    y += a * (x[i] - y);
    x[i] = y;
  }
  return x;
};
const highpass = (x: Float32Array, cutoff: number) => {
  const lp = lowpass(Float32Array.from(x), () => cutoff);
  for (let i = 0; i < x.length; i++) x[i] -= lp[i];
  return x;
};

/** Простая реверберация: параллельные гребенчатые фильтры. */
const reverb = (x: Float32Array, mix: number, size = 1) => {
  const out = Float32Array.from(x);
  const delays = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => Math.round(d * size));
  for (const d of delays) {
    const line = new Float32Array(x.length);
    let damp = 0;
    for (let i = 0; i < x.length; i++) {
      const fb = i >= d ? line[i - d] : 0;
      damp += 0.3 * (fb - damp);
      line[i] = x[i] + damp * 0.84;
      out[i] += (line[i] * mix) / delays.length;
    }
  }
  return out;
};

const add = (dst: Float32Array, src: Float32Array, at: number, gain = 1) => {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * gain;
};

const normalize = (x: Float32Array, peak = 0.89) => {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] = Math.tanh((x[i] / m) * 1.2) * peak;
  return x;
};

// ─────────────── Инструменты ───────────────
const kick = (len = 0.45, f0 = 130, f1 = 42) => {
  const b = buf(len);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (f1 + (f0 - f1) * Math.exp(-t * 28))) / SR;
    b[i] = Math.sin(ph) * Math.exp(-t * (4 / len)) + (t < 0.004 ? noise() * 0.4 : 0);
  }
  return b;
};
const boom = () => {
  const b = kick(2.2, 90, 32);
  const n = buf(2.2);
  for (let i = 0; i < n.length; i++) n[i] = noise() * Math.exp((-i / SR) * 3);
  lowpass(n, () => 400);
  for (let i = 0; i < b.length; i++) b[i] = b[i] * 1.2 + n[i] * 0.6;
  return b;
};
const tom = (f = 95) => {
  const b = buf(0.35);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * f * (1 + 0.5 * Math.exp(-t * 30))) / SR;
    b[i] = (Math.sin(ph) * 0.9 + noise() * 0.25 * Math.exp(-t * 40)) * Math.exp(-t * 11);
  }
  return b;
};
const snare = () => {
  const b = buf(0.25);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    b[i] = noise() * Math.exp(-t * 18) * 0.8 + Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 30) * 0.5;
  }
  return highpass(b, 300);
};
const hat = () => {
  const b = buf(0.06);
  for (let i = 0; i < b.length; i++) b[i] = noise() * Math.exp((-i / SR) * 70);
  return highpass(b, 7000);
};
/** Струнный пэд: расстроенные пилы, мягкая атака. */
const pad = (notes: number[], len: number) => {
  const b = buf(len);
  const phases = notes.flatMap(() => [rnd(), rnd(), rnd()]);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.6) * Math.min(1, (len - t) / 0.4);
    let s = 0;
    notes.forEach((n, k) => {
      for (let d = 0; d < 3; d++) {
        const f = midi(n) * (1 + (d - 1) * 0.006);
        const p = (phases[k * 3 + d] + f * t) % 1;
        s += (2 * p - 1) * 0.33;
      }
    });
    b[i] = (s / notes.length) * env;
  }
  return lowpass(lowpass(b, () => 1400), () => 2200);
};
const drone = (len: number, note = 26) => {
  const b = buf(len);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = midi(note);
    b[i] = ((((f * t) % 1) * 2 - 1) * 0.6 + Math.sin(2 * Math.PI * f * 0.5 * t) * 0.6) * Math.min(1, t / 1.5);
  }
  return lowpass(b, (t) => 180 + 120 * Math.sin(t * 0.7));
};
const riser = (len: number) => {
  const b = buf(len);
  for (let i = 0; i < b.length; i++) b[i] = noise() * Math.pow(i / b.length, 2);
  return lowpass(b, (t) => 300 + 9000 * Math.pow(t / len, 2));
};

// ─────────────── Трек ───────────────
const makeTrack = () => {
  const BPM = 120;
  const B = 60 / BPM;
  const LEN = 75;
  const drums = buf(LEN);
  const music = buf(LEN);
  // Ре минор: Dm – B♭ – F – C
  const chords = [
    [50, 53, 57, 62],
    [46, 50, 53, 58],
    [53, 57, 60, 65],
    [48, 52, 55, 60],
  ];
  const bar = (k: number) => k * 4 * B;

  // 0–3 с: хук. Гул и тяжёлый удар.
  add(music, drone(3.2), 0, 0.7);
  add(drums, boom(), 0, 1);
  add(drums, boom(), 1.4, 0.8);

  // 3–25 с: нарастание, 11 тактов по 2 с.
  for (let k = 1; k < 13; k++) {
    const t = bar(k);
    if (t >= 25) break;
    const p = (t - 2) / 23; // 0..1
    add(music, pad(chords[(k - 1) % 4], 4 * B + 0.3), t, 0.55);
    add(music, drone(4 * B), t, 0.45);
    for (let b = 0; b < 4; b++) {
      const bt = t + b * B;
      if (bt >= 25) break;
      add(drums, kick(), bt, b === 0 ? 1 : 0.6);
      if (b === 0) add(drums, kick(0.7, 95, 34), bt, 0.9);
      if (b % 2 === 1) add(drums, snare(), bt, 0.55 + p * 0.3);
      add(drums, tom(b % 2 ? 110 : 85), bt + B / 2, 0.3 + p * 0.5);
      add(drums, hat(), bt + B / 2, 0.3);
      if (p > 0.35) add(drums, hat(), bt + B / 4, 0.2);
      if (p > 0.35) add(drums, hat(), bt + (3 * B) / 4, 0.2);
      if (p > 0.7) {
        for (let s = 0; s < 4; s++) add(drums, tom(70 + s * 15), bt + (s * B) / 4, 0.35);
      }
    }
  }
  add(music, riser(6), 19, 0.45);

  // 25+ с: финал на карточке. Удар, широкие аккорды, пульс в половину темпа.
  add(drums, boom(), 25, 1.1);
  for (let k = 0; k < 25; k++) {
    const t = 25 + k * 4 * B;
    if (t >= LEN - 1) break;
    add(music, pad(chords[k % 4].map((n) => n + 12).concat(chords[k % 4][0] - 12), 4 * B + 0.4), t, 0.6);
    add(music, drone(4 * B), t, 0.4);
    add(drums, kick(0.6, 110, 38), t, 1);
    add(drums, tom(80), t + 2 * B, 0.6);
    add(drums, hat(), t + B, 0.15);
    add(drums, hat(), t + 3 * B, 0.15);
  }

  const wetMusic = reverb(music, 0.9, 1.3);
  const wetDrums = reverb(drums, 0.35, 1);
  const mix = buf(LEN);
  for (let i = 0; i < mix.length; i++) {
    const t = i / SR;
    const fadeOut = Math.min(1, (LEN - t) / 3);
    mix[i] = (wetMusic[i] * 0.8 + wetDrums[i]) * fadeOut;
  }
  return normalize(mix);
};

// ─────────────── Звуки ───────────────
const makeWind = () => {
  const LEN = 12;
  const b = buf(LEN);
  let brown = 0;
  for (let i = 0; i < b.length; i++) {
    brown = (brown + noise() * 0.02) * 0.998;
    b[i] = brown * 8 + noise() * 0.05;
  }
  // Порывы: частота среза гуляет. Склейка конца с началом — для зацикливания.
  lowpass(b, (t) => 500 + 900 * (0.5 + 0.5 * Math.sin((t * 2 * Math.PI) / 6)) * (0.6 + 0.4 * Math.sin(t * 2.3)));
  const xf = Math.round(0.8 * SR);
  for (let i = 0; i < xf; i++) {
    const a = i / xf;
    b[i] = b[i] * a + b[b.length - xf + i] * (1 - a);
  }
  return normalize(b.subarray(0, b.length - xf), 0.7);
};

const makeSteps = () => {
  const LEN = 5;
  const b = buf(LEN);
  for (let s = 0; s < 8; s++) {
    const step = buf(0.28);
    for (let i = 0; i < step.length; i++) {
      const t = i / SR;
      // Хруст: короткие щелчки на фоне шума.
      const crunch = rnd() < 0.02 ? noise() * 2 : 0;
      step[i] = (noise() * 0.6 + crunch) * Math.exp(-t * 14) * Math.min(1, t / 0.01);
    }
    lowpass(highpass(step, 400), () => 3500);
    add(b, step, 0.25 + s * 0.58 + rnd() * 0.05, 0.8 + rnd() * 0.3);
  }
  return normalize(reverb(b, 0.15, 0.6), 0.8);
};

const makeSword = () => {
  const LEN = 1.4;
  const b = buf(LEN);
  const partials = [1240, 2310, 3170, 4420, 5960];
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let s = 0;
    partials.forEach((f, k) => (s += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (3 + k * 2.5)) / (k + 1)));
    const swish = i < 0.08 * SR ? noise() * Math.sin((Math.PI * i) / (0.08 * SR)) : 0;
    const thud = Math.sin(2 * Math.PI * 140 * t) * Math.exp(-t * 25);
    b[i] = s * 0.7 + swish * 0.6 + thud * 0.8 + (t < 0.01 ? noise() : 0);
  }
  return normalize(reverb(b, 0.4, 0.8), 0.9);
};

const makeBell = () => {
  const LEN = 6;
  const b = buf(LEN);
  const f = 196; // соль
  const ratios = [0.5, 1, 1.19, 1.5, 2, 2.5, 3, 4.2];
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let s = 0;
    ratios.forEach((r, k) => (s += Math.sin(2 * Math.PI * f * r * t + k) * Math.exp(-t * (0.5 + k * 0.45)) / (1 + k * 0.4)));
    b[i] = s * Math.min(1, t / 0.003);
  }
  return normalize(reverb(b, 0.6, 1.4), 0.85);
};

// ─────────────── Запись ───────────────
const writeWav = (file: string, x: Float32Array) => {
  const data = Buffer.alloc(x.length * 4);
  for (let i = 0; i < x.length; i++) {
    const l = Math.max(-1, Math.min(1, x[i]));
    const r = Math.max(-1, Math.min(1, x[Math.max(0, i - 13)]));
    data.writeInt16LE(Math.round(l * 32767), i * 4);
    data.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
};

const jobs: [string, () => Float32Array][] = [
  ['audio/track.mp3', makeTrack],
  ['sfx/wind.mp3', makeWind],
  ['sfx/snow-steps.mp3', makeSteps],
  ['sfx/sword-hit.mp3', makeSword],
  ['sfx/bell.mp3', makeBell],
];

const main = async () => {
  for (const [rel, make] of jobs) {
    const out = path.join(root, rel);
    if (fs.existsSync(out) && !force) {
      console.log(`  ${rel}: уже есть, пропускаю (--force перезапишет)`);
      continue;
    }
    process.stdout.write(`  ${rel}: синтез… `);
    const wav = out.replace(/\.mp3$/, '.tmp.wav');
    fs.mkdirSync(path.dirname(out), {recursive: true});
    writeWav(wav, make());
    await ffmpeg(['-i', wav, '-c:a', 'libmp3lame', '-b:a', '256k', out]);
    fs.rmSync(wav);
    console.log('готово');
  }
  console.log('\n✓ Музыка и звуки готовы. Дальше: npm run prep');
};

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
