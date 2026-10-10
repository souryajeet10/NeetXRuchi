import { normalizeCompletionTarget } from './completion-target.js';
import { ALL, BY, LECTURES, migrateProgress } from './syllabus.js';
export const fresh = () => ({ syllabusCompletionDate: '', done: {}, dates: {}, tab: 0, hide: false, grid: true, view: "dash", wk: 5, mo: 20, tests: [], plan: {}, day: {}, dayDone: {}, due: {}, todos: [], lec: Object.fromEntries(ALL.map(a => [a.id, { n: 0, d: [] }])), syllabusVersion: 2, legacyProgress: {} });

export function normalize(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw Error("Invalid tracker data");
  x = migrateProgress(x);
  const n = fresh();
  n.syllabusCompletionDate = normalizeCompletionTarget(x.syllabusCompletionDate);
  for (const a of ALL) {
    for (let k = 0; k < 3; k++) if (x.done?.[a.id + "|" + k] === true) n.done[a.id + "|" + k] = true;
    if (/^\d{4}-\d{2}-\d{2}$/.test(x.dates?.[a.id] || '')) n.dates[a.id] = x.dates[a.id];
    const l = x.lec?.[a.id];
    if (l) {
      const count = Math.max(0, Math.min(60, Math.floor(Number(l.n) || 0)));
      const done = [...new Set((Array.isArray(l.d) ? l.d : []).filter(v => Number.isInteger(v) && v > 0 && v <= count))];
      const isCodedDefault = l.n === LECTURES[a.id] && done.length === 0;
      n.lec[a.id] = { n: isCodedDefault ? 0 : count, d: done };
    }
  }
  for (const field of ['plan', 'day', 'dayDone']) for (const [d, ids] of Object.entries(x[field] || {})) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Array.isArray(ids)) n[field][d] = [...new Set(ids.filter(id => Object.hasOwn(BY, id)))];
  for (const [id, date] of Object.entries(x.due || {})) if (Object.hasOwn(BY, id) && /^\d{4}-\d{2}-\d{2}$/.test(date)) n.due[id] = date;
  n.todos = (Array.isArray(x.todos) ? x.todos : []).filter(t => t && typeof t.text === 'string').map(t => ({ id: String(t.id || Date.now() + Math.random()), text: String(t.text).trim().slice(0, 200), done: !!t.done, due: /^\d{4}-\d{2}-\d{2}$/.test(t.due||'') ? t.due : '', priority: ['high','medium','low'].includes(t.priority) ? t.priority : 'medium', completedAt: /^\d{4}-\d{2}-\d{2}$/.test(t.completedAt||'') ? t.completedAt : '' }));
  n.tests = (Array.isArray(x.tests) ? x.tests : []).filter(t => t && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && /^[a-zA-Z0-9_-]+$/.test(String(t.id))).map(t => ({ id: String(t.id), name: String(t.name || 'Test').slice(0, 160), date: t.date, ch: [...new Set((Array.isArray(t.ch) ? t.ch : []).filter(id => Object.hasOwn(BY, id)))], chk: Object.fromEntries(Object.entries(t.chk || {}).filter(([id, v]) => Object.hasOwn(BY, id) && v === true)) }));
  n.tab = Number.isInteger(x.tab) && x.tab >= 0 && x.tab < 4 ? x.tab : 0; n.view = ['dash', 'syl', 'plan', 'cal', 'todo'].includes(x.view) ? x.view : 'syl'; n.hide = !!x.hide; n.grid = !!x.grid;
  for (const k of ['wk', 'mo']) n[k] = Number.isFinite(x[k]) ? Math.max(0, Math.min(1000, Math.floor(x[k]))) : n[k]; n.legacyProgress = x.legacyProgress && typeof x.legacyProgress === 'object' ? structuredClone(x.legacyProgress) : {}; return n;
}
