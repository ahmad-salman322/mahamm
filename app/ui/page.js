// The GUI page, served by gui.js. Kept as a JS module so single-file builds embed it.
import { strings } from '../../core/i18n.js';

export function page(secret) {
  const S = JSON.stringify({ en: strings('en'), ar: strings('ar') }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mahamm</title>
<style>
:root { --bg:#f6f7fb; --card:#fff; --fg:#1d2433; --muted:#5b6478; --line:#d6dbe7; --accent:#2f4fd8; --accent2:#e8edff; --red:#b42318; --green:#1a7f37; }
@media (prefers-color-scheme: dark) { :root { --bg:#12151d; --card:#1b1f2a; --fg:#e6e9f2; --muted:#9aa3b8; --line:#2c3243; --accent:#7c93ff; --accent2:#232b48; --red:#ff6b5e; --green:#4cc38a; } }
* { box-sizing: border-box; }
body { margin:0; font-family: "Segoe UI", "Noto Sans Arabic", "Noto Sans Hebrew", system-ui, sans-serif; background:var(--bg); color:var(--fg); }
header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 22px; border-bottom:1px solid var(--line); background:var(--card); flex-wrap:wrap; }
header h1 { margin:0; font-size:20px; } header small { color:var(--muted); }
main { max-width:1100px; margin:0 auto; padding:18px; display:grid; grid-template-columns: 340px 1fr; gap:18px; }
@media (max-width: 820px) { main { grid-template-columns: 1fr; } }
.card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; }
label { display:block; font-size:13px; color:var(--muted); margin:12px 0 4px; }
select, input[type=text] { width:100%; padding:8px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--fg); font:inherit; }
.row { display:flex; gap:8px; } .row > * { flex:1; }
.check { display:flex; gap:8px; align-items:center; margin:8px 0; font-size:14px; color:var(--fg); }
button { font:inherit; border:0; border-radius:8px; padding:9px 14px; cursor:pointer; background:var(--accent2); color:var(--fg); }
button.primary { background:var(--accent); color:#fff; font-weight:600; width:100%; margin-top:14px; padding:11px; }
button:disabled { opacity:.55; cursor:wait; }
.muted { color:var(--muted); font-size:13px; }
.msg { margin-top:12px; font-size:14px; word-break:break-all; }
.msg.err { color:var(--red); } .msg.ok { color:var(--green); }
iframe { width:100%; height:calc(100vh - 150px); min-height:420px; border:1px solid var(--line); border-radius:12px; background:#fff; }
.seg { display:inline-flex; gap:4px; } .seg button { padding:6px 12px; } .seg button.on { background:var(--accent); color:#fff; }
header .row > * { flex:0 0 auto; }
#login .card { max-width:460px; margin:60px auto; }
.hidden { display:none !important; }
</style></head>
<body>
<header>
  <div><h1 data-t="appName"></h1><small data-t="tagline"></small></div>
  <div class="row" style="flex:0 0 auto; align-items:center; gap:12px">
    <span class="muted" id="who"></span>
    <span class="seg"><button data-lang="en">EN</button><button data-lang="ar">ع</button></span>
    <button id="bugBtn" data-t="reportProblem"></button>
    <button id="logoutBtn" class="hidden" data-t="disconnect"></button>
  </div>
</header>

<section id="login" class="hidden"><div class="card">
  <label data-t="site"></label><input type="text" id="site">
  <label data-t="browser"></label><select id="browser"></select>
  <button class="primary" id="loginBtn" data-t="connect"></button>
  <label data-t="pasteHint"></label>
  <div class="row"><input type="text" id="link" placeholder="moodlemobile://token=…"><button id="linkBtn" style="flex:0 0 auto">OK</button></div>
  <div class="msg" id="loginMsg"></div>
</div></section>

<main id="app" class="hidden">
  <div class="card">
    <label data-t="semester"></label><select id="semester"></select>
    <label data-t="format"></label><select id="format"></select>
    <label data-t="saveTo"></label>
    <div class="row"><input type="text" id="outDir"><button id="browseBtn" style="flex:0 0 auto" data-t="browse"></button></div>
    <label data-t="fileName"></label>
    <input type="text" id="fileName" placeholder="moodle-tasks_{semester}_{date}">
    <div class="muted" style="font-size:12px;margin-top:4px" data-t="fileNameHint"></div>
    <div class="check"><input type="checkbox" id="pendingOnly"><span data-t="pendingOnly"></span></div>
    <div class="check"><input type="checkbox" id="materials"><span data-t="includeMaterials"></span></div>
    <div class="check"><input type="checkbox" id="downloadFiles"><span data-t="downloadFiles"></span></div>
    <button class="primary" id="genBtn" data-t="createReport"></button>
    <div class="msg" id="msg"></div>
    <div class="row hidden" id="after" style="margin-top:8px"><button id="openFile" data-t="openFile"></button><button id="openDir" data-t="openFolder"></button></div>
  </div>
  <div><iframe id="preview" title="preview"></iframe></div>
</main>

<script>
const SECRET = ${JSON.stringify(secret)};
const S = ${S};
let st = {}, lang = 'en', lastFile = null, lastErr = '';
const $ = (id) => document.getElementById(id);
const T = (k, v) => { const s = S[lang][k] || S.en[k] || k; return v ? s.replace(/\\{(\\w+)\\}/g, (_, x) => v[x] ?? '') : s; };

async function api(name, body) {
  const r = await fetch('/' + SECRET + '/api/' + name, { method: 'POST', headers: { 'x-mahamm': SECRET, 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.error || 'error'), { code: j.code });
  return j;
}
function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-t]').forEach((e) => (e.textContent = T(e.dataset.t)));
  document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
  $('who').textContent = st.user ? T('signedInAs', { name: st.user }) : '';
  document.title = T('appName');
  $('bugBtn').title = T('reportProblemHint');
}
function msg(el, text, kind) { el.textContent = text || ''; el.className = 'msg ' + (kind || ''); if (kind === 'err') lastErr = text; }

async function loadSemesters() {
  const keep = $('semester').value;
  const list = await api('semesters', { lang });
  $('semester').innerHTML = list.map((s) => '<option value="' + s.key + '">' + s.label + '</option>').join('') + '<option value="all">' + T('allSemesters') + '</option>';
  if (keep && [...$('semester').options].some((o) => o.value === keep)) $('semester').value = keep;
}
let previewSeq = 0;
async function preview() {
  const seq = ++previewSeq;
  $('preview').srcdoc = '<p style="font-family:sans-serif;padding:20px">' + T('loading') + '</p>';
  try {
    const r = await api('preview', { semester: $('semester').value, lang, pendingOnly: $('pendingOnly').checked, materials: $('materials').checked });
    if (seq === previewSeq) $('preview').srcdoc = r.html;
  } catch (e) { if (seq === previewSeq) { $('preview').srcdoc = ''; handleErr(e, $('msg')); } }
}
function handleErr(e, el) {
  if (e.code === 'invalidtoken' || e.code === 'nologin') { st.user = null; render(); return; }
  msg(el, T('error') + ': ' + e.message, 'err');
}
async function render() {
  applyLang();
  $('logoutBtn').classList.toggle('hidden', !st.user);
  $('login').classList.toggle('hidden', !!st.user);
  $('app').classList.toggle('hidden', !st.user);
  if (!st.user) {
    $('site').value = st.site;
    $('browser').innerHTML = '<option value="auto">' + T('auto') + '</option>' + st.browsers.map((b) => '<option>' + b + '</option>').join('');
    return;
  }
  $('format').innerHTML = st.formats.map((f) => '<option value="' + f + '">' + f.toUpperCase() + '</option>').join('');
  $('outDir').value = st.outDir;
  $('fileName').value = st.fileName || '';
  try { await loadSemesters(); await preview(); } catch (e) { handleErr(e, $('msg')); }
}

document.querySelectorAll('[data-lang]').forEach((b) => b.onclick = async () => {
  lang = b.dataset.lang; st = await api('settings', { lang });
  applyLang();
  if (st.user) { await loadSemesters().catch(() => {}); preview(); }
});
$('loginBtn').onclick = async () => {
  $('loginBtn').disabled = true; msg($('loginMsg'), T('connecting'));
  try { await api('settings', { site: $('site').value }); st = await api('login', { browser: $('browser').value }); msg($('loginMsg'), ''); render(); }
  catch (e) { msg($('loginMsg'), T('error') + ': ' + e.message, 'err'); }
  finally { $('loginBtn').disabled = false; }
};
$('linkBtn').onclick = async () => {
  try { await api('settings', { site: $('site').value }); st = await api('login', { link: $('link').value }); render(); }
  catch (e) { msg($('loginMsg'), T('error') + ': ' + e.message, 'err'); }
};
$('logoutBtn').onclick = async () => { st = await api('logout'); render(); };
$('browseBtn').onclick = async () => { const r = await api('browse'); if (r.path) $('outDir').value = r.path; };
['semester', 'pendingOnly', 'materials'].forEach((id) => $(id).onchange = preview);
$('genBtn').onclick = async () => {
  $('genBtn').disabled = true; msg($('msg'), T('loading')); $('after').classList.add('hidden');
  try {
    const r = await api('generate', { semester: $('semester').value, lang, format: $('format').value, outDir: $('outDir').value, name: $('fileName').value, pendingOnly: $('pendingOnly').checked, materials: $('materials').checked, downloadFiles: $('downloadFiles').checked });
    lastFile = r.file; msg($('msg'), T('saved', { path: r.file }), 'ok'); $('after').classList.remove('hidden');
    if (r.untranslated && r.untranslated.length) $('msg').textContent += '\\n' + T('untranslated', { list: r.untranslated.join('، ') });
  } catch (e) { handleErr(e, $('msg')); }
  finally { $('genBtn').disabled = false; }
};
$('bugBtn').onclick = async () => { try { await api('bug', { error: lastErr }); } catch (e) { alert(e.message); } };
$('openFile').onclick = () => api('open', { path: lastFile });
$('openDir').onclick = () => api('open', { path: lastFile.replace(/[\\\\/][^\\\\/]*$/, '') });
setInterval(() => api('ping').catch(() => {}), 20000);
(async () => { st = await api('state'); lang = st.lang; await api('ping'); render(); })();
</script>
</body></html>`;
}
