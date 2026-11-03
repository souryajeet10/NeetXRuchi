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

export function rescheduleTask(state, taskId, date) {
  const task = state.todos.find(t => t.id === taskId);
  const parsed = new Date(date + 'T00:00:00');
  if (!task || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.getDate() !== Number(date.slice(8))) return false;
  const oldDate = task.due;
  if (oldDate === date) return true;
  task.due = date;
  if (Object.hasOwn(BY, task.chapterId)) {
    const chapter = task.chapterId;
    const needed = state.todos.some(t => t.id !== taskId && t.chapterId === chapter && t.due === oldDate);
    if (!needed && !(state.dayDone[oldDate] || []).includes(chapter)) {
      state.day[oldDate] = (state.day[oldDate] || []).filter(id => id !== chapter);
    }
    state.day[date] = [...new Set([...(state.day[date] || []), chapter])];
  }
  return true;
}

export function stageProgress(done) {
  return ['Studied', 'Revised', 'PYQs'].map((label, step) => {
    const count = ALL.filter(a => done[a.id + '|' + step]).length;
    return { label, count, percent: Math.round(count / ALL.length * 100) };
  });
}
