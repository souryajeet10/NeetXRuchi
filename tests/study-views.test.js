import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalize } from '../src/state.js';

test('task dates, priorities and completion dates survive cloud normalization',()=>{
 const state=normalize({todos:[{id:'one',text:'Review vectors',done:true,due:'2026-10-12',priority:'high',completedAt:'2026-10-10'},{id:'old',text:'Legacy task',done:false},{id:'bad',text:'Invalid metadata',due:'bad',priority:'urgent',completedAt:'bad'}],view:'dash'});
 assert.equal(state.view,'dash');
 assert.deepEqual(state.todos[0],{id:'one',text:'Review vectors',done:true,due:'2026-10-12',priority:'high',completedAt:'2026-10-10'});
 assert.equal(state.todos[1].priority,'medium');
 assert.equal(state.todos[1].due,'');
 assert.equal(state.todos[2].due,'');
 assert.equal(state.todos[2].completedAt,'');
 assert.deepEqual(normalize(state),state);
});

test('calendar renders a full leap-year month with selected chapter controls',()=>{
 const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('function renderCal(){'),source.indexOf('let activeDueId=null;'));
 const nodes={calmain:{},dsum:{}};
 const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const ctx={cm:new Date(2028,1,1),cs:'2028-02-29',today:()=>new Date(2028,1,29),iso,weekStart:()=> '2028-02-28',st:{day:{'2028-02-29':['chapter']},dayDone:{},plan:{},due:{},tests:[]},BY:{chapter:{c:'Vectors',s:0,group:'Mechanics'}},S:[{n:'Physics'}],EXAM:'2028-05-02',pickers:{dpick:{setSelected(){}}},$:id=>nodes[id],esc:x=>String(x),fmt:x=>x,metric:()=>'',upcoming:()=>[],studyStreak:()=>0};
 vm.runInNewContext(fn+';renderCal();',ctx);
 assert.equal((nodes.calmain.innerHTML.match(/class="cd /g)||[]).length,42);
 assert.match(nodes.calmain.innerHTML,/data-markdone="2028-02-29\|chapter"/);
 assert.match(nodes.calmain.innerHTML,/data-reschedule="2028-02-29\|chapter"/);
 assert.match(nodes.calmain.innerHTML,/February 2028/);
});
