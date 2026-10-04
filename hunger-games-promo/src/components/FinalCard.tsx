import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import config from '../../promo.config';
import {BODY_FONT, DISPLAY_FONT, fitTitleSize} from '../fonts';
import {QrCode} from './QrCode';

const prettyLink = (link: string) => link.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** Финальная карточка — единственный текст в ролике. */
export const FinalCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const vertical = height > width;
  const u = Math.min(width, height) / 1080;
  const c = config.card;
  const {white, ice, iceDeep, navy} = config.look.colors;

  const enter = (delaySec: number) => {
    const s = spring({frame: frame - delaySec * fps, fps, config: {damping: 200, mass: 0.8}});
    return {
      opacity: s,
      transform: `translateY(${(1 - s) * 40 * u}px)`,
    };
  };

  // Название «вымерзает» из размытия.
  const titleBlur = interpolate(frame, [0, fps * 0.9], [24 * u, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const titleScale = interpolate(frame, [0, fps * 1.2], [1.12, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  // Медленный блик по льду названия.
  const shine = interpolate(frame, [fps * 1, fps * 3.5], [-40, 140], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleSize = fitTitleSize(c.title, vertical ? width - 160 * u : width * 0.5, (vertical ? 150 : 132) * u);
  const qrSize = (vertical ? 300 : 250) * u;

  const title = (
    <div style={{transform: `scale(${titleScale})`, filter: `blur(${titleBlur}px)`}}>
      <div
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: titleSize,
          lineHeight: 0.95,
          letterSpacing: 2 * u,
          textAlign: vertical ? 'center' : 'left',
          background: `linear-gradient(100deg, ${white} 0%, ${ice} ${shine - 20}%, #ffffff ${shine}%, ${ice} ${shine + 20}%, ${iceDeep} 110%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          filter: `drop-shadow(0 0 ${18 * u}px ${ice}88) drop-shadow(0 ${6 * u}px ${2 * u}px ${navy})`,
        }}
      >
        {c.title}
      </div>
      {c.subtitle ? (
        <div
          style={{
            fontFamily: BODY_FONT,
            fontWeight: 700,
            fontSize: 44 * u,
            letterSpacing: 22 * u,
            marginTop: 18 * u,
            marginRight: vertical ? -22 * u : 0,
            color: ice,
            textAlign: vertical ? 'center' : 'left',
            ...enter(0.5),
          }}
        >
          {c.subtitle}
        </div>
      ) : null}
    </div>
  );

  const divider = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16 * u,
        justifyContent: vertical ? 'center' : 'flex-start',
        width: vertical ? 620 * u : 560 * u,
        margin: vertical ? `${34 * u}px auto` : `${30 * u}px 0`,
        ...enter(1.1),
      }}
    >
      <div style={{flex: 1, height: 2 * u, background: `linear-gradient(90deg, transparent, ${ice})`}} />
      <div style={{width: 14 * u, height: 14 * u, background: ice, transform: 'rotate(45deg)'}} />
      <div style={{flex: 1, height: 2 * u, background: `linear-gradient(90deg, ${ice}, transparent)`}} />
    </div>
  );

  const info = (
    <div style={{textAlign: vertical ? 'center' : 'left', color: white, fontFamily: BODY_FONT}}>
      {c.tagline ? (
        <div style={{fontFamily: DISPLAY_FONT, fontSize: 62 * u, lineHeight: 1.1, ...enter(0.9)}}>{c.tagline}</div>
      ) : null}
      {divider}
      {c.date ? (
        <div style={{fontWeight: 700, fontSize: 52 * u, marginBottom: 14 * u, ...enter(1.4)}}>{c.date}</div>
      ) : null}
      {c.fee || c.prize ? (
        <div style={{fontWeight: 500, fontSize: 40 * u, color: ice, lineHeight: 1.35, ...enter(1.7)}}>
          {c.fee}
          {c.fee && c.prize ? (vertical ? <br /> : <span style={{opacity: 0.6}}>{'  /  '}</span>) : null}
          {c.prize}
        </div>
      ) : null}
    </div>
  );

  const label = c.linkLabel || prettyLink(c.link);
  const cta = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18 * u,
        ...enter(2.1),
      }}
    >
      {c.showQr && c.link ? (
        <div
          style={{
            padding: 14 * u,
            borderRadius: 22 * u,
            background: white,
            boxShadow: `0 0 ${40 * u}px ${ice}88, 0 0 0 ${3 * u}px ${ice}`,
          }}
        >
          <QrCode text={c.link} size={qrSize} color={navy} />
        </div>
      ) : null}
      {c.callToAction ? (
        <div
          style={{
            fontFamily: BODY_FONT,
            fontWeight: 700,
            fontSize: 30 * u,
            letterSpacing: 6 * u,
            textTransform: 'uppercase',
            color: ice,
          }}
        >
          {c.callToAction}
        </div>
      ) : null}
      {c.link ? (
        <div style={{fontFamily: BODY_FONT, fontWeight: 700, fontSize: 42 * u, color: white}}>{label}</div>
      ) : null}
    </div>
  );

  return (
    <AbsoluteFill>
      {vertical ? (
        <AbsoluteFill
          style={{
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${120 * u}px ${70 * u}px ${170 * u}px`,
            gap: 70 * u,
          }}
        >
          <div>
            {title}
            <div style={{height: 44 * u}} />
            {info}
          </div>
          {cta}
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${80 * u}px ${150 * u}px ${120 * u}px`,
          }}
        >
          <div>
            {title}
            <div style={{height: 36 * u}} />
            {info}
          </div>
          {cta}
        </AbsoluteFill>
      )}
      {c.disclaimer ? (
        <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: (vertical ? 70 : 40) * u}}>
          <div
            style={{
              fontFamily: BODY_FONT,
              fontWeight: 500,
              fontSize: 22 * u,
              color: white,
              opacity: 0.6 * enter(2.4).opacity,
              textAlign: 'center',
              padding: `0 ${60 * u}px`,
            }}
          >
            {c.disclaimer}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
