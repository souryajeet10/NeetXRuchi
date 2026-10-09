import { test } from 'node:test';
import assert from 'node:assert/strict';
import { S, ALL, BY, LECTURES, LEGACY_MAP } from '../src/syllabus.js';
import { fresh, normalize } from '../src/state.js';

test('planners have 89 distinct chapters, 655 lectures, with no revision sessions',()=>{
  assert.equal(ALL.length,89);assert.equal(new Set(ALL.map(a=>a.id)).size,89);
  assert.deepEqual(S.map((_,i)=>ALL.filter(a=>a.s===i).length),[31,26,17,15]);
  assert.equal(Object.values(LECTURES).reduce((a,b)=>a+b,0),655);
  assert.equal(LECTURES['Zoology|Breathing and Exchange of Gases'],8);
  assert.equal(LECTURES['Zoology|Structural Organization in Animals'],15);
  assert.equal(BY['Botany|Biomolecules'],undefined);assert(BY['Zoology|Biomolecules']);
  assert.equal(fresh().lec['Physics|Basic Maths & Calculus (Mathematical Tools)'].n,11);
});
test('every old chapter maps to known chapters',()=>{
  assert.equal(Object.keys(LEGACY_MAP).length,71);
  for(const ids of Object.values(LEGACY_MAP))for(const id of ids)assert(BY[id],id);
});
test('old progress, plans and test checklists migrate across splits and subject moves',()=>{
  const old={done:{'Physics|Kinematics|0':true,'Botany|Biomolecules|1':true},dates:{'Physics|Kinematics':'2026-10-08'},lec:{'Physics|Kinematics':{n:20,d:[1,2]},'Botany|Biomolecules':{n:10,d:[3]}},plan:{'2026-10-05':['Physics|Kinematics']},day:{'2026-10-09':['Botany|Biomolecules']},tests:[{id:'test1',name:'Mock',date:'2027-01-01',ch:['Physics|Kinematics'],chk:{'Physics|Kinematics':true}}]};
  const snapshot=structuredClone(old),n=normalize(old);
  assert.deepEqual(old,snapshot);
  for(const id of LEGACY_MAP['Physics|Kinematics']){assert(n.done[id+'|0']);assert.equal(n.dates[id],'2026-10-08');assert(n.tests[0].chk[id]);assert.equal(n.lec[id].d.length,0)}
  assert.deepEqual(n.plan['2026-10-05'],LEGACY_MAP['Physics|Kinematics']);
  assert.deepEqual(n.day['2026-10-09'],['Zoology|Biomolecules']);assert(n.done['Zoology|Biomolecules|1']);
  assert.deepEqual(n.lec['Zoology|Biomolecules'],{n:10,d:[3]});assert.deepEqual(n.legacyProgress.lec,old.lec);
  assert.deepEqual(normalize(n),n);
});
test('explicit new completion state takes precedence and custom totals survive reload',()=>{
  const x={done:{'Physics|Kinematics|0':true,'Physics|Motion in a Straight Line|0':false},lec:{'Physics|Units and Measurements':{n:0,d:[]}}};
  const n=normalize(x);assert(!n.done['Physics|Motion in a Straight Line|0']);assert(n.done['Physics|Motion in a Plane|0']);assert.equal(n.lec['Physics|Units and Measurements'].n,0);assert.deepEqual(normalize(n),n);
});
