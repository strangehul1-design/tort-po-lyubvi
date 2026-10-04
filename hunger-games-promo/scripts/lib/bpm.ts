/**
 * Автоопределение темпа (BPM) и первой сильной доли трека.
 * Спектральный поток → автокорреляция → точная подгонка сетки битов.
 */
import {ffmpegCapture} from './media';

const SR = 22050;
const N = 1024;
const HOP = 256;

const fft = (re: Float64Array, im: Float64Array) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
};

const normalize = (x: Float64Array, fps: number) => {
  // Вычитаем скользящее среднее (~0.4 с) и оставляем только всплески.
  const w = Math.round(fps * 0.4);
  const out = new Float64Array(x.length);
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    sum += x[i];
    if (i >= w) sum -= x[i - w];
    const mean = sum / Math.min(i + 1, w);
    out[i] = Math.max(0, x[i] - mean);
  }
  let max = 0;
  for (const v of out) max = Math.max(max, v);
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] /= max;
  return out;
};

const sampleAt = (env: Float64Array, pos: number) => {
  const i = Math.floor(pos);
  if (i < 0 || i + 1 >= env.length) return 0;
  const f = pos - i;
  return env[i] * (1 - f) + env[i + 1] * f;
};

export type BpmResult = {bpm: number; firstBeatSec: number; confidence: number};

export const analyzeBpm = async (
  file: string,
  opts: {startSec?: number; lengthSec?: number; minBpm?: number; maxBpm?: number} = {},
): Promise<BpmResult> => {
  const startSec = opts.startSec ?? 0;
  const lengthSec = opts.lengthSec ?? 60;
  const minBpm = opts.minBpm ?? 85;
  const maxBpm = opts.maxBpm ?? 175;

  const buf = await ffmpegCapture([
    '-ss', String(startSec), '-t', String(lengthSec), '-i', file,
    '-ac', '1', '-ar', String(SR), '-f', 'f32le', 'pipe:1',
  ]);
  const pcm = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength - (buf.byteLength % 4)));
  if (pcm.length < SR * 5) throw new Error('Трек слишком короткий для анализа (нужно хотя бы 5 секунд).');

  const frames = Math.floor((pcm.length - N) / HOP);
  const fps = SR / HOP;
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const lowBin = Math.round((150 * N) / SR);
  const flux = new Float64Array(frames);
  const lowFlux = new Float64Array(frames);
  let prev = new Float64Array(N / 2);
  let prevLow = 0;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) {
      re[i] = pcm[f * HOP + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    const mag = new Float64Array(N / 2);
    let s = 0;
    let lowEnergy = 0;
    for (let k = 1; k < N / 2; k++) {
      const m = Math.hypot(re[k], im[k]);
      mag[k] = Math.log1p(100 * m);
      const d = mag[k] - prev[k];
      if (d > 0) s += d;
      if (k <= lowBin) lowEnergy += m * m;
    }
    flux[f] = s;
    // Для сильной доли — линейный прирост энергии баса: громкость бочки важна.
    lowFlux[f] = Math.max(0, lowEnergy - prevLow);
    prevLow = lowEnergy;
    prev = mag;
  }
  const env = normalize(flux, fps);
  const low = normalize(lowFlux, fps);

  // 1. Грубый темп: автокорреляция с предпочтением ~120 BPM.
  const minLag = Math.floor((60 * fps) / 220);
  const maxLag = Math.ceil((60 * fps) / 55);
  const ac = new Float64Array(maxLag * 2 + 2);
  for (let L = minLag; L < ac.length && L < env.length; L++) {
    let s = 0;
    for (let i = 0; i + L < env.length; i++) s += env[i] * env[i + L];
    ac[L] = s / (env.length - L);
  }
  let bestL = minLag;
  let bestScore = -1;
  for (let L = minLag; L <= maxLag; L++) {
    const bpm = (60 * fps) / L;
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    const score = (ac[L] + 0.5 * (ac[2 * L] ?? 0)) * w;
    if (score > bestScore) {
      bestScore = score;
      bestL = L;
    }
  }
  let coarse = (60 * fps) / bestL;
  while (coarse < minBpm) coarse *= 2;
  while (coarse > maxBpm) coarse /= 2;

  // 2. Точная подгонка: сетка битов, лучше всего совпадающая со всплесками.
  const combScore = (bpm: number) => {
    const P = (60 * fps) / bpm;
    let best = 0;
    let bestPhase = 0;
    let total = 0;
    let count = 0;
    for (let ph = 0; ph < P; ph += 0.5) {
      let s = 0;
      for (let pos = ph; pos < env.length; pos += P) s += sampleAt(env, pos);
      total += s;
      count++;
      if (s > best) {
        best = s;
        bestPhase = ph;
      }
    }
    return {best, bestPhase, mean: total / count};
  };
  let bpm = coarse;
  let fit = combScore(bpm);
  for (let cand = coarse - 3; cand <= coarse + 3; cand += 0.05) {
    const r = combScore(cand);
    if (r.best > fit.best) {
      fit = r;
      bpm = cand;
    }
  }
  bpm = Math.round(bpm * 100) / 100;
  fit = combScore(bpm);

  // 3. Сильная доля: сдвиг с шагом в полдоли, где сильнее всего бочка.
  //    Полдоли — потому что хэты на слабых долях могут перетянуть сетку.
  const P = (60 * fps) / bpm;
  let bestShift = 0;
  let bestLow = -1;
  for (let j = 0; j < 8; j++) {
    let s = 0;
    for (let pos = fit.bestPhase + (j * P) / 2; pos < low.length; pos += 4 * P) {
      // Окно ±1 кадр, чтобы не промахнуться из-за округления.
      s += Math.max(sampleAt(low, pos - 1), sampleAt(low, pos), sampleAt(low, pos + 1));
    }
    if (s > bestLow) {
      bestLow = s;
      bestShift = j;
    }
  }
  const phaseFrames = fit.bestPhase + (bestShift * P) / 2;
  const frameToSec = (f: number) => (f * HOP + N / 2) / SR;
  return {
    bpm,
    firstBeatSec: Math.round((startSec + frameToSec(phaseFrames)) * 1000) / 1000,
    confidence: Math.round((fit.best / Math.max(1e-9, fit.mean)) * 100) / 100,
  };
};
