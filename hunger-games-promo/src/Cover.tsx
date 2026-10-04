import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import config from '../promo.config';
import {ColorGrade} from './components/ColorGrade';
import {ShotClip} from './components/ShotClip';
import {Snow} from './components/Snow';
import {Frost} from './components/Frost';
import {BODY_FONT, DISPLAY_FONT, fitTitleSize} from './fonts';

/** Обложка (превью-кадр): 1080×1920 и 1280×720. */
export const Cover: React.FC = () => {
  const {width, height} = useVideoConfig();
  const vertical = height > width;
  const u = Math.min(width, height) / 1080;
  const c = config.card;
  const {white, ice, iceDeep, navy, night} = config.look.colors;

  return (
    <AbsoluteFill style={{backgroundColor: night}}>
      <ColorGrade>
        <AbsoluteFill style={{transform: 'scale(1.06)'}}>
          <ShotClip shotId={config.cover.shot} fromSec={config.cover.atSec} rate={1} />
        </AbsoluteFill>
      </ColorGrade>
      <AbsoluteFill
        style={{
          background: vertical
            ? `linear-gradient(180deg, transparent 35%, ${night}ee 80%)`
            : `linear-gradient(90deg, ${night}ee 0%, ${night}99 45%, transparent 75%)`,
        }}
      />
      <Snow travel={7.3} intensity={1.7} time={3.1} seed="cover" />
      <Frost strength={1.1} />
      <AbsoluteFill
        style={{
          justifyContent: vertical ? 'flex-end' : 'center',
          alignItems: vertical ? 'center' : 'flex-start',
          padding: vertical ? `0 ${70 * u}px ${260 * u}px` : `0 ${110 * u}px`,
          textAlign: vertical ? 'center' : 'left',
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: fitTitleSize(c.title, vertical ? width - 160 * u : width * 0.55, (vertical ? 168 : 150) * u),
            lineHeight: 0.95,
            color: white,
            textShadow: `0 0 ${16 * u}px ${ice}, 0 0 ${40 * u}px ${iceDeep}aa, 0 ${8 * u}px ${3 * u}px ${navy}`,
            maxWidth: vertical ? '100%' : '60%',
          }}
        >
          {c.title}
        </div>
        {c.subtitle ? (
          <div
            style={{
              fontFamily: BODY_FONT,
              fontWeight: 700,
              fontSize: 50 * u,
              letterSpacing: 24 * u,
              marginRight: vertical ? -24 * u : 0,
              color: ice,
              marginTop: 22 * u,
            }}
          >
            {c.subtitle}
          </div>
        ) : null}
        {c.game ? (
          <div
            style={{
              fontFamily: BODY_FONT,
              fontWeight: 700,
              fontSize: 30 * u,
              letterSpacing: 4 * u,
              color: navy,
              background: ice,
              padding: `${8 * u}px ${20 * u}px`,
              borderRadius: 10 * u,
              marginTop: 26 * u,
            }}
          >
            {c.game}
          </div>
        ) : null}
        {c.tagline ? (
          <div style={{fontFamily: DISPLAY_FONT, fontSize: 64 * u, color: white, marginTop: 40 * u}}>{c.tagline}</div>
        ) : null}
        {c.date ? (
          <div
            style={{
              fontFamily: BODY_FONT,
              fontWeight: 700,
              fontSize: 46 * u,
              color: white,
              border: `${3 * u}px solid ${ice}`,
              padding: `${8 * u}px ${30 * u}px`,
              borderRadius: 12 * u,
              marginTop: 34 * u,
              letterSpacing: 6 * u,
            }}
          >
            {c.date}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
