// Per-user config: Windows %APPDATA%\mahamm, macOS ~/Library/Application Support/mahamm, Linux ~/.config/mahamm
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_SITE = 'https://moodle.jce.ac.il';

export function configDir() {
  if (process.env.MAHAMM_CONFIG_DIR) return process.env.MAHAMM_CONFIG_DIR;
  const home = os.homedir();
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'mahamm');
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'mahamm');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'mahamm');
}

const file = () => path.join(configDir(), 'config.json');

export function systemLang() {
  const loc = Intl.DateTimeFormat().resolvedOptions().locale || process.env.LANG || '';
  return /^ar/i.test(loc) ? 'ar' : 'en';
}

export function loadConfig() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { /* first run */ }
  return { site: DEFAULT_SITE, lang: systemLang(), ...c };
}

export function saveConfig(cfg) {
  fs.mkdirSync(configDir(), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(cfg, null, 2), { mode: 0o600 });
  try { fs.chmodSync(file(), 0o600); } catch { /* windows */ }
}

// Optional personal dictionary: <configDir>/translations.json  {"שם בעברית": {"en": "...", "ar": "..."}}
export function loadExtraDict() {
  try { return JSON.parse(fs.readFileSync(path.join(configDir(), 'translations.json'), 'utf8')); } catch { return null; }
}

export function defaultOutDir() {
  const home = os.homedir();
  for (const d of [path.join(home, 'Documents'), path.join(home, 'documents'), home]) {
    try { if (fs.statSync(d).isDirectory()) return d; } catch { /* next */ }
  }
  return process.cwd();
}
