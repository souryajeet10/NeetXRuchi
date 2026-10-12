import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, fresh } from '../src/state.js';
import { completionTargetError, normalizeCompletionTarget, daysBetween, chapterPace } from '../src/completion-target.js';

test('syllabus target is optional for existing accounts and persists through normalization',()=>{
 assert.equal(fresh().syllabusCompletionDate,'');
 assert.equal(normalize({}).syllabusCompletionDate,'');
 const state=normalize({syllabusCompletionDate:'2027-03-01'});
 assert.equal(state.syllabusCompletionDate,'2027-03-01');
 assert.deepEqual(normalize(state),state);
 assert.equal(normalizeCompletionTarget('2026-01-01'),'2026-01-01');
});

test('chapter pace includes both endpoints and rounds up enough to finish',()=>{
 const pace=chapterPace(30,'2026-10-25','2026-10-12');
 assert.deepEqual(pace,{remaining:30,days:14,overdue:false,daily:3,weekly:15,weekDays:7});
 assert.equal(chapterPace(10,'2026-10-25','2026-10-12').daily,1);
 assert.equal(chapterPace(10,'2026-10-25','2026-10-12').weekly,5);
 assert.equal(chapterPace(30,'2026-10-18','2026-10-12').weekly,30);
});

test('same-day and partial-week deadlines never suggest more than remaining chapters',()=>{
 assert.deepEqual(chapterPace(9,'2026-10-12','2026-10-12'),{remaining:9,days:1,overdue:false,daily:9,weekly:9,weekDays:1});
 assert.equal(chapterPace(9,'2026-10-14','2026-10-12').daily,3);
 assert.equal(chapterPace(9,'2026-10-14','2026-10-12').weekly,9);
});

test('missing, invalid, overdue and completed goals have explicit states',()=>{
 for(const deadline of ['', 'bad', '2027-02-30'])assert.equal(chapterPace(5,deadline,'2026-10-12'),null);
 assert.deepEqual(chapterPace(5,'2026-10-11','2026-10-12'),{remaining:5,days:0,overdue:true,daily:0,weekly:0,weekDays:0});
 assert.equal(chapterPace(0,'2026-10-25','2026-10-12').daily,0);
 assert.equal(chapterPace(0,'2026-10-25','2026-10-12').weekly,0);
 assert.equal(chapterPace(4,'2027-03-01','2027-02-28').days,2);
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
