// Sign-in: open a clean browser window on Moodle's mobile launch page, let the
// user log in (Microsoft / SSO / password – whatever the site uses), and catch
// the moodlemobile://token=… redirect. Only the resulting token is stored.
import { launch } from './driver.js';
import { pickBrowser } from './browsers.js';
import { launchUrl, isTokenLink, parseTokenLink, SCHEME } from '../../core/token.js';
import { randomHex } from '../../core/util.js';

export async function browserLogin(site, { browser = 'auto', timeoutMs = 10 * 60e3, log = () => {} } = {}) {
  const b = pickBrowser(browser);
  if (!b) throw new Error(browser === 'auto'
    ? 'No supported browser found (Chrome, Edge, Chromium, Brave or Firefox). Use: mahamm login --paste'
    : `Browser "${browser}" not found. Try --browser auto`);
  log(`Opening ${b.id}… sign in to Moodle in the new window.`);
  const d = await launch(b);
  try {
    const found = await new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn, v) => { if (!done) { done = true; clearInterval(poll); clearTimeout(timer); fn(v); } };
      d.onUrl((u) => { if (isTokenLink(u)) finish(resolve, u); });
      // Some Moodle versions show a "open the app" page with a link instead of redirecting.
      const poll = setInterval(async () => {
        const vals = await d.evalAll(`(document.querySelector('a[href^="${SCHEME}://"]')||{}).href||''`).catch(() => []);
        const hit = vals.find(isTokenLink);
        if (hit) finish(resolve, hit);
      }, 1000);
      const timer = setTimeout(() => finish(reject, new Error('Timed out waiting for sign-in')), timeoutMs);
      d.exited.then(() => finish(reject, new Error('The browser window was closed before sign-in finished')));
      d.navigate(launchUrl(site, randomHex(8))).catch((e) => finish(reject, e));
    });
    const parsed = parseTokenLink(found);
    if (!parsed) throw new Error('Moodle returned an unexpected sign-in link');
    return parsed.token;
  } finally {
    await d.close();
  }
}
