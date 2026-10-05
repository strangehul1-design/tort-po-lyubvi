/**
 * npm run render:all        — оба ролика и обе обложки
 * npm run render:vertical   — 9:16, 1080×1920
 * npm run render:horizontal — 16:9, 1920×1080
 * npm run render:covers     — обложки 1080×1920 и 1280×720
 * npm run render:avatar     — аватарка для Telegram и TikTok, 1080 и 640 px
 *
 * Ролик рендерит Remotion (H.264), затем ffmpeg переупаковывает файл
 * с +faststart, чтобы видео сразу начинало играть в соцсетях.
 */
import fs from 'node:fs';
import path from 'node:path';
import config from '../promo.config';
import {ffmpeg, remotionCliPath, run} from './lib/media';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'out');
const what = process.argv[2] ?? 'all';
const extra = process.argv.slice(3);

const remotion = (args: string[]) => run(process.execPath, [remotionCliPath, ...args, ...extra]);

const renderVideo = async (id: string, name: string) => {
  const tmp = path.join(outDir, `.${name}.tmp.mp4`);
  const final = path.join(outDir, `${name}.mp4`);
  console.log(`\n▸ ${id} → out/${name}.mp4`);
  await remotion([
    'render', 'src/index.ts', id, tmp,
    '--codec', 'h264', '--crf', String(config.video.crf),
    '--pixel-format', 'yuv420p', '--color-space', 'bt709', '--audio-codec', 'aac', '--audio-bitrate', '320k',
  ]);
  await ffmpeg(['-i', tmp, '-c', 'copy', '-movflags', '+faststart', final]);
  fs.rmSync(tmp, {force: true});
};

const renderStill = async (id: string, name: string) => {
  console.log(`\n▸ ${id} → out/${name}.jpg`);
  await remotion(['still', 'src/index.ts', id, path.join(outDir, `${name}.jpg`), '--image-format', 'jpeg', '--jpeg-quality', '95']);
};

const main = async () => {
  fs.mkdirSync(outDir, {recursive: true});
  if (what === 'vertical' || what === 'all') await renderVideo('Promo-Vertical', 'promo-9x16-1080x1920');
  if (what === 'horizontal' || what === 'all') await renderVideo('Promo-Horizontal', 'promo-16x9-1920x1080');
  if (what === 'covers' || what === 'all') {
    await renderStill('Cover-Vertical', 'cover-1080x1920');
    await renderStill('Cover-Horizontal', 'cover-1280x720');
  }
  if (what === 'avatar' || what === 'all') {
    console.log('\n▸ Avatar → out/avatar-1080.png, out/avatar-640.png');
    const big = path.join(outDir, 'avatar-1080.png');
    await remotion(['still', 'src/index.ts', 'Avatar', big, '--image-format', 'png']);
    await ffmpeg(['-i', big, '-vf', 'scale=640:640:flags=lanczos', path.join(outDir, 'avatar-640.png')]);
  }
  console.log('\n✓ Готово, файлы в папке out/');
};

main().catch((e) => {
  console.error('\n✗', e instanceof Error ? e.message : e);
  process.exit(1);
});
