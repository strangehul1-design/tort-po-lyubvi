import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import config from '../../promo.config';

/** Морозный иней по краям кадра: шум + маска от краёв к центру. */
export const Frost: React.FC<{strength?: number}> = ({strength = 1}) => {
  const {width, height} = useVideoConfig();
  const s = strength * config.look.frost;
  if (s <= 0) return null;
  const {ice, white, navy} = config.look.colors;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute'}}>
        <defs>
          <filter id="frost-fine" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.93  0 0 0 0 0.97  0 0 0 0 1  0 0 0 2.2 -1.05"
            />
          </filter>
          <filter id="frost-veins" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="turbulence" baseFrequency="0.012 0.018" numOctaves="4" seed="4" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.85  0 0 0 0 0.94  0 0 0 0 1  -3 0 0 0 1.25"
            />
          </filter>
          <radialGradient id="frost-edge" cx="50%" cy="50%" r="72%">
            <stop offset="58%" stopColor="#000" />
            <stop offset="86%" stopColor="#888" />
            <stop offset="100%" stopColor="#fff" />
          </radialGradient>
          <mask id="frost-mask">
            <rect width={width} height={height} fill="url(#frost-edge)" />
          </mask>
        </defs>
        <g mask="url(#frost-mask)" opacity={Math.min(1, 0.9 * s)}>
          <rect width={width} height={height} filter="url(#frost-veins)" opacity={0.55} />
          <rect width={width} height={height} filter="url(#frost-fine)" opacity={0.8} />
        </g>
      </svg>
      {/* Холодное свечение по краям */}
      <AbsoluteFill
        style={{
          boxShadow: `inset 0 0 ${Math.min(width, height) * 0.09}px ${Math.min(width, height) * 0.02}px ${ice}66,
                      inset 0 0 ${Math.min(width, height) * 0.25}px ${navy}aa`,
          opacity: Math.min(1, s),
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 50%, transparent 62%, ${white}22 88%, ${white}55 100%)`,
          opacity: Math.min(1, s),
        }}
      />
    </AbsoluteFill>
  );
};
