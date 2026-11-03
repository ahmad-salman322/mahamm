// Find installed browsers on Windows, macOS and Linux.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const exists = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

function onPath(names) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  for (const n of names) for (const d of dirs) for (const e of exts) {
    const p = path.join(d, n + e);
    if (exists(p)) return p;
  }
  return null;
}

function candidates() {
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  if (process.platform === 'win32') {
    return {
      chrome: [path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'), path.join(pf86, 'Google\\Chrome\\Application\\chrome.exe'), path.join(local, 'Google\\Chrome\\Application\\chrome.exe')],
      edge: [path.join(pf86, 'Microsoft\\Edge\\Application\\msedge.exe'), path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe')],
      brave: [path.join(pf, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'), path.join(local, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe')],
      chromium: [path.join(local, 'Chromium\\Application\\chrome.exe')],
      firefox: [path.join(pf, 'Mozilla Firefox\\firefox.exe'), path.join(pf86, 'Mozilla Firefox\\firefox.exe')],
    };
  }
  if (process.platform === 'darwin') {
    const apps = ['/Applications', path.join(os.homedir(), 'Applications')];
    const mac = (app, bin) => apps.map((a) => path.join(a, `${app}.app/Contents/MacOS/${bin}`));
    return {
      chrome: mac('Google Chrome', 'Google Chrome'),
      edge: mac('Microsoft Edge', 'Microsoft Edge'),
      brave: mac('Brave Browser', 'Brave Browser'),
      chromium: mac('Chromium', 'Chromium'),
      firefox: mac('Firefox', 'firefox'),
    };
  }
  return {
    chrome: [onPath(['google-chrome-stable', 'google-chrome'])],
    edge: [onPath(['microsoft-edge-stable', 'microsoft-edge'])],
    brave: [onPath(['brave-browser', 'brave'])],
    chromium: [onPath(['chromium', 'chromium-browser'])],
    firefox: [onPath(['firefox'])],
  };
}

// [{ id, kind: 'chromium'|'firefox', path }] in preference order.
export function findBrowsers() {
  const c = candidates();
  const out = [];
  for (const id of ['chrome', 'edge', 'chromium', 'brave', 'firefox']) {
    const p = (c[id] || []).find((x) => x && exists(x));
    if (p) out.push({ id, kind: id === 'firefox' ? 'firefox' : 'chromium', path: p });
  }
  return out;
}

export function pickBrowser(want = 'auto', kinds = ['chromium', 'firefox']) {
  const list = findBrowsers().filter((b) => kinds.includes(b.kind));
  if (want && want !== 'auto') return list.find((b) => b.id === want) || null;
  return list[0] || null;
}
