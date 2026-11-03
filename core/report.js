// Turns courses + tasks into a report model, then HTML / Markdown.
import { t as tr, dirOf, pickLang } from './i18n.js';
import { translateCourse, courseGroup } from './names.js';
import { taskState, semesterLabel } from './moodle.js';
import { escapeHtml as esc, truncate } from './util.js';

const LOCALE = { en: 'en-GB', ar: 'ar' };

export function fmtDate(ts, lang, { weekday = true, time = true } = {}) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const opt = { day: 'numeric', month: 'long', year: 'numeric' };
  if (weekday) opt.weekday = 'long';
  if (time) Object.assign(opt, { hour: '2-digit', minute: '2-digit', hour12: false });
  return new Intl.DateTimeFormat(LOCALE[lang] || 'en-GB', opt).format(d);
}

// "00:00 on Monday" really means "end of Sunday" – say so.
export function midnightHint(ts, lang) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  if (d.getHours() !== 0 || d.getMinutes() !== 0) return '';
  const prev = new Date(d.getTime() - 60 * 1000);
  const day = new Intl.DateTimeFormat(LOCALE[lang] || 'en-GB', { weekday: 'long', day: 'numeric', month: 'numeric' }).format(prev);
  return tr(lang, 'endOf', { day });
}

export function relTime(ts, lang, now = Date.now()) {
  if (!ts) return '';
  const diff = ts * 1000 - now;
  const abs = Math.abs(diff);
  const [v, unit] = abs >= 86400e3 ? [Math.round(abs / 86400e3), 'day'] : abs >= 3600e3 ? [Math.round(abs / 3600e3), 'hour'] : [Math.max(1, Math.round(abs / 60e3)), 'minute'];
  const span = new Intl.NumberFormat(LOCALE[lang] || 'en-GB', { style: 'unit', unit, unitDisplay: 'long' }).format(v);
  return tr(lang, diff >= 0 ? 'in' : 'overdueBy', { t: span });
}

const STATE_KEY = { pending: 'stPending', overdue: 'stOverdue', missed: 'stMissed', submitted: 'stSubmitted', draft: 'stDraft', info: 'stInfo' };

// courses: from Moodle.courses(); data: from Moodle.tasks()
export function buildModel({ site, siteName = '', user = '', courses, data, lang = 'en', semester = null, pendingOnly = false, extraDict = null, now = Date.now() }) {
  lang = pickLang(lang);
  const t = (k, v) => tr(lang, k, v);
  const cmap = new Map();
  for (const c of courses) {
    const n = translateCourse(c.fullname, lang, extraDict);
    cmap.set(c.id, { id: c.id, fullname: c.fullname, he: n.he, tr: n.tr, display: n.display, translated: n.translated, group: courseGroup(c.fullname), url: c.url, semester: c.semester });
  }
  const tasks = (data.tasks || [])
    .filter((x) => cmap.has(x.courseId))
    .map((x) => { const c = cmap.get(x.courseId); return { ...x, state: taskState(x, now), course: c.display, courseHe: c.he, courseTr: c.tr }; });
  const byDue = (a, b) => (a.due || Infinity) - (b.due || Infinity) || a.name.localeCompare(b.name);
  const todo = tasks.filter((x) => ['pending', 'overdue', 'draft'].includes(x.state)).sort((a, b) => {
    const ao = a.state === 'overdue' ? 0 : 1;
    const bo = b.state === 'overdue' ? 0 : 1;
    return ao - bo || byDue(a, b);
  });
  const missed = pendingOnly ? [] : tasks.filter((x) => x.state === 'missed').sort(byDue);
  const done = pendingOnly ? [] : tasks.filter((x) => ['submitted', 'info'].includes(x.state)).sort(byDue);
  const withTasks = new Set(tasks.map((x) => x.courseId));
  const empty = pendingOnly ? [] : [...cmap.values()].filter((c) => !withTasks.has(c.id));
  const materials = (data.materials || []).filter((m) => cmap.has(m.courseId)).map((m) => { const c = cmap.get(m.courseId); return { ...m, course: c.display, courseHe: c.he, courseTr: c.tr }; });
  const untranslated = [...cmap.values()].filter((c) => !c.translated && /[֐-׿]/.test(c.he)).map((c) => c.he);

  return {
    app: 'mahamm',
    version: 1,
    lang,
    dir: dirOf(lang),
    site,
    siteName,
    user,
    semester: semester ? { key: semester.key, label: semesterLabel(semester, t) } : { key: 'all', label: t('allSemesters') },
    generatedAt: Math.floor(now / 1000),
    courses: [...cmap.values()],
    todo, missed, done, empty, materials,
    untranslated: [...new Set(untranslated)],
    stateLabel: Object.fromEntries(Object.entries(STATE_KEY).map(([k, v]) => [k, t(v)])),
  };
}

// --- HTML ----------------------------------------------------------------------
const CSS = `
@page { size: A4; margin: 15mm 13mm; }
:root { --fg:#1d2433; --muted:#5b6478; --line:#d6dbe7; --soft:#eef1f7; --accent:#1e3a8a; --red:#b42318; --redbg:#fff6f5; --green:#1a7f37; --amber:#9a6700; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", "Noto Sans Arabic", "Noto Sans Hebrew", "Geeza Pro", Tahoma, Arial, sans-serif; color: var(--fg); background: #fff; line-height: 1.6; font-size: 11pt; margin: 0 auto; max-width: 900px; padding: 18px; }
h1 { font-size: 20pt; margin: 0; color: var(--accent); }
.sub { color: var(--muted); font-size: 10pt; margin: 2px 0 10px; }
.note { background: #f1f5ff; border-inline-start: 4px solid #3b5bdb; padding: 6px 10px; font-size: 10pt; border-radius: 4px; margin-bottom: 12px; }
h2 { font-size: 14pt; margin: 18px 0 8px; padding-bottom: 3px; border-bottom: 2px solid var(--line); }
h2 small { font-weight: 400; color: var(--muted); font-size: 10pt; }
h2.todo { color: var(--red); } h2.done { color: var(--green); } h2.muted { color: var(--muted); }
.task { border: 1px solid var(--line); border-radius: 7px; padding: 9px 12px; margin-bottom: 9px; page-break-inside: avoid; }
.task.overdue { border-color: #f04438; background: var(--redbg); }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.title { font-weight: 700; font-size: 12pt; }
.title a { color: inherit; text-decoration: none; }
.course { color: var(--muted); font-size: 9.5pt; }
.pill { white-space: nowrap; font-weight: 700; font-size: 9.5pt; background: var(--soft); padding: 2px 9px; border-radius: 10px; }
.overdue .pill { background: #f04438; color: #fff; }
.meta { font-size: 9.5pt; color: var(--muted); margin-top: 4px; }
.meta b { color: var(--fg); font-weight: 600; }
.intro { white-space: pre-wrap; font-size: 10pt; margin-top: 6px; }
.files { font-size: 9.5pt; margin-top: 4px; }
.files a, .files span { display: inline-block; background: var(--soft); border-radius: 4px; padding: 0 6px; margin: 2px 0 0 4px; color: inherit; text-decoration: none; direction: ltr; unicode-bidi: isolate; }
table { width: 100%; border-collapse: collapse; font-size: 10pt; }
th, td { border: 1px solid var(--line); padding: 4px 7px; text-align: start; vertical-align: top; }
th { background: var(--soft); }
td a { color: inherit; }
.ok { color: var(--green); font-weight: 700; }
ul.plain { margin: 0; padding-inline-start: 18px; }
.foot { margin-top: 18px; color: var(--muted); font-size: 8.5pt; }
bdi { unicode-bidi: isolate; }
@media print { body { padding: 0; } a { color: inherit; text-decoration: none; } }
`;

// Hebrew always first, then " - ", then the translation; each part isolated so
// the browser does not reorder them in left-to-right pages.
function cname(o) {
  const he = o.courseHe ?? o.he;
  const trn = o.courseTr ?? o.tr;
  return trn ? `<bdi>${esc(he)}</bdi> - <bdi>${esc(trn)}</bdi>` : `<bdi>${esc(he)}</bdi>`;
}

function dueLine(x, lang) {
  if (!x.due) return esc(tr(lang, 'noDue'));
  const hint = midnightHint(x.due, lang);
  return `${esc(fmtDate(x.due, lang))}${hint ? ` <span>(${esc(hint)})</span>` : ''}`;
}

function filesHtml(x, lang) {
  if (!x.files || !x.files.length) return '';
  const items = x.files.map((f) => f.localPath
    ? `<a href="${esc(f.localPath)}">${esc(f.name)}</a>`
    : `<span>${esc(f.name)}</span>`).join('');
  return `<div class="files">${esc(tr(lang, 'files'))}: ${items}</div>`;
}

function taskCard(x, lang, now, introMax) {
  const t = (k, v) => tr(lang, k, v);
  const pill = x.due ? relTime(x.due, lang, now) : t('noDue');
  const meta = [`<b>${esc(t('due'))}:</b> ${dueLine(x, lang)}`];
  if (x.state === 'overdue' && x.cutoff) meta.push(`<b>${esc(t('cutoff'))}:</b> ${esc(fmtDate(x.cutoff, lang))}`);
  if (x.opens && x.opens * 1000 > now) meta.push(`<b>${esc(t('opens'))}:</b> ${esc(fmtDate(x.opens, lang))}`);
  meta.push(esc(t(x.kind)) + (x.team ? ` · ${esc(t('teamSubmission'))}` : '') + ` · ${esc(t(STATE_KEY[x.state]))}`);
  return `<div class="task ${x.state}">
  <div class="head"><div><div class="title"><a href="${esc(x.url)}"><bdi>${esc(x.name)}</bdi></a></div><div class="course">${cname(x)}</div></div><div class="pill">${esc(pill)}</div></div>
  <div class="meta">${meta.join(' &nbsp;·&nbsp; ')}</div>
  ${x.intro ? `<div class="intro"><bdi>${esc(truncate(x.intro, introMax))}</bdi></div>` : ''}
  ${filesHtml(x, lang)}
</div>`;
}

export function renderHtml(model, { introMax = 700 } = {}) {
  const lang = model.lang;
  const t = (k, v) => tr(lang, k, v);
  const now = model.generatedAt * 1000;
  const out = [];
  out.push(`<!doctype html><html lang="${lang}" dir="${model.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(t('reportTitle'))} – ${esc(model.semester.label)}</title><style>${CSS}</style></head><body>`);
  out.push(`<h1>${esc(t('reportTitle'))} – ${esc(model.semester.label)}</h1>`);
  out.push(`<div class="sub">${model.siteName ? `<bdi>${esc(model.siteName)}</bdi> · ` : ''}${model.user ? `<bdi>${esc(model.user)}</bdi> · ` : ''}${esc(t('generatedAt', { date: fmtDate(model.generatedAt, lang) }))}</div>`);
  out.push(`<div class="note">${esc(t('midnightNote'))}</div>`);

  out.push(`<h2 class="todo">⚠️ ${esc(t('todo'))} <small>(${model.todo.length}) – ${esc(t('todoHint'))}</small></h2>`);
  out.push(model.todo.length ? model.todo.map((x) => taskCard(x, lang, now, introMax)).join('\n') : `<p>${esc(t('nothingTodo'))}</p>`);

  if (model.materials.length) {
    out.push(`<h2 class="muted">📎 ${esc(t('materials'))} <small>– ${esc(t('materialsHint'))}</small></h2><table><tr><th>${esc(t('course'))}</th><th>${esc(t('task'))}</th></tr>`);
    for (const m of model.materials) out.push(`<tr><td>${cname(m)}</td><td><a href="${esc(m.url)}"><bdi>${esc(m.name)}</bdi></a>${m.section ? ` <span class="course">(<bdi>${esc(m.section)}</bdi>)</span>` : ''}</td></tr>`);
    out.push('</table>');
  }

  if (model.done.length) {
    out.push(`<h2 class="done">✅ ${esc(t('done'))} <small>(${model.done.length})</small></h2><table><tr><th>${esc(t('course'))}</th><th>${esc(t('task'))}</th><th>${esc(t('due'))}</th><th>${esc(t('grade'))}</th></tr>`);
    for (const x of model.done) out.push(`<tr><td>${cname(x)}</td><td><a href="${esc(x.url)}"><bdi>${esc(x.name)}</bdi></a></td><td>${esc(x.due ? fmtDate(x.due, lang, { weekday: false, time: false }) : '—')}</td><td>${x.grade ? `<span class="ok">${esc(x.grade)}</span>` : esc(x.state === 'info' ? t('stInfo') : t('notGraded'))}</td></tr>`);
    out.push('</table>');
  }

  if (model.missed.length) {
    out.push(`<h2 class="muted">⛔ ${esc(t('missed'))} <small>(${model.missed.length})</small></h2><table><tr><th>${esc(t('course'))}</th><th>${esc(t('task'))}</th><th>${esc(t('due'))}</th></tr>`);
    for (const x of model.missed) out.push(`<tr><td>${cname(x)}</td><td><a href="${esc(x.url)}"><bdi>${esc(x.name)}</bdi></a></td><td>${esc(fmtDate(x.due, lang, { weekday: false }))}</td></tr>`);
    out.push('</table>');
  }

  if (model.empty.length) {
    out.push(`<h2 class="muted">${esc(t('noTasksCourses'))}</h2><p class="course">${esc(t('noTasksHint'))}</p><ul class="plain">`);
    for (const c of model.empty) out.push(`<li><a href="${esc(c.url)}">${cname(c)}</a>${c.group ? ` <span class="course">(${esc(c.group)})</span>` : ''}</li>`);
    out.push('</ul>');
  }
  out.push(`<div class="foot">Mahamm · <bdi>${esc(model.site)}</bdi></div></body></html>`);
  return out.join('\n');
}

// --- Markdown --------------------------------------------------------------------
const mdEsc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function renderMarkdown(model, { introMax = 500 } = {}) {
  const lang = model.lang;
  const t = (k, v) => tr(lang, k, v);
  const now = model.generatedAt * 1000;
  const L = [];
  L.push(`# ${t('reportTitle')} – ${model.semester.label}`, '');
  L.push(`_${t('generatedAt', { date: fmtDate(model.generatedAt, lang) })}_`, '');
  L.push(`> ${t('midnightNote')}`, '');
  L.push(`## ⚠️ ${t('todo')} (${model.todo.length})`, '');
  if (!model.todo.length) L.push(t('nothingTodo'), '');
  model.todo.forEach((x, i) => {
    const hint = midnightHint(x.due, lang);
    L.push(`### ${i + 1}. [${x.name}](${x.url})`);
    L.push(`- **${t('course')}:** ${x.course}`);
    L.push(`- **${t('due')}:** ${x.due ? fmtDate(x.due, lang) + (hint ? ` (${hint})` : '') + ` – ${relTime(x.due, lang, now)}` : t('noDue')}`);
    L.push(`- ${t(x.kind)}${x.team ? ' · ' + t('teamSubmission') : ''} · ${t(STATE_KEY[x.state])}`);
    if (x.files && x.files.length) L.push(`- **${t('files')}:** ${x.files.map((f) => f.localPath ? `[${f.name}](${encodeURI(f.localPath)})` : f.name).join(', ')}`);
    if (x.intro) L.push('', truncate(x.intro, introMax).split('\n').map((l) => '> ' + l).join('\n'));
    L.push('');
  });
  if (model.materials.length) {
    L.push(`## 📎 ${t('materials')}`, '', `_${t('materialsHint')}_`, '');
    for (const m of model.materials) L.push(`- ${m.course}: [${m.name}](${m.url})`);
    L.push('');
  }
  if (model.done.length) {
    L.push(`## ✅ ${t('done')} (${model.done.length})`, '', `| ${t('course')} | ${t('task')} | ${t('due')} | ${t('grade')} |`, '|---|---|---|---|');
    for (const x of model.done) L.push(`| ${mdEsc(x.course)} | [${mdEsc(x.name)}](${x.url}) | ${x.due ? fmtDate(x.due, lang, { weekday: false, time: false }) : '—'} | ${mdEsc(x.grade || t('notGraded'))} |`);
    L.push('');
  }
  if (model.missed.length) {
    L.push(`## ⛔ ${t('missed')} (${model.missed.length})`, '');
    for (const x of model.missed) L.push(`- ${x.course}: [${x.name}](${x.url}) – ${fmtDate(x.due, lang, { weekday: false })}`);
    L.push('');
  }
  if (model.empty.length) {
    L.push(`## ${t('noTasksCourses')}`, '');
    for (const c of model.empty) L.push(`- ${c.display}`);
    L.push('');
  }
  return L.join('\n');
}

export function renderJson(model) {
  return JSON.stringify(model, null, 2);
}
