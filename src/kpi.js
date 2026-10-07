/* ================= Q&G KPIs: targets for open items, turnaround, breaches, against each person ================= */
const DEFAULT_KPIS=[
  {id:"k-open",metric:"open",label:"Open items",target:15,better:"lower",unit:""},
  {id:"k-overdue",metric:"overdue",label:"Overdue items",target:0,better:"lower",unit:""},
  {id:"k-closed",metric:"closed",label:"Closed this month",target:10,better:"higher",unit:""},
  {id:"k-tat",metric:"tat",label:"Average turnaround",target:24,better:"lower",unit:" working hrs"},
  {id:"k-within",metric:"within",label:"Closed within target",target:90,better:"higher",unit:"%"},
  {id:"k-breach",metric:"breach",label:"Time limit breaches",target:0,better:"lower",unit:""}
];
const METRICS={
  open:{label:"Open items right now",calc:(id)=>workItems().filter(i=>i.assignee===id&&i.state==="open").length},
  overdue:{label:"Overdue items right now",calc:(id)=>workItems().filter(i=>i.assignee===id&&i.state==="open"&&isOver(i)).length},
  closed:{label:"Items closed in the month",calc:(id,m)=>workItems().filter(i=>i.assignee===id&&i.state==="done"&&monthOf(i.doneAt)===m).length},
  tat:{label:"Average turnaround (working hrs) in the month",calc:(id,m)=>{ const d=workItems().filter(i=>i.assignee===id&&i.state==="done"&&monthOf(i.doneAt)===m).map(tatOf); return avg(d); }},
  within:{label:"Percentage of items closed within their target in the month",calc:(id,m)=>{ const T=tatCfg(); const d=workItems().filter(i=>i.assignee===id&&i.state==="done"&&monthOf(i.doneAt)===m); if(!d.length) return null; const t=i=>i.kind==="rec"?T[i.sec]:i.kind==="task"?T.task:null; const within=d.filter(i=>{ const tg=t(i); return tg==null||tatOf(i)<=tg; }).length; return Math.round(within/d.length*100); }},
  breach:{label:"Time limit breaches recorded in the month",calc:(id,m)=>S.tatLog.filter(x=>x.staffId===id&&x.month===m).length},
  evalHandling:{label:"Average evaluation handling (minutes) in the month",calc:(id,m)=>{ const d=evalsV().filter(e=>{ const s=staffByUid(e.createdBy); return s&&s.id===id&&monthOf(evalTimes(e).submitted)===m; }); return avg(d.map(e=>evalTimes(e).handlingMin)); }},
  reviewTat:{label:"Average review turnaround (working hrs) in the month",calc:(id,m)=>{ const d=evalsV().filter(e=>{ const s=e.reviewerId&&staffByUid(e.reviewerId); return s&&s.id===id&&monthOf(evalTimes(e).submitted)===m; }); return avg(d.map(e=>evalTimes(e).reviewHrs)); }}
};
const kpiList=()=>S.cfg.kpis||DEFAULT_KPIS;
const kpiMet=(k,v)=>v==null?null:k.better==="lower"?v<=k.target:v>=k.target;
function kpiCell(k,id,m){
  const met=METRICS[k.metric]; if(!met) return {v:null,ok:null};
  const v=met.calc(id,m);
  return {v,ok:kpiMet(k,v)};
}
function viewKPIs(){
  const ui=S.ui.kpi||(S.ui.kpi={month:monthOf(nowMs()),editing:false});
  const months=[...new Set([monthOf(nowMs()),...S.tatLog.map(x=>x.month)])].sort().reverse();
  const m=ui.month, people=isChief()?qgStaff():qgStaff().filter(p=>{ const me=meStaff(); return me&&p.id===me.id; });
  const ks=kpiList();
  const monthLabel=mm=>new Date(mm+"-01T00:00:00Z").toLocaleDateString("en-GB",{month:"long",year:"numeric",timeZone:"UTC"});
  const header=`<div class="row between"><label class="inline">Month <select data-ui="kpi.month">${opts(months.map(x=>({v:x,l:monthLabel(x)})),m)}</select></label>${isChief()?`<button class="btn" data-act="kpiEdit">${ui.editing?"Done editing":"Manage KPIs"}</button>`:""}</div>`;
  if(ui.editing&&isChief()) return header+kpiEditor(ks);
  if(!ks.length) return header+`<div class="emptybox">No KPIs set up yet.${isChief()?` <button class="linkbtn" data-act="kpiEdit">Add some</button>`:""}</div>`;
  if(!isChief()){
    const me=people[0];
    if(!me) return header+`<div class="emptybox">Your sign-in isn't linked to a person in Staff list, so KPIs can't be shown yet.</div>`;
    return header+`<p class="lead">Your KPIs for ${esc(monthLabel(m))}.</p><div class="kpitiles">${ks.map(k=>{ const c=kpiCell(k,me.id,m); return `<div class="kpitile ${c.ok===null?"":c.ok?"ok":"bad"}"><span class="kl">${esc(k.label)}</span><b>${c.v==null?"–":c.v+esc(k.unit)}</b><span class="kt">Target: ${k.better==="lower"?"≤":"≥"} ${esc(k.target)}${esc(k.unit)}</span></div>`; }).join("")}</div>`;
  }
  return header+`<p class="lead">All Q&G members against each KPI for ${esc(monthLabel(m))}.</p>
   <div class="tbl"><table><thead><tr><th>Person</th>${ks.map(k=>`<th>${esc(k.label)}</th>`).join("")}</tr></thead><tbody>
    ${people.length?people.map(p=>`<tr><td><b>${esc(p.name)}</b></td>${ks.map(k=>{ const c=kpiCell(k,p.id,m); return `<td class="${c.ok===null?"":c.ok?"":"warn"}">${c.v==null?"–":c.v+esc(k.unit)} <span class="muted">/ ${k.better==="lower"?"≤":"≥"}${esc(k.target)}${esc(k.unit)}</span></td>`; }).join("")}</tr>`).join(""):`<tr><td colspan="${ks.length+1}" class="muted">Add your Q&G team in Staff list to see KPIs here.</td></tr>`}
   </tbody></table></div>
   <p class="hint">Lower-is-better KPIs are met at or below target; higher-is-better are met at or above. Amber shading means the target wasn't met that month.</p>`;
}
function kpiEditor(ks){
  const row=(k,i)=>`<tr><td><input data-kpi="${i}" data-f="label" value="${esc(k.label)}"></td>
   <td><select data-kpi="${i}" data-f="metric">${opts(Object.entries(METRICS).map(([v,m])=>({v,l:m.label})),k.metric)}</select></td>
   <td><input type="number" data-kpi="${i}" data-f="target" value="${esc(k.target)}" style="width:80px"></td>
   <td><select data-kpi="${i}" data-f="better">${opts([{v:"lower",l:"Lower is better"},{v:"higher",l:"Higher is better"}],k.better)}</select></td>
   <td><input data-kpi="${i}" data-f="unit" value="${esc(k.unit)}" placeholder="%, hrs…" style="width:70px"></td>
   <td><button class="btn sm danger" data-act="kpiDel" data-i="${i}">Remove</button></td></tr>`;
  return `<div class="tbl"><table><thead><tr><th>Name</th><th>Measures</th><th>Target</th><th>Direction</th><th>Unit</th><th></th></tr></thead><tbody>${ks.map(row).join("")}</tbody></table></div>
   <div class="row"><button class="btn" data-act="kpiAdd">Add a KPI</button><button class="btn primary" data-act="kpiSave">Save KPIs</button></div>
   <p class="hint">Changes apply to every Q&G member's KPI view once saved.</p>`;
}
async function kpiAction(act,el){
  const ui=S.ui.kpi||(S.ui.kpi={month:monthOf(nowMs())});
  if(act==="kpiEdit"){ if(!isChief()) return; ui.editing=!ui.editing; if(ui.editing) S.ui.kpiDraft=clone(kpiList()); return; }
  if(!isChief()) return;
  const ks=S.ui.kpiDraft||clone(kpiList());
  if(act==="kpiAdd"){ ks.push({id:rid("k-"),metric:"open",label:"New KPI",target:0,better:"lower",unit:""}); S.ui.kpiDraft=ks; return; }
  if(act==="kpiDel"){ ks.splice(+el.dataset.i,1); S.ui.kpiDraft=ks; return; }
  if(act==="kpiSave"){
    document.querySelectorAll("[data-kpi]").forEach(input=>{ const i=+input.dataset.kpi, f=input.dataset.f; if(ks[i]) ks[i][f]=f==="target"?Number(input.value)||0:input.value; });
    const c=clone(S.cfg); c.kpis=ks;
    if(await put("mod/core/config/main",c)){ await addAudit("kpi","main","KPIs updated",null,null,ks.length+" KPIs"); ui.editing=false; delete S.ui.kpiDraft; toast("KPIs saved."); }
    return;
  }
}
function kpiInput(el){
  const ks=S.ui.kpiDraft; if(!ks) return false;
  const i=+el.dataset.kpi, f=el.dataset.f; if(!ks[i]) return false;
  ks[i][f]=f==="target"?Number(el.value)||0:el.value; return true;
}
