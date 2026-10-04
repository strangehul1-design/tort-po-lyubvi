import React, {useMemo} from 'react';
import {AbsoluteFill, Sequence, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import config from '../promo.config';
import {buildTimeline, getShot} from './timeline';
import type {Segment, Timeline} from './timeline';
import {ShotClip} from './components/ShotClip';
import {ColorGrade} from './components/ColorGrade';
import {Snow} from './components/Snow';
import {Frost} from './components/Frost';
import {Flash} from './components/Flash';
import {FinalCard} from './components/FinalCard';
import {CityIntro} from './components/CityIntro';
import {SoundDesign} from './components/SoundDesign';

/** Сила метели на каждом кадре и «пройденный путь» снега. */
const useBlizzard = (tl: Timeline) =>
  useMemo(() => {
    const raw = new Array<number>(tl.totalFrames).fill(1);
    const buildStart = tl.hookEndFrame;
    const buildLen = Math.max(1, tl.pauseStartFrame - buildStart);
    for (const s of tl.segments) {
      const base = getShot(s.shotId).blizzard ?? 1;
      for (let f = s.startFrame; f < s.startFrame + s.durationFrames && f < tl.totalFrames; f++) {
        if (s.kind === 'build') {
          raw[f] = base * (1 + 0.35 * ((f - buildStart) / buildLen));
        } else if (s.kind === 'pause') {
          const p = (f - s.startFrame) / s.durationFrames;
          raw[f] = base + (3 - base) * p * p;
        } else {
          raw[f] = base;
        }
      }
    }
    for (let f = tl.cardStartFrame; f < tl.totalFrames; f++) raw[f] = 0.9;
    // Сглаживание, чтобы метель нарастала, а не прыгала.
    const smooth: number[] = [];
    let v = raw[0];
    for (let f = 0; f < tl.totalFrames; f++) {
      v += (raw[f] - v) * 0.12;
      smooth.push(v);
    }
    const travel: number[] = [];
    let acc = 0;
    for (let f = 0; f < tl.totalFrames; f++) {
      travel.push(acc);
      acc += (0.6 + 0.4 * smooth[f]) / tl.fps;
    }
    return {intensity: smooth, travel};
  }, [tl]);

/** Камера: медленный наезд в хуке, «толчки» на доли, подъём в паузе. */
const cameraTransform = (seg: Segment, frame: number, tl: Timeline, height: number): string => {
  const local = frame - seg.startFrame;
  const p = local / Math.max(1, seg.durationFrames);
  let scale = 1.04;
  let tx = 0;
  let ty = 0;
  if (seg.kind === 'hook') {
    scale = interpolate(p, [0, 1], [1.02, 1.12]);
    const d = frame - tl.impactFrame;
    if (d >= 0 && d < 10) {
      const k = Math.exp(-d / 3);
      scale += 0.06 * k;
      tx = (random(`sx-${frame}`) - 0.5) * 30 * k;
      ty = (random(`sy-${frame}`) - 0.5) * 30 * k;
    }
  } else if (seg.kind === 'build') {
    let last = -Infinity;
    for (const b of tl.beatFrames) {
      if (b <= frame) last = b;
      else break;
    }
    const d = frame - last;
    if (d >= 0) scale += config.build.beatPunch * Math.exp(-d / 3);
    if (seg.shotId === 4 && local < 6) {
      const k = Math.exp(-local / 2);
      tx = (random(`hx-${frame}`) - 0.5) * 18 * k;
      ty = (random(`hy-${frame}`) - 0.5) * 18 * k;
    }
  } else {
    scale = interpolate(p, [0, 1], [1.04, 1.14]);
    ty = interpolate(p, [0, 1], [0, height * 0.03]);
  }
  return `translate(${tx}px, ${ty}px) scale(${scale})`;
};

export const Promo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const tl = useMemo(() => buildTimeline(), []);
  const blizzard = useBlizzard(tl);
  const f = Math.min(frame, tl.totalFrames - 1);

  const pauseSeg = tl.segments.find((s) => s.kind === 'pause')!;
  const cardBgFrom = pauseSeg.clipFromSec + (pauseSeg.durationFrames / fps) * pauseSeg.rate;
  const cardFrames = tl.totalFrames - tl.cardStartFrame;

  // Белая метель-«засветка» в конце паузы, переходящая в карточку.
  // После начала карточки её снимает вспышка (Flash ниже).
  const whiteout =
    frame >= tl.cardStartFrame
      ? 0
      : interpolate(frame, [tl.cardStartFrame - fps * 0.9, tl.cardStartFrame], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  return (
    <AbsoluteFill style={{backgroundColor: config.look.colors.night}}>
      <ColorGrade>
        {tl.segments.map((seg, i) => (
          <Sequence
            key={i}
            from={seg.startFrame}
            durationInFrames={seg.durationFrames}
            name={`${seg.kind} · кадр ${seg.shotId}`}
          >
            <AbsoluteFill style={{transform: cameraTransform(seg, frame, tl, height)}}>
              <ShotClip shotId={seg.shotId} fromSec={seg.clipFromSec} rate={seg.rate} />
            </AbsoluteFill>
          </Sequence>
        ))}
        {/* Фон карточки: победитель дальше, размытый и затемнённый. */}
        <Sequence from={tl.cardStartFrame} durationInFrames={cardFrames} name="Фон карточки">
          <AbsoluteFill style={{filter: 'blur(14px) brightness(0.42)', transform: 'scale(1.15)'}}>
            <ShotClip shotId={pauseSeg.shotId} fromSec={cardBgFrom} rate={0.4} />
          </AbsoluteFill>
        </Sequence>
      </ColorGrade>

      {frame >= tl.cardStartFrame ? (
        <AbsoluteFill
          style={{
            background: `linear-gradient(180deg, ${config.look.colors.navy}aa 0%, ${config.look.colors.night}dd 100%)`,
          }}
        />
      ) : null}

      <Snow travel={blizzard.travel[f]} intensity={blizzard.intensity[f]} time={frame / fps} />
      <Frost strength={frame >= tl.cardStartFrame ? 0.8 : 1} />

      {/* Основной текст выходит из темноты вместе с музыкой. */}
      <Sequence from={tl.cardMainFrame} durationInFrames={tl.totalFrames - tl.cardMainFrame} name="Финальная карточка">
        <FinalCard />
      </Sequence>
      {/* Сначала одно слово — город, затем затемнение. */}
      <Sequence from={tl.cardStartFrame} durationInFrames={cardFrames} name="Заставка: город">
        <CityIntro
          introFrames={tl.cardMainFrame - tl.cardStartFrame - Math.round(config.structure.blackoutSec * fps)}
          blackoutFrames={Math.round(config.structure.blackoutSec * fps)}
        />
      </Sequence>

      {whiteout > 0 ? (
        <AbsoluteFill style={{backgroundColor: config.look.colors.white, opacity: whiteout}} />
      ) : null}
      <Flash
        events={[
          ...tl.flashes,
          {frame: tl.cardStartFrame, strength: 1, lengthFrames: Math.round(fps * 0.7)},
          {frame: tl.cardMainFrame, strength: 0.55, lengthFrames: Math.round(fps * 0.4)},
        ]}
      />

      <SoundDesign tl={tl} />
    </AbsoluteFill>
  );
};
