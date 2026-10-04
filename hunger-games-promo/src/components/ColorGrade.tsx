import React from 'react';
import {AbsoluteFill} from 'remotion';
import config from '../../promo.config';

/** Цветокоррекция в холод: обесцветить, добавить контраст и синеву. */
export const gradeFilter = (k = config.look.gradeStrength) =>
  `saturate(${1 - 0.38 * k}) contrast(${1 + 0.14 * k}) brightness(${1 - 0.04 * k}) hue-rotate(${-8 * k}deg)`;

export const ColorGrade: React.FC<{children: React.ReactNode}> = ({children}) => {
  const k = config.look.gradeStrength;
  const {navy, ice, night} = config.look.colors;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{filter: gradeFilter(k)}}>{children}</AbsoluteFill>
      {/* Синий оттенок по цвету картинки */}
      <AbsoluteFill style={{background: navy, mixBlendMode: 'color', opacity: 0.32 * k}} />
      {/* Светлое — в ледяной голубой, тени — в тёмно-синий */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${ice} 0%, ${navy} 100%)`,
          mixBlendMode: 'soft-light',
          opacity: 0.55 * k,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 45%, transparent 45%, ${night}cc 100%)`,
          opacity: 0.75 * k,
        }}
      />
    </AbsoluteFill>
  );
};
