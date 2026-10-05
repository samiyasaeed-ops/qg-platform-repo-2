/* ================= Turnaround targets, over-time alerts and performance ================= */
const TAT_DEFAULTS={appreciations:10,reviews:10,spotchecks:30,breaches:30,noncompliance:50,rca:50,mystery:30,journey:30,product:50,task:20,evalHandlingMin:45,evalReview:10,evalPublish:10};
const tatCfg=()=>({...TAT_DEFAULTS,...(S.cfg.tat||{})});
const staffByUid=uid=>uid?(Object.values(S.staff).find(p=>p.userId===uid)||(uid===S.uid?meStaff():null)):null;
function managerOf(staffId){ const p=S.staff[staffId]; if(p&&p.managerId&&p.managerId!==staffId) return p.managerId; const t=p&&teamOf(p); if(!t) return null; return t.lineManagerId&&t.lineManagerId!==staffId?t.lineManagerId:(t.superiorId||null); }
const monthOf=ms=>dateOf(ms).slice(0,7);
const minsBetween=(a,b)=>(ts(b)-ts(a))/60000;
const fmtMin=m=>m==null||isNaN(m)?"–":m<60?Math.round(m)+" min":(Math.round(m/6)/10)+" hrs";

/* QA evaluation timeline, from the evaluation's own audit trail */
function evalTimes(e){
  const st=(e.auditTrail||[]).filter(t=>t.field==="status");
  const firstTo=to=>{ const x=st.find(t=>to.includes(t.to)); return x?x.at:null; };
  const submitted=e.submittedAt||firstTo(["pending_review","confirmed"])||(e.status!=="draft"?e.createdAt:null);
  const queued=st.some(t=>t.to==="pending_review");
  const reviewed=queued?(e.reviewedAt||firstTo(["confirmed"])):null;
  const published=firstTo(["published"])||e.sentAt||e.emailSentAt||null;
  return {started:e.startedAt||null,submitted,queued,reviewStarted:e.reviewStartedAt||null,reviewed,published,
    handlingMin:e.startedAt&&submitted?minsBetween(e.startedAt,submitted):null,
    waitHrs:queued&&submitted?workHoursBetween(ts(submitted),ts(e.reviewStartedAt||reviewed||nowMs()),S.cfg):null,
    reviewHrs:queued&&submitted?workHoursBetween(ts(submitted),ts(reviewed||nowMs()),S.cfg):null,
    reviewerMin:e.reviewStartedAt&&reviewed?minsBetween(e.reviewStartedAt,reviewed):null,
    publishHrs:published&&(reviewed||submitted)?workHoursBetween(ts(reviewed||submitted),ts(published),S.cfg):null,
    totalHrs:submitted&&published?workHoursBetween(ts(e.startedAt||submitted),ts(published),S.cfg):null};
}

/* Every Q&G activity measured against its target, one row per item and stage */
function tatChecks(){
  const T=tatCfg(), out=[];
  for(const c of S.cases){
    if(!inV(c.venture)) continue;
    const owner=c.assigneeId||null, i=c.intake||{};
    const qgStage=["intake","qg_review","ready_internal"].includes(c.status), lmStage=["with_lm","consequence"].includes(c.status);
    if(c.status!=="closed"){ const due=dueOf(c); if(due&&due<nowMs()){ const who=qgStage?owner:lmStage?i.lmId:null;
      out.push({key:"case:"+c.ref+":"+c.status+":"+(c.stageAt||0),kind:"case",ref:c.ref,sec:isCallback(c)?"callbacks":"complaints",venture:c.venture,staffId:who,activity:ST[c.status],title:c.ref+" · "+(c.subject||c.type),target:S.cfg.sla[STAGE_SLA[c.status]],actual:workHoursBetween(c.stageAt||c.createdAt,nowMs(),S.cfg),open:true}); } }
  }
  for(const c of S.cases){ if(!inV(c.venture)||c.status==="closed") continue; const d=targetDue(c); if(!d||d>nowMs()) continue;
    out.push({key:"caseT:"+c.ref,kind:"case",ref:c.ref,sec:isCallback(c)?"callbacks":"complaints",venture:c.venture,staffId:c.assigneeId||null,activity:"Target resolution time ("+c.type+")",title:c.ref+" · "+(c.subject||c.type),target:targetHrs(c),actual:workHoursBetween(ts(c.receivedAt||c.createdAt),nowMs(),S.cfg),open:true}); }
  for(const r of S.recs){
    const def=REG[r.section]; if(!def||!inV(recVenture(r))) continue;
    const tgt=T[r.section]; if(!tgt) continue;
    const done=def.final.includes(r.status), end=done?(r.closedAt||r.updatedAt):nowMs(), act=workHoursBetween(r.createdAt,end,S.cfg);
    if(act>tgt) out.push({key:"rec:"+r.id,kind:"rec",ref:r.ref||r.id,id:r.id,sec:r.section,venture:recVenture(r),staffId:r.assigneeId||null,activity:NAVMAP[r.section].label,title:(r.ref||r.id),target:tgt,actual:act,open:!done});
  }
  for(const t of S.tasks){
    if(t.status==="Cancelled"||(S.venture&&t.venture&&t.venture!==S.venture)) continue;
    const done=t.status==="Done", end=done?t.doneAt:nowMs();
    const over=t.due?ts(end)>localToMs(t.due,S.cfg.work.end):workHoursBetween(t.createdAt,end,S.cfg)>T.task;
    if(over) out.push({key:"task:"+t.id,kind:"task",id:t.id,ref:t.title,sec:t.section||"",venture:t.venture||"",staffId:t.assigneeId,activity:"Task",title:t.title,target:t.due?null:T.task,actual:workHoursBetween(t.createdAt,end,S.cfg),open:!done,dueDate:t.due});
  }
  for(const e of evalsV()){
    const x=evalTimes(e), ev=staffByUid(e.createdBy||e.evaluatorId), rv=e.reviewerId?staffByUid(e.reviewerId):null, v=e.ventureId||"insurancemarket";
    if(x.handlingMin!=null&&x.handlingMin>T.evalHandlingMin) out.push({key:"evalh:"+e.id,kind:"eval",id:e.id,ref:e.callId||e.id,sec:/email/i.test(e.channel||"")?"emails":"calls",venture:v,staffId:ev&&ev.id,activity:"Evaluation handling",title:(e.callId||e.id),targetMin:T.evalHandlingMin,actualMin:x.handlingMin,open:false});
    if(x.queued&&x.reviewHrs!=null&&x.reviewHrs>T.evalReview) out.push({key:"evalr:"+e.id,kind:"eval",id:e.id,ref:e.callId||e.id,sec:"calls",venture:v,staffId:rv?rv.id:null,activity:"Review",title:(e.callId||e.id),target:T.evalReview,actual:x.reviewHrs,open:!x.reviewed});
  }
  return out;
}
const tatText=b=>b.targetMin!=null?`${fmtMin(b.actualMin)} against ${fmtMin(b.targetMin)}`:b.target!=null?`${fmtTat(b.actual)} against ${fmtTat(b.target)}`:`past due date ${fmtD(b.dueDate)}`;

/* Record new breaches, email the member and their manager (runs in the sweeper) */
async function recordTatBreaches(){
  if(!DB||!(isQG()||S.admin)) return;
  const known=new Set(S.tatLog.map(x=>x.key));
  for(const b of tatChecks()){
    if(known.has(b.key)||!b.staffId) continue;
    const mgr=managerOf(b.staffId);
    const doc={key:b.key,kind:b.kind,ref:b.ref,refId:b.id||b.ref,sec:b.sec,venture:b.venture,staffId:b.staffId,managerId:mgr,activity:b.activity,title:b.title,target:b.target??null,targetMin:b.targetMin??null,actual:b.actual??null,actualMin:b.actualMin??null,dueDate:b.dueDate||"",month:monthOf(nowMs()),detectedAt:nowMs(),memberAckAt:null,managerAckAt:null};
    const id=b.key.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,180);
    if(!await put("mod/perf/tat/"+id,doc)) continue;
    known.add(b.key);
    sendMail({to:[emailOf(b.staffId)],cc:[emailOf(mgr)],subject:`Time limit passed: ${b.title}`,lines:[`${b.activity} for ${b.title} has gone past its time limit: ${tatText(b)}.`,`This is recorded on ${personName(b.staffId)}'s Q&G performance for ${monthOf(nowMs())}.`,b.open?"Please action it now.":"It has been completed late."],ref:b.ref,kind:"tat"});
  }
}

/* Pop-up alert for the member and their manager */
let alertShownKey="";
function myAlerts(){
  const me=meStaff(); if(!me) return [];
  return S.tatLog.filter(x=>(x.staffId===me.id&&!x.memberAckAt)||(x.managerId===me.id&&!x.managerAckAt)).sort((a,b)=>b.detectedAt-a.detectedAt);
}
function showAlerts(force){
  const list=myAlerts(), host=$("#alertHost"); if(!host) return;
  const key=list.map(x=>x.key).join("|");
  if(!list.length){ host.hidden=true; host.innerHTML=""; return; }
  if(!force&&key===alertShownKey&&!host.hidden) return;
  alertShownKey=key;
  const me=meStaff();
  host.innerHTML=`<div class="alertbox" role="alertdialog" aria-modal="true" aria-labelledby="alertT"><h2 id="alertT">Time limit passed</h2>
   <p>${list.length} item${list.length>1?"s have":" has"} gone past the time allowed. Each one is recorded on the person's Q&G performance for the month.</p>
   <ul>${list.slice(0,8).map(x=>`<li><b>${esc(x.title)}</b> <span class="muted">${esc(x.activity)}${x.staffId!==me.id?" · "+esc(personName(x.staffId)):""}</span><br><span class="tag red">${esc(tatText(x))}</span> <button class="linkbtn" data-act="alertOpen" data-key="${esc(x.key)}">Open</button></li>`).join("")}</ul>
   ${list.length>8?`<p class="hint">${list.length-8} more in Team workload.</p>`:""}
   <div class="row"><button class="btn primary" data-act="alertAck">Acknowledge</button><button class="btn" data-act="alertLater">Remind me later</button></div></div>`;
  host.hidden=false; const b=host.querySelector(".btn.primary"); if(b) b.focus();
}
async function alertAction(act,el){
  const host=$("#alertHost");
  if(act==="alertLater"){ host.hidden=true; return; }
  if(act==="alertAck"){ const me=meStaff(); for(const x of myAlerts()){ const id=x.key.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,180); await patch("mod/perf/tat/"+id,x.staffId===me.id?{memberAckAt:nowMs()}:{managerAckAt:nowMs()}); } host.hidden=true; return toast("Acknowledged."); }
  if(act==="alertOpen"){ const x=S.tatLog.find(y=>y.key===el.dataset.key); host.hidden=true; if(!x) return;
    if(x.kind==="case"){ S.sel[x.sec]=x.ref; return go(x.sec); }
    if(x.kind==="rec"){ S.sel[x.sec]=x.refId; return go(x.sec); }
    if(x.kind==="task"){ S.sel.task=x.refId; return go("mywork"); }
    if(x.kind==="eval") return openEvalInQA(x.refId); }
}

/* Monthly performance and department turnaround */
function viewPerformance(){
  const ui=S.ui.perf||(S.ui.perf={month:monthOf(nowMs())});
  const months=[...new Set([monthOf(nowMs()),...S.tatLog.map(x=>x.month),...S.cases.map(c=>monthOf(c.createdAt)),...S.recs.map(r=>monthOf(r.createdAt))].filter(Boolean))].sort().reverse();
  const [y,m]=ui.month.split("-").map(Number), mStart=Date.UTC(y,m-1,1)-TZ, mEnd=Date.UTC(y,m,1)-TZ;
  const inMonth=t=>ts(t)>=mStart&&ts(t)<mEnd;
  const items=workItems().filter(i=>i.state==="done"&&inMonth(i.doneAt));
  const T=tatCfg();
  const targetOf=i=>i.kind==="rec"?T[i.sec]:i.kind==="task"?T.task:null;
  const evs=evalsV().filter(e=>inMonth(evalTimes(e).submitted));
  const people=qgStaff();
  const breaches=S.tatLog.filter(x=>x.month===ui.month&&inV(x.venture||""));
  const row=p=>{ const mine=items.filter(i=>i.assignee===p.id), tats=mine.map(tatOf).filter(x=>x!=null), within=mine.filter(i=>{ const t=targetOf(i); return t==null||tatOf(i)<=t; }).length;
    const ev=evs.filter(e=>{ const s=staffByUid(e.createdBy); return s&&s.id===p.id; }), hm=ev.map(e=>evalTimes(e).handlingMin).filter(x=>x!=null);
    const rv=evs.filter(e=>{ const s=e.reviewerId&&staffByUid(e.reviewerId); return s&&s.id===p.id; }), rh=rv.map(e=>evalTimes(e).reviewHrs).filter(x=>x!=null);
    const br=breaches.filter(x=>x.staffId===p.id);
    return `<tr><td><b>${esc(p.name)}</b></td><td class="n sep">${mine.length}</td><td>${esc(fmtTat(avg(tats)))}</td><td class="n">${mine.length?Math.round(within/mine.length*100)+"%":"–"}</td><td class="n sep">${ev.length}</td><td>${esc(fmtMin(avg(hm)))}</td><td class="n sep">${rv.length}</td><td>${esc(fmtTat(avg(rh)))}</td><td class="n sep">${br.length?`<button class="linkbtn" data-act="perfWho" data-id="${esc(p.id)}"><span class="tag red">${br.length}</span></button>`:"0"}</td></tr>`; };
  // department turnaround by activity
  const acts=[];
  for(const sec of Object.keys(REG).filter(x=>T[x])){ const d=items.filter(i=>i.kind==="rec"&&i.sec===sec).map(tatOf).filter(x=>x!=null); acts.push([NAVMAP[sec].label,d,T[sec]]); }
  const caseStage=n=>S.cases.filter(c=>inV(c.venture)).map(c=>stageTimes(c)[n]).filter(x=>x&&inMonth(x.end)&&!isNaN(ts(x.start))).map(x=>workHoursBetween(ts(x.start),ts(x.end),S.cfg));
  acts.unshift(["Case: Q&G first review",caseStage(2),S.cfg.sla.intake],["Case: line manager resolution",caseStage(3),S.cfg.sla.lm],["Case: Q&G assessment",caseStage(4),S.cfg.sla.qgReview]);
  acts.push(["Tasks",items.filter(i=>i.kind==="task").map(tatOf).filter(x=>x!=null),T.task]);
  const evalH=evs.map(e=>evalTimes(e).handlingMin).filter(x=>x!=null), evalR=evs.map(e=>evalTimes(e).reviewHrs).filter(x=>x!=null), evalP=evs.map(e=>evalTimes(e).publishHrs).filter(x=>x!=null);
  const who=ui.who, whoList=who?breaches.filter(x=>x.staffId===who):null;
  return `<div class="row between"><label class="inline">Month <select data-ui="perf.month">${opts(months.map(x=>({v:x,l:new Date(x+"-01T00:00:00Z").toLocaleDateString("en-GB",{month:"long",year:"numeric",timeZone:"UTC"})})),ui.month)}</select></label><span class="hint" style="margin:0">Turnaround counts working hours, Dubai time. Targets are set in Settings.</span></div>
  <h2 class="h3">Q&G members</h2>
  <div class="tbl"><table><thead><tr><th>Person</th><th class="n sep">Items closed</th><th>Average turnaround</th><th class="n">Within target</th><th class="n sep">Evaluations</th><th>Average handling</th><th class="n sep">Reviews</th><th>Average review time</th><th class="n sep">Time limit breaches</th></tr></thead>
  <tbody>${people.length?people.map(row).join(""):`<tr><td colspan="9" class="muted">Add your Q&G team in Staff list to see members here.</td></tr>`}</tbody></table></div>
  ${whoList?`<h3 class="h3">${esc(personName(who))}: time limit breaches in ${esc(ui.month)}</h3><div class="tbl"><table><thead><tr><th>Detected</th><th>Item</th><th>Activity</th><th>Time</th><th>Member saw it</th><th>Manager saw it</th></tr></thead><tbody>${whoList.map(x=>`<tr><td>${stampCell(x.detectedAt)}</td><td>${esc(x.title)}</td><td>${esc(x.activity)}</td><td>${esc(tatText(x))}</td><td>${stampCell(x.memberAckAt)}</td><td>${stampCell(x.managerAckAt)}</td></tr>`).join("")}</tbody></table></div>`:""}
  <h2 class="h3">Department turnaround by activity</h2>
  <div class="tbl"><table><thead><tr><th>Activity</th><th class="n">Completed</th><th>Average</th><th>Target</th><th>Fastest</th><th>Slowest</th><th></th></tr></thead><tbody>
   ${acts.map(([l,d,t])=>{ const a=avg(d); return `<tr><td><b>${esc(l)}</b></td><td class="n">${d.length}</td><td>${esc(fmtTat(a))}</td><td>${esc(fmtTat(t))}</td><td>${d.length?esc(fmtTat(Math.min(...d))):"–"}</td><td>${d.length?esc(fmtTat(Math.max(...d))):"–"}</td><td>${a==null?"":a>t?'<span class="tag red">Over target</span>':'<span class="tag ok">Within target</span>'}</td></tr>`; }).join("")}
   <tr><td><b>Evaluation handling</b></td><td class="n">${evalH.length}</td><td>${esc(fmtMin(avg(evalH)))}</td><td>${esc(fmtMin(T.evalHandlingMin))}</td><td>${evalH.length?esc(fmtMin(Math.min(...evalH))):"–"}</td><td>${evalH.length?esc(fmtMin(Math.max(...evalH))):"–"}</td><td>${avg(evalH)==null?"":avg(evalH)>T.evalHandlingMin?'<span class="tag red">Over target</span>':'<span class="tag ok">Within target</span>'}</td></tr>
   <tr><td><b>Evaluation review</b></td><td class="n">${evalR.length}</td><td>${esc(fmtTat(avg(evalR)))}</td><td>${esc(fmtTat(T.evalReview))}</td><td>${evalR.length?esc(fmtTat(Math.min(...evalR))):"–"}</td><td>${evalR.length?esc(fmtTat(Math.max(...evalR))):"–"}</td><td>${avg(evalR)==null?"":avg(evalR)>T.evalReview?'<span class="tag red">Over target</span>':'<span class="tag ok">Within target</span>'}</td></tr>
   <tr><td><b>Feedback published</b></td><td class="n">${evalP.length}</td><td>${esc(fmtTat(avg(evalP)))}</td><td>${esc(fmtTat(T.evalPublish))}</td><td>${evalP.length?esc(fmtTat(Math.min(...evalP))):"–"}</td><td>${evalP.length?esc(fmtTat(Math.max(...evalP))):"–"}</td><td>${avg(evalP)==null?"":avg(evalP)>T.evalPublish?'<span class="tag red">Over target</span>':'<span class="tag ok">Within target</span>'}</td></tr>
  </tbody></table></div>`;
}

/* Evaluation timings view inside Call and Email evaluations */
function viewEvalTimings(sec){
  const T=tatCfg(), list=evalsV().filter(e=>(sec==="emails")===/email/i.test(e.channel||"")&&e.status!=="draft").sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,300);
  const xs=list.map(e=>[e,evalTimes(e)]);
  const A=f=>avg(xs.map(([,x])=>x[f]));
  const nm=uid=>{ const s=uid&&staffByUid(uid); return s?s.name:(uid?"Not in staff list":"–"); };
  return `<div class="figs4"><div><b>${esc(fmtMin(A("handlingMin")))}</b><span>Average evaluation handling (target ${esc(fmtMin(T.evalHandlingMin))})</span></div><div><b>${esc(fmtTat(A("waitHrs")))}</b><span>Average wait in Review queue</span></div><div class="${A("reviewHrs")>T.evalReview?"warn":""}"><b>${esc(fmtTat(A("reviewHrs")))}</b><span>Average review turnaround (target ${esc(fmtTat(T.evalReview))})</span></div><div><b>${esc(fmtTat(A("publishHrs")))}</b><span>Average time to send feedback</span></div></div>
  <p class="hint">Handling starts when the evaluator opens a new evaluation and ends when it's submitted. Evaluations started before this version show handling as “–”. Review turnaround runs from submission to the reviewer's decision, in working hours.</p>
  ${xs.length?`<div class="tbl"><table><thead><tr><th>Call ID</th><th>Evaluator</th><th>Started</th><th>Submitted</th><th>Handling</th><th>Reviewer</th><th>Review opened</th><th>Reviewed</th><th>Review turnaround</th><th>Sent to advisor</th><th>Status</th></tr></thead><tbody>
   ${xs.map(([e,x])=>`<tr class="click" data-act="openEval" data-id="${esc(e.id)}" tabindex="0"><td><b>${esc(e.callId||e.id)}</b></td><td>${esc(nm(e.createdBy))}</td><td>${stampCell(x.started)}</td><td>${stampCell(x.submitted)}</td><td>${x.handlingMin==null?"–":x.handlingMin>T.evalHandlingMin?`<span class="tag red">${esc(fmtMin(x.handlingMin))}</span>`:esc(fmtMin(x.handlingMin))}</td>
     <td>${x.queued?esc(nm(e.reviewerId)):'<span class="muted">Not needed</span>'}</td><td>${x.queued?stampCell(x.reviewStarted):""}</td><td>${x.queued?stampCell(x.reviewed):""}</td><td>${x.queued?(x.reviewHrs>T.evalReview?`<span class="tag red">${esc(fmtTat(x.reviewHrs))}</span>`:esc(fmtTat(x.reviewHrs)))+(x.reviewed?"":' <span class="muted">so far</span>'):""}</td><td>${stampCell(x.published)}</td><td>${esc(e.status.replace("_"," "))}</td></tr>`).join("")}
  </tbody></table></div>`:`<div class="emptybox">No submitted ${sec==="emails"?"email":"call"} evaluations${S.venture?" for "+esc(scopeLabel()):""} yet.</div>`}`;
}
