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
  if (value >= EXAM_DATE) return 'Choose a date before the exam date to leave time for revision.';
  if (value < today) return 'Choose today or a future date for your new target.';
  return '';
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}
