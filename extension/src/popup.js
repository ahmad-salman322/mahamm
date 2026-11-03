import { t as tr, dirOf } from './core/i18n.js';
import { buildModel, fmtDate, relTime, midnightHint } from './core/report.js';
import { normalizeSite } from './core/token.js';
import { issueUrl, diagnostics } from './core/meta.js';

const B = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);
let S = {};
const T = (k, v) => tr(S.lang || 'en', k, v);

function send(type, extra = {}) {
  return new Promise((resolve, reject) => {
    B.runtime.sendMessage({ type, ...extra }, (r) => {
      const err = B.runtime.lastError;
      if (err) return reject(new Error(err.message));
      if (!r || !r.ok) return reject(Object.assign(new Error((r && r.error) || 'error'), { code: r && r.code }));
      resolve(r.value);
    });
  });
}

async function load() {
  S = await B.storage.local.get(null);
  const ui = (B.i18n.getUILanguage() || 'en');
  S.lang = S.lang || (/^ar/.test(ui) ? 'ar' : 'en');
  S.site = S.site || 'https://moodle.jce.ac.il';
  S.semester = S.semester || 'latest';
}

function show(id) {
  for (const s of ['login', 'main', 'settings']) $(s).classList.toggle('hidden', s !== id);
}

function applyLang() {
  document.documentElement.lang = S.lang;
  document.documentElement.dir = dirOf(S.lang);
  document.querySelectorAll('[data-t]').forEach((e) => { e.textContent = T(e.dataset.t); });
  document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === S.lang));
  $('settingsBtn').title = T('settings');
  $('bugLink').title = T('reportProblemHint');
  $('ver').textContent = 'v' + B.runtime.getManifest().version;
  $('refreshBtn').title = T('refresh');
}

async function renderSemesters() {
  const list = await send('semesters').catch(() => []);
  const sel = $('semester');
  sel.replaceChildren(...list.map((s) => h('option', { value: s.key }, s.label)), h('option', { value: 'all' }, T('allSemesters')));
  const want = S.semester === 'latest' ? (list[0] && list[0].key) : S.semester;
  if (want) sel.value = want;
}

// Tiny DOM builder (no innerHTML).
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else e.setAttribute(k, v);
  }
  e.append(...kids.filter((k) => k != null && k !== false));
  return e;
}
const bdi = (s) => h('bdi', {}, s);

function courseNode(x) {
  return x.courseTr ? h('div', { class: 'c' }, bdi(x.courseHe), ' - ', bdi(x.courseTr)) : h('div', { class: 'c' }, bdi(x.courseHe));
}

function placeholder(text) {
  $('list').replaceChildren(h('div', { class: 'empty' }, text));
}

function renderList() {
  if (!S.data || !S.courses) { placeholder(T('loading')); return; }
  const m = buildModel({ site: S.site, courses: S.courses, data: S.data, lang: S.lang, pendingOnly: true });
  if (!m.todo.length) placeholder(T('nothingTodo'));
  else {
    $('list').replaceChildren(...m.todo.map((x) => {
      const hint = midnightHint(x.due, S.lang);
      const when = x.due ? fmtDate(x.due, S.lang) + (hint ? ` (${hint})` : '') : T('noDue');
      return h('a', { class: `item ${x.state}`, href: x.url, target: '_blank' },
        h('div', { class: 't' }, bdi(x.name)),
        courseNode(x),
        h('div', { class: 'd' }, h('span', {}, when), h('span', { class: 'rel' }, x.due ? relTime(x.due, S.lang) : '')));
    }));
  }
  const when = S.lastRefresh ? new Intl.DateTimeFormat(S.lang === 'ar' ? 'ar' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(S.lastRefresh)) : '';
  $('status').textContent = S.error ? `${T('error')}: ${S.error.message}` : (when ? T('lastUpdate', { t: when }) : '');
}

async function render() {
  applyLang();
  if (!S.token) { $('site').value = S.site; show('login'); return; }
  show('main');
  renderList();
  await renderSemesters();
}

// ---- events ----
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', async () => {
  S.lang = b.dataset.lang;
  await B.storage.local.set({ lang: S.lang });
  render();
}));

$('signInBtn').addEventListener('click', async () => {
  let site;
  try { site = normalizeSite($('site').value); } catch { $('loginMsg').textContent = T('error'); return; }
  const origin = new URL(site).origin + '/*';
  // Must be requested from the click (user gesture). Firefox treats all host access as optional.
  const granted = await B.permissions.request({ origins: [origin] }).catch(() => false);
  if (!granted) { $('loginMsg').className = 'msg err'; $('loginMsg').textContent = T('error') + ': permission'; return; }
  $('signInBtn').disabled = true;
  $('loginMsg').className = 'msg';
  $('loginMsg').textContent = T('connecting');
  try {
    await send('signIn', { site });
    await load();
    render();
  } catch (e) {
    $('loginMsg').className = 'msg err';
    $('loginMsg').textContent = `${T('error')}: ${e.message}`;
  } finally { $('signInBtn').disabled = false; }
});

$('semester').addEventListener('change', async () => {
  placeholder(T('loading'));
  await send('setPrefs', { prefs: { semester: $('semester').value } }).catch(() => {});
  await load();
  renderList();
});

$('refreshBtn').addEventListener('click', async () => {
  $('refreshBtn').disabled = true;
  try { await send('refresh'); } catch { /* status shows error */ }
  await load();
  $('refreshBtn').disabled = false;
  render();
});

$('reportBtn').addEventListener('click', () => B.tabs.create({ url: B.runtime.getURL('report.html') }));

$('settingsBtn').addEventListener('click', () => {
  if (!S.token) return;
  $('who').textContent = T('signedInAs', { name: S.user || '' }) + ' · ' + (S.siteName || S.site);
  $('materials').checked = !!S.materials;
  $('key').value = S.token;
  show('settings');
});
$('backBtn').addEventListener('click', () => render());
$('materials').addEventListener('change', async () => {
  await send('setPrefs', { prefs: { materials: $('materials').checked } }).catch(() => {});
  await load();
});
$('copyKey').addEventListener('click', async () => {
  await navigator.clipboard.writeText(S.token);
  $('copyKey').textContent = T('copied');
  setTimeout(() => { $('copyKey').textContent = T('copy'); }, 1500);
});
$('signOutBtn').addEventListener('click', async () => {
  await send('signOut');
  await load();
  render();
});

$('bugLink').addEventListener('click', (e) => {
  e.preventDefault();
  const ua = navigator.userAgent;
  const browser = (ua.match(/(Edg|Firefox|OPR|Brave|Chrome)\/[\d.]+/) || [ua])[0];
  const env = diagnostics({ component: 'extension', version: B.runtime.getManifest().version, os: navigator.platform || '', browser, lang: S.lang, site: S.site });
  B.tabs.create({ url: issueUrl({ env, error: S.error ? S.error.message : '' }) });
});

B.storage.onChanged.addListener(async (ch) => {
  if (ch.data || ch.lastRefresh || ch.error) { await load(); if (S.token && !$('main').classList.contains('hidden')) renderList(); }
});

await load();
render();
