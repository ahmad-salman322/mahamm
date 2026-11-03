// Minimal browser drivers: Chrome DevTools Protocol (Chrome/Edge/Chromium/Brave)
// and WebDriver BiDi (Firefox). Each browser runs with a throw-away profile.
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

function rpc(ws) {
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (ev) => {
    const d = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString());
    if (d.id != null && pending.has(d.id)) {
      const { resolve, reject } = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) reject(new Error(typeof d.error === 'string' ? `${d.error}: ${d.message || ''}` : d.error.message));
      else resolve(d.result);
    } else for (const l of listeners) l(d);
  });
  ws.addEventListener('close', () => { for (const { reject } of pending.values()) reject(new Error('browser closed')); pending.clear(); });
  return {
    send(method, params = {}, sessionId) {
      const msg = { id: ++id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      return new Promise((resolve, reject) => { pending.set(msg.id, { resolve, reject }); ws.send(JSON.stringify(msg)); });
    },
    on(fn) { listeners.add(fn); },
  };
}

function openWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(ws), { once: true });
    ws.addEventListener('error', () => reject(new Error('cannot connect to ' + url)), { once: true });
  });
}

function killTree(child) {
  if (!child || child.exitCode != null) return;
  if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
  else try { child.kill('SIGTERM'); } catch { /* gone */ }
}

async function rmrf(dir) {
  for (let i = 0; i < 10; i++) {
    try { fs.rmSync(dir, { recursive: true, force: true }); return; } catch { await sleep(300); }
  }
}

// ---------------------------------------------------------------------------------
// Common interface:
//   d.onUrl(fn)         fn(url) for every request URL and redirect Location seen
//   d.navigate(url)
//   d.evalAll(expr)     evaluates in every open page, returns array of values
//   d.printPdf(url)     -> Buffer   (headless only)
//   d.exited            Promise resolved when the user closes the browser
//   d.close()
// ---------------------------------------------------------------------------------

export async function launch(browser, { headless = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahamm-'));
  try {
    return browser.kind === 'firefox' ? await launchFirefox(browser.path, dir, headless) : await launchChromium(browser.path, dir, headless);
  } catch (e) {
    await rmrf(dir);
    throw e;
  }
}

async function launchChromium(exe, dir, headless) {
  const args = [`--user-data-dir=${dir}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-features=Translate'];
  if (headless) args.push('--headless=new', '--disable-gpu');
  args.push('about:blank');
  const child = spawn(exe, args, { stdio: 'ignore', detached: false });
  const exited = new Promise((r) => child.once('exit', r));
  const portFile = path.join(dir, 'DevToolsActivePort');
  let wsUrl = null;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    if (child.exitCode != null) throw new Error('browser exited early');
    try {
      const [port, p] = fs.readFileSync(portFile, 'utf8').split('\n');
      if (port && p) wsUrl = `ws://127.0.0.1:${port.trim()}${p.trim()}`;
    } catch { await sleep(150); }
  }
  if (!wsUrl) { killTree(child); throw new Error('browser did not start'); }
  const ws = await openWs(wsUrl);
  const c = rpc(ws);
  const sessions = new Map(); // targetId -> sessionId
  const urlFns = new Set();
  const emit = (u) => { if (u) for (const f of urlFns) f(u); };

  c.on((m) => {
    if (m.method === 'Network.requestWillBeSent') {
      emit(m.params.request && m.params.request.url);
      const h = m.params.redirectResponse && m.params.redirectResponse.headers;
      if (h) emit(h.location || h.Location);
    } else if (m.method === 'Network.responseReceivedExtraInfo') {
      const h = m.params.headers || {};
      emit(h.location || h.Location);
    } else if (m.method === 'Target.targetCreated' && m.params.targetInfo.type === 'page') {
      attach(m.params.targetInfo.targetId).catch(() => {});
    } else if (m.method === 'Target.targetDestroyed') {
      sessions.delete(m.params.targetId);
    }
  });

  async function attach(targetId) {
    if (sessions.has(targetId)) return sessions.get(targetId);
    const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
    sessions.set(targetId, sessionId);
    await c.send('Network.enable', {}, sessionId).catch(() => {});
    await c.send('Page.enable', {}, sessionId).catch(() => {});
    return sessionId;
  }

  await c.send('Target.setDiscoverTargets', { discover: true });
  const { targetInfos } = await c.send('Target.getTargets');
  let page = targetInfos.find((x) => x.type === 'page');
  if (!page) page = { targetId: (await c.send('Target.createTarget', { url: 'about:blank' })).targetId };
  const main = await attach(page.targetId);

  return {
    exited,
    onUrl(fn) { urlFns.add(fn); },
    navigate(url) { return c.send('Page.navigate', { url }, main); },
    async evalAll(expression) {
      const out = [];
      for (const sid of sessions.values()) {
        try {
          const r = await c.send('Runtime.evaluate', { expression, returnByValue: true }, sid);
          out.push(r.result && r.result.value);
        } catch { /* page navigating */ }
      }
      return out;
    },
    async printPdf(url) {
      await c.send('Page.navigate', { url }, main);
      for (let i = 0; i < 100; i++) {
        const r = await c.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }, main).catch(() => null);
        if (r && r.result.value === 'complete') break;
        await sleep(100);
      }
      await c.send('Runtime.evaluate', { expression: 'document.fonts && document.fonts.ready.then(()=>1)', awaitPromise: true }, main).catch(() => {});
      const r = await c.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false }, main);
      return Buffer.from(r.data, 'base64');
    },
    async close() {
      try { await Promise.race([c.send('Browser.close'), sleep(1500)]); } catch { /* ignore */ }
      try { ws.close(); } catch { /* ignore */ }
      await Promise.race([exited, sleep(3000)]);
      killTree(child);
      await rmrf(dir);
    },
  };
}

async function launchFirefox(exe, dir, headless) {
  const port = await freePort();
  // Quiet first run: no welcome pages, no default-browser prompt.
  fs.writeFileSync(path.join(dir, 'user.js'), [
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("browser.startup.homepage_override.mstone", "ignore");',
    'user_pref("trailhead.firstrun.didSeeAboutWelcome", true);',
    'user_pref("browser.aboutwelcome.enabled", false);',
    'user_pref("datareporting.policy.firstRunURL", "");',
    'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
  ].join('\n'));
  const args = ['-no-remote', '-profile', dir, '--remote-debugging-port', String(port)];
  if (headless) args.push('--headless');
  args.push('about:blank');
  const child = spawn(exe, args, { stdio: 'ignore' });
  const exited = new Promise((r) => child.once('exit', r));
  let ws = null;
  for (let i = 0; i < 100 && !ws; i++) {
    if (child.exitCode != null) throw new Error('browser exited early');
    try { ws = await openWs(`ws://127.0.0.1:${port}/session`); } catch { await sleep(200); }
  }
  if (!ws) { killTree(child); throw new Error('browser did not start'); }
  const c = rpc(ws);
  const urlFns = new Set();
  const emit = (u) => { if (u) for (const f of urlFns) f(u); };
  c.on((m) => {
    if (!m.method || !m.method.startsWith('network.')) return;
    const p = m.params || {};
    emit(p.request && p.request.url);
    for (const h of (p.response && p.response.headers) || []) {
      if (h.name.toLowerCase() === 'location') emit(h.value && (h.value.value ?? h.value));
    }
  });
  await c.send('session.new', { capabilities: {} });
  await c.send('session.subscribe', { events: ['network.beforeRequestSent', 'network.responseStarted', 'network.responseCompleted'] }).catch(() => {});
  const contexts = async () => ((await c.send('browsingContext.getTree', {})).contexts || []).map((x) => x.context);
  const [main] = await contexts();

  return {
    exited,
    onUrl(fn) { urlFns.add(fn); },
    navigate(url) { return c.send('browsingContext.navigate', { context: main, url, wait: 'none' }); },
    async evalAll(expression) {
      const out = [];
      for (const ctx of await contexts().catch(() => [])) {
        try {
          const r = await c.send('script.evaluate', { target: { context: ctx }, expression, awaitPromise: false });
          out.push(r.result && r.result.value);
        } catch { /* navigating */ }
      }
      return out;
    },
    async printPdf(url) {
      await c.send('browsingContext.navigate', { context: main, url, wait: 'complete' });
      await c.send('script.evaluate', { target: { context: main }, expression: 'document.fonts ? document.fonts.ready.then(()=>1) : 1', awaitPromise: true }).catch(() => {});
      const r = await c.send('browsingContext.print', { context: main, background: true, shrinkToFit: true, page: { width: 21, height: 29.7 }, margin: { top: 1.3, bottom: 1.3, left: 1.2, right: 1.2 } });
      return Buffer.from(r.data, 'base64');
    },
    async close() {
      try { await Promise.race([c.send('browser.close', {}), sleep(1500)]); } catch { /* ignore */ }
      try { ws.close(); } catch { /* ignore */ }
      await Promise.race([exited, sleep(3000)]);
      killTree(child);
      await rmrf(dir);
    },
  };
}
