import course from './course-data.json' with { type: 'json' };
import legacy from './legacy-chapters.json' with { type: 'json' };
const names = (key, start = 0, end) => course[key].chapters.slice(start, end).map(c => c.name);
export const S = [
  { n: 'Physics', c: 'var(--phy)', g: { 'Foundation': names('physics',0,2), 'Class 11': names('physics',2,17), 'Class 12': names('physics',17) } },
  { n: 'Chemistry', c: 'var(--che)', g: { 'Physical Chemistry': names('physical'), 'Inorganic Chemistry': names('inorganic'), 'Organic Chemistry': names('organic') } },
  { n: 'Botany', c: 'var(--bot)', g: { 'Class 11': names('botany',0,10), 'Class 12': names('botany',10) } },
  { n: 'Zoology', c: 'var(--zoo)', g: { 'Class 11': names('zoology',0,9), 'Class 12': names('zoology',9) } }
];
export const chapters = si => Object.values(S[si].g).flat();
export const ALL = S.flatMap((s,si) => Object.entries(s.g).flatMap(([group,items])=>items.map(c=>({ id:s.n+'|'+c, s:si, c, group }))));
export const BY = Object.fromEntries(ALL.map(a=>[a.id,a]));
const subjects = { physics:'Physics',physical:'Chemistry',inorganic:'Chemistry',organic:'Chemistry',botany:'Botany',zoology:'Zoology' };
export const LECTURES = Object.fromEntries(Object.entries(subjects).flatMap(([key,subject])=>course[key].chapters.map(c=>[subject+'|'+c.name,c.lectures])));
export const LEGACY_MAP = legacy;

// Preserve old records before replacing chapter IDs. A split chapter carries its
// completion flags and selections forward, but its lecture numbers cannot be
// assigned to the new parts reliably, so those remain in the archive.
export function migrateProgress(raw) {
  if (raw.syllabusVersion === 2) return raw;
  const x = structuredClone(raw);
  const original = { done:raw.done||{}, dates:raw.dates||{}, lec:raw.lec||{} };
  const targets = id => Object.hasOwn(legacy,id) ? legacy[id] : Object.hasOwn(BY,id) ? [id] : [];
  const remapList = ids => [...new Set((Array.isArray(ids)?ids:[]).flatMap(targets))];
  const done = {...original.done}, dates = {...original.dates}, lec = {...original.lec};
  for (const [old, replacements] of Object.entries(legacy)) {
    if(replacements.length===1 && replacements[0]===old)continue;
    for(const id of replacements){
      for(let k=0;k<3;k++)if(!Object.hasOwn(original.done,id+'|'+k)&&Object.hasOwn(original.done,old+'|'+k))done[id+'|'+k]=original.done[old+'|'+k];
      if(!Object.hasOwn(original.dates,id)&&original.dates[old])dates[id]=original.dates[old];
      if(replacements.length===1&&!Object.hasOwn(original.lec,id)&&original.lec[old])lec[id]=original.lec[old];
    }
  }
  x.done=done;x.dates=dates;x.lec=lec;
  for(const field of ['day','plan'])x[field]=Object.fromEntries(Object.entries(raw[field]||{}).map(([date,ids])=>[date,remapList(ids)]));
  x.tests=(Array.isArray(raw.tests)?raw.tests:[]).map(t=>{
    const chk={};for(const [id,value] of Object.entries(t.chk||{}))for(const to of targets(id))if(value===true)chk[to]=true;
    return {...t,ch:remapList(t.ch),chk};
  });
  x.legacyProgress=raw.legacyProgress||{...original,plan:raw.plan||{},day:raw.day||{},tests:raw.tests||[]};
  x.syllabusVersion=2;
  return x;
}
