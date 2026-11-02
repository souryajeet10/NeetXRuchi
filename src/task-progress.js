import { ALL, BY } from './syllabus.js';

export function addChapterTask(state, task) {
  if (!task.text.trim() || !Object.hasOwn(BY, task.chapterId) || !/^\d{4}-\d{2}-\d{2}$/.test(task.due)) return false;
  state.todos.push({ ...task, done: false, completedAt: '' });
  state.day[task.due] = [...new Set([...(state.day[task.due] || []), task.chapterId])];
  return true;
}

export function taskDay(task) {
  return task.done ? task.completedAt || task.due || '' : task.due || '';
}

export function stageProgress(done) {
  return ['Studied', 'Revised', 'PYQs'].map((label, step) => {
    const count = ALL.filter(a => done[a.id + '|' + step]).length;
    return { label, count, percent: Math.round(count / ALL.length * 100) };
  });
}
