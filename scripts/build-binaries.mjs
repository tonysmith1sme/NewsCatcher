import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, extraEnv = {}, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function npmPrefix(prefix, args, extraEnv = {}) {
  run('npm', ['--prefix', prefix, ...args], extraEnv);
}

console.log('[dist] install check skipped (CI / local should already npm install)');

console.log('[dist] build frontend');
npmPrefix('frontend', ['run', 'build']);

console.log('[dist] generate prisma clients for all binary targets');
npmPrefix('backend', ['run', 'prisma:generate']);

const templateDb = path.join(root, 'backend/prisma/template.db');
for (const leftover of [templateDb, `${templateDb}-journal`, `${templateDb}-wal`, `${templateDb}-shm`]) {
  if (fs.existsSync(leftover)) fs.unlinkSync(leftover);
}

console.log('[dist] create empty template database');
run(
  'npx',
  ['prisma', 'db', 'push', '--skip-generate'],
  { DATABASE_URL: `file:${templateDb}` },
  path.join(root, 'backend'),
);

console.log('[dist] build backend');
npmPrefix('backend', ['run', 'build']);

const releaseDir = path.join(root, 'release');
fs.mkdirSync(releaseDir, { recursive: true });

const targets = [
  { pkg: 'node20-linux-x64', name: 'NewsCatcher-linux-x64' },
  { pkg: 'node20-linux-arm64', name: 'NewsCatcher-linux-arm64' },
  { pkg: 'node20-macos-x64', name: 'NewsCatcher-macos-x64' },
  { pkg: 'node20-macos-arm64', name: 'NewsCatcher-macos-arm64' },
];

for (const target of targets) {
  console.log(`[dist] pkg ${target.name}`);
  const outFile = path.join(releaseDir, target.name);
  run('npx', [
    'pkg',
    'backend/dist/index.js',
    '--config',
    'pkg.json',
    '--target',
    target.pkg,
    '--output',
    outFile,
    '--compress',
    'GZip',
  ]);
}

console.log('[dist] done → release/');
for (const target of targets) {
  const p = path.join(releaseDir, target.name);
  if (fs.existsSync(p)) {
    const size = Math.round(fs.statSync(p).size / 1024 / 1024);
    console.log(`  ${target.name}  ${size} MB`);
  }
}
