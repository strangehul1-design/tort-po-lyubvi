import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import config from '../promo.config';
import {Snow} from './components/Snow';
import {Frost} from './components/Frost';
import {BODY_FONT, DISPLAY_FONT, PIXEL_FONT} from './fonts';

const RED = '#ff3b4f';
const RED_DARK = '#9e1426';

/** Пиксельный крестик: рисуется квадратами, без эмодзи. */
const PixelX: React.FC<{size: number}> = ({size}) => {
  const n = 7;
  const p = size / n;
  const cells: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    cells.push([i, i], [n - 1 - i, i]);
  }
  return (
    <svg width={size} height={size} shapeRendering="crispEdges">
      {cells.map(([x, y], i) => (
        <rect key={i} x={x * p} y={y * p} width={p + 0.5} height={p + 0.5} fill={RED} />
      ))}
    </svg>
  );
};

/** Пиксельный знак запрета: круг с косой чертой. */
const PixelBan: React.FC<{size: number}> = ({size}) => {
  const n = 16;
  const p = size / n;
  const cells: [number, number][] = [];
  const c = (n - 1) / 2;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - c, y - c);
      const ring = d > 5.6 && d < 7.6;
      // Черта из левого верхнего в правый нижний.
      const slash = Math.abs(x - y) <= 1 && d < 6;
      if (ring || slash) cells.push([x, y]);
    }
  return (
    <svg width={size} height={size} shapeRendering="crispEdges" style={{filter: `drop-shadow(0 0 ${size * 0.08}px ${RED})`}}>
      {cells.map(([x, y], i) => (
        <rect key={i} x={x * p} y={y * p} width={p + 0.5} height={p + 0.5} fill={RED} />
      ))}
    </svg>
  );
};

const VIOLATIONS = [
  'Читы, X-Ray, макросы, автокликеры',
  'Отказ от проверки на читы',
  'Договорняки и продажа победы',
  'Чужой аккаунт или твинк',
  'Атаки на сервер',
  'Угрозы и слив личных данных',
];

/** Картинка к посту с правилами, 1080×1350. */
export const RulesPost: React.FC = () => {
  const {width} = useVideoConfig();
  const u = width / 1080;
  const {white, ice, navy, night} = config.look.colors;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 22%, #3a1020 0%, ${navy} 38%, ${night} 85%)`,
      }}
    >
      <Snow travel={6.1} intensity={1.3} time={2.4} seed="rules" />
      <Frost strength={1} />

      <AbsoluteFill style={{alignItems: 'center', padding: `${70 * u}px ${80 * u}px`}}>
        <div
          style={{
            fontFamily: `'${PIXEL_FONT}'`,
            fontSize: 26 * u,
            color: ice,
            letterSpacing: 2 * u,
            textShadow: `0 ${3 * u}px 0 #06111f`,
          }}
        >
          ГОЛОДНЫЕ ИГРЫ · СНЕЖИНСК
        </div>

        <div style={{marginTop: 46 * u}}>
          <PixelBan size={190 * u} />
        </div>

        <div
          style={{
            marginTop: 30 * u,
            fontFamily: DISPLAY_FONT,
            fontSize: 132 * u,
            lineHeight: 1,
            color: white,
            textShadow: `0 0 ${18 * u}px ${RED}, 0 0 ${48 * u}px ${RED_DARK}, 0 ${7 * u}px 0 #1a0408`,
          }}
        >
          ВЕЧНЫЙ БАН
        </div>
        <div
          style={{
            marginTop: 18 * u,
            fontFamily: BODY_FONT,
            fontWeight: 700,
            fontSize: 36 * u,
            color: ice,
            textAlign: 'center',
          }}
        >
          за грубое нарушение правил
        </div>

        <div
          style={{
            marginTop: 48 * u,
            width: '100%',
            background: `${night}cc`,
            border: `${3 * u}px solid ${RED}88`,
            borderRadius: 18 * u,
            padding: `${30 * u}px ${40 * u}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: 20 * u,
          }}
        >
          {VIOLATIONS.map((v) => (
            <div key={v} style={{display: 'flex', alignItems: 'center', gap: 26 * u}}>
              <PixelX size={34 * u} />
              <div style={{fontFamily: BODY_FONT, fontWeight: 700, fontSize: 38 * u, color: white}}>{v}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 44 * u,
            fontFamily: DISPLAY_FONT,
            fontSize: 44 * u,
            color: white,
            textAlign: 'center',
            lineHeight: 1.25,
          }}
        >
          Без предупреждений.
          <br />
          <span style={{color: RED, textShadow: `0 0 ${14 * u}px ${RED_DARK}`}}>Без права вернуться. Никогда.</span>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 52 * u,
            fontFamily: BODY_FONT,
            fontWeight: 500,
            fontSize: 26 * u,
            color: ice,
            opacity: 0.85,
          }}
        >
          Полный свод правил — в закрепе канала
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
