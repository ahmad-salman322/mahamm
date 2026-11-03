import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCourseName, translateCourse, courseGroup } from '../core/names.js';
import { parseSemester, listSemesters, coursesForSemester, taskState, restCaller } from '../core/moodle.js';
import { parseTokenLink, launchUrl, normalizeSite } from '../core/token.js';
import { buildModel, renderHtml, renderMarkdown, midnightHint } from '../core/report.js';
import { htmlToText, safeName } from '../core/util.js';

test('cleanCourseName strips group, codes and master-course marker', () => {
  const cases = {
    "תיכון מונחה עצמים קב' 04 - 100547104": 'תיכון מונחה עצמים',
    "קורס אב -  אוטומטים ושפות פורמליות 1008771 קב' 06, 07": 'אוטומטים ושפות פורמליות',
    'קורס אב - מתמטיקה בדידה 1 - 1015271': 'מתמטיקה בדידה 1',
    ' אלגברה ליניארית 1  - קורס אב סמסטר א 1000351': 'אלגברה ליניארית 1',
    'חדו"א 1 - קורס אב 1001752, 1100752': 'חדו"א 1',
    'מבוא לתכנות - קורס אב 10028/11004': 'מבוא לתכנות',
    'קורס אב - אלגוריתמיקה 1, 1000761': 'אלגוריתמיקה 1',
    "מעבדה במחשבים - מחומרה קב' 01 - 100837201": 'מעבדה במחשבים - מחומרה',
    "תכנות בשפת C ו- C++ קב' 07 - 100646107": 'תכנות בשפת C ו- C++',
    "אנגלית - מתקדמים ב' קב' 10 - 900256210": "אנגלית - מתקדמים ב'",
    "New Product and Service קב' 01 - 920987201": 'New Product and Service',
  };
  for (const [inp, want] of Object.entries(cases)) assert.equal(cleanCourseName(inp), want, inp);
});

test('translateCourse gives "Hebrew - translation" in the chosen language', () => {
  assert.equal(translateCourse("תיכון מונחה עצמים קב' 04 - 100547104", 'en').display, 'תיכון מונחה עצמים - Object-Oriented Design');
  assert.equal(translateCourse("תיכון מונחה עצמים קב' 04 - 100547104", 'ar').display, 'תיכון מונחה עצמים - تصميم البرمجيات الكائنية');
  assert.equal(translateCourse("אלגברה לינארית 2 - קורס אב 100045206, 110065201", 'en').tr, 'Linear Algebra 2');
  // truncated by Moodle
  assert.equal(translateCourse("הנדסת תוכנה בשירות הקהי קב' 04 - 101157204", 'en').tr, 'Software Engineering for the Community');
  // tutorial variant
  assert.equal(translateCourse('קורס אב תירגול - פיסיקה למהנדסי תוכנה 1014162', 'en').tr, 'Physics for Software Engineers – Tutorial');
  assert.equal(translateCourse('קורס אב - תרגול באלגוריתמיקה 1, 1000761', 'ar').tr, 'الخوارزميات 1 – تدريب');
  // unknown course: Hebrew only
  const u = translateCourse("קורס חדש לגמרי קב' 01 - 123456701", 'en');
  assert.equal(u.display, 'קורס חדש לגמרי');
  assert.equal(u.translated, false);
  // user dictionary
  assert.equal(translateCourse("קורס חדש לגמרי קב' 01", 'en', { 'קורס חדש לגמרי': { en: 'Brand New' } }).tr, 'Brand New');
  assert.equal(courseGroup("קורס אב -  אוטומטים 1008771 קב' 06, 07"), '06, 07');
});

test('parseSemester and semester filtering', () => {
  assert.deepEqual(
    (({ key, year, sem }) => ({ key, year, sem }))(parseSemester(' 2027- סמסטר 1')),
    { key: '2027-1', year: 2027, sem: '1' });
  assert.equal(parseSemester('2026- סמסטר קיץ').key, '2026-summer');
  assert.equal(parseSemester('Miscellaneous').key, 'Miscellaneous');
  const courses = [
    { id: 1, semester: parseSemester(' 2026- סמסטר 1') },
    { id: 2, semester: parseSemester(' 2027- סמסטר 1') },
    { id: 3, semester: parseSemester(' 2026- סמסטר 2') },
    { id: 4, semester: parseSemester(' 2027- סמסטר 1') },
  ];
  assert.deepEqual(listSemesters(courses).map((s) => s.key), ['2027-1', '2026-2', '2026-1']);
  assert.deepEqual(coursesForSemester(courses, 'latest').map((c) => c.id), [2, 4]);
  assert.deepEqual(coursesForSemester(courses, '2026-2').map((c) => c.id), [3]);
  assert.equal(coursesForSemester(courses, 'all').length, 4);
});

test('taskState', () => {
  const now = 1_800_000_000_000;
  const s = now / 1000;
  assert.equal(taskState({ kind: 'assign', due: s + 100 }, now), 'pending');
  assert.equal(taskState({ kind: 'assign', due: s - 100 }, now), 'overdue');
  assert.equal(taskState({ kind: 'assign', due: s - 100, cutoff: s - 10 }, now), 'missed');
  assert.equal(taskState({ kind: 'quiz', due: s - 100 }, now), 'missed');
  assert.equal(taskState({ kind: 'assign', due: s - 100, submitted: true }, now), 'submitted');
  assert.equal(taskState({ kind: 'assign', due: s + 100, draft: true }, now), 'draft');
});

test('token link parsing', () => {
  const tok = '0123456789abcdef0123456789abcdef';
  const link = 'moodlemobile://token=' + btoa(`abc123:::${tok}:::priv`);
  assert.equal(parseTokenLink(link).token, tok);
  assert.equal(parseTokenLink(tok).token, tok);
  assert.equal(parseTokenLink('nonsense'), null);
  assert.equal(normalizeSite('moodle.jce.ac.il/'), 'https://moodle.jce.ac.il');
  assert.match(launchUrl('https://moodle.jce.ac.il', 'p1'), /launch\.php\?service=moodle_mobile_app&passport=p1&urlscheme=moodlemobile$/);
});

test('restCaller flattens arrays and surfaces Moodle errors', async () => {
  let seen;
  const fake = async (url, opt) => { seen = opt.body.toString(); return { status: 200, text: async () => '{"exception":"x","errorcode":"invalidtoken","message":"Invalid token"}' }; };
  const call = restCaller('https://m', 'T', fake);
  await assert.rejects(call('f', { courseids: [5, 6] }), /Invalid token/);
  assert.match(seen, /courseids%5B0%5D=5&courseids%5B1%5D=6/);
});

test('helpers', () => {
  assert.equal(htmlToText('<p>a&amp;b</p><p>c<br>d</p>'), 'a&b\nc\nd');
  assert.equal(safeName('a/b:c?'), 'a_b_c_');
});

test('buildModel + renderers', () => {
  const now = Date.UTC(2026, 10, 3, 6, 0) ; // 3 Nov 2026 08:00 Israel
  const sem = parseSemester(' 2027- סמסטר 1');
  const courses = [
    { id: 10, fullname: "תיכון מונחה עצמים קב' 04 - 100547104", url: 'https://m/course/view.php?id=10', semester: sem },
    { id: 11, fullname: "חישוביות וסיבוכיות קב' 04 - 100767204", url: 'https://m/course/view.php?id=11', semester: sem },
  ];
  const due = Math.floor(new Date(2026, 10, 9, 0, 0).getTime() / 1000); // local midnight
  const data = {
    tasks: [
      { kind: 'assign', id: 1, courseId: 10, name: 'תרגיל כיתה 04', url: 'https://m/a1', due, submitted: false, intro: 'SRP', files: [{ name: 'a.pdf' }] },
      { kind: 'assign', id: 2, courseId: 10, name: 'תרגיל כיתה 01', url: 'https://m/a2', due: due - 30 * 86400, submitted: true, grade: '90.00 / 100.00' },
    ],
    materials: [],
  };
  for (const lang of ['en', 'ar']) {
    const m = buildModel({ site: 'https://m', courses, data, lang, semester: sem, now });
    assert.equal(m.todo.length, 1);
    assert.equal(m.done.length, 1);
    assert.equal(m.empty.length, 1);
    assert.equal(m.dir, lang === 'ar' ? 'rtl' : 'ltr');
    const html = renderHtml(m);
    assert.match(html, /<bdi>תיכון מונחה עצמים<\/bdi> - <bdi>/);
    assert.ok(midnightHint(due, lang).length > 0);
    assert.match(renderMarkdown(m), /תרגיל כיתה 04/);
  }
});

test('version is the same everywhere', async () => {
  const { VERSION } = await import('../core/meta.js');
  const fs = await import('node:fs');
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(VERSION, pkg.version);
});

test('issueUrl prefills the form and never leaks a key', async () => {
  const { issueUrl, diagnostics } = await import('../core/meta.js');
  const env = diagnostics({ component: 'program', os: 'linux', lang: 'ar', site: 'https://moodle.jce.ac.il/x' });
  assert.match(env, /Moodle: moodle\.jce\.ac\.il/);
  const u = new URL(issueUrl({ title: 't', env, error: 'bad token 0123456789abcdef0123456789abcdef here' }));
  assert.equal(u.searchParams.get('template'), 'bug_report.yml');
  assert.equal(u.searchParams.get('environment'), env);
  assert.equal(u.searchParams.get('error'), 'bad token <key> here');
});

test('fileNameFor fills placeholders and fixes the extension', async () => {
  const { fileNameFor, DEFAULT_NAME } = await import('../app/lib/runner.js');
  const d = new Date().toISOString().slice(0, 10);
  assert.equal(fileNameFor('', { format: 'pdf', semKey: '2027-1', lang: 'ar' }), `moodle-tasks_2027-1_${d}.pdf`);
  assert.equal(fileNameFor('وظائفي {lang}', { format: 'md', semKey: '2027-1', lang: 'ar' }), 'وظائفي ar.md');
  assert.equal(fileNameFor('tasks.pdf', { format: 'html', semKey: 'x' }), 'tasks.html');
  assert.equal(fileNameFor('a/b:c', { format: 'pdf', semKey: 'x' }), 'a_b_c.pdf');
  assert.ok(DEFAULT_NAME.includes('{semester}'));
});
