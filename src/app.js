import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence, onAuthStateChanged, signInAnonymously, linkWithCredential, EmailAuthProvider, signInWithEmailAndPassword, signOut, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, runTransaction, serverTimestamp, onSnapshot, connectFirestoreEmulator } from 'firebase/firestore';
import { nameParts, credentialsFor } from './identity.js';

const EXAM="2027-05-02";
const S=[
{n:"Physics",c:"var(--phy)",g:{"Class 11":["Units & Measurements","Kinematics","Laws of Motion","Work, Energy & Power","Rotational Motion","Gravitation","Properties of Solids & Liquids","Thermodynamics","Kinetic Theory of Gases","Oscillations & Waves"],"Class 12":["Electrostatics","Current Electricity","Magnetic Effects of Current & Magnetism","EMI & Alternating Current","Electromagnetic Waves","Ray & Wave Optics","Dual Nature of Matter & Radiation","Atoms & Nuclei","Electronic Devices"]}},
{n:"Chemistry",c:"var(--che)",g:{"Physical":["Some Basic Concepts of Chemistry","Structure of Atom","Chemical Thermodynamics","Equilibrium","Redox Reactions","Solutions","Electrochemistry","Chemical Kinetics"],"Inorganic":["Periodic Classification & Properties","Chemical Bonding & Molecular Structure","p-Block Elements","d- & f-Block Elements","Coordination Compounds"],"Organic":["Basic Principles & GOC","Hydrocarbons","Haloalkanes & Haloarenes","Alcohols, Phenols & Ethers","Aldehydes, Ketones & Carboxylic Acids","Amines","Biomolecules"]}},
{n:"Botany",c:"var(--bot)",g:{"Class 11":["The Living World","Biological Classification","Plant Kingdom","Morphology of Flowering Plants","Anatomy of Flowering Plants","Cell: The Unit of Life","Cell Cycle & Cell Division","Photosynthesis","Respiration in Plants","Plant Growth & Development","Biomolecules"],"Class 12":["Sexual Reproduction in Flowering Plants","Principles of Inheritance & Variation","Molecular Basis of Inheritance","Microbes in Human Welfare","Organisms & Populations","Ecosystem","Biodiversity & Conservation"]}},
{n:"Zoology",c:"var(--zoo)",g:{"Class 11":["Animal Kingdom","Structural Organisation in Animals","Breathing & Exchange of Gases","Body Fluids & Circulation","Excretory Products & Elimination","Locomotion & Movement","Neural Control & Coordination","Chemical Coordination & Integration"],"Class 12":["Human Reproduction","Reproductive Health","Evolution","Human Health & Disease","Biotechnology: Principles & Processes","Biotechnology & Its Applications"]}}
];
const STEPS=["Studied","Revised","PYQs"];
const $=id=>document.getElementById(id);
const ALL=S.flatMap((s,si)=>chapters(si).map(c=>({id:s.n+"|"+c,s:si,c})));
const BY=Object.fromEntries(ALL.map(a=>[a.id,a]));
function chapters(si){return Object.values(S[si].g).flat()}
const openT=new Set(),openL=new Set();
let pw=0,cm=new Date(new Date().getFullYear(),new Date().getMonth(),1),cs=null;
const fresh=()=>({done:{},dates:{},tab:0,hide:false,grid:false,view:"syl",wk:5,mo:20,tests:[],plan:{},day:{},lec:{}});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let st=fresh(),query="";
function normalize(x){
  if(!x||typeof x!=="object"||Array.isArray(x))throw Error("Invalid tracker data");
  const n=fresh();
  for(const a of ALL){for(let k=0;k<3;k++)if(x.done?.[a.id+"|"+k]===true)n.done[a.id+"|"+k]=true;
    if(/^\d{4}-\d{2}-\d{2}$/.test(x.dates?.[a.id]||''))n.dates[a.id]=x.dates[a.id];
    const l=x.lec?.[a.id];if(l){const count=Math.max(0,Math.min(60,Math.floor(Number(l.n)||0)));n.lec[a.id]={n:count,d:[...new Set((Array.isArray(l.d)?l.d:[]).filter(v=>Number.isInteger(v)&&v>0&&v<=count))]}}}
  for(const field of ['plan','day'])for(const [d,ids]of Object.entries(x[field]||{}))if(/^\d{4}-\d{2}-\d{2}$/.test(d)&&Array.isArray(ids))n[field][d]=[...new Set(ids.filter(id=>Object.hasOwn(BY,id)))];
  n.tests=(Array.isArray(x.tests)?x.tests:[]).filter(t=>t&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)&&/^[a-zA-Z0-9_-]+$/.test(String(t.id))).map(t=>({id:String(t.id),name:String(t.name||'Test').slice(0,160),date:t.date,ch:[...new Set((Array.isArray(t.ch)?t.ch:[]).filter(id=>Object.hasOwn(BY,id)))],chk:Object.fromEntries(Object.entries(t.chk||{}).filter(([id,v])=>Object.hasOwn(BY,id)&&v===true))}));
  n.tab=Number.isInteger(x.tab)&&x.tab>=0&&x.tab<4?x.tab:0;n.view=['syl','plan','cal'].includes(x.view)?x.view:'syl';n.hide=!!x.hide;n.grid=!!x.grid;
  for(const k of ['wk','mo'])n[k]=Number.isFinite(x[k])?Math.max(0,Math.min(1000,Math.floor(x[k]))):n[k];return n;
}

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
  const lv=Object.values(st.lec),lt=lv.reduce((a,l)=>a+l.n,0),ld=lv.reduce((a,l)=>a+l.d.length,0);
  const fin=ALL.filter(a=>ticks(a.id)==3).length;
  $("cnt").textContent=`${fin} of ${ALL.length} chapters fully done`+(lt?` · ${ld} of ${lt} lectures done`:"");
  $("days").textContent=Math.max(0,dleft(EXAM));
  document.querySelectorAll(".nav button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v==st.view));
  $("syl").hidden=st.view!="syl";$("plan").hidden=st.view!="plan";$("cal").hidden=st.view!="cal";
  if(st.view=="syl")renderSyl(pcts);else if(st.view=="plan")renderPlan();else renderCal();
}
function lecRow(id){
  const L=st.lec[id]||{n:0,d:[]},op=openL.has(id);
  return `<div class="lec"><button class="btn" data-lt="${id}">${L.n?`Lectures ${L.d.length}/${L.n}`:"Add lectures"} ${op?"&#9652;":"&#9662;"}</button>${op?`<span class="mute" style="font-size:13px">Total</span><input class="num" type="number" min="0" max="60" value="${L.n}" data-ln="${id}" aria-label="Total lectures">${Array.from({length:L.n},(_,i)=>`<button class="chip" aria-pressed="${L.d.includes(i+1)}" data-ld="${id}|${i+1}">Lec ${i+1}</button>`).join("")}`:""}</div>`;
}
function renderSyl(pcts){
  $("tabs").innerHTML=S.map((s,i)=>`<button class="tab" role="tab" style="--c:${s.c}" aria-selected="${i==st.tab}" data-t="${i}"><b>${s.n}</b><span>${pcts[i]}%</span></button>`).join("");
  const s=S[st.tab],ut=upcoming();let h="";
  for(const[g,list]of Object.entries(s.g)){
    let rows="";
    list.forEach(c=>{
      const id=s.n+"|"+c,full=ticks(id)==3;
      if(st.hide&&full)return;
      if(query&&!c.toLowerCase().includes(query))return;
      const t=ut.find(t=>t.ch.includes(id));
      rows+=`<div class="ch${full?" full":""}" style="--c:${s.c}"><span class="nm">${c}${t&&!full?`<small>${esc(t.name)} on ${fmt(t.date)}</small>`:""}</span><span class="chips">${STEPS.map((l,k)=>`<button class="chip" aria-pressed="${!!st.done[id+"|"+k]}" data-k="${id}|${k}">${l}</button>`).join("")}</span>${lecRow(id)}<div class="bar mini"><i style="width:${ticks(id)*100/3}%"></i></div></div>`;
    });
    if(rows)h+=`<div class="grp">${g}</div><div class="${st.grid?"cg":""}">${rows}</div>`;
  }
  $("list").innerHTML=h||`<div class="empty">${query?"No chapters match your search.":"Every chapter in "+s.n+" is finished. Nice work."}</div>`;
  $("gv").textContent=st.grid?"List view":"Grid view";
  const[d,t]=sub(st.tab);$("subline").textContent=`${s.n}: ${d} of ${t} ticks`;
}
function dlist(a,d){
  const old=d<iso(today());
  return a.length?a.map(id=>`<div class="f" style="--c:${S[BY[id].s].c}"><i></i><span>${BY[id].c}${chip(id)}</span>${studied(id)?`<span class="tag good" style="flex:none">Studied</span>`:`${old?`<span class="tag bad" style="flex:none">Missed</span><button class="btn" data-mv="${d}|${id}">Move to today</button>`:""}<button class="btn" data-k="${id}|0">Mark studied</button>`}<button class="btn" data-rmd="${d}|${id}" aria-label="Remove">&times;</button></div>`).join(""):`<div class="mute">Nothing planned.</div>`;
}
function renderPlan(){
  const tk=iso(today()),carry=Object.keys(st.day).filter(d=>d<tk).sort().map(d=>[d,st.day[d].filter(id=>!studied(id))]).filter(x=>x[1].length);
  $("todayp").innerHTML=`<div class="card"><h2>Today, ${fmt(tk)}</h2>${dlist(st.day[tk]||[],tk)}${carry.map(([d,l])=>`<div class="grp">Not finished from ${fmt(d)}</div>${dlist(l,d)}`).join("")}<p class="mute" style="margin:10px 0 0;font-size:13px">Plan chapters for any day in the Calendar tab.</p></div>`;
  const ws=weekStart(),ms=iso(today()).slice(0,7);
  const wd=ALL.filter(a=>st.dates[a.id]>=ws).length,md=ALL.filter(a=>(st.dates[a.id]||"").startsWith(ms)).length;
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
  document.querySelectorAll("#wpick input").forEach(i=>i.checked=pl.includes(i.value));
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
    <div class="row mute" style="margin-top:4px"><span>${t.ch.length} chapters · ${ready}% ready</span><span class="tag ${pd.length?(nw>st.wk?"bad":""):"good"}">${pd.length?`${pd.length} to do · ${nw}/week`:"All done"}</span></div>${bar(ready,100)}
    <details data-ot="${t.id}" ${openT.has(t.id)?"open":""}><summary>Test checklist (${t.ch.length-pd.length} of ${t.ch.length} ready)</summary>${t.ch.map(id=>`<label class="f" style="--c:${S[BY[id].s].c};cursor:pointer"><i></i><input type="checkbox" data-tc="${t.id}|${id.replace(/"/g,"&quot;")}" ${ck[id]?"checked":""}><span>${BY[id].c}${chip(id)}</span><span class="mute" style="font-size:12px;flex:none">tracker ${ticks(id)}/3</span></label>`).join("")}</details>
    <div style="margin-top:8px"><button class="btn" data-del="${t.id}">Delete test</button></div></div>`}).join(""):`<div class="card empty">No upcoming tests. Add one below to match its syllabus with your plan.</div>`;
}
function renderCal(){
  const y=cm.getFullYear(),m=cm.getMonth(),off=(new Date(y,m,1).getDay()+6)%7,n=new Date(y,m+1,0).getDate(),tk=iso(today());
  if(!cs)cs=tk;
  const by={};ALL.forEach(a=>{const d=st.dates[a.id];if(d)(by[d]=by[d]||[]).push(a.id)});
  let c=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>`<div class="h">${d}</div>`).join("")+"<div></div>".repeat(off);
  for(let d=1;d<=n;d++){
    const dt=new Date(y,m,d),k=iso(dt),pn=(st.plan[wsOf(dt)]||[]).length,tn=st.tests.filter(t=>t.date==k).length,sn=(by[k]||[]).length,dn=(st.day[k]||[]).length;
    c+=`<button class="cd${pn?" pl":""}${k==tk?" td":""}${k==EXAM?" ex":""}${k==cs?" sel":""}" data-cd="${k}"><b>${d}</b>${k==EXAM?'<span class="m e">NEET</span>':""}${tn?`<span class="m t">Test${tn>1?" "+tn:""}</span>`:""}${sn?`<span class="m s">&#10003;${sn}</span>`:""}${dn?`<span class="m d">D${dn}</span>`:""}${pn&&dt.getDay()==1?`<span class="m p">P${pn}</span>`:""}</button>`;
  }
  const dd=new Date(cs+"T00:00:00"),ts=st.tests.filter(t=>t.date==cs),sd=by[cs]||[],wp=st.plan[wsOf(dd)]||[];
  const dp=st.day[cs]||[];
  document.querySelectorAll("#dpick input").forEach(i=>i.checked=dp.includes(i.value));
  $("dsum").textContent="Choose chapters for "+fmt(cs);
  const list=a=>a.length?a.map(id=>`<div class="f" style="--c:${S[BY[id].s].c}"><i></i><span>${BY[id].c}${chip(id)}</span>${studied(id)?`<span class="tag good" style="flex:none">Studied</span>`:""}</div>`).join(""):`<div class="mute">Nothing yet.</div>`;
  $("calmain").innerHTML=`<div class="card"><div class="row" style="margin-bottom:10px"><button class="btn" data-cm="-1">&lsaquo; Prev</button><b>${cm.toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</b><button class="btn" data-cm="1">Next &rsaquo;</button></div>
  <div class="cal">${c}</div><p class="mute" style="margin:10px 0 0;font-size:12px">Orange D = chapters planned for that day. Blue tint and P = planned for that week. &#10003; = chapters studied that day. Tap a day for details.</p></div>
  <div class="card"><h2>${dd.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</h2>
  ${cs==EXAM?'<p><b>NEET 2027 exam day.</b></p>':dleft(cs)>=0?`<p class="mute">${dleft(cs)} days from today</p>`:""}
  ${ts.map(t=>`<div class="grp" style="margin-top:4px">Test: ${esc(t.name)}</div>${list(t.ch)}`).join("")}
  <div class="grp">Planned for this day</div>${dlist(dp,cs)}
  <div class="grp">Studied this day</div>${list(sd)}
  <div class="grp">Planned for this week</div>${list(wp)}</div>`;
}
function buildPicker(){
  $("wpick").innerHTML=S.map((s,i)=>`<div class="grp" style="color:${s.c}">${s.n}</div><div class="pick">${chapters(i).map(c=>`<label><input type="checkbox" value="${s.n}|${c.replace(/"/g,"&quot;")}"> ${c}</label>`).join("")}</div>`).join("");
  $("picker").innerHTML=S.map((s,i)=>`<div class="grp" style="color:${s.c}">${s.n}</div><div class="pick">${chapters(i).map(c=>`<label><input type="checkbox" value="${s.n}|${c.replace(/"/g,"&quot;")}"> ${c}</label>`).join("")}</div>`).join("");
}
document.addEventListener("click",e=>{
  const c=e.target.closest("[data-k]"),t=e.target.closest(".tab"),n=e.target.closest(".nav button"),d=e.target.closest("[data-del]");
  if(c){const k=c.dataset.k,id=k.slice(0,k.lastIndexOf("|")),i=k.slice(-1);
    st.done[k]=!st.done[k];
    if(i=="0"){if(st.done[k])st.dates[id]=iso(today());else delete st.dates[id]}
    save();render()}
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
  if(t){st.tab=+t.dataset.t;save();render()}
  if(n){st.view=n.dataset.v;save();render()}
  if(d&&confirm("Delete this test?")){st.tests=st.tests.filter(x=>x.id!=d.dataset.del);save();render()}
});
document.addEventListener("toggle",e=>{const id=e.target.dataset&&e.target.dataset.ot;if(id){e.target.open?openT.add(id):openT.delete(id)}},true);
document.addEventListener("change",e=>{
  if(e.target.id=="wk"||e.target.id=="mo"){st[e.target.id]=Math.max(0,+e.target.value||0);save();render()}
  if(e.target.closest("#wpick")){const k=wkISO(pw),v=e.target.value,l=st.plan[k]||[];st.plan[k]=e.target.checked?[...new Set([...l,v])]:l.filter(x=>x!=v);save();render()}
  if(e.target.dataset.ln){const id=e.target.dataset.ln,n=Math.max(0,Math.min(60,Math.floor(+e.target.value||0))),L=st.lec[id]=st.lec[id]||{n:0,d:[]};L.n=n;L.d=L.d.filter(x=>x<=n);save();render()}
  if(e.target.dataset.tc){const v=e.target.dataset.tc,i=v.indexOf("|"),t=st.tests.find(x=>x.id==v.slice(0,i));if(t){t.chk=t.chk||{};t.chk[v.slice(i+1)]=e.target.checked;save();render()}}
  if(e.target.closest("#dpick")){const v=e.target.value,l=st.day[cs]||[];st.day[cs]=e.target.checked?[...new Set([...l,v])]:l.filter(x=>x!=v);save();render()}
  if(e.target.closest("#picker"))$("pc").textContent=document.querySelectorAll("#picker input:checked").length;
});
$("addt").onclick=()=>{
  const name=$("tn").value.trim().slice(0,160),date=$("td").value,ch=[...document.querySelectorAll("#picker input:checked")].map(i=>i.value);
  if(!name||!date||!ch.length){alert("Add a test name, a date and at least one chapter.");return}
  st.tests.push({id:String(Date.now()),name,date,ch});save();
  $("tn").value="";$("td").value="";document.querySelectorAll("#picker input").forEach(i=>i.checked=false);$("pc").textContent=0;render();
};
$("gv").onclick=()=>{st.grid=!st.grid;save();render()};
$("hide").checked=st.hide;$("hide").onchange=()=>{st.hide=$("hide").checked;save();render()};
$("reset").onclick=()=>{if(confirm("Clear progress and tests for the current account? Other accounts are unaffected. This cannot be undone.")){st.done={};st.dates={};st.tests=[];st.plan={};st.day={};st.lec={};save();render()}};
buildPicker();$("dpick").innerHTML=$("wpick").innerHTML;render();
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
function lock(value){$('workspace').inert=value;$('workspace').style.opacity=value?'.45':'';$('reset').disabled=value;}
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
function clearTransient(){openT.clear();openL.clear();pw=0;cs=null;query='';$('search').value='';$('tn').value='';$('td').value='';$('pc').textContent='0';document.querySelectorAll('#picker input').forEach(i=>i.checked=false);}
async function loadCloud(){
  const generation=authGeneration;if(!user)return;
  ready=false;lock(true);status('Loading your saved progress…');
  try{const snap=await sdk.getDocFromServer(sdk.doc(db,'trackers',user.uid));if(generation!==authGeneration)return;
    st=snap.exists()?normalize(snap.data().state):fresh();version=snap.exists()?snap.data().version:0;
    dirty=false;conflict=false;ready=true;clearTransient();render();lock(false);status('Saved to your account · synced across devices');
  }catch(e){if(generation===authGeneration)status('Could not load your account. '+friendly(e),true)}
}
async function accountChanged(next){
  if(authBusy||createdUser)return;
  authGeneration++;const generation=authGeneration;clearTimeout(saveTimer);unsubscribe?.();unsubscribe=null;user=next;dirty=false;conflict=false;version=0;ready=false;st=fresh();clearTransient();render();
  $('account').textContent='My account';$('signedin').hidden=false;$('accessid').value='';
  if(!next||next.isAnonymous){showLoginPage(true);lock(true);status('');authControls(false);return;}
  showLoginPage(false);lock(true);
  try{const profile=await sdk.getDocFromServer(sdk.doc(db,'profiles',next.uid));if(generation!==authGeneration)return;
    const p=profile.exists()?profile.data():{};$('accountemail').textContent=(p.name||'Your account')+(p.id?' · '+p.id:'');$('greeting').textContent=p.name?'You’ve got this, '+p.name+'.':'Small steps. A stronger tomorrow.';
  }catch{$('accountemail').textContent='Your study account'}
  await loadCloud();if(generation!==authGeneration||!user)return;
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
try{document.documentElement.dataset.theme=localStorage.getItem('neet-theme')||'light'}catch{document.documentElement.dataset.theme='light'}
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
  authControls(true);$('authmsg').textContent=creating?'Creating your study space…':'Signing in…';
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
    }else{const credentials=credentialsFor($('accessid').value);const result=await sdk.signInWithEmailAndPassword(auth,credentials.email,credentials.password);authControls(false);await accountChanged(result.user);$('authmsg').textContent='';}
  }catch(e){$('authmsg').textContent=friendly(e);if(e.code==='auth/credential-already-in-use'||e.code==='auth/email-already-in-use')await sdk.signOut(auth);}
  finally{authControls(false)}
}
$('authform').onsubmit=e=>{e.preventDefault();authenticate()};
$('copyid').onclick=async()=>{try{await navigator.clipboard.writeText($('newid').value);$('authmsg').textContent='ID copied. Save it somewhere safe.'}catch{$('newid').select();$('authmsg').textContent='Select and copy your ID.'}};
function resetAuthForm(){
  $('newidpanel').hidden=true;$('newid').value='';$('signin').hidden=false;
  document.querySelector('.auth-tabs').hidden=false;
  mode(false);
}
$('entertracker').onclick=async()=>{if(!createdUser)return;const next=createdUser;createdUser=null;resetAuthForm();await accountChanged(next)};
$('signout').onclick=async()=>{
  if(saving){$('authmsg').textContent='Wait for the current save to finish, then sign out.';return}
  if(dirty){await pushCloud();if(dirty){$('authmsg').textContent='Progress is not saved. Retry saving before signing out.';return}}
  try{resetAuthForm();await sdk.signOut(auth);$('authdialog').close()}catch(e){$('authmsg').textContent=friendly(e)}
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
authControls(true);showLoginPage(true);
connectFirebase(FIREBASE_CONFIG).catch(()=>{$('loginconnection').textContent='Could not connect. Check your internet connection and reload.';authControls(true)});
