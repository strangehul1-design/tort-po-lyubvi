import React, {useMemo} from 'react';
import {AbsoluteFill, random, useVideoConfig} from 'remotion';
import config from '../../promo.config';

type Flake = {
  x0: number;
  y0: number;
  layer: number;
  size: number;
  speed: number;
  sway: number;
  swayFreq: number;
  phase: number;
  threshold: number;
  alpha: number;
};

const MAX_INTENSITY = 3;

/**
 * Падающий снег поверх кадра.
 * travel — «пройденное время» метели: сумма интенсивности по кадрам,
 * чтобы при смене силы метели снежинки не прыгали.
 */
export const Snow: React.FC<{
  travel: number;
  intensity: number;
  time: number;
  seed?: string;
}> = ({travel, intensity, time, seed = 'snow'}) => {
  const {width, height} = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  const count = Math.round(config.look.snowflakes * MAX_INTENSITY);

  const flakes = useMemo<Flake[]>(() => {
    return new Array(count).fill(0).map((_, i) => {
      const r = (k: string) => random(`${seed}-${i}-${k}`);
      const layerRnd = r('layer');
      const layer = layerRnd < 0.55 ? 0 : layerRnd < 0.88 ? 1 : 2;
      const size = [1.6, 3.2, 6.5][layer] * (0.6 + r('size') * 0.8);
      const speed = [70, 150, 300][layer] * (0.7 + r('speed') * 0.6);
      return {
        x0: r('x'),
        y0: r('y'),
        layer,
        size,
        speed,
        sway: (10 + r('sway') * 30) * (layer + 1),
        swayFreq: 0.3 + r('freq') * 0.9,
        phase: r('phase') * Math.PI * 2,
        threshold: r('thr') * MAX_INTENSITY,
        alpha: [0.55, 0.75, 0.9][layer] * (0.6 + r('alpha') * 0.4),
      };
    });
  }, [count, seed]);

  const margin = 80 * u;
  const W = width + margin * 2;
  const H = height + margin * 2;
  // Ветер усиливается вместе с метелью — снег идёт косо.
  const wind = 0.25 + Math.max(0, intensity - 1) * 0.35;
  const stretch = 1 + Math.max(0, intensity - 1) * 1.2;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <radialGradient id="flake">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="55%" stopColor="#eef8ff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#d8efff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {flakes.map((f, i) => {
          const visible = Math.min(1, Math.max(0, (intensity - f.threshold) / 0.25));
          if (visible <= 0) return null;
          const vy = f.speed * u;
          const vx = vy * wind;
          const x =
            ((((f.x0 * W + vx * travel + Math.sin(time * f.swayFreq + f.phase) * f.sway * u) % W) + W) % W) -
            margin;
          const y = (((f.y0 * H + vy * travel) % H) + H) % H - margin;
          const s = f.size * u;
          const angle = (Math.atan2(vy, vx) * 180) / Math.PI - 90;
          const elong = 1 + (stretch - 1) * (f.layer / 2);
          return (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx={s}
              ry={s * elong}
              transform={`rotate(${angle} ${x} ${y})`}
              fill="url(#flake)"
              opacity={f.alpha * visible}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
