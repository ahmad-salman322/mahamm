import { t as tr, dirOf } from './core/i18n.js';
import { buildModel, renderHtml, renderMarkdown, renderJson } from './core/report.js';
import { coursesForSemester, listSemesters } from './core/moodle.js';
import { safeName } from './core/util.js';

const B = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);
let S = {};
let model = null;

async function build() {
  S = await B.storage.local.get(null);
  S.lang = S.lang || 'en';
  document.documentElement.lang = S.lang;
  document.documentElement.dir = dirOf(S.lang);
  document.querySelectorAll('[data-t]').forEach((e) => { e.textContent = tr(S.lang, e.dataset.t); });
  document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === S.lang));
  if (!S.data || !S.courses) { $('doc').srcdoc = `<p style="font-family:sans-serif;padding:24px">${tr(S.lang, 'loading')}</p>`; return; }
  const all = S.allCourses || S.courses;
  const sems = listSemesters(all);
  const key = !S.semester || S.semester === 'latest' ? sems[0] && sems[0].key : S.semester;
  const semester = key === 'all' ? null : sems.find((s) => s.key === key) || null;
  const courses = key === 'all' ? S.courses : coursesForSemester(S.courses, key);
  model = buildModel({ site: S.site, siteName: S.siteName, user: S.user, courses, data: S.data, lang: S.lang, semester, pendingOnly: $('pendingOnly').checked, now: Date.now() });
  $('doc').srcdoc = renderHtml(model);
  document.title = `${tr(S.lang, 'reportTitle')} – ${model.semester.label}`;
  if (!$('fileName').value && S.fileName) $('fileName').value = S.fileName;
  $('fileName').title = tr(S.lang, 'fileNameHint');
}

// "{semester}", "{date}", "{lang}" are filled in; the browser's save dialog still lets the user change it.
function fileName(ext) {
  const date = new Date().toISOString().slice(0, 10);
  let n = $('fileName').value.trim() || 'moodle-tasks_{semester}_{date}';
  n = n.replace(/\{semester\}/g, model.semester.key).replace(/\{date\}/g, date).replace(/\{lang\}/g, S.lang);
  return `${safeName(n.replace(/\.(pdf|html?|md|json)$/i, ''), 150)}.${ext}`;
}

function download(text, ext, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const filename = fileName(ext);
  B.storage.local.set({ fileName: $('fileName').value.trim() });
  B.downloads.download({ url, filename, saveAs: true }).finally(() => setTimeout(() => URL.revokeObjectURL(url), 60e3));
}

document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', async () => {
  await B.storage.local.set({ lang: b.dataset.lang });
  build();
}));
$('pendingOnly').addEventListener('change', build);
$('print').addEventListener('click', () => $('doc').contentWindow.print());
$('dlHtml').addEventListener('click', () => model && download(renderHtml(model), 'html', 'text/html'));
$('dlMd').addEventListener('click', () => model && download(renderMarkdown(model), 'md', 'text/markdown'));
$('dlJson').addEventListener('click', () => model && download(renderJson(model), 'json', 'application/json'));
B.storage.onChanged.addListener((ch) => { if (ch.data) build(); });

build();
