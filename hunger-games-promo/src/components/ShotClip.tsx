import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useRemotionEnvironment, useVideoConfig} from 'remotion';
import config from '../../promo.config';
import {assetsInfo, getShot} from '../timeline';
import {BODY_FONT} from '../fonts';

/**
 * Один кусок записи. Если кадр ещё не снят и не вырезан (`npm run prep`),
 * показывается тёмная снежная заглушка. Подпись на ней видна только в Studio,
 * в отрендеренном ролике текста нет.
 */
export const ShotClip: React.FC<{
  shotId: number;
  fromSec: number;
  rate: number;
  style?: React.CSSProperties;
}> = ({shotId, fromSec, rate, style}) => {
  const {fps, width, height} = useVideoConfig();
  const env = useRemotionEnvironment();
  const shot = getShot(shotId);
  const clip = assetsInfo.clips[String(shotId)];
  const vertical = height > width;
  const focusX = shot.focusX ?? 0.5;

  if (!clip) {
    const {navy, night, iceDeep} = config.look.colors;
    return (
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at ${30 + ((shotId * 37) % 40)}% 35%, ${iceDeep}55 0%, ${navy} 45%, ${night} 100%)`,
          ...style,
        }}
      >
        {env.isStudio ? (
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
            <div
              style={{
                fontFamily: BODY_FONT,
                fontWeight: 700,
                color: '#ffffff88',
                fontSize: Math.min(width, height) * 0.04,
                textAlign: 'center',
                padding: 40,
              }}
            >
              Кадр {shotId} · {shot.name}
              <br />
              <span style={{fontWeight: 500, fontSize: '0.6em'}}>
                нет записи: заполните shots[{shotId - 1}].source и запустите npm run prep
              </span>
            </div>
          </AbsoluteFill>
        ) : null}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={style}>
      <OffthreadVideo
        src={staticFile(clip.file)}
        muted
        trimBefore={Math.max(0, Math.round(fromSec * fps))}
        playbackRate={rate}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: vertical ? `${focusX * 100}% 50%` : '50% 50%',
        }}
      />
    </AbsoluteFill>
  );
};
