// Moodle mobile-app login (the same flow the official Moodle app uses).
// The user signs in normally (SSO included); Moodle then redirects to
//   moodlemobile://token=<base64("sitehash:::token[:::privatetoken]")>
// and we keep only the web-service token. No password is ever stored.
export const SCHEME = 'moodlemobile';

export function normalizeSite(site) {
  let s = String(site || '').trim();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  const u = new URL(s);
  return (u.origin + u.pathname).replace(/\/+$/, '');
}

export function launchUrl(site, passport) {
  return `${normalizeSite(site)}/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=${encodeURIComponent(passport)}&urlscheme=${SCHEME}`;
}

export function isTokenLink(url) {
  return typeof url === 'string' && url.startsWith(SCHEME + '://');
}

// Accepts the full moodlemobile:// link, the base64 part, or a bare 32-char token.
export function parseTokenLink(input) {
  const s = String(input || '').trim();
  if (/^[a-f0-9]{32}$/i.test(s)) return { token: s };
  const m = s.match(/token=([A-Za-z0-9+/=%_-]+)/);
  const b64 = m ? m[1] : s;
  try {
    const raw = atob(decodeURIComponent(b64).replace(/-/g, '+').replace(/_/g, '/'));
    const parts = raw.split(':::');
    if (parts.length >= 2 && /^[a-f0-9]{32}$/i.test(parts[1])) {
      return { siteHash: parts[0], token: parts[1], privateToken: parts[2] || null };
    }
  } catch { /* fall through */ }
  return null;
}
