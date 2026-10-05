import React, {useMemo} from 'react';
import {AbsoluteFill, random, useVideoConfig} from 'remotion';
import config from '../promo.config';
import {Snow} from './components/Snow';
import {BODY_FONT, PIXEL_FONT} from './fonts';

type Cell = {x: number; y: number; color: string};

/**
 * Пиксельный меч 16×16, своя отрисовка в блочном стиле.
 * Остриё в правом верхнем углу, рукоять в левом нижнем.
 */
const swordCells = (): Cell[] => {
  const C = {
    light: '#ffffff',
    mid: '#9fe6ff',
    dark: '#3aa3d8',
    guard: '#1f5f8f',
    handle: '#6b4428',
    pommel: '#1f5f8f',
    outline: '#06111f',
  };
  const map = new Map<string, string>();
  const put = (x: number, y: number, col: string) => map.set(`${x},${y}`, col);
  for (let i = 6; i <= 15; i++) {
    put(i, 15 - i, C.mid);
    if (i <= 14) {
      put(i, 14 - i, C.light);
      put(i + 1, 15 - i, C.dark);
    }
  }
  for (let k = -2; k <= 2; k++) put(5 + k, 10 + k, C.guard);
  put(4, 11, C.handle);
  put(3, 12, C.handle);
  put(2, 13, C.handle);
  put(1, 14, C.pommel);
  // Обводка по четырём соседям — чистый пиксельный контур.
  for (const key of [...map.keys()]) {
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = `${x + dx},${y + dy}`;
      if (!map.has(k) && x + dx >= 0 && y + dy >= 0 && x + dx < 16 && y + dy < 16) map.set(k, C.outline);
    }
  }
  return [...map.entries()].map(([key, color]) => {
    const [x, y] = key.split(',').map(Number);
    return {x, y, color};
  });
};

const mix = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
};

/** Изометрический блок снежной травы 8×8 пикселей на грань. */
const SnowBlock: React.FC<{cx: number; top: number; a: number}> = ({cx, top, a}) => {
  const w = a * Math.cos(Math.PI / 6);
  const h = a * 0.5;
  const N = 8;
  const snow = ['#ffffff', '#f1faff', '#e2f3ff', '#cdeaff'];
  const dirt = ['#7a5236', '#6a4630', '#5b3b28', '#86603f'];

  const polys: {pts: string; fill: string}[] = [];
  const quad = (o: [number, number], du: [number, number], dv: [number, number], u: number, v: number) => {
    const p = (uu: number, vv: number) =>
      `${o[0] + du[0] * uu + dv[0] * vv},${o[1] + du[1] * uu + dv[1] * vv}`;
    return [p(u, v), p(u + 1, v), p(u + 1, v + 1), p(u, v + 1)].join(' ');
  };
  const pick = (arr: string[], key: string) => arr[Math.floor(random(key) * arr.length)];

  // Верх: снег.
  for (let u = 0; u < N; u++)
    for (let v = 0; v < N; v++)
      polys.push({
        pts: quad([cx, top], [w / N, h / N], [-w / N, h / N], u, v),
        fill: pick(snow, `t${u}-${v}`),
      });
  // Боковые грани: полоса снега сверху с подтёками, ниже земля.
  const side = (o: [number, number], du: [number, number], shade: number, tag: string) => {
    for (let u = 0; u < N; u++) {
      const drip = 2 + (random(`${tag}d${u}`) < 0.45 ? 1 : 0) + (random(`${tag}e${u}`) < 0.15 ? 1 : 0);
      for (let v = 0; v < N; v++) {
        const base = v < drip ? pick(snow, `${tag}${u}-${v}`) : pick(dirt, `${tag}${u}-${v}`);
        polys.push({pts: quad(o, du, [0, a / N], u, v), fill: base.startsWith('#') ? mix(base, shade) : base});
      }
    }
  };
  side([cx - w, top + h], [w / N, h / N], 0.72, 'L');
  side([cx, top + 2 * h], [w / N, -h / N], 0.9, 'R');

  const outline = [
    [cx, top],
    [cx + w, top + h],
    [cx + w, top + h + a],
    [cx, top + 2 * h + a],
    [cx - w, top + h + a],
    [cx - w, top + h],
  ]
    .map((p) => p.join(','))
    .join(' ');

  return (
    <g>
      {polys.map((p, i) => (
        <polygon key={i} points={p.pts} fill={p.fill} stroke={p.fill} strokeWidth={0.6} />
      ))}
      <polyline
        points={`${cx - w},${top + h} ${cx},${top + 2 * h} ${cx + w},${top + h}`}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.55}
        strokeWidth={a * 0.012}
      />
      <line x1={cx} y1={top + 2 * h} x2={cx} y2={top + 2 * h + a} stroke="#000" strokeOpacity={0.25} strokeWidth={a * 0.01} />
      <polygon points={outline} fill="none" stroke="#06111f" strokeWidth={a * 0.04} strokeLinejoin="round" />
    </g>
  );
};

/**
 * Аватарка для Telegram и TikTok. Квадрат, но всё важное — внутри круга:
 * обе площадки обрезают аватарку по кругу.
 */
export const Avatar: React.FC = () => {
  const {width} = useVideoConfig();
  const S = width;
  const c = S / 2;
  const {white, ice, iceDeep, navy, night} = config.look.colors;

  const sword = useMemo(swordCells, []);
  const swordSize = S * 0.6;
  const px = swordSize / 16;

  const bandOuter = S * 0.45;
  const bandInner = S * 0.355;
  const textR = (bandOuter + bandInner) / 2;
  const blockA = S * 0.25;
  const blockTop = c - blockA * 0.95;

  const swords = (
    <>
      {[1, -1].map((flip) => (
        <g
          key={flip}
          transform={`translate(${c} ${c - S * 0.02}) scale(${flip} 1) translate(${-swordSize / 2} ${-swordSize / 2})`}
          shapeRendering="crispEdges"
        >
          {sword.map((cell, i) => (
            <rect key={i} x={cell.x * px} y={cell.y * px} width={px + 0.6} height={px + 0.6} fill={cell.color} />
          ))}
        </g>
      ))}
    </>
  );

  return (
    <AbsoluteFill style={{backgroundColor: night}}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{position: 'absolute'}}>
        <defs>
          <filter id="av-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={S * 0.01} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="av-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy={S * 0.012} stdDeviation={S * 0.012} floodColor="#000" floodOpacity="0.7" />
          </filter>
          <radialGradient id="av-core" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#2f78b8" />
            <stop offset="45%" stopColor="#15406f" />
            <stop offset="100%" stopColor={night} />
          </radialGradient>
          <linearGradient id="av-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor={ice} />
            <stop offset="100%" stopColor={iceDeep} />
          </linearGradient>
          <clipPath id="av-inner">
            <circle cx={c} cy={c} r={bandInner} />
          </clipPath>
          <path id="av-top" d={`M ${c - textR} ${c} A ${textR} ${textR} 0 0 1 ${c + textR} ${c}`} />
          <path id="av-bottom" d={`M ${c - textR} ${c} A ${textR} ${textR} 0 0 0 ${c + textR} ${c}`} />
        </defs>

        {/* Внутренний круг: свечение, лучи, мечи и блок */}
        <g clipPath="url(#av-inner)">
          <rect width={S} height={S} fill="url(#av-core)" />
          {new Array(18).fill(0).map((_, i) => (
            <polygon
              key={i}
              points={`${c},${c} ${c + Math.cos((i * 20 - 4) * (Math.PI / 180)) * S},${c + Math.sin((i * 20 - 4) * (Math.PI / 180)) * S} ${c + Math.cos((i * 20 + 4) * (Math.PI / 180)) * S},${c + Math.sin((i * 20 + 4) * (Math.PI / 180)) * S}`}
              fill={ice}
              opacity={0.07}
            />
          ))}
          <g filter="url(#av-shadow)">{swords}</g>
          <g filter="url(#av-shadow)">
            <SnowBlock cx={c} top={blockTop} a={blockA} />
          </g>
        </g>

        {/* Кольцо: тёмная лента, ледяные ободки */}
        <circle
          cx={c}
          cy={c}
          r={textR}
          fill="none"
          stroke={navy}
          strokeWidth={bandOuter - bandInner}
        />
        <circle cx={c} cy={c} r={bandOuter} fill="none" stroke="url(#av-ring)" strokeWidth={S * 0.018} filter="url(#av-glow)" />
        <circle cx={c} cy={c} r={bandInner} fill="none" stroke="url(#av-ring)" strokeWidth={S * 0.012} filter="url(#av-glow)" />
        {/* Пиксельные заклёпки на кольце */}
        {new Array(24).fill(0).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const deg = (a * 180) / Math.PI;
          // Пропускаем места под надписями.
          const nearTop = deg > 200 && deg < 340;
          const nearBottom = deg > 40 && deg < 140;
          if (nearTop || nearBottom) return null;
          const s = S * 0.016;
          return (
            <rect
              key={i}
              x={c + Math.cos(a) * textR - s / 2}
              y={c + Math.sin(a) * textR - s / 2}
              width={s}
              height={s}
              fill={ice}
              transform={`rotate(45 ${c + Math.cos(a) * textR} ${c + Math.sin(a) * textR})`}
            />
          );
        })}

        {/* Надписи по кругу */}
        <text
          fill={white}
          fontFamily={`'${PIXEL_FONT}'`}
          fontSize={S * 0.052}
          letterSpacing={S * 0.004}
          textAnchor="middle"
          dominantBaseline="central"
          stroke="#06111f"
          strokeWidth={S * 0.006}
          style={{paintOrder: 'stroke'}}
        >
          <textPath href="#av-top" startOffset="50%">
            ГОЛОДНЫЕ ИГРЫ
          </textPath>
        </text>
        <text
          fill={ice}
          fontFamily={BODY_FONT}
          fontWeight={700}
          fontSize={S * 0.05}
          letterSpacing={S * 0.022}
          textAnchor="middle"
          dominantBaseline="central"
        >
          <textPath href="#av-bottom" startOffset="50%">
            СНЕЖИНСК
          </textPath>
        </text>
      </svg>
      <Snow travel={5.7} intensity={1.1} time={3} seed="avatar3" />
    </AbsoluteFill>
  );
};
