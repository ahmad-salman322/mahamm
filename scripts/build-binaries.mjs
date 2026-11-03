// Builds single-file programs (no Node needed) for Windows, macOS and Linux with Bun.
//   node scripts/build-binaries.mjs            all targets
//   node scripts/build-binaries.mjs linux-x64  one target
// Requires Bun (https://bun.sh). The GitHub release workflow runs this automatically.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = {
  'linux-x64': 'bun-linux-x64',
  'linux-arm64': 'bun-linux-arm64',
  'windows-x64': 'bun-windows-x64',
  'macos-x64': 'bun-darwin-x64',
  'macos-arm64': 'bun-darwin-arm64',
};

const bun = spawnSync('bun', ['--version'], { encoding: 'utf8' });
if (bun.status !== 0) {
  console.error('Bun is required: https://bun.sh  (or download ready-made programs from the GitHub Releases page)');
  process.exit(1);
}
const want = process.argv.slice(2);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
for (const [name, target] of Object.entries(TARGETS)) {
  if (want.length && !want.includes(name)) continue;
  const out = path.join(root, 'dist', `mahamm-${name}${name.startsWith('windows') ? '.exe' : ''}`);
  const r = spawnSync('bun', ['build', 'app/bin/mahamm.js', '--compile', '--minify', `--target=${target}`, '--outfile', out], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
  console.log('built', path.relative(root, out));
}
