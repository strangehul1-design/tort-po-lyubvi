import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import config from '../../promo.config';

export type FlashEvent = {frame: number; strength: number; lengthFrames?: number};

/** Вспышки-переходы на сильных долях. */
export const Flash: React.FC<{events: FlashEvent[]}> = ({events}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const defaultLen = Math.round(fps * 0.2);
  let opacity = 0;
  for (const e of events) {
    const len = e.lengthFrames ?? defaultLen;
    const d = frame - e.frame;
    if (d >= 0 && d < len) {
      const p = 1 - d / len;
      opacity = Math.max(opacity, e.strength * p * p);
    }
  }
  if (opacity <= 0.001) return null;
  const {white, ice} = config.look.colors;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 50%, ${white} 0%, ${white} 35%, ${ice} 100%)`,
        opacity,
        mixBlendMode: 'screen',
      }}
    />
  );
};
