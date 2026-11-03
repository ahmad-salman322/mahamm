// App identity + "Report a problem" links (GitHub Issues with a prefilled form).
// Change REPO if the project lives somewhere else.
export const VERSION = '1.0.0';
export const REPO = 'ahmad-salman322/mahamm';
export const REPO_URL = `https://github.com/${REPO}`;

// Never put the Moodle key, the student's name or task contents in here.
export function diagnostics({ component, version = VERSION, os = '', browser = '', lang = '', site = '', extra = '' }) {
  let host = '';
  try { host = site ? new URL(site).host : ''; } catch { host = ''; }
  return [
    `Mahamm ${component} ${version}`,
    os && `OS: ${os}`,
    browser && `Browser: ${browser}`,
    lang && `Language: ${lang}`,
    host && `Moodle: ${host}`,
    extra,
  ].filter(Boolean).join('\n');
}

// Opens the bug form with the environment and the last error already filled in.
// Field ids must match .github/ISSUE_TEMPLATE/bug_report.yml
export function issueUrl({ title = '', env = '', error = '' } = {}) {
  const p = new URLSearchParams({ template: 'bug_report.yml', labels: 'bug' });
  if (title) p.set('title', title.slice(0, 120));
  if (env) p.set('environment', env.slice(0, 1500));
  if (error) p.set('error', String(error).replace(/[a-f0-9]{32}/gi, '<key>').slice(0, 2500));
  return `${REPO_URL}/issues/new?${p}`;
}
