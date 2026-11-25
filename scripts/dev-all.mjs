// Запускает бэкенд + Vite dev параллельно (кросс-платформенно).
// npm run dev
//
// ВАЖНО: путь проекта может содержать пробелы (напр. "T-Start product"),
// поэтому Vite запускаем через `node node_modules/vite/bin/vite.js`,
// а НЕ через shell/.cmd — иначе аргументы ломаются по пробелу.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const procs = [
  spawn(process.execPath, ['server/index.mjs'], { cwd: root, stdio: 'inherit', env: process.env }),
  spawn(process.execPath, [viteBin], { cwd: root, stdio: 'inherit', env: process.env }),
];

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  procs.forEach(p => { try { p.kill(); } catch { /* ignore */ } });
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

for (const p of procs) {
  p.on('exit', (code) => {
    // Если один процесс упал — гасим второй, чтобы не висел «полу-запуск».
    if (code && code !== 0) shutdown();
  });
}
