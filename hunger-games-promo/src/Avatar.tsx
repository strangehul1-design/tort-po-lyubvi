import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import config from '../promo.config';
import {Snow} from './components/Snow';
import {BODY_FONT, DISPLAY_FONT} from './fonts';

/** Снежинка из шести лучей с веточками. */
const Snowflake: React.FC<{r: number; stroke: string; width: number}> = ({r, stroke, width}) => {
  const arm = (
    <g>
      <line x1={0} y1={0} x2={0} y2={-r} />
      {[0.38, 0.62, 0.82].map((p, i) => {
        const len = r * [0.26, 0.2, 0.12][i];
        return (
          <g key={i}>
            <line x1={0} y1={-r * p} x2={-len * 0.8} y2={-r * p - len} />
            <line x1={0} y1={-r * p} x2={len * 0.8} y2={-r * p - len} />
          </g>
        );
      })}
    </g>
  );
  return (
    <g stroke={stroke} strokeWidth={width} strokeLinecap="round" fill="none">
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          {arm}
        </g>
      ))}
      <polygon
        points={[0, 60, 120, 180, 240, 300]
          .map((a) => {
            const rad = ((a - 90) * Math.PI) / 180;
            return `${Math.cos(rad) * r * 0.18},${Math.sin(rad) * r * 0.18}`;
          })
          .join(' ')}
      />
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
  const ringR = S * 0.43;
  const textR = S * 0.37;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 42%, #173a66 0%, ${navy} 45%, ${night} 80%)`,
      }}
    >
      <Snow travel={4.2} intensity={1.2} time={2} seed="avatar" />
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{position: 'absolute'}}>
        <defs>
          <filter id="av-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={S * 0.012} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <path id="av-top" d={`M ${c - textR} ${c} A ${textR} ${textR} 0 0 1 ${c + textR} ${c}`} />
          <path id="av-bottom" d={`M ${c - textR} ${c} A ${textR} ${textR} 0 0 0 ${c + textR} ${c}`} />
        </defs>

        {/* Большая снежинка-эмблема */}
        <g transform={`translate(${c} ${c})`} opacity={0.5} filter="url(#av-glow)">
          <Snowflake r={S * 0.3} stroke={iceDeep} width={S * 0.014} />
        </g>

        {/* Кольца */}
        <circle cx={c} cy={c} r={ringR} fill="none" stroke={ice} strokeWidth={S * 0.008} filter="url(#av-glow)" />
        <circle cx={c} cy={c} r={ringR - S * 0.022} fill="none" stroke={ice} strokeOpacity={0.45} strokeWidth={S * 0.003} />
        <circle cx={c} cy={c} r={S * 0.31} fill="none" stroke={ice} strokeOpacity={0.35} strokeWidth={S * 0.003} />

        {/* Надписи по кругу */}
        <text
          fill={white}
          fontFamily={DISPLAY_FONT}
          fontSize={S * 0.062}
          letterSpacing={S * 0.008}
          textAnchor="middle"
          filter="url(#av-glow)"
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
          dominantBaseline="hanging"
        >
          <textPath href="#av-bottom" startOffset="50%">
            СНЕЖИНСК
          </textPath>
        </text>
        {/* Звёздочки-разделители слева и справа */}
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(${c + side * textR} ${c + S * 0.004}) rotate(45)`}>
            <rect x={-S * 0.011} y={-S * 0.011} width={S * 0.022} height={S * 0.022} fill={ice} />
          </g>
        ))}

        {/* Монограмма */}
        <text
          x={c}
          y={c + S * 0.075}
          fill={white}
          fontFamily={DISPLAY_FONT}
          fontSize={S * 0.25}
          textAnchor="middle"
          filter="url(#av-glow)"
          style={{paintOrder: 'stroke'}}
          stroke={navy}
          strokeWidth={S * 0.012}
        >
          ГИ
        </text>
      </svg>
    </AbsoluteFill>
  );
};
