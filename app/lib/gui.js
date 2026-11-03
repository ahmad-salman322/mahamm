// Local GUI: a tiny HTTP server on 127.0.0.1 with a random secret in the URL.
// Works the same on Windows, macOS and Linux and needs no extra libraries.
import http from 'node:http';
import os from 'node:os';
import { loadConfig, saveConfig, defaultOutDir } from './config.js';
import { browserLogin } from './login.js';
import { findBrowsers } from './browsers.js';
import { saveLogin, logout, semesters, generate, openPath, chooseFolder, FORMATS } from './runner.js';
import { parseTokenLink, normalizeSite } from '../../core/token.js';
import { randomHex } from '../../core/util.js';
import { renderHtml } from '../../core/report.js';
import { page } from '../ui/page.js';
import { issueUrl, diagnostics, VERSION } from '../../core/meta.js';

export async function startGui({ open = true, port = 0 } = {}) {
  const secret = randomHex(16);
  let lastPing = Date.now();
  let busyLogin = null;

  const api = {
    async state() {
      const cfg = loadConfig();
      return { site: cfg.site, lang: cfg.lang, user: cfg.token ? cfg.user : null, siteName: cfg.siteName || '', outDir: cfg.outDir || defaultOutDir(), fileName: cfg.fileName || '', version: VERSION, formats: FORMATS, browsers: findBrowsers().map((b) => b.id) };
    },
    async settings({ lang, site, outDir }) {
      const cfg = loadConfig();
      if (lang) cfg.lang = lang === 'ar' ? 'ar' : 'en';
      if (outDir) cfg.outDir = outDir;
      if (site && normalizeSite(site) !== cfg.site) { cfg.site = normalizeSite(site); delete cfg.token; delete cfg.user; }
      saveConfig(cfg);
      return api.state();
    },
    async login({ browser, link }) {
      const cfg = loadConfig();
      let token;
      if (link) {
        const p = parseTokenLink(link);
        if (!p) throw new Error('Invalid link / key');
        token = p.token;
      } else {
        if (busyLogin) return busyLogin;
        busyLogin = browserLogin(cfg.site, { browser: browser || 'auto' }).finally(() => { busyLogin = null; });
        token = await busyLogin;
      }
      await saveLogin(cfg.site, token);
      return api.state();
    },
    async logout() { logout(); return api.state(); },
    async semesters({ lang }) {
      const cfg = loadConfig();
      const { list } = await semesters(cfg, lang || cfg.lang);
      return list.map(({ key, label }) => ({ key, label }));
    },
    async preview({ semester, lang, pendingOnly, materials }) {
      const { model } = await generate({ semester, lang, pendingOnly, materials, dryRun: true });
      return { html: renderHtml(model), todo: model.todo.length, untranslated: model.untranslated };
    },
    async browse() { return { path: await chooseFolder() }; },
    async generate(o) {
      const cfg = loadConfig();
      if (o.outDir) cfg.outDir = o.outDir;
      cfg.fileName = o.name || '';
      saveConfig(cfg);
      const { file, model } = await generate({ ...o, out: o.outDir || cfg.outDir });
      return { file, todo: model.todo.length, untranslated: model.untranslated };
    },
    async open({ path: p }) { openPath(p); return {}; },
    async bug({ error }) {
      const cfg = loadConfig();
      const env = diagnostics({
        component: 'program window', os: `${process.platform} ${os.release()} ${process.arch}`,
        browser: findBrowsers().map((b) => b.id).join(', ') || 'none found', lang: cfg.lang, site: cfg.site,
        extra: `Runtime: ${process.versions.bun ? 'bun ' + process.versions.bun : 'node ' + process.versions.node}`,
      });
      const url = issueUrl({ env, error: error || (cfg.lastError && cfg.lastError.message) || '' });
      openPath(url);
      return { url };
    },
    async ping() { lastPing = Date.now(); return {}; },
  };

  const server = http.createServer(async (req, res) => {
    const host = req.headers.host || '';
    const okHost = host === `127.0.0.1:${server.address().port}` || host === `localhost:${server.address().port}`;
    if (!okHost) { res.writeHead(403).end(); return; }
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === `/${secret}/`) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'self' 'unsafe-inline'; frame-src 'self' data: blob:; img-src * data:" });
      res.end(page(secret));
      return;
    }
    const m = url.pathname.match(new RegExp(`^/${secret}/api/(\\w+)$`));
    if (req.method !== 'POST' || !m || !api[m[1]] || req.headers['x-mahamm'] !== secret) { res.writeHead(404).end(); return; }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const out = await api[m[1]](body ? JSON.parse(body) : {});
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out ?? {}));
    } catch (e) {
      res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: e.message, code: e.code || null }));
    }
  });

  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const addr = `http://127.0.0.1:${server.address().port}/${secret}/`;
  console.log(`Mahamm is running at ${addr}\nKeep this window open. Close the browser tab or press Ctrl+C to quit.`);
  if (open) openPath(addr);
  // Quit a while after the page stops pinging (tab closed).
  setInterval(() => { if (Date.now() - lastPing > 90e3 && !busyLogin) { console.log('Window closed – bye.'); process.exit(0); } }, 15e3).unref();
  return { url: addr, server };
}
