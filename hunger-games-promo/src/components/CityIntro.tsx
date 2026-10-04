import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import config from '../../promo.config';
import {DISPLAY_FONT} from '../fonts';

/**
 * Начало карточки: одно слово (card.subtitle, «СНЕЖИНСК») в тишине,
 * затем уход в чёрное. Из темноты вместе с музыкой выходит основной текст.
 * Кадр 0 — начало карточки.
 */
export const CityIntro: React.FC<{introFrames: number; blackoutFrames: number}> = ({
  introFrames,
  blackoutFrames,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  const {white, ice, iceDeep, navy, night} = config.look.colors;
  const word = config.card.subtitle;
  const mainStart = introFrames + blackoutFrames;
  const reveal = Math.round(fps * 0.5);

  // Чернота: нарастает к концу заставки и снимается, когда входит основной текст.
  const black = interpolate(
    frame,
    [introFrames - fps * 0.2, introFrames + blackoutFrames * 0.6, mainStart, mainStart + reveal],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  const wordIn = interpolate(frame, [fps * 0.15, fps * 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const wordScale = interpolate(frame, [0, introFrames], [1.08, 1], {extrapolateRight: 'clamp'});
  const spacing = interpolate(frame, [0, introFrames], [0.32, 0.42], {extrapolateRight: 'clamp'});
  const fontSize = Math.min(150 * u, (width * 0.86) / Math.max(1, word.length * (0.78 + spacing)));

  return (
    <AbsoluteFill>
      {word && frame < mainStart ? (
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
          {/* Тёмный фон под словом, чтобы оно читалось поверх размытого кадра */}
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse at 50% 50%, ${navy}cc 0%, ${night}f2 75%)`,
              opacity: wordIn,
            }}
          />
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize,
              letterSpacing: `${spacing}em`,
              marginRight: `-${spacing}em`,
              color: white,
              textShadow: `0 0 ${16 * u}px ${ice}, 0 0 ${48 * u}px ${iceDeep}aa`,
              opacity: wordIn,
              filter: wordIn < 0.999 ? `blur(${(1 - wordIn) * 18 * u}px)` : undefined,
              transform: `scale(${wordScale})`,
            }}
          >
            {word}
          </div>
        </AbsoluteFill>
      ) : null}
      {black > 0 ? <AbsoluteFill style={{backgroundColor: '#000', opacity: black}} /> : null}
    </AbsoluteFill>
  );
};
