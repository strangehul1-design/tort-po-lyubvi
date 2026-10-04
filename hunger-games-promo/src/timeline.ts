/**
 * Монтажный лист ролика, построенный по битам трека.
 * Чистый TypeScript без браузера: им пользуется и Remotion, и `npm run timeline`.
 */
import config from '../promo.config';
import type {ShotConfig} from '../promo.config';
import beats from './generated/beats.json';
import assets from './generated/assets.json';

export type SegmentKind = 'hook' | 'build' | 'pause';

export type Segment = {
  kind: SegmentKind;
  shotId: number;
  startFrame: number;
  durationFrames: number;
  /** С какой секунды вырезанного куска начинать. */
  clipFromSec: number;
  rate: number;
  /** Кусок начинается на сильной доле: здесь вспышка. */
  onDownbeat: boolean;
  /** Длина куска в долях (для отчёта). */
  beats: number;
};

export type Timeline = {
  fps: number;
  totalFrames: number;
  bpm: number;
  bpmSource: 'config' | 'analysis' | 'fallback';
  beatSec: number;
  hookEndFrame: number;
  pauseStartFrame: number;
  cardStartFrame: number;
  segments: Segment[];
  /** Кадры всех долей до паузы — для «толчков» камеры. */
  beatFrames: number[];
  /** Кадры вспышек и их сила 0..1. */
  flashes: {frame: number; strength: number}[];
  impactFrame: number;
  bellFrame: number;
  swordFrames: number[];
  warnings: string[];
};

type AssetsJson = {
  clips: Record<string, {file: string; durationSec: number}>;
  music: string | null;
  sfx: Record<string, string>;
};

export const assetsInfo = assets as AssetsJson;

export const getShot = (id: number): ShotConfig => {
  const shot = config.shots.find((s) => s.id === id);
  if (!shot) {
    throw new Error(`Кадр ${id} не найден в promo.config.ts → shots`);
  }
  return shot;
};

export const clipDurationSec = (id: number): number => {
  const real = assetsInfo.clips[String(id)]?.durationSec;
  return real && real > 0 ? real : getShot(id).duration;
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

export const resolveTempo = () => {
  const b = beats as {bpm: number | null; firstBeatSec: number | null};
  let bpm: number;
  let bpmSource: Timeline['bpmSource'];
  if (typeof config.music.bpm === 'number') {
    bpm = config.music.bpm;
    bpmSource = 'config';
  } else if (b.bpm) {
    bpm = b.bpm;
    bpmSource = 'analysis';
  } else {
    bpm = config.music.fallbackBpm;
    bpmSource = 'fallback';
  }
  const firstBeatTrackSec = config.music.firstBeatSec ?? b.firstBeatSec ?? config.music.startSec;
  return {bpm, bpmSource, firstBeatTrackSec};
};

export const buildTimeline = (): Timeline => {
  const fps = config.video.fps;
  const warnings: string[] = [];
  const {bpm, bpmSource, firstBeatTrackSec} = resolveTempo();
  const T = 60 / bpm;
  const bpb = config.music.beatsPerBar;
  // Первая доля в секундах ролика (может быть отрицательной).
  const b0 = firstBeatTrackSec - config.music.startSec;
  const beatIndex = (t: number) => Math.round((t - b0) / T);
  const beatTime = (k: number) => b0 + k * T;
  const snap = (t: number) => beatTime(beatIndex(t));
  const toFrame = (t: number) => Math.round(t * fps);

  const totalSec = config.video.durationSec;
  const cardStart = config.structure.cardStartSec;
  let hookEnd = snap(config.structure.hookEndSec);
  if (Math.abs(hookEnd - config.structure.hookEndSec) > 0.6) hookEnd = config.structure.hookEndSec;
  let pauseStart = snap(config.structure.pauseStartSec);
  if (pauseStart >= cardStart - 1 || Math.abs(pauseStart - config.structure.pauseStartSec) > 0.8) {
    pauseStart = config.structure.pauseStartSec;
  }

  // Сколько каждого кадра уже израсходовано, чтобы повтор показывал новый кусок.
  const nextFrom = new Map<number, number>();
  const takeClip = (shotId: number, segSec: number, rateWanted: number) => {
    const len = clipDurationSec(shotId);
    let rate = rateWanted;
    let need = segSec * rate;
    if (need > len) {
      rate = (len / segSec) * 0.98;
      need = segSec * rate;
      warnings.push(
        `Кадр ${shotId}: кусок ${segSec.toFixed(2)} с длиннее записи ${len.toFixed(2)} с — замедлен до ${rate.toFixed(2)}.`,
      );
    }
    let from = nextFrom.get(shotId) ?? 0;
    if (from + need > len) from = 0;
    nextFrom.set(shotId, from + need);
    return {from, rate};
  };

  const segments: Segment[] = [];

  // 1. Хук.
  {
    const shot = config.hook.shot;
    const dur = hookEnd;
    const len = clipDurationSec(shot);
    let rate = config.hook.rate;
    if (config.hook.from + dur * rate > len) {
      rate = Math.max(0.05, ((len - config.hook.from) / dur) * 0.98);
      warnings.push(`Хук: записи кадра ${shot} не хватает, замедлен до ${rate.toFixed(2)}.`);
    }
    nextFrom.set(shot, config.hook.from + dur * rate);
    segments.push({
      kind: 'hook',
      shotId: shot,
      startFrame: 0,
      durationFrames: toFrame(hookEnd),
      clipFromSec: config.hook.from,
      rate,
      onDownbeat: false,
      beats: dur / T,
    });
  }

  // 2. Нарастание: длины кусков в долях, к концу всё короче.
  const span = pauseStart - hookEnd;
  const lengths: number[] = [];
  {
    const pattern = config.build.beatsPattern;
    let acc = 0;
    let i = 0;
    // Первый кусок дотягивает до начала такта, чтобы длинные куски
    // начинались на сильных долях.
    const toBar = mod(-beatIndex(hookEnd), bpb);
    if (toBar > 0 && pattern.length === 0) {
      const first = toBar < 2 ? toBar + bpb : toBar;
      lengths.push(first);
      acc += first;
    }
    while (acc < span / T - 1e-6) {
      let lb: number;
      if (pattern.length > 0) {
        lb = pattern[Math.min(i, pattern.length - 1)];
      } else {
        const p = acc / (span / T);
        const target =
          config.build.firstCutSec -
          (config.build.firstCutSec - config.build.lastCutSec) * Math.pow(p, config.build.acceleration);
        const raw = Math.log2(Math.max(target / T, 0.25));
        lb = Math.pow(2, Math.max(-1, Math.min(3, Math.round(raw))));
      }
      if (lb < 1 && pattern.length === 0) {
        // Полдоли — только парами, чтобы не съехать с сетки.
        lengths.push(0.5, 0.5);
        acc += 1;
      } else {
        lengths.push(lb);
        acc += lb;
      }
      i++;
    }
  }

  let t = hookEnd;
  const order = config.build.order;
  lengths.forEach((lb, i) => {
    const start = t;
    let end = Math.min(start + lb * T, pauseStart);
    if (pauseStart - end < T * 0.25) end = pauseStart;
    if (end <= start + 1e-6) return;
    t = end;
    const shotId = order[i % order.length];
    const shot = getShot(shotId);
    const {from, rate} = takeClip(shotId, end - start, shot.rate ?? 1);
    const k = beatIndex(start);
    const onGrid = Math.abs(beatTime(k) - start) < 0.02;
    segments.push({
      kind: 'build',
      shotId,
      startFrame: toFrame(start),
      durationFrames: toFrame(end) - toFrame(start),
      clipFromSec: from,
      rate,
      onDownbeat: onGrid && mod(k, bpb) === 0,
      beats: (end - start) / T,
    });
  });

  // 3. Пауза: победитель.
  {
    const shot = config.pause.shot;
    const dur = cardStart - pauseStart;
    const len = clipDurationSec(shot);
    let rate = config.pause.rate;
    if (config.pause.from + dur * rate > len) {
      rate = Math.max(0.05, ((len - config.pause.from) / dur) * 0.98);
      warnings.push(`Пауза: записи кадра ${shot} не хватает, замедлен до ${rate.toFixed(2)}.`);
    }
    segments.push({
      kind: 'pause',
      shotId: shot,
      startFrame: toFrame(pauseStart),
      durationFrames: toFrame(cardStart) - toFrame(pauseStart),
      clipFromSec: config.pause.from,
      rate,
      onDownbeat: false,
      beats: dur / T,
    });
  }

  const beatFrames: number[] = [];
  for (let k = beatIndex(0); beatTime(k) < pauseStart - 1e-6; k++) {
    if (beatTime(k) >= 0) beatFrames.push(toFrame(beatTime(k)));
  }

  const impactFrame = toFrame(config.hook.impactSec);
  const flashes: Timeline['flashes'] = [{frame: impactFrame, strength: 0.85}];
  for (const s of segments) {
    if (s.kind === 'build' && s.onDownbeat) flashes.push({frame: s.startFrame, strength: 0.9});
    else if (s.kind === 'build' && s.beats >= 1) flashes.push({frame: s.startFrame, strength: 0.25});
  }
  flashes.push({frame: toFrame(hookEnd), strength: 1});
  flashes.push({frame: toFrame(pauseStart), strength: 1});

  const firstStart = segments.find((s) => s.kind === 'build' && s.shotId === 3);
  const bellFrame = firstStart ? firstStart.startFrame : toFrame(hookEnd);
  const swordFrames = [
    impactFrame,
    ...segments.filter((s) => s.kind === 'build' && s.shotId === 4).map((s) => s.startFrame),
  ];

  return {
    fps,
    totalFrames: toFrame(totalSec),
    bpm,
    bpmSource,
    beatSec: T,
    hookEndFrame: toFrame(hookEnd),
    pauseStartFrame: toFrame(pauseStart),
    cardStartFrame: toFrame(cardStart),
    segments,
    beatFrames,
    flashes: flashes.sort((a, b) => a.frame - b.frame),
    impactFrame,
    bellFrame,
    swordFrames,
    warnings,
  };
};
