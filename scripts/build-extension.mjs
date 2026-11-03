// Builds the extension for Chrome/Edge and Firefox:
//   dist/extension-chrome/   dist/extension-firefox/   + .zip of each
// No dependencies (zip writer below uses node:zlib).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'extension', 'src');
const dist = path.join(root, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const GECKO_ID = 'mahamm@mahamm-extension';

function copyDir(from, to, filter = () => true) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (!filter(a)) continue;
    if (e.isDirectory()) copyDir(a, b, filter);
    else fs.copyFileSync(a, b);
  }
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

// Minimal ZIP (deflate) writer.
function zip(dir, outFile) {
  const files = listFiles(dir).sort();
  const parts = [];
  const central = [];
  let offset = 0;
  const dosTime = 0; // 1980-01-01 00:00 (reproducible builds)
  const dosDate = (1 << 5) | 1;
  for (const name of files) {
    const data = fs.readFileSync(path.join(dir, name));
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data) >>> 0;
    const nameBuf = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20);
    cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  fs.writeFileSync(outFile, Buffer.concat([...parts, cenBuf, end]));
}

function build(target) {
  const out = path.join(dist, `extension-${target}`);
  fs.rmSync(out, { recursive: true, force: true });
  copyDir(src, out);
  copyDir(path.join(root, 'core'), path.join(out, 'core'));
  copyDir(path.join(root, 'extension', 'icons'), path.join(out, 'icons'), (p) => !p.endsWith('.svg'));
  const m = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
  m.version = pkg.version;
  if (target === 'firefox') {
    m.background = { scripts: ['background.js'], type: 'module' };
    m.browser_specific_settings = { gecko: { id: GECKO_ID, strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } } };
  } else {
    m.background = { service_worker: 'background.js', type: 'module' };
    m.minimum_chrome_version = '116';
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(m, null, 2));
  const zipFile = path.join(dist, `mahamm-extension-${target}-${pkg.version}.zip`);
  zip(out, zipFile);
  console.log(`${target.padEnd(8)} ${path.relative(root, out)}  →  ${path.relative(root, zipFile)}`);
}

fs.mkdirSync(dist, { recursive: true });
for (const t of process.argv.slice(2).length ? process.argv.slice(2) : ['chrome', 'firefox']) build(t);
