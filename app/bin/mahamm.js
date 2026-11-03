#!/usr/bin/env node
// Mahamm – Moodle tasks report. Run without arguments to open the window.
import readline from 'node:readline/promises';
import os from 'node:os';
import { loadConfig, saveConfig, configDir, DEFAULT_SITE } from '../lib/config.js';
import { browserLogin } from '../lib/login.js';
import { saveLogin, logout, semesters, generate, openPath, FORMATS } from '../lib/runner.js';
import { findBrowsers } from '../lib/browsers.js';
import { launchUrl, parseTokenLink, normalizeSite } from '../../core/token.js';
import { relTime, fmtDate } from '../../core/report.js';
import { randomHex } from '../../core/util.js';
import { VERSION, issueUrl, diagnostics, REPO_URL } from '../../core/meta.js';

const HELP = `Mahamm ${VERSION} – your Moodle tasks in one report

Usage:
  mahamm                        open the window (GUI)
  mahamm login [options]        sign in (opens a browser window)
      --browser <id>            auto | chrome | edge | chromium | brave | firefox
      --site <url>              Moodle site (default ${DEFAULT_SITE})
      --paste                   no automatic browser: paste the moodlemobile:// link yourself
      --token <key>             use a key copied from the browser extension
  mahamm logout                 forget the saved key
  mahamm status                 who is signed in, which site
  mahamm semesters              list your semesters (keys for --semester)
  mahamm list [options]         print tasks still to do in the terminal
  mahamm report [options]       create a report file
  mahamm config [--lang en|ar] [--site <url>]   change defaults
  mahamm bug ["short title"]     report a problem (opens a prefilled GitHub form)

Report / list options:
  -s, --semester <key>          latest (default) | all | e.g. 2027-1
  -l, --lang <en|ar>            report language (course names stay "Hebrew - <language>")
  -f, --format <fmt>            ${FORMATS.join(' | ')}   (default: from --out extension, else pdf)
  -o, --out <path>              file or folder (default: your Documents folder)
  -n, --name <name>             file name; may use {semester} {date} {lang}
                                (default moodle-tasks_{semester}_{date}; extension added)
      --pending-only            only tasks still to do
      --materials               add files/links whose names look like tasks
      --download-files          download instruction files next to the report
      --open                    open the file when done
      --json                    (list) machine-readable output

Examples:
  mahamm login
  mahamm report -l ar -o ~/Desktop
  mahamm report -s 2026-2 -f md -o ./tasks.md
  mahamm report -o ~/Desktop -n "my tasks {date}"
  mahamm list --semester latest
`;

function parseArgs(argv) {
  const alias = { s: 'semester', l: 'lang', f: 'format', o: 'out', n: 'name', h: 'help', v: 'version' };
  const flags = new Set(['paste', 'pending-only', 'materials', 'download-files', 'open', 'json', 'help', 'version', 'no-open']);
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') || (a.startsWith('-') && a.length === 2)) {
      let [k, v] = a.replace(/^--?/, '').split(/=(.*)/s);
      k = alias[k] || k;
      if (flags.has(k)) out[k] = true;
      else out[k] = v ?? argv[++i];
    } else out._.push(a);
  }
  return out;
}

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const die = (msg, { report = false } = {}) => {
  console.error(c('31', 'Error: ') + msg);
  if (report) {
    try { const cfg = loadConfig(); cfg.lastError = { message: String(msg).slice(0, 2000), at: Date.now(), cmd: process.argv.slice(2).filter((x) => !/^[a-f0-9]{32}$/i.test(x)).join(' ') }; saveConfig(cfg); } catch { /* ignore */ }
    console.error(c('2', 'If this looks like a bug, report it with: mahamm bug'));
  }
  process.exit(1);
};

function bugReport(title) {
  const cfg = loadConfig();
  const env = diagnostics({
    component: process.versions.bun ? 'program (binary)' : 'program (node)',
    os: `${process.platform} ${os.release()} ${process.arch}`,
    browser: findBrowsers().map((b) => b.id).join(', ') || 'none found',
    lang: cfg.lang, site: cfg.site,
    extra: `Runtime: ${process.versions.bun ? 'bun ' + process.versions.bun : 'node ' + process.versions.node}`,
  });
  const le = cfg.lastError;
  const error = le ? `${le.message}\n(command: mahamm ${le.cmd || ''}, ${new Date(le.at).toISOString()})` : '';
  return issueUrl({ title, env, error });
}

function progress(p) {
  if (!process.stderr.isTTY) return;
  const label = { courses: 'Reading courses', assignments: 'Assignments', quizzes: 'Quizzes', materials: 'Course pages', files: 'Downloading files', writing: 'Writing file' }[p.step] || p.step;
  process.stderr.write(`\r\x1b[K${label}${p.total ? ` ${p.done}/${p.total}` : '…'}`);
  if (p.step === 'writing') process.stderr.write('\n');
}

async function cmdLogin(a) {
  const cfg = loadConfig();
  const site = normalizeSite(a.site || cfg.site || DEFAULT_SITE);
  let token;
  if (a.token) {
    const p = parseTokenLink(a.token);
    if (!p) die('That does not look like a Moodle key.');
    token = p.token;
  } else if (a.paste) {
    const url = launchUrl(site, randomHex(8));
    console.log(`1. Open this link in any browser and sign in:\n\n   ${url}\n`);
    console.log('2. After signing in, the browser tries to open a "moodlemobile://token=…" link.');
    console.log('   Copy that link (Developer tools F12 → Network, or the "open app" prompt) and paste it here.\n');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ans = await rl.question('Link: ');
    rl.close();
    const p = parseTokenLink(ans);
    if (!p) die('That does not look like a moodlemobile:// link.');
    token = p.token;
  } else {
    token = await browserLogin(site, { browser: a.browser || 'auto', log: (m) => console.log(m) });
  }
  const saved = await saveLogin(site, token);
  console.log(c('32', '✔ ') + `Signed in as ${saved.user} (${saved.siteName || site})`);
}

async function cmdList(a) {
  const cfg = loadConfig();
  const { model } = await generate({ semester: a.semester, lang: a.lang || cfg.lang, pendingOnly: true, dryRun: true, onProgress: progress });
  if (process.stderr.isTTY) process.stderr.write('\r\x1b[K');
  if (a.json) { console.log(JSON.stringify(model.todo, null, 2)); return; }
  console.log(c('1', `${model.semester.label} – ${model.todo.length} to do`));
  for (const x of model.todo) {
    const when = x.due ? `${fmtDate(x.due, 'en')}  (${relTime(x.due, 'en')})` : 'no deadline';
    const mark = x.state === 'overdue' ? c('31', '!') : '•';
    console.log(`\n${mark} ${c('1', x.name)}\n  ${x.course}\n  ${c(x.state === 'overdue' ? '31' : '36', when)}\n  ${c('2', x.url)}`);
  }
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const cmd = a._[0];
  if (a.version) return console.log(VERSION);
  if (a.help || cmd === 'help') return console.log(HELP);
  try {
    switch (cmd) {
      case undefined:
      case 'gui': {
        const { startGui } = await import('../lib/gui.js');
        return startGui({ open: !a['no-open'] });
      }
      case 'login': return await cmdLogin(a);
      case 'logout': logout(); return console.log('Signed out.');
      case 'status': {
        const cfg = loadConfig();
        console.log(`Site:     ${cfg.site}\nUser:     ${cfg.token ? cfg.user : '(not signed in)'}\nLanguage: ${cfg.lang}\nConfig:   ${configDir()}\nBrowsers: ${findBrowsers().map((b) => b.id).join(', ') || 'none found'}`);
        return;
      }
      case 'config': {
        const cfg = loadConfig();
        if (a.lang) { if (!['en', 'ar'].includes(a.lang)) die('lang must be en or ar'); cfg.lang = a.lang; }
        if (a.site) { cfg.site = normalizeSite(a.site); delete cfg.token; }
        saveConfig(cfg);
        return console.log(`lang=${cfg.lang} site=${cfg.site}`);
      }
      case 'semesters': {
        const cfg = loadConfig();
        const { list, courses } = await semesters(cfg, a.lang || cfg.lang);
        for (const s of list) console.log(`${s.key.padEnd(14)} ${s.label}  (${courses.filter((x) => x.semester.key === s.key).length} courses)`);
        return;
      }
      case 'list': return await cmdList(a);
      case 'report': {
        const { file, model } = await generate({
          semester: a.semester, lang: a.lang, format: a.format, out: a.out,
          name: a.name, pendingOnly: a['pending-only'], materials: a.materials, downloadFiles: a['download-files'], onProgress: progress,
        });
        console.log(c('32', '✔ ') + file);
        console.log(`  ${model.todo.length} to do · ${model.done.length} submitted · ${model.missed.length} closed`);
        if (model.untranslated.length) console.log(c('33', `  No translation yet for: ${model.untranslated.join(', ')} (see README → translations)`));
        if (a.open) openPath(file);
        return;
      }
      case 'bug': {
        const url = bugReport(a._.slice(1).join(' '));
        console.log(`Opening the problem report form on GitHub (you can review everything before sending):\n${url}\n\nNo password, key or task contents are included. Project page: ${REPO_URL}`);
        openPath(url);
        return;
      }
      default: die(`Unknown command "${cmd}". Run: mahamm --help`);
    }
  } catch (e) {
    if (e.code === 'invalidtoken' || e.code === 'nologin') die(`${e.message}\nSign in again: mahamm login`);
    die(e.message, { report: true });
  }
}

main();
