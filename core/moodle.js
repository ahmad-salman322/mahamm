// Moodle web-service client: courses, semesters, assignments, quizzes.
import { htmlToText, pool } from './util.js';

export class MoodleError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

function flatten(obj, prefix, out) {
  if (Array.isArray(obj)) obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}[${k}]` : k, out);
  else if (obj !== undefined && obj !== null) out.append(prefix, typeof obj === 'boolean' ? (obj ? '1' : '0') : String(obj));
}

// REST caller using a web-service token. Works in Node 22+, Bun and browsers.
export function restCaller(site, token, fetchImpl = globalThis.fetch) {
  return async (fn, args = {}) => {
    const body = new URLSearchParams({ wstoken: token, wsfunction: fn, moodlewsrestformat: 'json' });
    flatten(args, '', body);
    let res;
    try {
      res = await fetchImpl(`${site}/webservice/rest/server.php`, { method: 'POST', body });
    } catch (e) {
      throw new MoodleError('network', `Cannot reach ${site}: ${e.message}`);
    }
    const text = await res.text();
    let j;
    try { j = JSON.parse(text); } catch { throw new MoodleError('badresponse', `Unexpected reply from Moodle (${res.status})`); }
    if (j && j.exception) throw new MoodleError(j.errorcode, j.message);
    return j;
  };
}

// --- semesters -------------------------------------------------------------
// JCE categories look like " 2027- סמסטר 1". Anything else falls back to the raw name.
export function parseSemester(category) {
  const raw = String(category || '').trim();
  let m = raw.match(/(\d{4})\s*-\s*סמסטר\s*(\S+)/) || raw.match(/סמסטר\s*(\S+)\s*-?\s*(\d{4})/);
  if (m) {
    let [year, sem] = /^\d{4}$/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
    sem = sem.replace(/['׳]/g, '');
    const n = { 'א': '1', 'ב': '2', 'ג': '3', 'קיץ': 'summer' }[sem] || sem;
    const rank = n === 'summer' ? 3 : Number(n) || 4;
    return { key: `${year}-${n}`, year: Number(year), sem: n, raw, order: Number(year) * 10 + rank };
  }
  return { key: raw || 'other', year: null, sem: null, raw: raw || 'other', order: -1 };
}

export function semesterLabel(s, t) {
  if (!s || s.year == null) return s ? s.raw : '';
  const name = s.sem === 'summer' ? t('summer') : t('semesterN', { n: s.sem });
  return `${name} · ${s.year}`;
}

export function listSemesters(courses) {
  const m = new Map();
  for (const c of courses) if (!m.has(c.semester.key)) m.set(c.semester.key, c.semester);
  return [...m.values()].sort((a, b) => b.order - a.order || a.key.localeCompare(b.key));
}

// "latest" | "all" | "<key>"  ->  filtered courses
export function coursesForSemester(courses, want = 'latest') {
  if (want === 'all') return courses;
  const sems = listSemesters(courses);
  const key = want === 'latest' || !want ? sems[0]?.key : want;
  return courses.filter((c) => c.semester.key === key);
}

// --- task classification ---------------------------------------------------
export function taskState(t, now = Date.now()) {
  if (t.submitted) return 'submitted';
  if (t.noSubmission) return 'info';
  const due = t.due ? t.due * 1000 : null;
  const cutoff = t.cutoff ? t.cutoff * 1000 : null;
  if (due && due < now) {
    if (t.kind === 'quiz' || (cutoff && cutoff < now)) return 'missed';
    return 'overdue';
  }
  if (t.draft) return 'draft';
  return 'pending';
}

export const MATERIAL_KEYWORDS = [
  'מטלה', 'מטלת', 'מטלות', 'תרגיל', 'שיעורי בית', 'ש"ב', 'עבודת בית', 'עבודה להגשה',
  'הגשה', 'הגשת', 'להגיש', 'משימה', 'משימת', 'פרויקט', 'פרוייקט', 'דוח מעבדה', 'דו"ח',
  'בוחן', 'גיליון', 'גליון', 'assignment', 'homework', 'hw', 'exercise', 'ex', 'project', 'lab', 'worksheet',
];
export const MATERIAL_EXCLUDE = ['פתרון', 'פתרונות', 'solution', 'solutions', 'sol', 'הרצאה', 'lecture'];

function matcher(words) {
  const res = words.map((w) => /[a-z]/i.test(w)
    ? new RegExp(`(?:^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z])`, 'i')
    : new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/"/g, '["״]')));
  return (s) => res.some((r) => r.test(s));
}
const isTaskLike = matcher(MATERIAL_KEYWORDS);
const isExcluded = matcher(MATERIAL_EXCLUDE);

// --- client ------------------------------------------------------------------
export class Moodle {
  constructor(site, call) {
    this.site = site;
    this.call = call;
  }

  siteInfo() {
    return this.call('core_webservice_get_site_info', {});
  }

  async courses() {
    let r;
    try {
      r = await this.call('core_course_get_enrolled_courses_by_timeline_classification', { classification: 'allincludinghidden', limit: 0, offset: 0, sort: 'fullname' });
    } catch {
      r = await this.call('core_course_get_enrolled_courses_by_timeline_classification', { classification: 'all', limit: 0, offset: 0, sort: 'fullname' });
    }
    return (r.courses || []).map((c) => ({
      id: c.id,
      fullname: c.fullname,
      shortname: c.shortname,
      category: c.coursecategory || '',
      semester: parseSemester(c.coursecategory),
      url: c.viewurl || `${this.site}/course/view.php?id=${c.id}`,
    }));
  }

  // Returns raw task objects (state is computed later so a cached list stays correct).
  async tasks(courses, { materials = false, onProgress = () => {} } = {}) {
    const ids = courses.map((c) => c.id);
    if (!ids.length) return { tasks: [], materials: [] };
    const tasks = [];

    onProgress({ step: 'assignments' });
    const ar = await this.call('mod_assign_get_assignments', { courseids: ids }).catch(() => ({ courses: [] }));
    const assigns = [];
    for (const c of ar.courses || []) for (const a of c.assignments || []) assigns.push({ courseId: c.id, a });
    let done = 0;
    await pool(assigns, 6, async ({ courseId, a }) => {
      let st = null;
      try { st = await this.call('mod_assign_get_submission_status', { assignid: a.id }); } catch { /* hidden / no access */ }
      const la = (st && st.lastattempt) || {};
      const sub = la.teamsubmission && la.teamsubmission.status !== 'new' ? la.teamsubmission : la.submission;
      const status = sub && sub.status;
      const fb = st && st.feedback;
      tasks.push({
        kind: 'assign',
        id: a.id,
        cmid: a.cmid,
        courseId,
        name: a.name,
        url: `${this.site}/mod/assign/view.php?id=${a.cmid}`,
        opens: a.allowsubmissionsfromdate || null,
        due: a.duedate || null,
        cutoff: a.cutoffdate || null,
        submitted: status === 'submitted',
        draft: status === 'draft',
        noSubmission: st ? la.submissionsenabled === false : false,
        team: !!a.teamsubmission,
        graded: la.gradingstatus === 'graded',
        grade: fb && fb.gradefordisplay ? htmlToText(fb.gradefordisplay) : null,
        intro: htmlToText(a.intro),
        files: (a.introattachments || []).map((f) => ({ name: f.filename, url: f.fileurl, size: f.filesize })),
      });
      onProgress({ step: 'assignments', done: ++done, total: assigns.length });
    });

    onProgress({ step: 'quizzes' });
    const qr = await this.call('mod_quiz_get_quizzes_by_courses', { courseids: ids }).catch(() => ({ quizzes: [] }));
    await pool(qr.quizzes || [], 6, async (q) => {
      let finished = 0;
      let grade = null;
      try {
        const at = await this.call('mod_quiz_get_user_attempts', { quizid: q.id, status: 'all', includepreviews: false });
        finished = (at.attempts || []).filter((x) => x.state === 'finished').length;
      } catch { /* ignore */ }
      if (finished) {
        try {
          const g = await this.call('mod_quiz_get_user_best_grade', { quizid: q.id });
          if (g.hasgrade && g.grade != null) grade = `${Math.round(g.grade * 100) / 100}${q.grade ? ' / ' + Math.round(q.grade * 100) / 100 : ''}`;
        } catch { /* ignore */ }
      }
      tasks.push({
        kind: 'quiz',
        id: q.id,
        cmid: q.coursemodule,
        courseId: q.course,
        name: q.name,
        url: `${this.site}/mod/quiz/view.php?id=${q.coursemodule}`,
        opens: q.timeopen || null,
        due: q.timeclose || null,
        cutoff: null,
        submitted: finished > 0,
        draft: false,
        noSubmission: false,
        team: false,
        graded: grade != null,
        grade,
        intro: htmlToText(q.intro),
        files: (q.introfiles || []).map((f) => ({ name: f.filename, url: f.fileurl, size: f.filesize })),
      });
    });

    const mats = [];
    if (materials) {
      onProgress({ step: 'materials' });
      await pool(courses, 4, async (c) => {
        let sections = [];
        try { sections = await this.call('core_course_get_contents', { courseid: c.id }); } catch { return; }
        for (const s of sections) {
          for (const m of s.modules || []) {
            if (['assign', 'quiz', 'label', 'forum', 'zoom'].includes(m.modname) || m.uservisible === false) continue;
            const text = `${m.name} ${s.name || ''}`;
            if (isTaskLike(m.name) && !isExcluded(text)) {
              mats.push({ courseId: c.id, name: m.name, section: s.name || '', modname: m.modname, url: m.url || `${this.site}/mod/${m.modname}/view.php?id=${m.id}` });
            }
          }
        }
      });
    }
    return { tasks, materials: mats };
  }
}
