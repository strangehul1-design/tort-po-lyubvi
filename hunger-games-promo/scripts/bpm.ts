/**
 * npm run bpm — определить темп трека и записать src/generated/beats.json.
 * npm run bpm -- audio/другой.mp3 — проверить любой файл, ничего не записывая.
 */
import fs from 'node:fs';
import path from 'node:path';
import config from '../promo.config';
import {analyzeBpm} from './lib/bpm';

const root = path.resolve(import.meta.dirname, '..');
const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));

const main = async () => {
  const file = arg ? path.resolve(arg) : path.join(root, 'audio', config.music.file);
  if (!fs.existsSync(file)) {
    console.error(`Нет файла ${file}. Положите трек в audio/ и укажите его в promo.config.ts → music.file`);
    process.exit(1);
  }
  const r = await analyzeBpm(file, {startSec: arg ? 0 : config.music.startSec, lengthSec: 60});
  console.log(`${path.basename(file)}: ${r.bpm} BPM, первая сильная доля ${r.firstBeatSec} с, уверенность ${r.confidence}`);
  if (!arg) {
    fs.writeFileSync(
      path.join(root, 'src', 'generated', 'beats.json'),
      JSON.stringify({...r, file: config.music.file}, null, 2) + '\n',
    );
    console.log('✓ src/generated/beats.json обновлён');
  }
};

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
