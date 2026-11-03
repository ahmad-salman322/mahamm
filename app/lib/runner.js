// Shared logic for the CLI and the GUI.
import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { Moodle, restCaller, listSemesters, coursesForSemester, semesterLabel } from '../../core/moodle.js';
import { buildModel, renderHtml, renderMarkdown, renderJson } from '../../core/report.js';
import { t as tr, pickLang } from '../../core/i18n.js';
import { normalizeSite } from '../../core/token.js';
import { safeName, pool } from '../../core/util.js';
import { loadConfig, saveConfig, loadExtraDict, defaultOutDir } from './config.js';
import { htmlToPdf } from './pdf.js';

export const FORMATS = ['pdf', 'html', 'md', 'json'];

export function client(cfg) {
  if (!cfg.token) throw Object.assign(new Error('Not signed in. Run: mahamm login'), { code: 'nologin' });
  return new Moodle(cfg.site, restCaller(cfg.site, cfg.token));
}

export async function saveLogin(site, token) {
  const s = normalizeSite(site);
  const m = new Moodle(s, restCaller(s, token));
  const info = await m.siteInfo();
  const cfg = loadConfig();
  Object.assign(cfg, { site: s, token, user: info.fullname, userid: info.userid, siteName: info.sitename });
  saveConfig(cfg);
  return cfg;
}

export function logout() {
  const cfg = loadConfig();
  delete cfg.token; delete cfg.user; delete cfg.userid;
  saveConfig(cfg);
}

export async function semesters(cfg, lang) {
  const courses = await client(cfg).courses();
  const t = (k, v) => tr(lang, k, v);
  return { courses, list: listSemesters(courses).map((s) => ({ ...s, label: semesterLabel(s, t) })) };
}

export const DEFAULT_NAME = 'moodle-tasks_{semester}_{date}';

// "{semester}", "{date}", "{lang}" are filled in; the right extension is added if missing.
export function fileNameFor(template, { format, semKey, lang }) {
  const date = new Date().toISOString().slice(0, 10);
  let n = String(template || '').trim() || DEFAULT_NAME;
  n = n.replace(/\{semester\}/g, semKey).replace(/\{date\}/g, date).replace(/\{lang\}/g, lang || '');
  n = n.replace(/\.(pdf|html?|md|markdown|json)$/i, '');
  return `${safeName(n, 150)}.${format}`;
}

function resolveOut(out, format, semKey, nameTemplate, lang) {
  const name = fileNameFor(nameTemplate, { format, semKey, lang });
  if (!out) return path.join(defaultOutDir(), name);
  let p = out.replace(/^~(?=$|[\\/])/, process.env.HOME || process.env.USERPROFILE || '~');
  p = path.resolve(p);
  let isDir = /[\\/]$/.test(out);
  try { isDir = isDir || fs.statSync(p).isDirectory(); } catch { /* new path */ }
  if (isDir || !path.extname(p)) { fs.mkdirSync(p, { recursive: true }); return path.join(p, name); }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return nameTemplate ? path.join(path.dirname(p), name) : p;
}

export function formatFromPath(p) {
  const e = path.extname(p || '').slice(1).toLowerCase();
  return { htm: 'html', markdown: 'md' }[e] || (FORMATS.includes(e) ? e : null);
}

async function downloadFiles(cfg, model, outFile, onProgress) {
  const base = outFile.replace(/\.[^.]+$/, '') + '_files';
  const jobs = [];
  for (const x of model.todo) for (const f of x.files || []) if (f.url) jobs.push({ x, f });
  let n = 0;
  await pool(jobs, 4, async ({ x, f }) => {
    const c = model.courses.find((cc) => cc.id === x.courseId);
    const dir = path.join(base, safeName(c ? c.he : String(x.courseId)), safeName(x.name));
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, safeName(f.name, 120));
    const url = f.url + (f.url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(cfg.token);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      f.localPath = path.relative(path.dirname(outFile), dest).split(path.sep).join('/');
    } catch { /* keep going */ }
    onProgress({ step: 'files', done: ++n, total: jobs.length });
  });
  return base;
}

// opts: { semester: 'latest'|'all'|key, lang, format, out, pendingOnly, materials, downloadFiles, browser, onProgress }
export async function generate(opts = {}) {
  const cfg = loadConfig();
  const lang = pickLang(opts.lang || cfg.lang);
  const onProgress = opts.onProgress || (() => {});
  const m = client(cfg);
  onProgress({ step: 'courses' });
  const all = await m.courses();
  const sems = listSemesters(all);
  const want = opts.semester || 'latest';
  const chosen = want === 'all' ? null : (want === 'latest' ? sems[0] : sems.find((s) => s.key === want));
  if (want !== 'all' && !chosen) {
    throw new Error(`Unknown semester "${want}". Available: ${sems.map((s) => s.key).join(', ')}`);
  }
  const courses = coursesForSemester(all, chosen ? chosen.key : 'all');
  const data = await m.tasks(courses, { materials: !!opts.materials, onProgress });
  const model = buildModel({ site: cfg.site, siteName: cfg.siteName, user: cfg.user, courses, data, lang, semester: chosen, pendingOnly: !!opts.pendingOnly, extraDict: loadExtraDict() });

  const format = opts.format || formatFromPath(opts.out) || 'pdf';
  if (!FORMATS.includes(format)) throw new Error(`Unknown format "${format}" (use ${FORMATS.join(', ')})`);
  if (opts.dryRun) return { model };
  const file = resolveOut(opts.out, format, chosen ? chosen.key : 'all', opts.name, lang);
  if (opts.downloadFiles) await downloadFiles(cfg, model, file, onProgress);
  onProgress({ step: 'writing' });
  if (format === 'html') fs.writeFileSync(file, renderHtml(model));
  else if (format === 'md') fs.writeFileSync(file, renderMarkdown(model));
  else if (format === 'json') fs.writeFileSync(file, renderJson(model));
  else await htmlToPdf(renderHtml(model), file, { browser: opts.pdfBrowser || 'auto' });
  return { file, model };
}

export function openPath(p) {
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', p], { detached: true, stdio: 'ignore' }).unref();
  else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [p], { detached: true, stdio: 'ignore' }).unref();
}

// Native "choose folder" dialog. Resolves to a path, or null if cancelled/unavailable.
export function chooseFolder(title = 'Mahamm') {
  const run = (cmd, args) => new Promise((resolve) => execFile(cmd, args, { windowsHide: true }, (err, out) => resolve(err ? null : String(out).trim() || null)));
  if (process.platform === 'win32') {
    return run('powershell', ['-NoProfile', '-STA', '-Command',
      'Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = "' + title + '"; if ($f.ShowDialog() -eq "OK") { $f.SelectedPath }']);
  }
  if (process.platform === 'darwin') return run('osascript', ['-e', `POSIX path of (choose folder with prompt "${title}")`]);
  return run('zenity', ['--file-selection', '--directory', '--title', title]).then((r) => r ?? run('kdialog', ['--getexistingdirectory', '.', '--title', title]));
}
