import React from 'react';
import {Html5Audio as Audio, Sequence, interpolate, staticFile} from 'remotion';
import config from '../../promo.config';
import type {Timeline} from '../timeline';
import {assetsInfo} from '../timeline';

type SfxKey = keyof typeof config.sfx;
const sfxSrc = (key: SfxKey) => {
  const file = assetsInfo.sfx[key];
  return file ? staticFile(file) : null;
};

/** Музыка и звуки. Отсутствующие файлы просто пропускаются. */
export const SoundDesign: React.FC<{tl: Timeline}> = ({tl}) => {
  const {fps, totalFrames, pauseStartFrame, cardStartFrame, cardMainFrame} = tl;
  const mainFrames = totalFrames - cardMainFrame;
  const music = assetsInfo.music ? staticFile(assetsInfo.music) : null;
  const cardFrames = totalFrames - cardStartFrame;
  const s = config.sfx;

  const wind = sfxSrc('wind');
  const steps = sfxSrc('footsteps');
  const sword = sfxSrc('swordHit');
  const bell = sfxSrc('bell');

  const cardMusicFrom =
    config.music.cardStartSec ?? config.music.startSec + pauseStartFrame / fps;

  return (
    <>
      {music ? (
        <>
          {/* 0–25 с: трек под монтаж. На паузе обрывается в тишину. */}
          <Sequence durationInFrames={pauseStartFrame} name="Музыка: до паузы">
            <Audio
              src={music}
              trimBefore={Math.round(config.music.startSec * fps)}
              volume={(f) =>
                config.music.volume *
                interpolate(f, [0, 3, pauseStartFrame - 2, pauseStartFrame], [0, 1, 1, 0], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })
              }
            />
          </Sequence>
          {/* Карточка: после слова «СНЕЖИНСК» и затемнения музыка возвращается
              вместе с основным текстом и затихает к концу. */}
          <Sequence from={cardMainFrame} durationInFrames={mainFrames} name="Музыка: карточка">
            <Audio
              src={music}
              trimBefore={Math.round(cardMusicFrom * fps)}
              volume={(f) =>
                config.music.volume *
                interpolate(f, [0, 2, mainFrames - fps * 1.5, mainFrames], [0, 1, 1, 0], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })
              }
            />
          </Sequence>
        </>
      ) : null}

      {wind ? (
        <Sequence durationInFrames={totalFrames} name="Ветер">
          <Audio
            src={wind}
            loop
            volume={(f) =>
              interpolate(
                f,
                [0, fps, pauseStartFrame, pauseStartFrame + fps, cardStartFrame, totalFrames - fps, totalFrames],
                [0, s.wind.volume, s.wind.volume, s.wind.pauseVolume, s.wind.pauseVolume, s.wind.volume * 0.6, 0],
                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
              )
            }
          />
        </Sequence>
      ) : null}

      {steps ? (
        <Sequence
          from={pauseStartFrame + Math.round(fps * 0.3)}
          durationInFrames={cardStartFrame - pauseStartFrame - Math.round(fps * 0.3)}
          name="Шаги по снегу"
        >
          <Audio src={steps} volume={s.footsteps.volume} />
        </Sequence>
      ) : null}

      {sword
        ? tl.swordFrames.map((f, i) => (
            <Sequence key={`sword-${i}`} from={f} durationInFrames={Math.round(fps * 1.5)} name="Удар мечом">
              <Audio src={sword} volume={s.swordHit.volume} />
            </Sequence>
          ))
        : null}

      {bell ? (
        <>
          <Sequence from={tl.bellFrame} durationInFrames={Math.round(fps * 4)} name="Колокол старта">
            <Audio src={bell} volume={s.bell.volume} />
          </Sequence>
          <Sequence from={cardStartFrame} durationInFrames={cardFrames} name="Колокол: карточка">
            <Audio src={bell} volume={s.bell.volume} />
          </Sequence>
        </>
      ) : null}
    </>
  );
};
