import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence, onAuthStateChanged, signInAnonymously, linkWithCredential, EmailAuthProvider, signInWithEmailAndPassword, signOut, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, runTransaction, serverTimestamp, onSnapshot, connectFirestoreEmulator } from 'firebase/firestore';
import { nameParts, credentialsFor } from './identity.js';
import { S, ALL, BY, chapters } from './syllabus.js';
import { fresh, normalize } from './state.js';
import { createChapterPicker } from './chapter-picker.js';

const EXAM="2027-05-02";
const STEPS=["Studied","Revised","PYQs"];
const $=id=>document.getElementById(id);
const openT=new Set(),openL=new Set();
let pw=0,cm=new Date(new Date().getFullYear(),new Date().getMonth(),1),cs=null;
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let st=fresh(),query="",syllabusGroup="all",syllabusClass="all";
const pickers={};
let testToastTimer;
function dismissTestToast(){clearTimeout(testToastTimer);$('testtoast').hidden=true;$('testtoastmessage').textContent=''}
$('closetesttoast').onclick=dismissTestToast;

st=fresh();
function save(){persistProgress()}
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const today=()=>new Date(new Date().setHours(0,0,0,0));
const dleft=s=>Math.ceil((new Date(s+"T00:00:00")-today())/864e5);
const fmt=s=>new Date(s+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"});
const studied=id=>!!st.done[id+"|0"];
const ticks=id=>[0,1,2].filter(k=>st.done[id+"|"+k]).length;
const upcoming=()=>st.tests.filter(t=>dleft(t.date)>=0).sort((a,b)=>a.date.localeCompare(b.date));
const wsOf=dt=>{const x=new Date(dt);x.setDate(x.getDate()-((x.getDay()+6)%7));return iso(x)};
const wkISO=o=>{const d=new Date(weekStart()+"T00:00:00");d.setDate(d.getDate()+7*o);return iso(d)};
const chip=(id,k)=>`<span class="mute"> · ${S[BY[id].s].n}</span>`;
function weekStart(){const d=today();d.setDate(d.getDate()-((d.getDay()+6)%7));return iso(d)}
function sub(si){let d=0,t=0;chapters(si).forEach(c=>[0,1,2].forEach(k=>{t++;if(st.done[S[si].n+"|"+c+"|"+k])d++}));return[d,t]}
function render(){
  $("hide").checked=st.hide;
  let D=0,T=0;const pcts=S.map((_,i)=>{const[d,t]=sub(i);D+=d;T+=t;return Math.round(d/t*100)});
  const all=Math.round(D/T*100);
  $("pct").textContent=all+"%";$("fill").style.width=all+"%";
  const fin=ALL.filter(a=>ticks(a.id)==3).length;
  $("cnt").textContent=`${fin} of ${ALL.length} chapters fully done`;
  $("days").textContent=Math.max(0,dleft(EXAM));
  document.querySelectorAll(".nav button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v==st.view));
  $("syl").hidden=st.view!="syl";$("plan").hidden=st.view!="plan";$("cal").hidden=st.view!="cal";$("todo").hidden=st.view!="todo";
  renderShell();
  $("dash").hidden=st.view!=="dash";
  if(st.view==="dash")renderDashboard();else if(st.view=="syl")renderSyl(pcts);else if(st.view=="plan")renderPlan();else if(st.view=="cal")renderCal();else renderTodo();
}
function lecRow(id){
  const L=st.lec[id]||{n:0,d:[]},op=openL.has(id);
  return `<div class="lec"><button class="btn" data-lt="${id}">${L.n?`Lectures ${L.d.length}/${L.n}`:"Add lectures"} ${op?"&#9652;":"&#9662;"}</button>${op?`<span class="mute" style="font-size:13px">Total</span><input class="num" type="number" min="0" max="60" value="${L.n}" data-ln="${id}" aria-label="Total lectures">${Array.from({length:L.n},(_,i)=>`<button class="chip" aria-pressed="${L.d.includes(i+1)}" data-ld="${id}|${i+1}">Lec ${i+1}</button>`).join("")}`:""}</div>`;
}
function renderSyl(pcts){
  $("tabs").innerHTML=S.map((s,i)=>`<button class="tab" role="tab" style="--c:${s.c}" aria-selected="${i==st.tab}" data-t="${i}"><b>${s.n}</b><span>${pcts[i]}%</span></button>`).join("");
  const s=S[st.tab],ut=upcoming();let h="";
  const groups=Object.keys(s.g);if(!groups.includes(syllabusGroup))syllabusGroup='all';
  $('groups').hidden=st.tab!==1;
  document.querySelectorAll('[data-syllabus-class]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.syllabusClass===syllabusClass));
  $('groups').innerHTML=['all',...groups].map(g=>`<button type="button" data-syllabus-group="${g}" aria-pressed="${g===syllabusGroup}">${g==='all'?'All chapters':g}</button>`).join('');
  for(const[g,list]of Object.entries(s.g)){
    if(syllabusGroup!=='all'&&g!==syllabusGroup)continue;
    let rows="";
    list.forEach(c=>{
      const id=s.n+"|"+c,full=ticks(id)==3,isDone=studied(id);
      if(syllabusClass!=='all'&&!BY[id].classes.includes(syllabusClass))return;
      if(st.hide&&full)return;
      if(query&&!c.toLowerCase().includes(query))return;
      const t=ut.find(t=>t.ch.includes(id));
      let dueHtml="";
      if(!isDone){
        const dd=st.due&&st.due[id];
        if(dd){
          const dl=dleft(dd),ov=dl<0;
          dueHtml=`<span class="tag ${ov?'bad':'good'}" style="font-size:11px" title="Target completion date">🎯 ${fmt(dd)}${ov?' (overdue)':''}</span><button class="btn" type="button" data-setdue="${id}" title="Edit target date" style="padding:2px 7px;font-size:11px">✎</button>`;
        }else{
          dueHtml=`<span class="tag bad" style="font-size:10px" title="No target date assigned">Missing target date</span><button class="btn" type="button" data-setdue="${id}" style="padding:2px 8px;font-size:11px">+ Target date</button>`;
        }
      }
      rows+=`<div class="ch${full?" full":""}" style="--c:${s.c}"><span class="nm">${c}${dueHtml?`<span class="due-slot">${dueHtml}</span>`:""}${t&&!full?`<small>${esc(t.name)} on ${fmt(t.date)}</small>`:""}</span><span class="chips">${STEPS.map((l,k)=>`<button class="chip" aria-pressed="${!!st.done[id+"|"+k]}" data-k="${id}|${k}">${l}</button>`).join("")}</span>${lecRow(id)}<div class="bar mini"><i style="width:${ticks(id)*100/3}%"></i></div></div>`;
    });
    if(rows)h+=`<div class="grp">${g}</div><div class="${st.grid?"cg":""}">${rows}</div>`;
  }
  $("list").innerHTML=h||`<div class="empty">${query?"No chapters match your search.":"Every chapter in "+s.n+" is finished. Nice work."}</div>`;
  $("gv").textContent=st.grid?"≡ List view":"⊞ Grid view";
  const[d,t]=sub(st.tab);$("subline").textContent=`${s.n}: ${d} of ${t} ticks`;
}
function listStudied(a,d){
  return a.length?a.map(id=>`<div class="f" style="--c:${S[BY[id].s].c}"><i></i><span>${BY[id].c}${chip(id)}</span><span class="tag good" style="flex:none">Studied</span><button class="btn" data-unmarkdone="${d}|${id}">Undo</button></div>`).join(""):`<div class="mute">Nothing yet.</div>`;
}
function dlist(a,d){
  const old=d<iso(today());
  const pending=a.filter(id=>!(st.dayDone[d]||[]).includes(id));
  return pending.length?pending.map(id=>`<div class="f" style="--c:${S[BY[id].s].c}"><i></i><span>${BY[id].c}${chip(id)}</span>${old?`<span class="tag bad" style="flex:none">Missed</span><button class="btn" data-mv="${d}|${id}">Move to today</button>`:""}<button class="btn" data-markdone="${d}|${id}">Mark studied</button><button class="btn" data-rmd="${d}|${id}" aria-label="Remove">&times;</button></div>`).join(""):`<div class="mute">${a.length?"All planned chapters studied! ♡":"Nothing planned."}</div>`;
}
function renderPlan(){
  const tk=iso(today()),todayStudied=st.dayDone[tk]||[],carry=Object.keys(st.day).filter(d=>d<tk).sort().map(d=>[d,st.day[d].filter(id=>!(st.dayDone[d]||[]).includes(id))]).filter(x=>x[1].length);
  $("todayp").innerHTML=`<div class="card"><h2>Today, ${fmt(tk)}</h2>${dlist(st.day[tk]||[],tk)}${todayStudied.length?`<div class="grp" style="margin-top:14px">Studied today</div>${listStudied(todayStudied,tk)}`:""}${carry.map(([d,l])=>`<div class="grp">Not finished from ${fmt(d)}</div>${dlist(l,d)}`).join("")}<p class="mute" style="margin:10px 0 0;font-size:13px">Plan chapters for any day in the Calendar tab.</p></div>`;
  const ws=weekStart(),ms=iso(today()).slice(0,7);
  const wd=new Set(Object.keys(st.dayDone||{}).filter(d=>d>=ws).flatMap(d=>st.dayDone[d]||[])).size;
  const md=new Set(Object.keys(st.dayDone||{}).filter(d=>d.startsWith(ms)).flatMap(d=>st.dayDone[d]||[])).size;
  const pend=ALL.filter(a=>!studied(a.id)),wl=Math.max(1,Math.ceil(dleft(EXAM)/7));
  const need=Math.ceil(pend.length/wl);
  const bar=(d,t)=>`<div class="bar"><i style="width:${Math.min(100,Math.round(d/Math.max(1,t)*100))}%"></i></div>`;
  $("targets").innerHTML=`<div class="card"><h2>Chapter targets</h2>
  <div class="row"><span>This week <b>${wd}</b> of <input class="num" type="number" min="0" id="wk" value="${st.wk}" aria-label="Weekly target"> chapters</span><span class="mute">Mon to Sun</span></div>${bar(wd,st.wk)}
  <div class="row" style="margin-top:14px"><span>This month <b>${md}</b> of <input class="num" type="number" min="0" id="mo" value="${st.mo}" aria-label="Monthly target"> chapters</span></div>${bar(md,st.mo)}
  <p class="mute" style="margin:12px 0 0">${pend.length} chapters left to study with ${wl} weeks to NEET. To finish studying by exam day you need about <b>${need} a week</b>${need>st.wk?", more than your current target":""}.</p></div>`;
  const wk=wkISO(pw),pl=st.plan[wk]||[],pd2=pl.filter(studied).length;
  $("wkplan").innerHTML=`<div class="card"><div class="row"><button class="btn" data-wk="-1" aria-label="Previous week">&lsaquo; Prev</button><b>${pw==0?"This week":"Week of "+fmt(wk)}${pw==0?` (from ${fmt(wk)})`:""}</b><button class="btn" data-wk="1" aria-label="Next week">Next &rsaquo;</button></div>
  <p class="mute" style="margin:8px 0 0">${pl.length?`${pd2} of ${pl.length} chosen chapters studied`:"No chapters chosen for this week yet."}</p>${pl.length?bar(pd2,pl.length):""}
  ${pl.map(id=>`<div class="f" style="--c:${S[BY[id].s].c}"><i></i><span>${BY[id].c}${chip(id)}</span>${studied(id)?`<span class="tag good" style="flex:none">Studied</span>`:`<button class="btn" data-k="${id}|0">Mark studied</button>`}<button class="btn" data-rm="${id}" aria-label="Remove">&times;</button></div>`).join("")}</div>`;
  pickers.wpick.setSelected(pl);
  const seen=new Set(),fl=[];
  upcoming().forEach(t=>t.ch.forEach(id=>{if(!studied(id)&&!seen.has(id)){seen.add(id);fl.push(id)}}));
  ALL.forEach(a=>{if(!studied(a.id)&&!seen.has(a.id)){seen.add(a.id);fl.push(a.id)}});
  const top=fl.slice(0,Math.max(0,st.wk-wd));
  $("focus").innerHTML=`<div class="card"><h2>Suggested next</h2><div class="mute" style="margin-bottom:6px">Chapters for upcoming tests come first, then syllabus order.</div>${top.length?top.map(id=>`<div class="f" style="--c:${S[BY[id].s].c}"><i></i><span>${BY[id].c}<span class="mute"> · ${S[BY[id].s].n}</span></span><button class="btn" data-k="${id}|0">Mark studied</button><button class="btn" data-add="${id}">+ Plan</button></div>`).join(""):`<div class="empty">Weekly target met. Rest or revise.</div>`}</div>`;
  const ut=upcoming();
  $("tests").innerHTML=ut.length?ut.map(t=>{
    const d=dleft(t.date),w=Math.max(1,Math.ceil(d/7)),ck=t.chk||{},pd=t.ch.filter(id=>!ck[id]),
    ready=Math.round((t.ch.length-pd.length)/Math.max(1,t.ch.length)*100),nw=Math.ceil(pd.length/w);
    return `<div class="card"><div class="row"><b>${esc(t.name)}</b><span class="mute">${fmt(t.date)} · ${d} days</span></div>
    <div class="row mute" style="margin-top:4px"><span>${t.ch.length} chapters · ${ready}% ready</span><span class="tag ${pd.length?(nw>st.wk?"bad":""):"good"}">${pd.length?`${pd.length} ${pd.length===1?'chapter':'chapters'} left · Aim for ${nw} ${nw===1?'chapter':'chapters'} per week`:"All chapters ready"}</span></div>${bar(ready,100)}
    <details data-ot="${t.id}" ${openT.has(t.id)?"open":""}><summary>Test checklist (${t.ch.length-pd.length} of ${t.ch.length} ready)</summary>${t.ch.map(id=>`<label class="f" style="--c:${S[BY[id].s].c};cursor:pointer"><i></i><input type="checkbox" data-tc="${t.id}|${id.replace(/"/g,"&quot;")}" ${ck[id]?"checked":""}><span>${BY[id].c}${chip(id)}</span><span class="mute" style="font-size:12px;flex:none">tracker ${ticks(id)}/3</span></label>`).join("")}</details>
    <div style="margin-top:8px"><button class="btn" data-del="${t.id}">Delete test</button></div></div>`}).join(""):`<div class="card empty">No upcoming tests. Add one below to match its syllabus with your plan.</div>`;
}
function renderCal(){
  const y=cm.getFullYear(),m=cm.getMonth(),off=(new Date(y,m,1).getDay()+6)%7,n=new Date(y,m+1,0).getDate(),tk=iso(today());
  if(!cs)cs=tk;
  let c=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>`<div class="h">${d}</div>`).join("")+"<div></div>".repeat(off);
  for(let d=1;d<=n;d++){
    const dt=new Date(y,m,d),k=iso(dt),pn=(st.plan[wsOf(dt)]||[]).length,tn=st.tests.filter(t=>t.date==k).length,sn=(st.dayDone[k]||[]).length,dn=(st.day[k]||[]).length;
    const dueChs=Object.keys(st.due||{}).filter(id=>st.due[id]===k&&Object.hasOwn(BY,id));
    const un=dueChs.length;
    c+=`<button class="cd${pn?" pl":""}${k==tk?" td":""}${k==EXAM?" ex":""}${k==cs?" sel":""}" data-cd="${k}"><b>${d}</b>${k==EXAM?'<span class="m e">NEET</span>':""}${tn?`<span class="m t">Test${tn>1?" "+tn:""}</span>`:""}${un?`<span class="m tg" title="${un} target completion date${un>1?'s':''}">🎯${un}</span>`:""}${sn?`<span class="m s">&#10003;${sn}</span>`:""}${(st.day[k]||[]).slice(0,2).map(id=>`<span class="calendar-chapter">${esc(BY[id].c)}</span>`).join("")}${dn>2?`<span class="mute">+${dn-2} more</span>`:""}${pn&&dt.getDay()==1?`<span class="m p">P${pn}</span>`:""}</button>`;
  }
  const dd=new Date(cs+"T00:00:00"),ts=st.tests.filter(t=>t.date==cs),sd=st.dayDone[cs]||[],wp=st.plan[wsOf(dd)]||[];
  const dp=st.day[cs]||[];
  const dueForDay=Object.keys(st.due||{}).filter(id=>st.due[id]===cs&&Object.hasOwn(BY,id));
  pickers.dpick.setSelected(dp);
  $("dsum").textContent="Choose chapters for "+fmt(cs);
  const list=a=>a.length?a.map(id=>`<div class="f" style="--c:${S[BY[id].s].c}"><i></i><span>${BY[id].c}${chip(id)}</span></div>`).join(""):`<div class="mute">Nothing yet.</div>`;
  const listDue=a=>a.length?a.map(id=>{
    const isDone=studied(id);
    return `<div class="f" style="--c:${S[BY[id].s].c}"><i></i><span>${BY[id].c}${chip(id)}</span>${isDone?`<span class="tag good" style="flex:none">Studied</span>`:`<span class="tag ${dleft(cs)<0?'bad':'good'}" style="flex:none">${dleft(cs)<0?'Overdue':'Target'}</span><button class="btn" data-k="${id}|0" style="font-size:11px;padding:3px 8px">Mark studied</button>`}<button class="btn" data-setdue="${id}" title="Edit target date" style="font-size:11px;padding:3px 8px">✎</button></div>`;
  }).join(""):`<div class="mute">Nothing yet.</div>`;
  $("calmain").innerHTML=`<div class="card"><div class="row" style="margin-bottom:10px"><button class="btn" data-cm="-1">&lsaquo; Prev</button><b>${cm.toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</b><button class="btn" data-cm="1">Next &rsaquo;</button></div>
  <div class="cal">${c}</div><p class="mute" style="margin:10px 0 0;font-size:12px">Orange D = chapters planned for that day. Blue tint and P = planned for that week. &#10003; = chapters studied that day. 🎯 = target completion due date. Tap a day for details.</p></div>
  <div class="card"><h2>${dd.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</h2>
  ${cs==EXAM?'<p><b>NEET 2027 exam day.</b></p>':dleft(cs)>=0?`<p class="mute">${dleft(cs)} days from today</p>`:""}
  ${ts.map(t=>`<div class="grp" style="margin-top:4px">Test: ${esc(t.name)}</div>${list(t.ch)}`).join("")}
  ${dueForDay.length?`<div class="grp" style="margin-top:4px">🎯 Target completion dates (${dueForDay.length})</div>${listDue(dueForDay)}`:""}
  <div class="grp">Planned for this day</div>${dlist(dp,cs)}
  <div class="grp">Studied this day</div>${listStudied(sd,cs)}
  <div class="grp">Planned for this week</div>${list(wp)}</div>`;
}
let activeDueId=null;
function renderTodo(){
  const tk=iso(today()),planned=st.day[tk]||[],studiedToday=st.dayDone[tk]||[];
  const total=new Set([...planned,...studiedToday]).size,done=studiedToday.length;
  const pct=total?Math.min(100,Math.round(done/total*100)):0;
  const customTodos=st.todos||[],customDone=customTodos.filter(t=>t.done).length;
  $("todomain").innerHTML=`
    <div class="card">
      <div class="row"><div><h2>Today’s chapter targets</h2><div class="mute">${fmt(tk)} · Daily focus</div></div><div style="text-align:right"><b>${done} of ${total}</b><div class="mute" style="font-size:12px">${pct}% complete</div></div></div>
      <div class="bar" style="margin:10px 0 16px"><i style="width:${pct}%"></i></div>
      <div class="grp">Planned for today</div>${dlist(planned,tk)}
      <div class="grp" style="margin-top:16px">Studied today</div>${listStudied(studiedToday,tk)}
    </div>
    <div class="card">
      <div class="row"><h2>Daily to-do tasks</h2><span class="mute" style="font-size:12px">${customDone} of ${customTodos.length} tasks done</span></div>
      <form id="customtodoform" style="display:flex;gap:8px;margin:12px 0 16px"><input type="text" id="customtodotext" placeholder="Add a custom task (e.g. solve 40 MCQs, revise notes…)" style="flex:1" required maxlength="180"><button class="btn p" type="submit">+ Add task</button></form>
      ${customTodos.length?customTodos.map(t=>`<div class="f"><label style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer"><input type="checkbox" data-todotoggle="${t.id}" ${t.done?"checked":""}><span style="${t.done?'text-decoration:line-through;opacity:.6':''}">${esc(t.text)}</span></label><button class="btn" data-tododel="${t.id}" aria-label="Delete">&times;</button></div>`).join(""):`<div class="mute">No custom tasks yet. Add one above!</div>`}
    </div>`;
  if(pickers.tpick){pickers.tpick.setSelected(planned);$("tsum").textContent="Add chapters to today’s study plan ("+fmt(tk)+")"}
}
function buildPicker(){
  pickers.wpick=createChapterPicker($('wpick'),'Plan your week');
  pickers.picker=createChapterPicker($('picker'),'Build your test syllabus');
  pickers.dpick=createChapterPicker($('dpick'),'Plan your day');
  pickers.tpick=createChapterPicker($('tpick'),'Plan today’s chapters');
}
document.addEventListener('chapterselection',e=>{
  const id=e.target.id,ids=e.detail.ids;
  if(id==='wpick'){st.plan[wkISO(pw)]=ids;save();render()}
  if(id==='dpick'){st.day[cs]=ids;save();render()}
  if(id==='tpick'){st.day[iso(today())]=ids;save();render()}
  if(id==='picker')$('pc').textContent=ids.length;
});
document.addEventListener("click",e=>{
  const classFilter=e.target.closest('[data-syllabus-class]');if(classFilter){syllabusClass=classFilter.dataset.syllabusClass;render()}
  const group=e.target.closest('[data-syllabus-group]');if(group){syllabusGroup=group.dataset.syllabusGroup;render()}
  const c=e.target.closest("[data-k]"),t=e.target.closest(".tab"),n=e.target.closest("[data-v]"),d=e.target.closest("[data-del]");
  if(c){const k=c.dataset.k;st.done[k]=!st.done[k];save();render()}
  const md=e.target.closest("[data-markdone]"),umd=e.target.closest("[data-unmarkdone]");
  if(md){const v=md.dataset.markdone,i=v.indexOf("|"),date=v.slice(0,i),id=v.slice(i+1);st.dayDone[date]=[...new Set([...(st.dayDone[date]||[]),id])];save();render()}
  if(umd){const v=umd.dataset.unmarkdone,i=v.indexOf("|"),date=v.slice(0,i),id=v.slice(i+1);st.dayDone[date]=(st.dayDone[date]||[]).filter(x=>x!=id);save();render()}
  const sdue=e.target.closest("[data-setdue]");
  if(sdue){activeDueId=sdue.dataset.setdue;$("duename").textContent=BY[activeDueId].c+" · "+S[BY[activeDueId].s].n;$("dueinput").value=st.due[activeDueId]||iso(today());$("duedialog").showModal();return}
  const tdt=e.target.closest("[data-todotoggle]");
  if(tdt){const item=(st.todos||[]).find(x=>x.id===tdt.dataset.todotoggle);if(item){item.done=!item.done;save();render();}return}
  const tdd=e.target.closest("[data-tododel]");
  if(tdd){st.todos=(st.todos||[]).filter(x=>x.id!==tdd.dataset.tododel);save();render();return}
  const a=e.target.closest("[data-add]"),r=e.target.closest("[data-rm]"),w=e.target.closest("[data-wk]"),cmb=e.target.closest("[data-cm]"),cd=e.target.closest("[data-cd]");
  if(a){const k=wkISO(0);st.plan[k]=[...new Set([...(st.plan[k]||[]),a.dataset.add])];save();render()}
  if(r){const k=wkISO(pw);st.plan[k]=(st.plan[k]||[]).filter(x=>x!=r.dataset.rm);save();render()}
  if(w){pw+=+w.dataset.wk;render()}
  if(cmb){cm=new Date(cm.getFullYear(),cm.getMonth()+ +cmb.dataset.cm,1);render()}
  if(cd){cs=cd.dataset.cd;render()}
  const lt_=e.target.closest("[data-lt]"),ld_=e.target.closest("[data-ld]");
  if(lt_){const id=lt_.dataset.lt;openL.has(id)?openL.delete(id):openL.add(id);render()}
  if(ld_){const v=ld_.dataset.ld,i=v.lastIndexOf("|"),id=v.slice(0,i),n=+v.slice(i+1),L=st.lec[id]=st.lec[id]||{n:0,d:[]};L.d=L.d.includes(n)?L.d.filter(x=>x!=n):[...L.d,n];save();render()}
  const rd=e.target.closest("[data-rmd]"),mv=e.target.closest("[data-mv]");
  if(rd){const v=rd.dataset.rmd,d=v.slice(0,10),id=v.slice(11);st.day[d]=(st.day[d]||[]).filter(x=>x!=id);save();render()}
  if(mv){const v=mv.dataset.mv,d=v.slice(0,10),id=v.slice(11),k=iso(today());st.day[d]=(st.day[d]||[]).filter(x=>x!=id);st.day[k]=[...new Set([...(st.day[k]||[]),id])];save();render()}
  if(t){st.tab=+t.dataset.t;syllabusGroup="all";save();render()}
  if(n){st.view=n.dataset.v;save();render()}
  if(d&&confirm("Delete this test?")){st.tests=st.tests.filter(x=>x.id!=d.dataset.del);save();render()}
});
$("dueform").onsubmit=e=>{e.preventDefault();if(activeDueId){st.due=st.due||{};st.due[activeDueId]=$("dueinput").value;save();render();$("duedialog").close();}};
$("cleardue").onclick=()=>{if(activeDueId){if(st.due)delete st.due[activeDueId];save();render();$("duedialog").close();}};
document.addEventListener("submit",e=>{
  if(e.target.id==="customtodoform"){
    e.preventDefault();
    const input=$("customtodotext"),val=input?input.value.trim().slice(0,180):"";
    if(!val)return;
    st.todos=st.todos||[];
    st.todos.push({id:String(Date.now()),text:val,done:false});
    save();render();
  }
});
document.addEventListener("toggle",e=>{const id=e.target.dataset&&e.target.dataset.ot;if(id){e.target.open?openT.add(id):openT.delete(id)}},true);
document.addEventListener("change",e=>{
  if(e.target.id=="wk"||e.target.id=="mo"){st[e.target.id]=Math.max(0,+e.target.value||0);save();render()}
  if(e.target.dataset.ln){const id=e.target.dataset.ln,n=Math.max(0,Math.min(60,Math.floor(+e.target.value||0))),L=st.lec[id]=st.lec[id]||{n:0,d:[]};L.n=n;L.d=L.d.filter(x=>x<=n);save();render()}
  if(e.target.dataset.tc){const v=e.target.dataset.tc,i=v.indexOf("|"),t=st.tests.find(x=>x.id==v.slice(0,i));if(t){t.chk=t.chk||{};t.chk[v.slice(i+1)]=e.target.checked;save();render()}}
});
$("addt").onclick=()=>{
  const name=$("tn").value.trim().slice(0,160),date=$("td").value,ch=pickers.picker.selected();
  if(!name||!date||!ch.length){alert("Add a test name, a date and at least one chapter.");return}
  st.tests.push({id:String(Date.now()),name,date,ch});save();
  $("tn").value="";$("td").value="";pickers.picker.reset();$("pc").textContent=0;render();
  $('testsyllabus').open=false;$('testmaker').open=false;
  $('testmakersummary').focus();
  clearTimeout(testToastTimer);$('testtoast').hidden=false;
  $('testtoastmessage').textContent='Test added';
  testToastTimer=setTimeout(dismissTestToast,5000);
};
$("gv").onclick=()=>{st.grid=!st.grid;save();render()};
$("hide").checked=st.hide;$("hide").onchange=()=>{st.hide=$("hide").checked;save();render()};
if($("reset"))$("reset").onclick=()=>{if(confirm("Clear progress and tests for the current account? Other accounts are unaffected. This cannot be undone.")){st.done={};st.dates={};st.tests=[];st.plan={};st.day={};st.dayDone={};st.due={};st.todos=[];st.lec=fresh().lec;st.legacyProgress={};save();render()}};
buildPicker();render();
// Paste your PUBLIC Firebase web config here before sharing/hosting this file.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDBWFow5KxXw8jqm1lPT1aZRK0Go7YPqkc",
  authDomain: "brainstormx-bddc1.firebaseapp.com",
  projectId: "brainstormx-bddc1",
  storageBucket: "brainstormx-bddc1.firebasestorage.app",
  messagingSenderId: "594654782733",
  appId: "1:594654782733:web:5f1812e36df2943cc7fc44",
  measurementId: "G-2J55MW208Y"
};
let sdk=null,auth=null,db=null,user=null,ready=true,dirty=false,saving=false,version=0,saveTimer=null,unsubscribe=null;
let editRevision=0,authGeneration=0,conflict=false;
function status(message,error=false){$('loginconnection').textContent=auth?'':message;$('syncmsg').textContent=message;$('statusbar').classList.toggle('error',error);$('retry').hidden=!(dirty&&!saving);$('cloudreload').hidden=!(user&&(!ready||conflict));}
function lock(value){$('workspace').inert=value;$('workspace').style.opacity=value?'.45':'';if($('reset'))$('reset').disabled=value;}
function persistProgress(){
  if(!user||user.isAnonymous)return
  if(!ready)return;
  dirty=true;editRevision++;status('Changes waiting to sync…');clearTimeout(saveTimer);saveTimer=setTimeout(pushCloud,700);
}
async function pushCloud(){
  if(!user||!ready||!dirty||saving||conflict)return;
  saving=true;const uid=user.uid,generation=authGeneration,revision=editRevision,payload=JSON.parse(JSON.stringify(st)),expected=version;
  status('Saving to your account…');
  try{
    const ref=sdk.doc(db,'trackers',uid);
    await sdk.runTransaction(db,async tx=>{const snap=await tx.get(ref),current=snap.exists()?snap.data().version:0;
      if(current!==expected)throw Error('SYNC_CONFLICT');
      tx.set(ref,{state:payload,version:expected+1,updatedAt:sdk.serverTimestamp()});});
    if(generation!==authGeneration)return;
    version=expected+1;dirty=revision!==editRevision;status(dirty?'Saving latest changes…':'Saved to your account · synced across devices');
  }catch(e){if(generation!==authGeneration)return;conflict=e.message==='SYNC_CONFLICT';status(conflict?'Another device changed your progress. Load the cloud version before making more changes.':'Cloud save failed. Keep this tab open and retry. '+friendly(e),true)}
  finally{saving=false;$('retry').hidden=!dirty;if(dirty&&!conflict&&editRevision!==revision)saveTimer=setTimeout(pushCloud,700);}
}
function friendly(e){
  const messages={'auth/invalid-credential':'Your study ID is incorrect.','auth/user-not-found':'Your study ID is incorrect.','auth/wrong-password':'Your study ID is incorrect.','auth/email-already-in-use':'This ID is already used. Sign in, or start a new account.','auth/credential-already-in-use':'This ID is already used. Start a new account to receive the next number.','auth/network-request-failed':'Check your internet connection and try again.','auth/too-many-requests':'Too many attempts. Wait a little before trying again.','auth/operation-not-allowed':'Account creation is not available yet. Please try again later.','permission-denied':'Your account could not be saved. Please try again later.'};
  return messages[e.code]||e.userMessage||'Something went wrong. Please try again.';
}
function clearTransient(){dismissTestToast();$('testmaker').open=false;$('testsyllabus').open=false;openT.clear();openL.clear();pw=0;cs=null;query='';syllabusGroup='all';syllabusClass='all';Object.values(pickers).forEach(p=>p.reset());$('search').value='';$('tn').value='';$('td').value='';$('pc').textContent='0';pickers.picker.reset();}
async function loadCloud(){
  const generation=authGeneration;if(!user)return;
  ready=false;lock(true);status('Loading your saved progress…');
  try{const snap=await sdk.getDocFromServer(sdk.doc(db,'trackers',user.uid));if(generation!==authGeneration)return;
    st=snap.exists()?normalize(snap.data().state):fresh();version=snap.exists()?snap.data().version:0;
    dirty=false;conflict=false;ready=true;clearTransient();render();lock(false);status('Saved to your account · synced across devices');
  }catch(e){if(generation===authGeneration)status('Could not load your account. '+friendly(e),true)}
}
function showLoading(show,title='Welcome back ♡',message='Getting your study space ready…'){
  const el=$('loadingscreen');if(!el)return;
  if(show){$('loadingtitle').textContent=title;$('loadingstatus').textContent=message;el.removeAttribute('hidden');void el.offsetHeight;el.classList.add('is-active');}
  else{el.classList.remove('is-active');setTimeout(()=>{if(!el.classList.contains('is-active'))el.setAttribute('hidden','')},260);}
}
async function accountChanged(next){
  if(authBusy||createdUser)return;
  authGeneration++;const generation=authGeneration;clearTimeout(saveTimer);unsubscribe?.();unsubscribe=null;user=next;dirty=false;conflict=false;version=0;ready=false;st=fresh();clearTransient();render();
  $('account').textContent='My account';$('signedin').hidden=false;$('accessid').value='';
  if(!next||next.isAnonymous){showLoginPage(true);showLoading(false);$('signin').classList.remove('is-loading');lock(true);status('');authControls(false);return;}
  showLoading(true,'Opening your study space ♡','Loading your chapters and tests…');
  showLoginPage(false);lock(true);
  try{const profile=await sdk.getDocFromServer(sdk.doc(db,'profiles',next.uid));if(generation!==authGeneration){showLoading(false);return;}
    const p=profile.exists()?profile.data():{};$('accountemail').textContent=(p.name||'Your account')+(p.id?' · '+p.id:'');$('greeting').textContent=p.name?'You’ve got this, '+p.name+'.':'Small steps. A stronger tomorrow.';
    if(p.name)$('loadingtitle').textContent='Welcome, '+p.name+' ♡';
  }catch{$('accountemail').textContent='Your study account'}
  await loadCloud();
  showLoading(false);$('signin').classList.remove('is-loading');
  if(generation!==authGeneration||!user)return;
  unsubscribe=sdk.onSnapshot(sdk.doc(db,'trackers',user.uid),snap=>{
    if(generation!==authGeneration||!ready||dirty||saving||snap.metadata.hasPendingWrites||!snap.exists())return;
    if(snap.data().version>version){try{st=normalize(snap.data().state);version=snap.data().version;render();status('Updated from another device')}catch{status('Saved progress could not be read. Please retry.',true)}}
  },()=>status('Live updates disconnected. Check your connection.',true));
}
async function connectFirebase(config){
  sdk={initializeApp,getAuth,setPersistence,browserSessionPersistence,onAuthStateChanged,signInAnonymously,linkWithCredential,EmailAuthProvider,signInWithEmailAndPassword,signOut,getFirestore,doc,getDocFromServer,runTransaction,serverTimestamp,onSnapshot};
  const emulating=import.meta.env.DEV&&import.meta.env.VITE_USE_EMULATORS==='true';
  const app=sdk.initializeApp(emulating?{...config,projectId:'demo-neetxruchi',apiKey:'demo-key'}:config);auth=sdk.getAuth(app);db=sdk.getFirestore(app);
  if(emulating){connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080)}
  await sdk.setPersistence(auth,sdk.browserSessionPersistence);
  authControls(false);
  sdk.onAuthStateChanged(auth,accountChanged);
}
$('search').addEventListener('input',()=>{query=$('search').value.trim().toLowerCase();render()});
try{document.documentElement.dataset.theme=localStorage.getItem('neet-theme')||'dark'}catch{document.documentElement.dataset.theme='dark'}
$('theme').onclick=()=>{const v=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=v;try{localStorage.setItem('neet-theme',v)}catch{}};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('account').onclick=()=>{$('authmsg').textContent='';$('authdialog').showModal()};
let authBusy=false,creating=false,createdUser=null;
function authControls(busy){authBusy=busy;for(const id of ['signin','signup','signinmode','accessid','fullname'])$(id).disabled=busy||!auth;}
function mode(create){
  if(authBusy)return;creating=create;$('namefield').hidden=!create;$('idfield').hidden=create;
  $('fullname').required=create;$('accessid').required=!create;
  $('signin').textContent=create?'Create my account':'Sign in';
  $('signup').classList.toggle('p',create);$('signinmode').classList.toggle('p',!create);$('signup').setAttribute('aria-pressed',create);$('signinmode').setAttribute('aria-pressed',!create);$('authmsg').textContent='';
}
$('signup').onclick=()=>mode(true);$('signinmode').onclick=()=>mode(false);
async function reserveProfile(current,name){
  const {displayName,stem}=nameParts(name),profileRef=sdk.doc(db,'profiles',current.uid),counterRef=sdk.doc(db,'nameCounters',stem);
  return sdk.runTransaction(db,async tx=>{
    const profile=await tx.get(profileRef);if(profile.exists())return profile.data();
    const counter=await tx.get(counterRef),serial=(counter.exists()?counter.data().serial:0)+1;
    if(serial>999999999)throw {userMessage:'Please use another name.'};
    const result={name:displayName,stem,serial,id:'NEETX'+stem+String(serial).padStart(2,'0')};
    tx.set(counterRef,{serial,lastUid:current.uid});tx.set(profileRef,result);return result;
  });
}
async function authenticate(){
  if(authBusy||!auth||!$('authform').reportValidity())return;
  try{if(creating)nameParts($('fullname').value)}catch(e){$('authmsg').textContent=friendly(e);return}
  authControls(true);
  $('signin').classList.add('is-loading');
  showLoading(true,creating?'Creating your account…':'Signing in…',creating?'Setting up your personal study space ♡':'Connecting to your study space ♡');
  $('authmsg').textContent=creating?'Creating your study space…':'Signing in…';
  try{
    if(creating){
      const current=auth.currentUser?.isAnonymous?auth.currentUser:(await sdk.signInAnonymously(auth)).user;
      const profile=await reserveProfile(current,$('fullname').value);
      const credentials=credentialsFor(profile.id);
      const result=await sdk.linkWithCredential(current,sdk.EmailAuthProvider.credential(credentials.email,credentials.password));
      createdUser=result.user;$('newid').value=profile.id;$('newidpanel').hidden=false;
      for(const id of ['namefield','idfield','signin'])$(id).hidden=true;
      document.querySelector('.auth-tabs').hidden=true;
      $('authmsg').textContent='Welcome, '+profile.name+'! Save your ID before continuing.';
      showLoading(false);$('signin').classList.remove('is-loading');
    }else{
      const credentials=credentialsFor($('accessid').value);
      const result=await sdk.signInWithEmailAndPassword(auth,credentials.email,credentials.password);
      authControls(false);await accountChanged(result.user);$('authmsg').textContent='';
    }
  }catch(e){
    showLoading(false);$('signin').classList.remove('is-loading');
    $('authmsg').textContent=friendly(e);
    if(e.code==='auth/credential-already-in-use'||e.code==='auth/email-already-in-use')await sdk.signOut(auth);
  }
  finally{authControls(false);$('signin').classList.remove('is-loading');}
}
$('authform').onsubmit=e=>{e.preventDefault();authenticate()};
$('copyid').onclick=async()=>{try{await navigator.clipboard.writeText($('newid').value);$('authmsg').textContent='ID copied. Save it somewhere safe.'}catch{$('newid').select();$('authmsg').textContent='Select and copy your ID.'}};
function resetAuthForm(){
  $('newidpanel').hidden=true;$('newid').value='';$('signin').hidden=false;
  document.querySelector('.auth-tabs').hidden=false;
  mode(false);
}
$('entertracker').onclick=async()=>{if(!createdUser)return;showLoading(true,'Setting up your space ♡','Loading your syllabus and tracker…');const next=createdUser;createdUser=null;resetAuthForm();await accountChanged(next);};
$('signout').onclick=async()=>{
  if(saving){$('authmsg').textContent='Wait for the current save to finish, then sign out.';return}
  if(dirty){await pushCloud();if(dirty){$('authmsg').textContent='Progress is not saved. Retry saving before signing out.';return}}
  showLoading(true,'Signing out…','Safely closing your session…');
  try{resetAuthForm();await sdk.signOut(auth);$('authdialog').close()}catch(e){$('authmsg').textContent=friendly(e)}
  finally{showLoading(false);}
};
$('retry').onclick=()=>{if(conflict){status('Load the cloud version to resolve this conflict. Your unsaved changes will be discarded.',true);return}pushCloud()};
$('cloudreload').onclick=()=>{if(saving)return;if(dirty&&!confirm('Discard unsaved changes from this tab and load the cloud version?'))return;loadCloud()};
window.addEventListener('online',()=>{if(dirty)pushCloud()});
window.addEventListener('offline',()=>{if(user)status('You are offline. Keep this tab open until your changes finish saving.',true)});
window.addEventListener('beforeunload',e=>{if(dirty||saving){e.preventDefault();e.returnValue=''}});
const authMessageParent=$('authmsg').parentNode;
function showLoginPage(show){
  $('loginpage').hidden=!show;$('trackerpage').hidden=show;
  if(show){$('loginformslot').append($('authmsg'),$('authform'));$('authform').hidden=false;}
  else if(user){authMessageParent.insertBefore($('authmsg'),$('signedin'));}
}
authControls(true);
showLoading(true,'Welcome ♡','Getting your study space ready…');
showLoginPage(true);
connectFirebase(FIREBASE_CONFIG).catch(()=>{showLoading(false);$('loginconnection').textContent='Could not connect. Check your internet connection and reload.';authControls(true)});


function renderShell(){
 const titles={dash:['Your study space, at a glance.','Stay consistent. Every chapter brings you closer to NEET.'],syl:['One chapter closer.','Your syllabus, broken into small, achievable steps.'],plan:['A little planning. A lot of progress.','Set your targets, plan your week and prepare for every test.'],cal:['Plan your study calendar.','Schedule your chapters, stay consistent and make every day count.'],todo:['Stay on top of every task.','Break your goals into small steps and make consistent progress towards NEET.']};
 const [title,subtitle]=titles[st.view]||titles.dash;
 document.querySelector('.herohead h1').textContent=title;
 document.querySelector('.herohead .sub').textContent=subtitle;
 document.querySelector('.top').hidden=st.view!=='syl';
 document.querySelector('.hero-quote').hidden=st.view!=='dash';
}
function renderDashboard(){
 const tk=iso(today()),ws=weekStart(),month=tk.slice(0,7),completed=ALL.filter(a=>studied(a.id)).length;
 const weekEnd=new Date(ws+'T00:00:00');weekEnd.setDate(weekEnd.getDate()+6);
 const wd=new Set(Object.keys(st.dayDone).filter(d=>d>=ws&&d<=iso(weekEnd)).flatMap(d=>st.dayDone[d])).size;
 const md=new Set(Object.keys(st.dayDone).filter(d=>d.startsWith(month)).flatMap(d=>st.dayDone[d])).size;
 const percent=Math.round(completed/ALL.length*100),planned=st.day[tk]||[];
 const progress=(n,t)=>'<div class="bar"><i style="width:'+Math.min(100,n/Math.max(1,t)*100)+'%"></i></div>';
 const target=(name,n,t)=>'<section class="card target-card"><h2><span>▦</span> '+name+'</h2><p><b>'+n+' of '+t+'</b> chapters</p>'+progress(n,t)+'<div class="row"><span class="mute">Keep making progress</span><button class="btn" data-v="plan">Edit target</button></div></section>';
 $('dash').innerHTML='<div class="dashboard-stats"><section class="card overall-card"><div class="row"><h2>Overall Progress</h2><button class="text-button" data-v="syl">View details →</button></div><div class="overall-body"><div class="progress-ring" style="--progress:'+percent+'%"><strong>'+percent+'%</strong></div><div><p><b>'+completed+' of '+ALL.length+'</b> chapters studied</p>'+progress(completed,ALL.length)+'<div class="progress-numbers"><span><b>'+ALL.length+'</b>Total chapters</span><span><b>'+completed+'</b>Studied</span><span><b>'+(ALL.length-completed)+'</b>Remaining</span></div></div></div></section>'+target('This Month',md,st.mo)+target('This Week',wd,st.wk)+'</div><div class="dashboard-middle"><div><section class="card"><div class="row"><div><h2>Today’s Plan</h2><p class="mute">'+today().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short',year:'numeric'})+'</p></div><button class="btn p" data-v="cal">＋ Add chapter</button></div>'+dlist(planned,tk)+(st.dayDone[tk]?.length?listStudied(st.dayDone[tk],tk):'')+'</section><section class="card"><h2>Weekly Overview <small class="mute">(from '+fmt(ws)+')</small></h2><p class="mute">'+wd+' / '+st.wk+' chapters completed</p>'+progress(wd,st.wk)+'<div class="week-strip">'+Array.from({length:7},(_,i)=>{const d=new Date(ws+'T00:00:00');d.setDate(d.getDate()+i);const k=iso(d);return '<button data-jump-day="'+k+'" class="'+(k===tk?'active':'')+'"><span>'+d.toLocaleDateString('en',{weekday:'short'})+'</span><b>'+d.getDate()+'</b><small>'+(st.day[k]||[]).length+' planned</small></button>'}).join('')+'</div></section></div><section class="card"><div class="row"><h2>Upcoming tests</h2><button class="text-button" data-v="plan">View all →</button></div>'+ (upcoming().slice(0,3).map(t=>'<div class="deadline"><div class="date-badge">'+new Date(t.date+'T00:00:00').getDate()+'<small>'+new Date(t.date+'T00:00:00').toLocaleDateString('en',{month:'short'})+'</small></div><div><b>'+esc(t.name)+'</b><p class="mute">'+t.ch.length+' chapters · '+dleft(t.date)+' days to prepare</p></div></div>').join('')||'<div class="empty">A clear schedule, a fresh start.<br>Add your next test to prepare with purpose.</div>')+'<button class="btn" data-v="plan">＋ Plan a test</button><div class="quiet-note">✧<p>Progress starts with showing up.<br>You’ve got this.</p></div></section></div><section class="card"><div class="row"><div><h2>Recommended Next</h2><p class="mute">A little momentum for your next study session</p></div><button class="text-button" data-v="syl">Browse syllabus →</button></div><div class="recommendations">'+ALL.filter(a=>!studied(a.id)).slice(0,4).map(a=>'<article><span class="book-icon">♧</span><div><b>'+esc(a.c)+'</b><p class="mute">'+S[a.s].n+'</p></div><button class="btn" data-add="'+esc(a.id)+'">'+((st.plan[ws]||[]).includes(a.id)?'✓ Planned':'+ Plan')+'</button></article>').join('')+'</div></section>';
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-jump-day]');if(b){cs=b.dataset.jumpDay;cm=new Date(cs.slice(0,7)+'-01T00:00:00');st.view='cal';save();render();}});
$('global-search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();if(query){const match=ALL.find(a=>a.c.toLowerCase().includes(query));if(match)st.tab=match.s;st.view='syl';$('search').value=e.target.value;render();}else{$('search').value='';render();}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('global-search').focus();}});
