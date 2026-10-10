import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, fresh } from '../src/state.js';
import { completionTargetError, normalizeCompletionTarget, daysBetween } from '../src/completion-target.js';

test('syllabus target is optional for existing accounts and persists through normalization',()=>{
 assert.equal(fresh().syllabusCompletionDate,'');
 assert.equal(normalize({}).syllabusCompletionDate,'');
 const state=normalize({syllabusCompletionDate:'2027-03-01'});
 assert.equal(state.syllabusCompletionDate,'2027-03-01');
 assert.deepEqual(normalize(state),state);
 assert.equal(normalizeCompletionTarget('2026-01-01'),'2026-01-01');
});
test('target must be a real date before the exam and new selections cannot be past',()=>{
 for(const value of ['2027-02-30','2027-05-02','2027-05-03','not-a-date']){
  assert.equal(normalizeCompletionTarget(value),'');
  assert.notEqual(completionTargetError(value,'2026-10-10'),'');
 }
 assert.notEqual(completionTargetError('2026-10-09','2026-10-10'),'');
 assert.equal(completionTargetError('2026-10-10','2026-10-10'),'');
 assert.equal(completionTargetError('2027-05-01','2026-10-10'),'');
 assert.equal(daysBetween('2027-05-01','2027-05-02'),1);
 assert.equal(daysBetween('2027-03-01','2027-05-02'),62);
});
