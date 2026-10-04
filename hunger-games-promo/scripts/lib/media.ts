/**
 * Запуск ffmpeg/ffprobe. Берётся системный ffmpeg, если он есть в PATH,
 * иначе — тот, что поставляется вместе с Remotion (ставить отдельно не нужно).
 */
import {spawn, spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const remotionCli = path.join(path.dirname(require.resolve('@remotion/cli/package.json')), 'remotion-cli.js');

const hasSystem = (bin: string) => {
  if (process.env.USE_REMOTION_FFMPEG) return false;
  try {
    return spawnSync(bin, ['-version'], {stdio: 'ignore'}).status === 0;
  } catch {
    return false;
  }
};

const resolveTool = (tool: 'ffmpeg' | 'ffprobe'): [string, string[]] =>
  hasSystem(tool) ? [tool, []] : [process.execPath, [remotionCli, tool]];

const ffmpegCmd = resolveTool('ffmpeg');
const ffprobeCmd = resolveTool('ffprobe');

export const remotionCliPath = remotionCli;

export const run = (cmd: string, args: string[], opts: {quiet?: boolean} = {}): Promise<void> =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {stdio: opts.quiet ? ['ignore', 'ignore', 'pipe'] : 'inherit'});
    let err = '';
    p.stderr?.on('data', (d) => (err += d.toString()));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} завершился с кодом ${code}\n${err.slice(-2000)}`)),
    );
  });

export const ffmpeg = (args: string[], quiet = true) =>
  run(ffmpegCmd[0], [...ffmpegCmd[1], '-hide_banner', '-y', ...args], {quiet});

/** ffmpeg с выводом в память (например, PCM для анализа темпа). */
export const ffmpegCapture = (args: string[]): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const p = spawn(ffmpegCmd[0], [...ffmpegCmd[1], '-hide_banner', '-v', 'error', ...args]);
    const chunks: Buffer[] = [];
    let err = '';
    p.stdout.on('data', (d: Buffer) => chunks.push(d));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(err))));
  });

export const probeDuration = (file: string): number => {
  const r = spawnSync(
    ffprobeCmd[0],
    [...ffprobeCmd[1], '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
    {encoding: 'utf8'},
  );
  const v = parseFloat((r.stdout || '').trim().split('\n').pop() || '');
  if (!Number.isFinite(v)) throw new Error(`Не удалось узнать длину файла ${file}\n${r.stderr}`);
  return v;
};

/** "1:23.5" → 83.5, "01:02:03" → 3723, 12 → 12. */
export const parseTime = (t: number | string): number => {
  if (typeof t === 'number') return t;
  const parts = t.trim().split(':').map(Number);
  if (parts.some((x) => !Number.isFinite(x))) throw new Error(`Не понимаю время "${t}"`);
  return parts.reduce((acc, x) => acc * 60 + x, 0);
};
