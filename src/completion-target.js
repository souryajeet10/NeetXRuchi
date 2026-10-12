export const EXAM_DATE = '2027-05-02';

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Past targets remain saved so students can see and edit an overdue goal.
export function normalizeCompletionTarget(value) {
  return isValidDate(value) && value < EXAM_DATE ? value : '';
}

export function completionTargetError(value, today) {
  if (!isValidDate(value)) return 'Choose a valid syllabus completion date.';
  if (value >= EXAM_DATE) return 'Choose a date before the tentative exam date to leave time for revision.';
  if (value < today) return 'Choose today or a future date for your new target.';
  return '';
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}

// Include both today and the deadline as available study days.
export function chapterPace(remaining, deadline, today) {
  if (!normalizeCompletionTarget(deadline) || !isValidDate(today)) return null;
  const days = Math.max(0, daysBetween(today, deadline) + 1);
  const chapters = Math.max(0, Math.floor(remaining));
  return {
    remaining: chapters,
    days,
    overdue: deadline < today,
    daily: days ? Math.ceil(chapters / days) : 0,
    weekly: days ? Math.min(chapters, Math.ceil(chapters * 7 / days)) : 0,
    weekDays: Math.min(7, days),
  };
}
