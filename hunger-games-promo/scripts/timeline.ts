/**
 * npm run timeline — показать монтажный лист: какой кадр, когда, сколько долей,
 * и сколько секунд каждой записи реально нужно ролику.
 */
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

/** Запуск в отдельном процессе, чтобы подхватить свежие JSON после prep. */
export const printTimeline = async () => {
  spawnSync(process.execPath, ['--import', 'tsx', path.join(import.meta.dirname, 'timeline.ts')], {stdio: 'inherit'});
};

const main = async () => {
  const {buildTimeline, clipDurationSec, getShot, assetsInfo} = await import('../src/timeline');
  const tl = buildTimeline();
  const sec = (f: number) => (f / tl.fps).toFixed(2).padStart(6);
  const src = {config: 'из конфига', analysis: 'из анализа трека', fallback: 'запасной (трека нет)'}[tl.bpmSource];
  console.log(`Темп: ${tl.bpm} BPM (${src}), доля ${tl.beatSec.toFixed(3)} с, ${tl.fps} fps`);
  console.log(`Хук до ${sec(tl.hookEndFrame)} с · пауза с ${sec(tl.pauseStartFrame)} с · карточка с ${sec(tl.cardStartFrame)} с\n`);
  console.log('  начало   длина  долей  кадр                       с секунды  скорость');
  const need = new Map<number, number>();
  for (const s of tl.segments) {
    const d = s.durationFrames / tl.fps;
    need.set(s.shotId, Math.max(need.get(s.shotId) ?? 0, s.clipFromSec + d * s.rate));
    const mark = s.onDownbeat ? '⚡' : s.kind === 'hook' ? 'Х' : s.kind === 'pause' ? 'П' : ' ';
    console.log(
      `${mark} ${sec(s.startFrame)}  ${d.toFixed(2).padStart(5)}  ${s.beats.toFixed(1).padStart(5)}  ` +
        `${String(s.shotId).padStart(2)} ${getShot(s.shotId).name.padEnd(22)} ${s.clipFromSec.toFixed(2).padStart(6)}  ${s.rate.toFixed(2).padStart(6)}`,
    );
  }
  console.log('\n⚡ — вспышка на сильной доле, Х — хук, П — пауза');
  console.log('\nСколько записи нужно ролику (с учётом замедления):');
  for (const [id, n] of [...need.entries()].sort((a, b) => a[0] - b[0])) {
    const has = assetsInfo.clips[String(id)] ? `вырезано ${clipDurationSec(id).toFixed(1)} с` : 'не снято';
    console.log(`  ${String(id).padStart(2)} ${getShot(id).name.padEnd(22)} нужно ${n.toFixed(1).padStart(4)} с · ${has}`);
  }
  if (tl.warnings.length) {
    console.log('\nПредупреждения:');
    for (const w of tl.warnings) console.log('  ⚠ ' + w);
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
