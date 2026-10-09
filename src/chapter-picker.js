import { S, ALL, BY, LECTURES } from './syllabus.js';
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createChapterPicker(root, label) {
  let subject='all',subSubject='all',selectedOnly=false;
  root.classList.add('chapter-picker');
  root.innerHTML=`<div class="picker-heading"><div><span class="eyebrow">MAKE ROOM FOR PROGRESS</span><h3>${esc(label)}</h3></div><span class="selection-count" aria-live="polite">0 selected</span></div>
    <label class="picker-search-label">Find a chapter<input type="search" class="picker-search" aria-label="Search ${esc(label.toLowerCase())}"></label>
    <div class="picker-subjects" role="group" aria-label="Filter by subject"><button type="button" data-subject="all" aria-pressed="true">All subjects</button><button type="button" data-subject="0" aria-pressed="false">Physics</button><button type="button" data-subject="1" aria-pressed="false">Chemistry</button><button type="button" data-subject="biology" aria-pressed="false">Biology</button></div>
    <div class="picker-subfilters" hidden><span class="picker-search-label">Narrow it down</span><div class="picker-subjects" role="group" aria-label="Filter by sub-subject"></div></div>
    <div class="picker-actions"><button type="button" class="btn" data-select-visible>Select visible</button><button type="button" class="btn" data-clear>Clear selection</button><button type="button" class="btn" data-selected-only aria-pressed="false">Selected only</button><span class="picker-visible mute"></span></div>
    <div class="picker-options">${S.map((s,si)=>Object.entries(s.g).map(([group])=>`<section class="picker-group" data-group><h4>${s.n} <span> / ${esc(group)}</span></h4><div class="picker-grid">${ALL.filter(a=>a.s===si&&a.group===group).map(a=>`<label class="chapter-choice" data-subject-index="${si}" data-name="${esc(a.c.toLowerCase())}" style="--c:${s.c}"><input type="checkbox" value="${esc(a.id)}"><span class="choice-copy"><strong>${esc(a.c)}</strong><small>${LECTURES[a.id]} lectures</small></span><span class="choice-check" aria-hidden="true">✓</span></label>`).join('')}</div></section>`).join('')).join('')}</div><p class="picker-empty" hidden>No chapters found. Try another search or subject.</p>`;
  const boxes=()=>[...root.querySelectorAll('input[type=checkbox]')];
  function selected(){return boxes().filter(i=>i.checked).map(i=>i.value)}
  function renderSubSubjects(){
    const container=root.querySelector('.picker-subfilters');
    container.hidden=subject==='all';
    if(subject==='all'){container.querySelector('.picker-subjects').innerHTML='';return}
    const options=subject==='biology'?['Botany','Zoology']:subject==='all'?[]:Object.keys(S[Number(subject)].g);
    container.querySelector('.picker-subjects').innerHTML=['all',...options].map(value=>`<button type="button" data-sub-subject="${esc(value)}" aria-pressed="${value===subSubject}">${value==='all'?'All '+(subject==='biology'?'Biology':S[Number(subject)].n):esc(value)}</button>`).join('');
  }
  function refresh(){
    const query=root.querySelector('.picker-search').value.trim().toLowerCase();let visible=0;
    for(const row of root.querySelectorAll('.chapter-choice')){
      const checked=row.querySelector('input').checked;
      const si=Number(row.dataset.subjectIndex),chapter=BY[row.querySelector('input').value];
      const matchesSubject=subject==='all'||(subject==='biology'?si===2||si===3:row.dataset.subjectIndex===subject);
      const matchesSubSubject=subSubject==='all'||(subject==='biology'?S[si].n===subSubject:chapter.group===subSubject);
      row.hidden=!matchesSubject||!matchesSubSubject||!row.dataset.name.includes(query)||(selectedOnly&&!checked);
      row.classList.toggle('is-selected',checked);if(!row.hidden)visible++;
    }
    for(const group of root.querySelectorAll('[data-group]'))group.hidden=![...group.querySelectorAll('.chapter-choice')].some(r=>!r.hidden);
    const count=selected().length;root.querySelector('.selection-count').textContent=`${count} selected`;
    root.querySelector('.picker-visible').textContent=`${visible} shown`;
    root.querySelector('.picker-empty').hidden=visible!==0;
    root.querySelector('[data-select-visible]').disabled=visible===0;
    root.querySelector('[data-clear]').disabled=count===0;
  }
  function changed(){refresh();root.dispatchEvent(new CustomEvent('chapterselection',{bubbles:true,detail:{ids:selected()}}))}
  root.querySelector('.picker-search').addEventListener('input',refresh);
  root.addEventListener('change',e=>{if(e.target.matches('input[type=checkbox]'))changed()});
  root.addEventListener('click',e=>{
    const tab=e.target.closest('[data-subject]');if(tab){subject=tab.dataset.subject;subSubject='all';root.querySelectorAll('[data-subject]').forEach(b=>b.setAttribute('aria-pressed',b===tab));renderSubSubjects();refresh()}
    const subTab=e.target.closest('[data-sub-subject]');if(subTab){subSubject=subTab.dataset.subSubject;root.querySelectorAll('[data-sub-subject]').forEach(b=>b.setAttribute('aria-pressed',b===subTab));refresh()}
    if(e.target.closest('[data-selected-only]')){selectedOnly=!selectedOnly;root.querySelector('[data-selected-only]').setAttribute('aria-pressed',selectedOnly);refresh()}
    if(e.target.closest('[data-select-visible]')){for(const i of boxes())if(!i.closest('.chapter-choice').hidden)i.checked=true;changed()}
    if(e.target.closest('[data-clear]')){boxes().forEach(i=>i.checked=false);changed()}
  });
  refresh();
  return { selected, refresh, setSelected(ids){const set=new Set(ids);boxes().forEach(i=>i.checked=set.has(i.value));refresh()}, reset(){subject='all';subSubject='all';selectedOnly=false;renderSubSubjects();root.querySelector('.picker-search').value='';root.querySelectorAll('[data-subject]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.subject==='all'));root.querySelector('[data-selected-only]').setAttribute('aria-pressed',false);boxes().forEach(i=>i.checked=false);refresh()} };
}
