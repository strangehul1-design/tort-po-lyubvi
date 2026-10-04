/**
 * npm run prep — подготовить исходники к сборке:
 *  1) вырезать нужные куски записей ReplayMod из footage/ в public/clips/;
 *  2) скопировать музыку из audio/ и звуки из sfx/ в public/;
 *  3) определить темп трека (если в конфиге bpm: 'auto');
 *  4) записать src/generated/assets.json и beats.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import config from '../promo.config';
import {ffmpeg, parseTime, probeDuration} from './lib/media';
import {analyzeBpm} from './lib/bpm';
import {printTimeline} from './timeline';

const root = path.resolve(import.meta.dirname, '..');
const pub = path.join(root, 'public');
const genDir = path.join(root, 'src', 'generated');
const force = process.argv.includes('--force');

type Assets = {
  clips: Record<string, {file: string; durationSec: number; key: string}>;
  music: string | null;
  sfx: Record<string, string>;
};

const readJson = <T,>(p: string, fallback: T): T => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch {
    return fallback;
  }
};

const copyIfChanged = (from: string, to: string) => {
  fs.mkdirSync(path.dirname(to), {recursive: true});
  const a = fs.statSync(from);
  if (fs.existsSync(to)) {
    const b = fs.statSync(to);
    if (b.size === a.size && b.mtimeMs >= a.mtimeMs) return;
  }
  fs.copyFileSync(from, to);
};

const main = async () => {
  const prev = readJson<Assets>(path.join(genDir, 'assets.json'), {clips: {}, music: null, sfx: {}});
  const assets: Assets = {clips: {}, music: null, sfx: {}};

  console.log('\n▸ Кадры');
  fs.mkdirSync(path.join(pub, 'clips'), {recursive: true});
  for (const shot of config.shots) {
    const label = `  ${String(shot.id).padStart(2)} ${shot.name}`;
    if (!shot.source) {
      console.log(`${label}: не указан source — будет заглушка`);
      continue;
    }
    const src = path.join(root, 'footage', shot.source);
    if (!fs.existsSync(src)) {
      console.log(`${label}: нет файла footage/${shot.source} — будет заглушка`);
      continue;
    }
    const start = parseTime(shot.start);
    const rel = `clips/shot-${String(shot.id).padStart(2, '0')}.mp4`;
    const out = path.join(pub, rel);
    const key = `${shot.source}|${fs.statSync(src).mtimeMs}|${start}|${shot.duration}`;
    if (!force && prev.clips[String(shot.id)]?.key === key && fs.existsSync(out)) {
      assets.clips[String(shot.id)] = prev.clips[String(shot.id)];
      console.log(`${label}: без изменений`);
      continue;
    }
    process.stdout.write(`${label}: режу ${start}–${start + shot.duration} с… `);
    // Высота 1080, частота кадров как в записи (60 fps даёт плавное замедление),
    // короткий GOP — чтобы Remotion быстро перематывал.
    await ffmpeg([
      '-ss', String(start), '-i', src, '-t', String(shot.duration),
      '-an', '-vf', 'scale=-2:1080:flags=lanczos',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-g', '12', '-bf', '0',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
    ]);
    const durationSec = probeDuration(out);
    assets.clips[String(shot.id)] = {file: rel, durationSec, key};
    console.log(`готово (${durationSec.toFixed(2)} с)`);
  }

  console.log('\n▸ Музыка');
  const beatsPath = path.join(genDir, 'beats.json');
  if (config.music.file) {
    const src = path.join(root, 'audio', config.music.file);
    if (fs.existsSync(src)) {
      const rel = `audio/${config.music.file}`;
      copyIfChanged(src, path.join(pub, rel));
      assets.music = rel;
      console.log(`  ${config.music.file}: подключён`);
      if (config.music.bpm === 'auto' || process.argv.includes('--bpm')) {
        process.stdout.write('  определяю темп… ');
        const r = await analyzeBpm(src, {startSec: config.music.startSec, lengthSec: 60});
        fs.writeFileSync(beatsPath, JSON.stringify({...r, file: config.music.file}, null, 2) + '\n');
        console.log(`${r.bpm} BPM, первая сильная доля ${r.firstBeatSec} с (уверенность ${r.confidence})`);
        if (r.confidence < 1.6) {
          console.log('  ⚠ уверенность низкая: проверьте вспышки в Studio, при необходимости задайте music.bpm вручную');
        }
      } else {
        console.log(`  темп задан вручную: ${config.music.bpm} BPM`);
      }
    } else {
      console.log(`  нет файла audio/${config.music.file} — ролик будет без музыки`);
    }
  } else {
    console.log('  music.file пуст — без музыки');
  }

  console.log('\n▸ Звуки');
  for (const [key, s] of Object.entries(config.sfx)) {
    if (!s.file) continue;
    const src = path.join(root, 'sfx', s.file);
    if (fs.existsSync(src)) {
      const rel = `sfx/${s.file}`;
      copyIfChanged(src, path.join(pub, rel));
      assets.sfx[key] = rel;
      console.log(`  ${key}: ${s.file}`);
    } else {
      console.log(`  ${key}: нет файла sfx/${s.file} — пропущен`);
    }
  }

  fs.mkdirSync(genDir, {recursive: true});
  fs.writeFileSync(path.join(genDir, 'assets.json'), JSON.stringify(assets, null, 2) + '\n');
  console.log('\n✓ src/generated/assets.json обновлён\n');

  // Монтажный лист строится уже по новым данным — в отдельном процессе.
  await printTimeline();
};

main().catch((e) => {
  console.error('\n✗', e instanceof Error ? e.message : e);
  process.exit(1);
});
