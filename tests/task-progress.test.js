import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL } from '../src/syllabus.js';
import { fresh, normalize } from '../src/state.js';
import { addChapterTask, rescheduleTask, taskDay, stageProgress } from '../src/task-progress.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { S, BY } from '../src/syllabus.js';
import { matchingChapters } from '../src/task-chapter-search.js';

test('chapter search matches names and subjects and rejects unknown queries', () => {
  assert.deepEqual(matchingChapters('   '), []);
  assert.deepEqual(matchingChapters('zzzz-no-such-chapter'), []);
  assert.ok(matchingChapters('physics').length > 0);
  assert.ok(matchingChapters('physics').every(a => S[a.s].n === 'Physics'));
  assert.ok(matchingChapters(ALL[0].c).some(a => a.id === ALL[0].id));
});

test('daily view renders separate completion dates and an empty selected date', () => {
  const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const fn=source.slice(source.indexOf('function renderTodo(){'),source.indexOf('function buildPicker(){'));
  const node={};
  const state=fresh();
  state.todos=[{id:'a',text:'First',done:true,completedAt:'2026-11-01'}, {id:'b',text:'Second',done:true,completedAt:'2026-11-02'}];
  const ctx={st:state,ALL,S,BY,taskDay,taskDate:'',taskCalendar:false,setupTaskChapterSearch:()=>{},taskFilter:'all',today:()=>new Date(2026,10,2),iso:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,fmt:x=>x,esc:String,metric:()=>'',studyStreak:()=>0,dlist:()=>'',listStudied:()=>'',pickers:{},$:()=>node};
  vm.runInNewContext(fn+';renderTodo();',ctx);
  assert.doesNotMatch(node.innerHTML,/Completed · 2026-11-01/);
  assert.match(node.innerHTML,/Completed · 2026-11-02/);
  assert.equal((node.innerHTML.match(/data-task-day=/g)||[]).length,7);
  ctx.taskCalendar=true;
  ctx.taskDate='2026-11-01';
  vm.runInNewContext('renderTodo();',ctx);
  assert.match(node.innerHTML,/Completed · 2026-11-01/);
  assert.doesNotMatch(node.innerHTML,/task-history-calendar/);
  assert.equal((node.innerHTML.match(/data-task-day=/g)||[]).length,7);
  ctx.taskDate='2026-11-05';
  vm.runInNewContext('renderTodo();',ctx);
  assert.match(node.innerHTML,/No tasks for this day/);
  assert.doesNotMatch(node.innerHTML,/data-todotoggle=/);
});

test('chapter is mandatory and scheduled once; chapter links survive storage', () => {
  const state = fresh(), chapterId = ALL[0].id;
  const task = { id: '1', text: 'Revise notes', due: '2026-11-02', chapterId };
  assert.equal(addChapterTask(state, {...task, chapterId: ''}), false);
  assert.equal(state.todos.length, 0);
  assert.equal(addChapterTask(state, task), true);
  addChapterTask(state, {...task, id: '2'});
  assert.deepEqual(state.day[task.due], [chapterId]);
  assert.equal(normalize(state).todos[0].chapterId, chapterId);
  assert.deepEqual(state.done, {});
});

test('completed work uses completion day and legacy work falls back without losing tasks', () => {
  const task = {due:'2026-11-01',completedAt:'2026-11-02',done:true};
  assert.equal(taskDay(task), '2026-11-02');
  assert.equal(taskDay({...task,done:false}), '2026-11-01');
  assert.equal(taskDay({...task,completedAt:''}), '2026-11-01');
  assert.equal(taskDay({done:true}), '');
});

test('study, revision and PYQ percentages use independent chapter counts', () => {
  const done = Object.fromEntries(ALL.map(a=>[a.id+'|0',true]));
  done[ALL[0].id+'|1']=true;
  const result=stageProgress(done);
  assert.equal(result[0].percent,100);
  assert.equal(result[1].count,1);
  assert.equal(result[1].percent,Math.round(100/ALL.length));
  assert.equal(result[2].percent,0);
});

test('rescheduling moves linked plans while preserving shared chapters and study history', () => {
 const state=fresh(),chapterId=ALL[0].id;
 addChapterTask(state,{id:'a',text:'Notes',chapterId,due:'2026-11-03'});
 addChapterTask(state,{id:'b',text:'Practice',chapterId,due:'2026-11-03'});
 assert.equal(rescheduleTask(state,'a','2026-02-30'),false);
 assert.equal(rescheduleTask(state,'a','2026-11-04'),true);
 assert.deepEqual(state.day['2026-11-03'],[chapterId]);
 assert.deepEqual(state.day['2026-11-04'],[chapterId]);
 rescheduleTask(state,'b','2026-11-04');
 assert.deepEqual(state.day['2026-11-03'],[]);
 assert.deepEqual(state.day['2026-11-04'],[chapterId]);
 state.dayDone['2026-11-04']=[chapterId];
 rescheduleTask(state,'a','2026-11-05');
 rescheduleTask(state,'b','2026-11-05');
 assert.deepEqual(state.day['2026-11-04'],[chapterId]);
 assert.deepEqual(state.dayDone['2026-11-04'],[chapterId]);
 assert.equal(normalize(state).todos[0].due,'2026-11-05');
});
