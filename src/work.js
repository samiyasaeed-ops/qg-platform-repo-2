/* ================= Team work, workload and open questions ================= */
function qgStaff(date){ return staffList(date).filter(p=>{ const t=teamOf(p,date); return t&&t.kind==="qg"; }); }
function qgOpts(sel){ return opts(qgStaff().map(p=>({v:p.id,l:p.name})).concat(sel&&!qgStaff().some(p=>p.id===sel)?[{v:sel,l:personName(sel)}]:[]),sel||"","Unassigned"); }
const dayHours=()=>{ const [a,b]=[S.cfg.work.start,S.cfg.work.end].map(t=>{ const [h,m]=t.split(":").map(Number); return h+m/60; }); return Math.max(1,b-a); };
const fmtTat=h=>h==null?"–":h<dayHours()?(Math.round(h*10)/10)+" working hrs":(Math.round(h/dayHours()*10)/10)+" working days";
const QG_STAGES=["intake","qg_review","ready_internal"];

/* One list of everything Q&G owns, whatever section it lives in */
function workItems(){
  const out=[];
  const keep=x=>inV(x);
  for(const c of S.cases){
    if(!keep(c.venture)) continue;
    const done=c.status==="closed";
    const atQG=QG_STAGES.includes(c.status);
    if(!done&&!atQG) { out.push({kind:"case",id:c.ref,sec:isCallback(c)?"callbacks":"complaints",title:c.ref+" · "+(c.subject||c.type),assignee:c.assigneeId||null,state:"waiting",stage:ST[c.status],created:c.createdAt,due:dueOf(c),doneAt:null}); continue; }
    out.push({kind:"case",id:c.ref,sec:isCallback(c)?"callbacks":"complaints",title:c.ref+" · "+(c.subject||c.type),assignee:c.assigneeId||null,state:done?"done":"open",stage:ST[c.status],created:c.createdAt,due:done?null:dueOf(c),doneAt:done?ts((c.closure||{}).internalAt):null});
  }
  for(const r of S.recs){
    const def=REG[r.section]; if(!def||r.section==="controls"||!keep(recVenture(r))) continue;
    const done=def.final.includes(r.status);
    out.push({kind:"rec",id:r.id,sec:r.section,title:(r.ref||r.id)+" · "+(r[def.cols[2]]||r[def.cols[1]]||def.noun),assignee:r.assigneeId||null,state:done?"done":"open",stage:r.status,created:r.createdAt,due:!done&&r.due?localToMs(r.due,S.cfg.work.end):null,doneAt:done?(r.closedAt||r.updatedAt||null):null});
  }
  for(const t of S.tasks){
    const done=t.status==="Done", gone=t.status==="Cancelled"; if(gone||(S.venture&&t.venture&&t.venture!==S.venture)) continue;
    out.push({kind:"task",id:t.id,sec:t.section||"",title:t.title,assignee:t.assigneeId||null,state:done?"done":"open",stage:t.status,created:t.createdAt,due:!done&&t.due?localToMs(t.due,S.cfg.work.end):null,doneAt:done?t.doneAt:null,task:t});
  }
  return out;
}
const isOver=i=>i.state==="open"&&i.due&&i.due<nowMs();
const tatOf=i=>i.doneAt&&i.created?workHoursBetween(i.created,i.doneAt,S.cfg):null;
function itemRow(i,showWho){
  const sec=NAVMAP[i.sec];
  return `<tr class="click" data-act="openItem" data-kind="${i.kind}" data-id="${esc(i.id)}" data-sec="${esc(i.sec)}" tabindex="0"><td><b>${esc(i.title)}</b></td><td>${stampCell(i.created)}</td><td>${esc(sec?sec.label:"Task")}</td>${showWho?`<td>${i.assignee?esc(personName(i.assignee)):'<span class="tag amb">Unassigned</span>'}</td>`:""}
   <td>${esc(i.stage)}</td><td>${i.state==="done"?stampCell(i.doneAt):i.due?(isOver(i)?`<span class="tag red">Overdue ${esc(fmtDT(i.due))}</span>`:esc(fmtDT(i.due))):'<span class="muted">No due date</span>'}</td><td>${i.state==="done"?esc(fmtTat(tatOf(i))):esc(fmtTat(workHoursBetween(i.created,nowMs(),S.cfg)))+' <span class="muted">so far</span>'}</td></tr>`;
}
function itemTable(list,showWho,empty){
  return list.length?`<div class="tbl"><table><thead><tr><th>Item</th><th>Created</th><th>Section</th>${showWho?"<th>Owner</th>":""}<th>Stage or status</th><th>Due or done</th><th>Turnaround</th></tr></thead><tbody>${list.map(i=>itemRow(i,showWho)).join("")}</tbody></table></div>`:`<div class="emptybox">${esc(empty)}</div>`;
}

/* ---- My work ---- */
function viewMyWork(){
  const me=meStaff();
  if(!me) return `<div class="emptybox">Your sign-in isn't linked to a person in the Staff list yet, so nothing can be assigned to you. ${S.admin?"Link yourself in Staff list under Platform sign-in.":"Ask the administrator to link you."}</div>`;
  const all=workItems().filter(i=>i.assignee===me.id);
  const open=all.filter(i=>i.state==="open").sort((a,b)=>(isOver(b)-isOver(a))||((a.due||9e15)-(b.due||9e15)));
  const done=all.filter(i=>i.state==="done").sort((a,b)=>(b.doneAt||0)-(a.doneAt||0)).slice(0,30);
  const lm=S.cases.filter(c=>["with_lm","consequence"].includes(c.status)&&((c.intake||{}).lmId===me.id||(c.intake||{}).superiorId===me.id));
  const dueToday=open.filter(i=>i.due&&dateOf(i.due)===todayD()).length;
  return `<p class="lead">Hello ${esc((me.name||"").split(" ")[0])}. ${open.length?`You have ${open.length} open item${open.length>1?"s":""}${open.filter(isOver).length?`, ${open.filter(isOver).length} overdue`:""}${dueToday?`, ${dueToday} due today`:""}.`:"You're all clear."}${S.venture?` Showing ${esc(scopeLabel())} only.`:""}</p>
  <div class="figs4"><div><b>${open.length}</b><span>Open</span></div><div class="${open.filter(isOver).length?"warn":""}"><b>${open.filter(isOver).length}</b><span>Overdue</span></div><div><b>${done.filter(i=>i.doneAt>=nowMs()-30*864e5).length}</b><span>Done in 30 days</span></div><div><b>${fmtTat(avg(done.map(tatOf)))}</b><span>Average turnaround</span></div></div>
  ${lm.length?`<h2 class="h3">Cases waiting for you as line manager</h2>${itemTable(lm.map(c=>({kind:"case",id:c.ref,sec:isCallback(c)?"callbacks":"complaints",title:c.ref+" · "+(c.subject||c.type),assignee:me.id,state:"open",stage:ST[c.status],created:c.stageAt,due:dueOf(c)})),false,"")}`:""}
  ${(()=>{ const mine=S.cases.filter(c=>(c.pendingCalls||[]).some(x=>x.by===S.uid)); return mine.length?`<div class="callout amb"><b>Calls you started that aren't logged yet</b>${mine.map(c=>`<div><button class="linkbtn" data-act="cxOpenOther" data-ref="${esc(c.ref)}">${esc(c.ref)}</button> started ${esc(fmtDT(c.pendingCalls.find(x=>x.by===S.uid).at))}</div>`).join("")}</div>`:""; })()}
  ${(()=>{ const a=S.tatLog.filter(x=>x.staffId===me.id&&x.month===monthOf(nowMs())); return a.length?`<p class="hint">${a.length} time limit breach${a.length>1?"es":""} recorded for you this month.</p>`:""; })()}
  ${(()=>{ const rt=S.recs.filter(r=>r.route&&r.route.hopId===me.id&&r.status!=="Closed"); return rt.length?`<h2 class="h3">Findings routed to your team</h2><div class="tbl"><table><thead><tr><th>Reference</th><th>Section</th><th>Priority</th><th>Routed</th><th>Update expected by</th><th>Status</th></tr></thead><tbody>${rt.map(r=>`<tr class="click" data-act="openItem" data-kind="rec" data-sec="${esc(r.section)}" data-id="${esc(r.id)}" tabindex="0"><td><b>${esc(r.ref||r.id)}</b></td><td>${esc(NAVMAP[r.section].label)}</td><td>${prioTag(r.priority)}</td><td>${stampCell(r.route.routedAt)}</td><td>${r.route.dueDate&&r.route.dueDate<todayD()&&r.status!=="Ready for retest"?`<span class="tag red">${esc(fmtD(r.route.dueDate))}</span>`:esc(fmtD(r.route.dueDate))}</td><td><span class="tag cx">${esc(r.status)}</span></td></tr>`).join("")}</tbody></table></div>`:""; })()}
  <h2 class="h3">Open</h2>${itemTable(open,false,"Nothing is assigned to you right now.")}
  <h2 class="h3">Recently done</h2>${itemTable(done,false,"Nothing completed yet.")}`;
}
const avg=a=>{ a=a.filter(x=>x!=null&&!isNaN(x)); return a.length?a.reduce((s,x)=>s+x,0)/a.length:null; };

/* ---- Team workload (Chief Q&G / admin) ---- */
function viewTeam(){
  if(!isChief()) return `<div class="emptybox">Team workload is visible to the Chief Q&G and the administrator.</div>`;
  const ui=S.ui.team||(S.ui.team={days:30,who:null,newTask:false});
  const from=nowMs()-ui.days*864e5, items=workItems().filter(i=>i.state!=="waiting");
  const people=qgStaff(), rows=[...people.map(p=>({id:p.id,name:p.name})),{id:null,name:"Unassigned"}];
  const stat=id=>{ const mine=items.filter(i=>i.assignee===id), open=mine.filter(i=>i.state==="open"), done=mine.filter(i=>i.state==="done"&&i.doneAt>=from);
    const bySec={}; open.forEach(i=>bySec[i.sec]=(bySec[i.sec]||0)+1);
    return {open:open.length,over:open.filter(isOver).length,done:done.length,tat:avg(done.map(tatOf)),oldest:open.length?Math.max(...open.map(i=>workHoursBetween(i.created,nowMs(),S.cfg))):null,bySec}; };
  const tbl=`<div class="tbl"><table><thead><tr><th>Person</th><th class="n">Open</th><th class="n">Overdue</th><th class="n">Done in ${ui.days} days</th><th>Average turnaround</th><th>Oldest open item</th><th>Open by section</th></tr></thead><tbody>
    ${rows.map(r=>{ const s=stat(r.id); if(r.id===null&&!s.open&&!s.done) return ""; return `<tr class="click" data-act="teamWho" data-id="${esc(r.id||"none")}" tabindex="0"${ui.who===(r.id||"none")?' aria-selected="true"':""}><td><b>${esc(r.name)}</b></td><td class="n">${s.open}</td><td class="n">${s.over?`<span class="tag red">${s.over}</span>`:0}</td><td class="n">${s.done}</td><td>${esc(fmtTat(s.tat))}</td><td>${s.oldest==null?"–":esc(fmtTat(s.oldest))}</td><td class="wrap">${Object.entries(s.bySec).map(([k,n])=>`<span class="tag">${esc((NAVMAP[k]||{label:"Tasks"}).label)} ${n}</span>`).join(" ")}</td></tr>`; }).join("")}
  </tbody></table></div>`;
  const tot={open:items.filter(i=>i.state==="open").length,over:items.filter(isOver).length,done:items.filter(i=>i.state==="done"&&i.doneAt>=from).length,un:items.filter(i=>i.state==="open"&&!i.assignee).length};
  const who=ui.who, sel=who?items.filter(i=>(i.assignee||"none")===who).sort((a,b)=>(a.state==="done")-(b.state==="done")||(isOver(b)-isOver(a))||((b.doneAt||0)-(a.doneAt||0))):null;
  return `<div class="row between"><div class="chips">${[7,30,90].map(d=>`<button class="chip" data-act="teamDays" data-v="${d}" aria-pressed="${ui.days===d}">${d} days</button>`).join("")}</div><button class="btn primary" data-act="taskNew">Assign a task</button></div>
  ${!people.length?`<div class="callout amb">No Q&G team is set up yet. In Staff list, add a team of kind “Q&G team” and put your team members in it.</div>`:""}
  ${ui.newTask?taskForm(null):""}
  <div class="figs4"><div><b>${tot.open}</b><span>Open across the team</span></div><div class="${tot.over?"warn":""}"><b>${tot.over}</b><span>Overdue</span></div><div class="${tot.un?"warn":""}"><b>${tot.un}</b><span>Unassigned</span></div><div><b>${tot.done}</b><span>Done in ${ui.days} days</span></div></div>
  ${tbl}<p class="hint">Turnaround is measured in working hours from when an item was created to when it was completed. Customer cases count here while they sit at a Q&G stage; time with line managers is tracked on the case itself.</p>
  ${sel?`<h2 class="h3">${esc(who==="none"?"Unassigned items":personName(who))}</h2>${itemTable(sel,false,"No items.")}`:""}`;
}
function taskForm(t){
  const k=t?"task-"+t.id:"task-new";
  return `<div class="form inset"><b>${t?"Edit task":"Assign a task"}</b><div class="g3">
    <label class="f"><span class="req">Task</span><input data-d="${k}" data-f="title" value="${esc(dv(k,"title",t&&t.title))}"></label>
    <label class="f"><span class="req">Assign to</span><select data-d="${k}" data-f="assigneeId">${qgOpts(dv(k,"assigneeId",t&&t.assigneeId))}</select></label>
    <label class="f"><span>Due date</span><input type="date" data-d="${k}" data-f="due" value="${esc(dv(k,"due",t&&t.due))}" min="${todayD()}"></label></div>
    <div class="g3"><label class="f"><span>Related section</span><select data-d="${k}" data-f="section">${opts(Object.keys(NAVMAP).filter(x=>!NAVMAP[x].admin&&!["home","mywork","team"].includes(x)).map(x=>({v:x,l:NAVMAP[x].label})),dv(k,"section",t&&t.section),"None")}</select></label>
    <label class="f"><span>Related reference</span><input data-d="${k}" data-f="linkRef" value="${esc(dv(k,"linkRef",t&&t.linkRef))}" placeholder="For example, CX-2026-000004"></label>
    <label class="f"><span>Venture</span><select data-d="${k}" data-f="venture">${opts([{v:"",l:"Group-wide"},...ventures().map(v=>({v:v.id,l:v.name}))],dv(k,"venture",t?t.venture||"":S.venture))}</select></label>
    <label class="f"><span>Priority</span><select data-d="${k}" data-f="priority">${opts(["Normal","High","Critical"],dv(k,"priority",t?t.priority:"Normal"))}</select></label></div>
    <label class="f"><span>Detail</span><textarea rows="3" data-d="${k}" data-f="detail">${esc(dv(k,"detail",t&&t.detail))}</textarea></label>
    <div class="row"><button class="btn primary" data-act="taskSave"${t?` data-id="${esc(t.id)}"`:""}>${t?"Save task":"Assign task"}</button><button class="btn" data-act="taskCancel"${t?` data-id="${esc(t.id)}"`:""}>Cancel</button></div></div>`;
}
function viewTask(t){
  const me=meStaff(), mine=me&&t.assigneeId===me.id, can=mine||isChief(), k="task-"+t.id;
  if((S.ui["task-"+t.id]||{}).edit&&isChief()) return taskForm(t);
  return `<div class="crumbs"><button class="linkbtn" data-act="taskBack">Back</button> / Task</div><h2 class="h2">${esc(t.title)} <span class="tag ${t.status==="Done"?"ok":"cx"}">${esc(t.status)}</span></h2>
  <div class="split"><div>${kv([["Assigned to",esc(personName(t.assigneeId))],["Assigned by",esc(t.createdByName)+" on "+esc(fmtDT(t.createdAt))],["Last updated",esc(fmtDT(t.updatedAt||t.createdAt))],["Due",t.due?esc(fmtD(t.due)):""],["Priority",esc(t.priority)],["Section",t.section?esc((NAVMAP[t.section]||{}).label||t.section):""],["Reference",esc(t.linkRef)],["Detail",esc(t.detail)],["Completed",t.doneAt?esc(fmtDT(t.doneAt))+" · turnaround "+esc(fmtTat(workHoursBetween(t.createdAt,t.doneAt,S.cfg))):""]])}
  ${can&&t.status!=="Done"?`<div class="form"><label class="f"><span>Update</span><textarea rows="2" data-d="${k}" data-f="note">${esc(dv(k,"note",""))}</textarea></label>
   <div class="row">${t.status==="Open"?`<button class="btn" data-act="taskStatus" data-id="${esc(t.id)}" data-v="In progress">Start</button>`:""}<button class="btn primary" data-act="taskStatus" data-id="${esc(t.id)}" data-v="Done">Mark done</button><button class="btn" data-act="taskStatus" data-id="${esc(t.id)}" data-v="">Add update</button>${isChief()?`<button class="btn" data-act="taskEdit" data-id="${esc(t.id)}">Edit or reassign</button><button class="btn danger" data-act="taskStatus" data-id="${esc(t.id)}" data-v="Cancelled">Cancel task</button>`:""}</div></div>`:""}</div>
  <aside class="timeline"><h3>Updates</h3><ol>${[...(t.history||[])].reverse().map(h=>`<li><b>${esc(h.note)}</b><small>${esc(h.byName)}, ${esc(fmtDT(h.at))}</small></li>`).join("")}</ol></aside></div>`;
}
async function workAction(act,el){
  const id=el.dataset.id;
  if(act==="teamDays"){ S.ui.team.days=+el.dataset.v; return; }
  if(act==="teamWho"){ S.ui.team.who=S.ui.team.who===id?null:id; return; }
  if(act==="taskNew"){ (S.ui.team||(S.ui.team={days:30})).newTask=true; return; }
  if(act==="taskCancel"){ if(id) S.ui["task-"+id]={edit:false}; else S.ui.team.newTask=false; delete S.drafts[id?"task-"+id:"task-new"]; return; }
  if(act==="taskBack"){ S.sel.task=null; return; }
  if(act==="taskEdit"){ S.ui["task-"+id]={edit:true}; return; }
  if(act==="openItem"){
    const k=el.dataset.kind;
    if(k==="task"){ S.sel.task=id; return; }
    if(k==="case"){ S.sel[el.dataset.sec]=id; return go(el.dataset.sec); }
    S.sel[el.dataset.sec]=id; return go(el.dataset.sec);
  }
  if(act==="taskSave"){
    if(!isChief()) return toast("Only the Chief Q&G assigns tasks.");
    const t=id?S.tasks.find(x=>x.id===id):null, k=t?"task-"+t.id:"task-new", d=draft(k);
    const title=String(d.title??(t&&t.title)??"").trim(), assigneeId=d.assigneeId??(t&&t.assigneeId);
    if(!title||!assigneeId) return toast("Add the task and who it's for.");
    const base={title,assigneeId,due:d.due??(t&&t.due)??"",section:d.section??(t&&t.section)??"",venture:d.venture??(t?t.venture||"":S.venture),linkRef:String(d.linkRef??(t&&t.linkRef)??"").trim(),priority:d.priority??(t&&t.priority)??"Normal",detail:String(d.detail??(t&&t.detail)??"").trim(),updatedAt:nowMs()};
    if(t){ const note=t.assigneeId!==assigneeId?"Reassigned from "+personName(t.assigneeId)+" to "+personName(assigneeId):"Edited";
      if(!await patch("mod/work/tasks/"+t.id,{...base,history:[...(t.history||[]),{at:nowMs(),byName:S.meName,note}]})) return;
      if(t.assigneeId!==assigneeId) sendMail({to:[emailOf(assigneeId)],subject:"Task assigned to you: "+title,lines:[`${S.meName} assigned you a task: ${title}.`,base.due?`Due ${fmtD(base.due)}.`:"",base.detail].filter(Boolean),ref:t.id,kind:"task"});
      S.ui["task-"+t.id]={edit:false}; delete S.drafts[k]; return toast("Saved."); }
    const nt={id:rid("tsk-"),...base,status:"Open",createdAt:nowMs(),createdBy:S.uid,createdByName:S.meName,history:[{at:nowMs(),byName:S.meName,note:"Assigned to "+personName(assigneeId)}]};
    if(!await put("mod/work/tasks/"+nt.id,nt)) return;
    await addAudit("task",nt.id,"Assigned",null,null,title+" → "+personName(assigneeId));
    sendMail({to:[emailOf(assigneeId)],subject:"Task assigned to you: "+title,lines:[`${S.meName} assigned you a task: ${title}.`,base.due?`Due ${fmtD(base.due)}.`:"",base.detail].filter(Boolean),ref:nt.id,kind:"task"});
    S.ui.team.newTask=false; delete S.drafts[k]; return toast("Task assigned to "+personName(assigneeId)+".");
  }
  if(act==="taskStatus"){
    const t=S.tasks.find(x=>x.id===id); if(!t) return; const d=draft("task-"+id), v=el.dataset.v, note=String(d.note||"").trim();
    if(!v&&!note) return toast("Write the update first.");
    const p={updatedAt:nowMs(),history:[...(t.history||[]),{at:nowMs(),byName:S.meName,note:(v?"Status: "+v:"Update")+(note?". "+note:"")}]};
    if(v){ p.status=v; if(v==="Done") p.doneAt=nowMs(); }
    if(!await patch("mod/work/tasks/"+id,p)) return;
    if(v==="Done"&&t.createdBy!==S.uid) sendMail({to:chiefEmails(),subject:"Task done: "+t.title,lines:[`${S.meName} completed: ${t.title}.`,note].filter(Boolean),ref:id,kind:"task"});
    delete S.drafts["task-"+id]; return toast(v?"Updated.":"Update added.");
  }
}

/* ---- Open questions (pending list) ---- */
const QSTATUS=["Open","Parked","Answered"];
function questionsFor(sec){ return S.questions.filter(q=>q.section===sec).sort((a,b)=>(a.order||0)-(b.order||0)); }
function questionBlock(q){
  const k="q-"+q.id;
  return `<li class="qitem ${q.status.toLowerCase()}"><div class="row between"><b>${esc(q.q)}</b><span class="tag ${q.status==="Answered"?"ok":q.status==="Parked"?"amb":"cx"}">${esc(q.status)}</span></div>
   ${q.why?`<p class="hint">${esc(q.why)}</p>`:""}
   <p class="hint" style="margin:0">Raised ${esc(fmtDT(q.askedAt))}${q.parkedAt&&q.status==="Parked"?" · parked "+esc(fmtDT(q.parkedAt)):""}</p>
   ${q.answer&&!(S.ui[k]||{}).edit?`<p class="ans">${esc(q.answer)}</p><p class="hint">Answered ${esc(fmtDT(q.answeredAt))}</p>`:""}
   ${S.admin&&(!q.answer||(S.ui[k]||{}).edit)?`<label class="f"><span>Your answer</span><textarea rows="2" data-d="${k}" data-f="answer">${esc(dv(k,"answer",q.answer||""))}</textarea></label>`:""}
   ${S.admin?`<div class="row">${!q.answer||(S.ui[k]||{}).edit?`<button class="btn sm primary" data-act="qAnswer" data-id="${esc(q.id)}">Save answer</button>`:`<button class="btn sm" data-act="qEdit" data-id="${esc(q.id)}">Change answer</button>`}${q.status!=="Parked"?`<button class="btn sm" data-act="qStatus" data-id="${esc(q.id)}" data-v="Parked">Park</button>`:`<button class="btn sm" data-act="qStatus" data-id="${esc(q.id)}" data-v="Open">Bring back</button>`}</div>`:""}</li>`;
}
function viewQuestions(){
  const ui=S.ui.questions||(S.ui.questions={st:"Open",sec:""});
  const list=S.questions.filter(q=>!ui.st||q.status===ui.st).filter(q=>!ui.sec||q.section===ui.sec);
  const secs=[...new Set(S.questions.map(q=>q.section))];
  const groups=secs.filter(s=>!ui.sec||s===ui.sec).map(s=>[s,list.filter(q=>q.section===s).sort((a,b)=>(a.order||0)-(b.order||0))]).filter(([,l])=>l.length);
  return `<div class="tools"><div class="chips">${QSTATUS.concat([""]).map(s=>`<button class="chip" data-act="qFilter" data-v="${s}" aria-pressed="${ui.st===s}">${s||"All"} <span class="cnt">${S.questions.filter(q=>!s||q.status===s).length}</span></button>`).join("")}</div>
   <div class="row"><select data-ui="questions.sec">${opts(secs.map(s=>({v:s,l:(NAVMAP[s]||{label:"Platform-wide"}).label})),ui.sec,"All sections")}</select>${S.admin?`<button class="btn" data-act="qNew">Add a question</button><button class="btn" data-act="qExport">Download as a document</button>`:""}</div></div>
   ${ui.newQ?`<div class="form inset"><div class="g2"><label class="f"><span class="req">Question</span><input data-d="q-new" data-f="q" value="${esc(dv("q-new","q",""))}"></label><label class="f"><span>Section</span><select data-d="q-new" data-f="section">${opts(Object.keys(NAVMAP).filter(k=>!NAVMAP[k].admin).map(k=>({v:k,l:NAVMAP[k].label})).concat([{v:"platform",l:"Platform-wide"}]),dv("q-new","section","platform"))}</select></label></div><div class="row"><button class="btn primary" data-act="qCreate">Add</button><button class="btn" data-act="qNew">Cancel</button></div></div>`:""}
   ${groups.length?groups.map(([s,l])=>`<section class="qgroup"><h2 class="h3">${esc((NAVMAP[s]||{label:"Platform-wide"}).label)}</h2><ol class="qlist">${l.map(questionBlock).join("")}</ol></section>`).join(""):`<div class="emptybox">No questions in this view.</div>`}`;
}
async function qAction(act,el){
  const id=el.dataset.id, q=S.questions.find(x=>x.id===id);
  if(act==="qFilter"){ S.ui.questions.st=el.dataset.v; return; }
  if(act==="qNew"){ (S.ui.questions||(S.ui.questions={st:"Open"})).newQ=!S.ui.questions.newQ; return; }
  if(!S.admin) return;
  if(act==="qEdit"){ S.ui["q-"+id]={edit:true}; return; }
  if(act==="qCreate"){ const d=draft("q-new"); if(!String(d.q||"").trim()) return toast("Write the question."); const nq={id:rid("q-"),section:d.section||"platform",q:d.q.trim(),status:"Open",order:nowMs(),askedAt:nowMs()}; if(await put("mod/pb/questions/"+nq.id,nq)){ delete S.drafts["q-new"]; S.ui.questions.newQ=false; } return; }
  if(act==="qAnswer"){ const a=String(draft("q-"+id).answer||"").trim(); if(!a) return toast("Write your answer first."); if(await patch("mod/pb/questions/"+id,{answer:a,status:"Answered",answeredAt:nowMs()})){ delete S.drafts["q-"+id]; S.ui["q-"+id]={edit:false}; toast("Saved. It will shape the next playbook version."); } return; }
  if(act==="qStatus"){ await patch("mod/pb/questions/"+id,{status:el.dataset.v,[el.dataset.v==="Parked"?"parkedAt":"reopenedAt"]:nowMs()}); return; }
}
