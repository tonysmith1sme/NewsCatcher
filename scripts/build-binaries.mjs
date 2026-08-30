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

function writeReadme(dir, binName) {
  const text = `NewsCatcher

1. 解压后不要移动或删除同目录下的 data.db 与 media 文件夹。
2. 运行 ${binName}
3. 用浏览器打开终端里打印的 http://127.0.0.1:4000

数据、图片、数据库都保存在本目录。可用环境变量 PORT / HOST / NEWSCATCHER_HOME 覆盖端口与数据路径。
macOS 若提示未知开发者：xattr -cr ${binName}
`;
  fs.writeFileSync(path.join(dir, 'README.txt'), text);
}

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
fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });

const targets = [
  { pkg: 'node20-linux-x64', dir: 'NewsCatcher-linux-x64', bin: 'NewsCatcher' },
  { pkg: 'node20-linux-arm64', dir: 'NewsCatcher-linux-arm64', bin: 'NewsCatcher' },
  { pkg: 'node20-macos-x64', dir: 'NewsCatcher-macos-x64', bin: 'NewsCatcher' },
  { pkg: 'node20-macos-arm64', dir: 'NewsCatcher-macos-arm64', bin: 'NewsCatcher' },
  { pkg: 'node20-win-x64', dir: 'NewsCatcher-windows-x64', bin: 'NewsCatcher.exe' },
];

for (const target of targets) {
  console.log(`[dist] pkg ${target.dir}`);
  const packDir = path.join(releaseDir, target.dir);
  fs.mkdirSync(packDir, { recursive: true });
  fs.mkdirSync(path.join(packDir, 'media'), { recursive: true });
  fs.writeFileSync(path.join(packDir, 'media', '.keep'), '');
  fs.copyFileSync(templateDb, path.join(packDir, 'data.db'));
  writeReadme(packDir, target.bin);

  const outFile = path.join(packDir, target.bin);
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

  const zipName = `${target.dir}.zip`;
  console.log(`[dist] zip ${zipName}`);
  run('zip', ['-r', '-q', zipName, target.dir], {}, releaseDir);
}

console.log('[dist] done → release/');
for (const target of targets) {
  const zip = path.join(releaseDir, `${target.dir}.zip`);
  if (fs.existsSync(zip)) {
    const size = Math.round(fs.statSync(zip).size / 1024 / 1024);
    console.log(`  ${target.dir}.zip  ${size} MB`);
  }
}
