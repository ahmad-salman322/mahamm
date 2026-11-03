// Background: sign-in (Moodle mobile-app flow), periodic refresh, badge, reminders.
import { Moodle, restCaller, listSemesters, coursesForSemester, taskState, semesterLabel } from './core/moodle.js';
import { launchUrl, isTokenLink, parseTokenLink, normalizeSite, SCHEME } from './core/token.js';
import { randomHex } from './core/util.js';
import { t as tr } from './core/i18n.js';
import { translateCourse } from './core/names.js';
import { fmtDate, midnightHint } from './core/report.js';

const B = globalThis.browser ?? globalThis.chrome;
const DEFAULT_SITE = 'https://moodle.jce.ac.il';
const REFRESH_MIN = 60;

const get = (keys) => B.storage.local.get(keys);
const set = (obj) => B.storage.local.set(obj);

async function settings() {
  const s = await get(['site', 'token', 'user', 'siteName', 'lang', 'semester']);
  const uiLang = (B.i18n && B.i18n.getUILanguage && B.i18n.getUILanguage()) || 'en';
  return { site: DEFAULT_SITE, lang: /^ar/.test(uiLang) ? 'ar' : 'en', semester: 'latest', ...s };
}

// ---------------- sign-in ----------------
let pendingLogin = null;

function signIn(site) {
  if (pendingLogin) return pendingLogin;
  site = normalizeSite(site || DEFAULT_SITE);
  const origin = new URL(site).origin;
  const url = launchUrl(site, randomHex(8));
  pendingLogin = new Promise((resolve, reject) => {
    let tabId = null;
    let done = false;
    const filter = { urls: [origin + '/*'] };
    const finish = async (err, link) => {
      if (done) return;
      done = true;
      B.webRequest.onBeforeRedirect.removeListener(onRedirect);
      B.webRequest.onHeadersReceived.removeListener(onHeaders);
      B.tabs.onUpdated.removeListener(onUpdated);
      B.tabs.onRemoved.removeListener(onRemoved);
      if (tabId != null) B.tabs.remove(tabId).catch(() => {});
      if (err) return reject(err);
      try {
        const p = parseTokenLink(link);
        if (!p) throw new Error('Unexpected sign-in link');
        resolve(await saveToken(site, p.token));
      } catch (e) { reject(e); }
    };
    const onRedirect = (d) => { if (isTokenLink(d.redirectUrl)) finish(null, d.redirectUrl); };
    const onHeaders = (d) => {
      const h = (d.responseHeaders || []).find((x) => x.name.toLowerCase() === 'location');
      if (h && isTokenLink(h.value)) finish(null, h.value);
    };
    // Some Moodle versions show a page with an "open app" link instead of redirecting.
    const onUpdated = async (id, info) => {
      if (id !== tabId || info.status !== 'complete') return;
      try {
        const [r] = await B.scripting.executeScript({ target: { tabId }, func: (s) => (document.querySelector(`a[href^="${s}://"]`) || {}).href || '', args: [SCHEME] });
        if (r && isTokenLink(r.result)) finish(null, r.result);
      } catch { /* not our page yet */ }
    };
    const onRemoved = (id) => { if (id === tabId) finish(new Error('cancelled')); };
    B.webRequest.onBeforeRedirect.addListener(onRedirect, filter);
    B.webRequest.onHeadersReceived.addListener(onHeaders, filter, ['responseHeaders']);
    B.tabs.onUpdated.addListener(onUpdated);
    B.tabs.onRemoved.addListener(onRemoved);
    B.tabs.create({ url, active: true }).then((tab) => { tabId = tab.id; }, (e) => finish(e));
  }).finally(() => { pendingLogin = null; });
  return pendingLogin;
}

async function saveToken(site, token) {
  site = normalizeSite(site);
  const info = await new Moodle(site, restCaller(site, token)).siteInfo();
  await set({ site, token, user: info.fullname, siteName: info.sitename, data: null, courses: null });
  await refresh();
  return info.fullname;
}

async function signOut() {
  await B.storage.local.remove(['token', 'user', 'data', 'courses', 'lastRefresh', 'error', 'notified']);
  await B.action.setBadgeText({ text: '' });
}

// ---------------- data ----------------
let refreshing = null;

async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const s = await settings();
    if (!s.token) return null;
    const m = new Moodle(s.site, restCaller(s.site, s.token));
    try {
      const all = await m.courses();
      const courses = coursesForSemester(all, s.semester);
      const data = await m.tasks(courses, { materials: !!s.materials });
      await set({ allCourses: all, courses, data, lastRefresh: Date.now(), error: null });
      await updateBadge();
      await remind();
      return true;
    } catch (e) {
      await set({ error: { code: e.code || null, message: e.message } });
      if (e.code === 'invalidtoken') await signOut();
      throw e;
    }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

async function updateBadge() {
  const { data } = await get(['data']);
  if (!data) return;
  const now = Date.now();
  const states = data.tasks.map((x) => taskState(x, now));
  const todo = states.filter((x) => x === 'pending' || x === 'overdue' || x === 'draft').length;
  const late = states.includes('overdue');
  await B.action.setBadgeText({ text: todo ? String(todo) : '' });
  await B.action.setBadgeBackgroundColor({ color: late ? '#d92d20' : '#2f4fd8' });
}

// Reminders 24 h and 3 h before a deadline, once each.
async function remind() {
  const s = await settings();
  const { data, courses, notified = {} } = await get(['data', 'courses', 'notified']);
  if (!data || !courses) return;
  const now = Date.now();
  const cmap = new Map(courses.map((c) => [c.id, c]));
  for (const x of data.tasks) {
    const st = taskState(x, now);
    if (!x.due || !['pending', 'draft'].includes(st)) continue;
    const left = x.due * 1000 - now;
    for (const [tag, win] of [['24h', 24 * 3600e3], ['3h', 3 * 3600e3]]) {
      const id = `${x.kind}-${x.id}-${tag}`;
      if (left > 0 && left <= win && !notified[id]) {
        notified[id] = now;
        const c = cmap.get(x.courseId);
        const course = c ? translateCourse(c.fullname, s.lang).display : '';
        const hint = midnightHint(x.due, s.lang);
        B.notifications.create(id, {
          type: 'basic',
          iconUrl: B.runtime.getURL('icons/128.png'),
          title: tr(s.lang, 'notifyTitle'),
          message: tr(s.lang, 'notifyBody', { task: x.name, course, due: fmtDate(x.due, s.lang) + (hint ? ` (${hint})` : '') }),
        });
      }
    }
  }
  await set({ notified });
}

B.notifications.onClicked.addListener(async (id) => {
  const { data } = await get(['data']);
  const [kind, tid] = id.split('-');
  const x = data && data.tasks.find((t) => t.kind === kind && String(t.id) === tid);
  if (x) B.tabs.create({ url: x.url });
});

// ---------------- wiring ----------------
B.runtime.onInstalled.addListener(() => {
  B.alarms.create('refresh', { periodInMinutes: REFRESH_MIN });
  refresh().catch(() => {});
});
B.runtime.onStartup.addListener(() => {
  B.alarms.create('refresh', { periodInMinutes: REFRESH_MIN });
  refresh().catch(() => {});
});
B.alarms.onAlarm.addListener((a) => {
  if (a.name === 'refresh') refresh().catch(() => {});
});
B.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && ch.data) updateBadge().catch(() => {});
});

B.runtime.onMessage.addListener((msg, _sender, reply) => {
  const handlers = {
    signIn: () => signIn(msg.site),
    signInWithKey: () => saveToken(msg.site, (parseTokenLink(msg.key) || {}).token || ''),
    signOut: () => signOut(),
    refresh: () => refresh(),
    setPrefs: async () => {
      const before = await settings();
      await set(msg.prefs);
      if (msg.prefs.semester && msg.prefs.semester !== before.semester) await refresh();
      if ('materials' in msg.prefs) await refresh();
      return true;
    },
    semesters: async () => {
      const s = await settings();
      const { allCourses = [] } = await get(['allCourses']);
      return listSemesters(allCourses).map((x) => ({ key: x.key, label: semesterLabel(x, (k, v) => tr(s.lang, k, v)) }));
    },
  };
  const h = handlers[msg && msg.type];
  if (!h) return false;
  Promise.resolve().then(h).then((v) => reply({ ok: true, value: v }), (e) => reply({ ok: false, error: e.message, code: e.code || null }));
  return true; // async reply
});
