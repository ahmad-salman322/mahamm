// HTML -> PDF using an installed browser in headless mode (Chrome/Edge/Chromium/Brave, else Firefox).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './driver.js';
import { pickBrowser } from './browsers.js';

export async function htmlToPdf(html, outFile, { browser = 'auto' } = {}) {
  const b = pickBrowser(browser);
  if (!b) throw new Error('PDF needs Chrome, Edge, Chromium, Brave or Firefox installed. Use --format html instead.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mahamm-pdf-'));
  const src = path.join(tmp, 'report.html');
  fs.writeFileSync(src, html);
  const d = await launch(b, { headless: true });
  try {
    const buf = await d.printPdf(pathToFileURL(src).href);
    fs.writeFileSync(outFile, buf);
  } finally {
    await d.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return outFile;
}
