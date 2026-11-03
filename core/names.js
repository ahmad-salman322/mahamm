// Course-name cleanup and translation.
// Moodle full names look like "תיכון מונחה עצמים קב' 04 - 100547104" or
// "קורס אב - מתמטיקה בדידה 1 - 1015271". We strip the group, codes and the
// "master course" marker, keep the Hebrew name, and look up a translation.
import { TRANSLATIONS } from './translations.js';

export function normalizeHe(s) {
  return String(s || '')
    .normalize('NFC')
    .replace(/[֑-ׇ]/g, '') // niqqud / cantillation
    .replace(/[״“”]/g, '"')
    .replace(/[׳‘’`]/g, "'")
    .replace(/לינארית/g, 'ליניארית')
    .replace(/תירגול/g, 'תרגול')
    .replace(/\s+/g, ' ')
    .trim();
}

export function courseGroup(full) {
  const m = normalizeHe(full).match(/קב'\s*([\d,\s]*\d)/);
  return m ? m[1].replace(/\s+/g, '').replace(/,/g, ', ') : '';
}

export function cleanCourseName(full) {
  let s = normalizeHe(full);
  s = s.replace(/קב'\s*[\d,\s]*\d/g, ' ');
  s = s.replace(/קורס אב/g, ' ');
  s = s.replace(/סמסטר [אב]'?(?=\s|$)/g, ' ');
  s = s.replace(/[,\s]*\b\d{5,}(?:\s*[,/]\s*\d{4,})*/g, ' '); // course codes
  s = s.replace(/\s+-\s+(?:-\s+)+/g, ' - ');
  s = s.replace(/^[\s\-–,]+|[\s\-–,]+$/g, '');
  return s.replace(/\s+/g, ' ').trim() || normalizeHe(full);
}

const HAS_HEBREW = /[֐-׿]/;
const TUTORIAL = { en: 'Tutorial', ar: 'تدريب' };

function buildIndex(extra) {
  const idx = new Map();
  for (const src of [TRANSLATIONS, extra || {}]) {
    for (const [k, v] of Object.entries(src)) idx.set(normalizeHe(k), v);
  }
  return idx;
}

function lookup(idx, he, lang) {
  const hit = idx.get(he);
  if (hit && hit[lang]) return hit[lang];
  if (he.length >= 10) { // truncated by Moodle
    for (const [k, v] of idx) if (k.startsWith(he) && v[lang]) return v[lang];
  }
  return null;
}

// Returns { he, tr, display, translated }.
// display is always "<Hebrew> - <translation>" when a translation exists.
export function translateCourse(full, lang = 'en', extra) {
  const he = cleanCourseName(full);
  const idx = buildIndex(extra);
  let tr = null;
  if (!HAS_HEBREW.test(he)) tr = lookup(idx, he, lang) || he;
  else {
    tr = lookup(idx, he, lang);
    if (!tr) {
      const m = he.match(/^תרגול\s*(?:-\s*)?(.+)$/);
      if (m) {
        const rest = m[1];
        const base = lookup(idx, rest, lang) || (rest.startsWith('ב') ? lookup(idx, rest.slice(1), lang) : null);
        if (base) tr = `${base} – ${TUTORIAL[lang] || TUTORIAL.en}`;
      }
    }
  }
  const translated = !!tr && tr !== he;
  return { he, tr: translated ? tr : null, display: translated ? `${he} - ${tr}` : he, translated };
}
