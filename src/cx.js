/* ================= Customer experience journey ================= */
const ST={intake:"Q&G intake",with_lm:"With line manager",qg_review:"Q&G review",consequence:"Consequence with line manager",dispute:"Dispute with Chief Q&G",ready_internal:"Ready for internal closure",closed:"Closed"};
const STAGE_SLA={intake:"intake",with_lm:"lm",qg_review:"qgReview",consequence:"consequence",dispute:"dispute",ready_internal:"qgReview"};
const OUTCOMES=["Reached","No answer","Busy","Switched off","Voicemail","Wrong number"];
const VERDICTS=["Valid","Partially valid","Not valid"];
const isOpenCase=c=>c.status!=="closed";
const isCallback=c=>c.type==="Callback request";
function dueOf(c){ const k=STAGE_SLA[c.status]; if(!k) return null; return addWorkHours(c.stageAt||c.createdAt,S.cfg.sla[k]||10,S.cfg); }
const overdue=c=>{ const d=dueOf(c); return d!=null&&d<nowMs(); };
function ownerLabel(c){
  if(["intake","qg_review","ready_internal"].includes(c.status)) return "Q&G";
  if(["with_lm","consequence"].includes(c.status)) return personName(c.intake&&c.intake.lmId);
  if(c.status==="dispute") return "Chief Q&G";
  return "—";
}
function canAct(c){
  if(S.admin) return true;
  const me=meStaff(), mid=me&&me.id, i=c.intake||{};
  if(["intake","qg_review","ready_internal"].includes(c.status)) return isQG();
  if(["with_lm","consequence"].includes(c.status)) return !!mid&&(mid===i.lmId||mid===i.superiorId);
  if(c.status==="dispute") return isChief();
  return false;
}
function stageRecipients(c){
  const i=c.intake||{};
  if(["intake","qg_review","ready_internal"].includes(c.status)) return {to:c.assigneeId&&emailOf(c.assigneeId)?[emailOf(c.assigneeId)]:i.routedBy&&emailOf(i.routedBy)?[emailOf(i.routedBy)]:qgEmails(),cc:[]};
  if(["with_lm","consequence"].includes(c.status)) return {to:[emailOf(i.lmId)],cc:[emailOf(i.superiorId)]};
  if(c.status==="dispute") return {to:chiefEmails(),cc:qgEmails()};
  return {to:[],cc:[]};
}
const ev=(text,note)=>({at:nowMs(),by:S.uid,byName:S.meName,ev:text,note:note||""});
async function moveCase(c,status,partial,evText,note){
  const p={...partial,status,stageAt:nowMs(),stageStartedAt:null,reminderCount:0,lastReminderAt:null,escalated:false,updatedAt:nowMs(),updatedBy:S.uid,timeline:[...(c.timeline||[]),ev(evText,note)]};
  const ok=await patch("mod/cx/cases/"+c.ref,p);
  if(ok) await addAudit("case",c.ref,evText,{status:c.status},{status},note);
  return ok?{...c,...p}:null;
}
async function markStarted(c){ if(c.stageStartedAt) return; await patch("mod/cx/cases/"+c.ref,{stageStartedAt:nowMs()}); }
function caseLine(c){ return [c.type,c.lob,(c.subject||"")].filter(Boolean).join(", "); }

/* ---- list ---- */
const QUEUES=[["mine","Needs my action"],["intake","Q&G intake"],["with_lm","With line manager"],["qg_review","Q&G review"],["consequence","Consequence"],["dispute","Disputes"],["overdue","Overdue"],["closed","Closed"],["all","All"]];
function cxCases(kind){ return S.cases.filter(c=>inV(c.venture)&&(kind==="callbacks"?isCallback(c):!isCallback(c))); }
function queueFilter(q,c){
  if(q==="mine") return isOpenCase(c)&&canAct(c)&&(!S.admin||isQG()?true:true);
  if(q==="overdue") return isOpenCase(c)&&overdue(c);
  if(q==="all") return true;
  if(q==="consequence") return c.status==="consequence"||c.status==="ready_internal";
  return c.status===q;
}
function viewCX(kind){
  const ui=S.ui[kind]||(S.ui[kind]={q:"mine",text:"",type:"",lob:""});
  const all=cxCases(kind);
  const sel=S.sel[kind];
  if(sel==="__new") return newCaseForm(kind);
  const c=sel&&S.cases.find(x=>x.ref===sel);
  if(c) return caseDetail(c,kind);
  const list=all.filter(c=>queueFilter(ui.q,c)).filter(c=>!ui.type||c.type===ui.type).filter(c=>!ui.lob||c.lob===ui.lob)
    .filter(c=>!ui.text||[c.ref,c.subject,c.dealRef,c.mobile,c.lob].join(" ").toLowerCase().includes(ui.text.toLowerCase()))
    .sort((a,b)=>(overdue(b)-overdue(a))||((b.createdAt||0)-(a.createdAt||0)));
  const counts=Object.fromEntries(QUEUES.map(([k])=>[k,all.filter(c=>queueFilter(k,c)).length]));
  const types=kind==="callbacks"?[]:pick("caseTypes").filter(t=>t!=="Callback request");
  return `<div class="tools">
    <div class="chips" role="group" aria-label="Queue">${QUEUES.map(([k,l])=>`<button class="chip" data-act="cxQueue" data-k="${kind}" data-q="${k}" aria-pressed="${ui.q===k}">${esc(l)} <span class="cnt${k==="overdue"&&counts[k]?" red":""}">${counts[k]}</span></button>`).join("")}</div>
    <div class="row"><input type="search" placeholder="Search reference, subject, deal ref or mobile" data-ui="${kind}.text" value="${esc(ui.text)}" class="grow">
      ${types.length?`<select data-ui="${kind}.type">${opts(types,ui.type,"All types")}</select>`:""}
      <select data-ui="${kind}.lob">${opts([...new Set(lobs().map(l=>l.lob))],ui.lob,"All LOBs")}</select>
      ${impButton(kind)}${isQG()?`<button class="btn primary" data-act="cxNew" data-k="${kind}">${kind==="callbacks"?"Log a callback request":"Register a case"}</button>`:""}</div></div>${impPanel(kind)}
  ${list.length?`<div class="tbl"><table><thead><tr><th>Reference</th><th>Registered</th><th>Type and subject</th><th>Source</th><th>Customer key</th><th>Status</th><th>Stage</th><th>With</th><th>Due</th><th>CSAT</th><th>Last updated</th></tr></thead><tbody>
    ${list.map(c=>{ const d=dueOf(c); return `<tr class="click" data-act="cxOpen" data-k="${kind}" data-ref="${esc(c.ref)}" tabindex="0"><td><b>${esc(c.ref)}</b></td><td>${stampCell(c.createdAt)}</td><td>${esc(caseLine(c))}</td><td>${esc(c.source)}</td><td>${esc(c.dealRef||maskMobile(c.mobile))}</td>
      <td>${tsTag(c)}</td><td><span class="muted">${esc(ST[c.status])}</span></td><td>${esc(ownerLabel(c))}</td>
      <td>${c.status==="closed"?'<span class="muted">Closed '+esc(fmtD(c.closure&&c.closure.internalAt))+"</span>":d?(d<nowMs()?`<span class="tag red">Overdue ${esc(fmtDT(d))}</span>`:esc(fmtDT(d))):""}${c.escalated?' <span class="tag amb">Escalated</span>':""}</td><td>${c.csat&&c.csat.status==="Captured"?`<span class="csatpill cs${c.csat.score}">${c.csat.score}/5</span>`:c.csat?'<span class="muted">'+esc(c.csat.status)+'</span>':""}</td><td>${stampCell(c.updatedAt||c.createdAt)}</td></tr>`; }).join("")}
  </tbody></table></div>`:`<div class="emptybox">${ui.q==="mine"?"Nothing is waiting for your action.":"No cases in this view."}${isQG()&&!all.length?` Register the first ${kind==="callbacks"?"callback request":"case"} to start the journey.`:""}</div>`}`;
}

/* ---- new case ---- */
function newCaseForm(kind){
  const k="new-"+kind, cb=kind==="callbacks";
  const types=cb?["Callback request"]:pick("caseTypes").filter(t=>t!=="Callback request");
  { const d0=draft(k); if(!d0.type||!types.includes(d0.type)) d0.type=types[0]; }
  return `<div class="crumbs"><button class="linkbtn" data-act="cxBack" data-k="${kind}">${cb?"Callbacks":"Complaints management"}</button> / New</div>
  <h2 class="h2">${cb?"Log a callback request":"Register a case"}</h2>
  ${(S.drafts[k]||{}).linkedTo?`<div class="callout">Follow-up to <b>${esc(S.drafts[k].linkedTo)}</b>. The new case will be linked to it.</div>`:""}
  <p class="lead">Record only a mobile number or a deal reference as the customer key. Don't type customer names, emails or Emirates ID anywhere on the platform.</p>
  ${ventureStep(k,formVenture(k),S.venture)}
  ${!formVenture(k)?"":`<div class="form">
    <div class="g3">
      <label class="f"><span class="req">Type</span><select data-d="${k}" data-f="type">${opts(types,dv(k,"type",types[0]))}</select></label>
      <label class="f"><span class="req">Source channel</span><select data-d="${k}" data-f="source">${opts(pick("sources"),dv(k,"source",""),"Choose source")}</select></label>
      <label class="f"><span class="req">Received</span><input type="datetime-local" data-d="${k}" data-f="received" value="${esc(dv(k,"received",dLocal(nowMs()).toISOString().slice(0,16)))}"></label>
    </div>
    <div class="g3">
      <label class="f"><span>Customer mobile</span><input inputmode="tel" data-d="${k}" data-f="mobile" value="${esc(dv(k,"mobile",""))}" placeholder="05X XXX XXXX"></label>
      <label class="f"><span>Deal reference</span><input data-d="${k}" data-f="dealRef" value="${esc(dv(k,"dealRef",""))}" placeholder="CRM or policy deal ref"></label>
      <label class="f"><span class="req">Line of business</span><select data-d="${k}" data-f="lob">${opts(lobsFor(formVenture(k)),dv(k,"lob",""),"Choose LOB")}</select></label>
    </div>
    <p class="hint">Give at least one of mobile or deal reference. Open cases for the same customer are checked as you type.</p>
    ${dupBox(k,formVenture(k))}
    ${classifyFields(k,null,formVenture(k),(dv(k,"lob","")||"").split("|")[1]||"",false)}
    <div class="g3">
      <label class="f"><span>Priority</span><select data-d="${k}" data-f="priority">${opts(["Normal","High","Critical"],dv(k,"priority","Normal"))}</select></label>
      <label class="f"><span>Staff member concerned</span><select data-d="${k}" data-f="staffId">${opts(staffFor(formVenture(k)).map(p=>({v:p.id,l:p.name+" ("+teamName((asgAt(p)||{}).teamId)+")"})),dv(k,"staffId",""),"Not known yet")}</select></label>
      <label class="f"><span>Source reference</span><input data-d="${k}" data-f="extRef" value="${esc(dv(k,"extRef",""))}" placeholder="Email subject, review link or call ID"></label>
    </div>
    <label class="f"><span class="req">Subject</span><input data-d="${k}" data-f="subject" value="${esc(dv(k,"subject",""))}" maxlength="140"></label>
    <label class="f"><span class="req">Additional information: the full details of what the customer raised</span><textarea data-d="${k}" data-f="description" rows="5">${esc(dv(k,"description",""))}</textarea></label>
    ${ASSETS?`<label class="f"><span>Supporting documents (emails, screenshots, PDFs)</span><input type="file" multiple data-cxnewfile="${esc(k)}" accept="image/*,.pdf,.txt,.eml"></label>${(S.drafts[k]&&S.drafts[k].files||[]).length?`<p class="hint">Attached: ${S.drafts[k].files.map(f=>esc(f.name)).join(", ")}</p>`:""}`:""}
    <p class="hint">Register with the basics now. Complaint type, nature, root cause, validity and actions can be added or corrected during the investigation.</p>
    <div class="row"><button class="btn primary" data-act="cxCreate" data-k="${kind}">${cb?"Log callback request":"Register case"}</button><button class="btn" data-act="cxBack" data-k="${kind}">Cancel</button></div>
  </div>`}`;
}
async function createCase(kind){
  const k="new-"+kind, d=draft(k), cb=kind==="callbacks";
  const type=d.type||(cb?"Callback request":pick("caseTypes").filter(t=>t!=="Callback request")[0]);
  const p=[];
  const fv=formVenture(k); if(!fv) return toast("Choose the venture first.");
  if(d.lob&&d.lob.split("|")[0]!==fv) d.lob="";
  if(!d.source) p.push("source channel"); if(!d.lob) p.push("line of business"); if(!String(d.subject||"").trim()) p.push("subject"); if(!String(d.description||"").trim()) p.push("what the customer raised");
  if(!identOk(d.mobile,d.dealRef)) p.push("a mobile number or deal reference");
  const rec=d.received?localToMs(d.received.slice(0,10),d.received.slice(11,16)):nowMs();
  if(rec>nowMs()+60e3) p.push("a received time that isn't in the future");
  if(/@[^@\s]+\.[a-z]{2,}/i.test(d.description||"")) p.push("a description without email addresses");
  if(type==="Service – Request"&&!d.requestSubtype) p.push("the request type");
  if(dupMatches(fv,d.mobile,d.dealRef).length&&!d.notDup) return toast("This customer already has an open case. Add it as a note there, or tick that it's a new, separate issue.");
  if(p.length){ toast("Add "+p.join(", ")+"."); return; }
  const [venture,lob]=d.lob.split("|");
  const ref=await nextRef(cb?"CB":"CX");
  const c={ref,type,source:d.source,receivedAt:rec,mobile:String(d.mobile||"").trim(),dealRef:String(d.dealRef||"").trim(),venture,lob,subject:d.subject.trim(),description:d.description.trim(),
    priority:d.priority||"Normal",staffId:d.staffId||null,staffTeamId:d.staffId?((asgAt(S.staff[d.staffId],dateOf(rec))||{}).teamId||null):null,extRef:d.extRef||"",
    assigneeId:(meStaff()&&isQG())?meStaff().id:null,status:"intake",stageAt:nowMs(),createdAt:nowMs(),createdBy:S.uid,createdByName:S.meName,updatedAt:nowMs(),linkedTo:d.linkedTo||null,requestSubtype:type==="Service – Request"?d.requestSubtype:"",product:classifyValues(d).product||"",complaintType:isComplaintType(type)?d.complaintType||"":"",nature:isComplaintType(type)?(classifyValues(d).nature||""):"",flag:flagOf(type),files:d.files||[],
    intake:{},lm:{attempts:[]},review:{},closure:{},notes:[],qgAttempts:[],pendingCalls:[],timeline:[ev("Registered","Source: "+d.source+(d.notDup?". Confirmed as a separate issue from "+dupMatches(fv,d.mobile,d.dealRef).map(x=>x.ref).join(", "):""))]};
  if(!await put("mod/cx/cases/"+ref,c)) return;
  await addAudit("case",ref,"Registered",null,{type,source:d.source,lob});
  delete S.drafts[k]; S.sel[kind]=ref; render();
  if(c.linkedTo){ const o=S.cases.find(x=>x.ref===c.linkedTo); if(o) await patch("mod/cx/cases/"+o.ref,{timeline:[...(o.timeline||[]),sysEv("Follow-up case raised",ref)],updatedAt:nowMs()}); }
  const routed=await maybeAutoRoute(c);
  if(routed.status==="with_lm"){ toast(ref+" registered and routed to "+personName(routed.intake.lmId)+"."); return; }
  sendMail({to:qgEmails(),subject:`New ${type.toLowerCase()} for Q&G intake: ${ref}`,lines:[`${ref} was registered from ${d.source} for ${lob}.`,`Subject: ${c.subject}`,`It is in the Q&G intake queue. First review is due by ${fmtDT(dueOf(c))}.`],ref,kind:"intake"});
  toast(ref+" registered.");
}

/* ---- detail ---- */
function stageTimes(c){
  const i=c.intake||{}, lm=c.lm||{}, r=c.review||{}, cl=c.closure||{}, rets=(lm.returns||[]), lastRet=rets.length?rets[rets.length-1].at:null;
  const closedAtIntake=c.status==="closed"&&!i.routedAt;
  return {
    1:{start:c.receivedAt,end:c.createdAt,startLabel:"Received",endLabel:"Registered"},
    2:{start:c.createdAt,end:i.routedAt||(closedAtIntake?cl.internalAt:null)},
    3:{start:lastRet&&(!lm.submittedAt||lastRet<lm.submittedAt)?lastRet:i.routedAt,end:lm.submittedAt,first:i.routedAt},
    4:{start:lm.submittedAt,end:r.at},
    5:{start:cl.externalAt||r.at,end:cl.internalAt},
    6:{start:(c.dispute||{}).at,end:(c.dispute||{}).decidedAt}
  };
}
function stampLine(t,state,c){
  if(!t||!t.start) return "";
  const s=ts(t.start), e=ts(t.end), parts=[`${esc(t.startLabel||"Started")} ${stampCell(s)}`];
  if(!isNaN(e)) parts.push(`${esc(t.endLabel||"Finished")} ${stampCell(e)}`, `took ${esc(fmtTat(workHoursBetween(s,e,S.cfg)))}`);
  else if(state==="active") parts.push(`open for ${esc(fmtTat(workHoursBetween(s,nowMs(),S.cfg)))}`, `due ${stampCell(dueOf(c))}`);
  if(t.first&&ts(t.first)!==s) parts.push(`first routed ${stampCell(t.first)}`);
  return `<div class="stamps">${parts.join('<span class="dot">·</span>')}</div>`;
}
function sect(n,title,state,body,owner,times,c){ return `<section class="stage ${state}"><header><span class="no">${n}</span><h3>${esc(title)}</h3>${owner?`<span class="own">${esc(owner)}</span>`:""}<span class="st">${state==="done"?"Done":state==="active"?"In progress":state==="skip"?"Not needed":"Not started"}</span></header>${times?stampLine(times,state,c):""}<div class="b">${body}</div></section>`; }
const kv=(rows)=>`<dl class="kv">${rows.filter(r=>r&&r[1]!==undefined&&r[1]!==""&&r[1]!==null).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
const yn=v=>v==="yes"?"Yes":v==="no"?"No":"—";
function stageState(c,idx){
  const order=["intake","with_lm","qg_review","closure","consequence","dispute"];
  const pos={intake:0,with_lm:1,qg_review:2,consequence:4,ready_internal:4,dispute:5,closed:9}[c.status];
  if(idx===5) return c.dispute?(c.status==="dispute"?"active":"done"):"skip";
  if(idx===4){ if(c.status==="closed") return (c.review||{}).consequence&&c.review.consequence!=="None"?"done":"skip"; return ["consequence","ready_internal","dispute"].includes(c.status)?"active":"todo"; }
  if(idx===3){ return (c.closure||{}).externalAt?"done":"todo"; }
  return pos>idx?"done":pos===idx?"active":"todo";
}
function caseDetail(c,kind){
  const k=c.ref, act=canAct(c), d=dueOf(c), i=c.intake||{}, lm=c.lm||{attempts:[]}, r=c.review||{}, cl=c.closure||{}, ST_T=stageTimes(c);
  const head=`<div class="crumbs"><button class="linkbtn" data-act="cxBack" data-k="${kind}">${kind==="callbacks"?"Callbacks":"Complaints management"}</button> / ${esc(c.ref)}</div>
  <div class="casehead"><div><h2 class="h2">${vChip(c.venture)} ${esc(c.ref)} ${tsTag(c)} <span class="tag ${c.status==="closed"?"ok":"cx"}">${esc(ST[c.status])}</span>${c.escalated?' <span class="tag amb">Escalated</span>':""}</h2>
  <p class="lead">${esc(caseLine(c))} ${targetLine(c)}</p>
  ${(c.convertedFrom||[]).length?`<p class="hint">Converted from ${esc(c.convertedFrom[c.convertedFrom.length-1].fromType)} by ${esc(c.convertedFrom[c.convertedFrom.length-1].byName)}, ${esc(fmtDT(c.convertedFrom[c.convertedFrom.length-1].at))}.</p>`:""}
  ${isCallback(c)&&(S.admin||isQG())&&c.status!=="closed"?`<div class="callout amb"><b>This is a callback request.</b> If it's actually a complaint, convert it. The reference, call log and full history stay the same.
    <div class="row" style="margin-top:6px"><button class="btn sm primary" data-act="cxConvert" data-ref="${esc(c.ref)}">Convert to complaint</button></div></div>`:""}
  <div class="stamps flat">Received ${stampCell(c.receivedAt)}<span class="dot">·</span>Registered ${stampCell(c.createdAt)}<span class="dot">·</span>Last updated ${stampCell(c.updatedAt||c.createdAt)}<span class="dot">·</span>${c.status==="closed"?"Total time "+esc(fmtTat(workHoursBetween(c.createdAt,ts((c.closure||{}).internalAt),S.cfg))):"Open for "+esc(fmtTat(workHoursBetween(c.createdAt,nowMs(),S.cfg)))}</div>
  <div class="row"><label class="inline">Q&G owner ${isQG()&&c.status!=="closed"?`<select data-assign="${esc(c.ref)}">${qgOpts(c.assigneeId)}</select>`:`<b>${esc(c.assigneeId?personName(c.assigneeId):"Unassigned")}</b>`}</label></div></div>
  <div class="due">${c.status==="closed"?`Closed ${esc(fmtDT(cl.internalAt))}${cl.reason?"<br>"+esc(cl.reason):""}${isQG()?`<br><button class="btn sm" data-act="cxReopen" data-ref="${esc(c.ref)}">Reopen</button> <button class="btn sm" data-act="cxFollowUp" data-ref="${esc(c.ref)}">Raise a follow-up case</button>`:""}`:`With <b>${esc(ownerLabel(c))}</b><br>${d<nowMs()?`<span class="tag red">Overdue since ${esc(fmtDT(d))}</span>`:`Due ${esc(fmtDT(d))}`}${c.reminderCount?`<br><span class="muted">${c.reminderCount} reminder${c.reminderCount>1?"s":""} sent</span>`:""}`}</div></div>`;

  // 1 intake summary
  const s1=kv([["Type",esc(c.type)],["Source",esc(c.source)+(c.extRef?" ("+esc(c.extRef)+")":"")],["Received",esc(fmtDT(c.receivedAt))],["Customer key",esc([c.dealRef&&"Deal "+c.dealRef,c.mobile&&(isQG()?"Mobile "+c.mobile:"Mobile "+maskMobile(c.mobile))].filter(Boolean).join(", "))],
    ["Follow-up of",c.linkedTo?`<button class="linkbtn" data-act="cxOpenOther" data-ref="${esc(c.linkedTo)}">${esc(c.linkedTo)}</button>`:""],["Follow-up cases",followUps(c).map(x=>`<button class="linkbtn" data-act="cxOpenOther" data-ref="${esc(x.ref)}">${esc(x.ref)}</button>`).join(", ")],
    ["LOB",esc(c.lob)],["Policy or product",esc(c.product||"")],["Request type",esc(c.requestSubtype||"")],["Complaint type",esc(c.complaintType?c.complaintType+(c.nature?" · "+c.nature:""):"")],["Priority",esc(c.priority)],["Staff concerned",c.staffId?esc(personName(c.staffId))+(c.staffTeamId?" ("+esc(teamName(c.staffTeamId))+")":""):""],["Registered by",esc(c.createdByName||"")]])+`<p class="desc">${esc(c.description)}</p>`+((c.files||[]).length?`<p class="hint">Supporting documents: ${c.files.map(f=>`<a href="/_blob/${esc(f.id)}" target="_blank" rel="noopener">${esc(f.name)}</a>`).join(", ")}</p>`:"")
    +(isQG()&&c.status!=="closed"?`<details class="inset"><summary>Add or correct the classification</summary>${classifyFields("cl-"+c.ref,c,c.venture,c.lob,false)}
      <div class="g2"><label class="f"><span>Staff member concerned</span><select data-d="cl-${esc(c.ref)}" data-f="staffId">${opts(staffFor(c.venture).map(p=>({v:p.id,l:p.name})),dv("cl-"+c.ref,"staffId",c.staffId||""),"Not known")}</select></label>
      <label class="f"><span>Priority</span><select data-d="cl-${esc(c.ref)}" data-f="priority">${opts(["Normal","High","Critical"],dv("cl-"+c.ref,"priority",c.priority||"Normal"))}</select></label></div>
      ${ASSETS?`<label class="f"><span>Add supporting documents</span><input type="file" multiple data-cxfile="${esc(c.ref)}" accept="image/*,.pdf,.txt,.eml"></label>`:""}
      <button class="btn sm primary" data-act="cxClassify" data-ref="${esc(c.ref)}">Save classification</button></details>`:"")+rawBlock(c);

  // 2 Q&G first review & routing
  let s2;
  if(c.status==="intake"&&act){
    const allTeams=Object.values(S.teams).filter(t=>t.kind!=="qg"&&t.active!==false&&t.venture===c.venture).sort((a,b)=>a.name.localeCompare(b.name));
    const teams=allTeams.filter(t=>t.lob===c.lob), otherLobTeams=allTeams.filter(t=>t.lob!==c.lob);
    const tsel=dv(k,"teamId",""), t=S.teams[tsel];
    s2=`<div class="form">
      <label class="f"><span class="req">Q&G assessment</span><textarea rows="3" data-d="${k}" data-f="comment">${esc(dv(k,"comment",""))}</textarea></label>
      <fieldset class="f"><legend class="req">Customer contacted by Q&G</legend><div class="row">${["yes","no"].map(v=>`<label class="radio"><input type="radio" name="ct-${k}" data-d="${k}" data-f="contacted" value="${v}"${dv(k,"contacted",(c.qgAttempts||[]).length?"yes":"")===v?" checked":""}> ${v==="yes"?"Yes, Q&G is calling the customer":"No"}</label>`).join("")}</div></fieldset>
      ${dv(k,"contacted",(c.qgAttempts||[]).length?"yes":"")==="yes"?(()=>{ const qa=c.qgAttempts||[], reached=qa.some(a=>a.outcome==="Reached");
        return `<div class="inset">${pendingBanner(c,"qg")}<div class="row between"><b class="sm">Q&G call attempts${reached?"":" (up to 3)"}</b>${!reached&&qa.length<3?callBtn(c,"qg"):""}</div>${attemptsTable(qa)}
        ${!reached&&qa.length<3?`<div class="g4"><label class="f"><span class="req">Call date</span><input type="date" value="${todayD()}" disabled></label>
          <label class="f"><span class="req">Time</span><input type="time" data-d="${k}" data-f="qTime" value="${esc(dv(k,"qTime",""))}"></label>
          <label class="f"><span class="req">Call ID</span><input data-d="${k}" data-f="qCall" value="${esc(dv(k,"qCall",""))}"></label>
          <label class="f"><span class="req">Outcome</span><select data-d="${k}" data-f="qOutcome">${opts(OUTCOMES,dv(k,"qOutcome",""),"Choose")}</select></label></div>
          <button class="btn" data-act="cxQAttempt" data-ref="${k}">Log attempt ${qa.length+1}</button><p class="hint">Q&G calls are logged on the day you submit this review. Routing needs the customer reached, or three attempts.</p>`:reached?`<p class="hint">Customer reached.</p>`:`<p class="hint">Three attempts made without reaching the customer.</p>`}</div>`; })():""}
      <label class="f"><span class="req">Route to team</span><select data-d="${k}" data-f="teamId">${opts(teams.map(t=>({v:t.id,l:t.name+" · "+t.lob})),tsel,teams.length?"Choose the "+esc(c.lob)+" team":otherLobTeams.length?"No "+esc(c.lob)+" team yet; LOB is wrong, or add one in Staff list":"No "+vInfo(c.venture).name+" teams yet. Add them in Staff list")}</select></label>
      ${!teams.length&&otherLobTeams.length?`<p class="hint">This case is ${esc(c.lob)}, but the only teams set up are: ${otherLobTeams.map(t=>t.name+" ("+t.lob+")").join(", ")}. If ${esc(c.lob)} is wrong, correct it under “Add or correct the classification” above; otherwise add a ${esc(c.lob)} team in Staff list.</p>`:""}
      ${t?(()=>{ const auto=routeTargets(t,c.staffId), chosen=dv(k,"handlerId",""), tg=routeTargets(t,c.staffId,chosen||null), members=teamMembersToday(t).filter(p=>p.id!==c.staffId), venturePeople=staffFor(c.venture).filter(p=>p.id!==c.staffId);
        const needPick=!t.lineManagerId||t.lineManagerId===c.staffId;
        return `${needPick?`<div class="callout amb"><b>${esc(t.name)} has no line manager set${t.lineManagerId===c.staffId?" who isn't the person the case is about":""}.</b> Choose who handles it.${auto&&auto.lmId?" Suggested: "+esc(personName(auto.lmId))+", the team's line manager by role.":""}
          <div class="g2" style="margin-top:6px"><label class="f"><span class="req">Who handles it</span><select data-d="${k}" data-f="handlerId">${opts([...members.map(p=>({v:p.id,l:p.name+" ("+(p.roles||[]).map(roleLabel).join(", ")+")"})),...venturePeople.filter(p=>!members.includes(p)).map(p=>({v:p.id,l:p.name+" · "+teamName((asgAt(p)||{}).teamId)}))],chosen||(auto&&auto.lmId)||"","Choose person")}</select></label>
          ${S.admin?`<label class="radio" style="align-self:end"><input type="checkbox" data-d="${k}" data-f="setLm"${dv(k,"setLm",true)?" checked":""}> Also make them ${esc(t.name)}'s line manager in Staff list</label>`:""}</div></div>`:""}
          <p class="hint">Goes to <b>${esc(tg&&tg.lmId?personName(tg.lmId):"no one yet")}</b>'s queue${tg&&tg.superiorId?`, copy to <b>${esc(personName(tg.superiorId))}</b>`:""}. Response due by ${esc(fmtDT(addWorkHours(nowMs(),S.cfg.sla.lm,S.cfg)))}.</p>`; })():""}
      ${t&&routeTargets(t,c.staffId).note?`<div class="callout amb">${esc(routeTargets(t,c.staffId).note)}</div>`:""}
      <div class="row"><button class="btn primary" data-act="cxRoute" data-ref="${k}">Submit and route</button>${S.admin||isQG()?`<button class="btn" data-act="cxCloseDup" data-ref="${k}">Close as duplicate or invalid intake</button>`:""}
      ${c.noMatchSince?`<span class="tag amb">No valid match since ${esc(fmtD(c.noMatchSince))}; closes automatically after ${cxc("draftAutoCloseDays")} days</span> <button class="linkbtn" data-act="cxNoMatch" data-ref="${k}" data-v="off">Match found</button>`:`<button class="btn" data-act="cxNoMatch" data-ref="${k}" data-v="on">No valid match in CRM yet</button>`}</div></div>`;
  } else if(i.routedAt){
    s2=attemptsTable(c.qgAttempts||[])+kv([["Assessment",esc(i.comment)],["Customer contacted by Q&G",yn(i.contacted)+(i.contacted==="yes"?`, call ${esc(i.callRef)} on ${esc(fmtD(i.contactDate))} at ${esc(i.contactTime)}`:"")],["Routed to",esc(teamName(i.teamId))+": "+esc(personName(i.lmId))+", copy "+esc(personName(i.superiorId))],["Routed by",esc(personName(i.routedBy)||i.routedByName||"")+" on "+esc(fmtDT(i.routedAt))]]);
  } else s2=`<p class="muted">${c.status==="closed"?"Closed at intake: "+esc((cl.reason)||""):"Waiting for Q&G's first review."}</p>`;

  // 3 LM resolution
  let s3;
  const atts=lm.attempts||[];
  const attTable=atts.length?`<div class="tbl sm"><table><thead><tr><th>Attempt</th><th>Call date and time</th><th>Logged</th><th>Call ID</th><th>Outcome</th></tr></thead><tbody>${atts.map((a,n)=>`<tr><td>${n+1}</td><td>${esc(fmtD(a.date))} ${esc(a.time)}</td><td>${stampCell(a.at)}</td><td>${esc(a.callId)}</td><td>${a.outcome==="Reached"?'<span class="tag ok">Reached</span>':esc(a.outcome)}</td></tr>`).join("")}</tbody></table></div>`:"";
  const returns=(lm.returns||[]).map(x=>`<div class="callout amb"><b>Returned by Q&G ${esc(fmtDT(x.at))}</b> ${esc(x.reason)}</div>`).join("");
  const recalls=(c.recalls||[]);
  const recallBanner=recalls.length?recalls.map(x=>`<div class="callout amb"><b>Recalled to Q&G ${esc(fmtDT(x.at))} by ${esc(x.byName||"")}</b> ${esc(x.why)}</div>`).join(""):"";
  const recallBtn=c.status==="with_lm"&&(S.admin||isQG())?`<div class="row" style="margin-bottom:8px"><button class="btn sm" data-act="cxRecall" data-ref="${esc(c.ref)}">Recall to Q&G</button><span class="hint" style="margin:0">If this was routed to the wrong queue, or the line manager's action is incomplete.</span></div>`:"";
  if(c.status==="with_lm"&&act){
    const reached=atts.some(a=>a.outcome==="Reached"), unreachable=atts.length>=3&&!reached;
    s3=`${recallBtn}${returns}${pendingBanner(c,"lm")}${attTable}${!reached&&atts.length<3?`<div class="form inset"><div class="row between"><b class="sm">Log call attempt ${atts.length+1} of 3</b>${callBtn(c,"lm")}</div><div class="g4">
        <label class="f"><span class="req">Date</span><input type="date" data-d="${k}" data-f="aDate" value="${esc(dv(k,"aDate",todayD()))}" max="${todayD()}" min="${esc(dateOf(i.routedAt))}"></label>
        <label class="f"><span class="req">Time</span><input type="time" data-d="${k}" data-f="aTime" value="${esc(dv(k,"aTime",""))}"></label>
        <label class="f"><span class="req">Call ID</span><input data-d="${k}" data-f="aCall" value="${esc(dv(k,"aCall",""))}"></label>
        <label class="f"><span class="req">Outcome</span><select data-d="${k}" data-f="aOutcome">${opts(OUTCOMES,dv(k,"aOutcome",""),"Choose")}</select></label></div>
        ${dv(k,"aOutcome","")&&dv(k,"aOutcome","")!=="Reached"?`<div class="g2"><label class="radio"><input type="checkbox" data-d="${k}" data-f="aEmail"${dv(k,"aEmail",false)?" checked":""}> I've emailed the customer that we tried to call (required after each missed call)</label>
          <label class="f"><span>Subject line of that email</span><input data-d="${k}" data-f="aEmailSubject" value="${esc(dv(k,"aEmailSubject",""))}"></label></div>
          ${atts.length===2&&cxc("notReachableAutoClose")?`<p class="hint">This is the third attempt. If the customer isn't reached, the case closes automatically as “Customer not reachable” and Q&G is told.</p>`:""}`:""}
        <button class="btn" data-act="cxAttempt" data-ref="${k}">Log attempt</button></div>`:""}
      <div class="form">
      ${reached?`<label class="f"><span class="req">Resolution agreed with the customer</span><textarea rows="3" data-d="${k}" data-f="resolution">${esc(dv(k,"resolution",lm.resolution||""))}</textarea></label>`:""}
      ${unreachable?`<div class="callout">Three attempts without reaching the customer. Email the customer that you tried three times, then record it here.</div>
        <label class="f"><span class="req">Subject line of the email sent to the customer</span><input data-d="${k}" data-f="emailSubject" value="${esc(dv(k,"emailSubject",lm.emailSubject||""))}"></label>
        <label class="radio"><input type="checkbox" data-d="${k}" data-f="sharedWithQG"${dv(k,"sharedWithQG",lm.sharedWithQG)?" checked":""}> I've shared the email correspondence with Q&G</label>
        ${ASSETS?`<label class="f"><span>Attach the correspondence (optional)</span><input type="file" data-upload="${k}" accept=".pdf,.png,.jpg,.jpeg,.txt,.eml,.msg"></label>${lm.attachment?`<p class="hint">Attached: <a href="/_blob/${esc(lm.attachment.id)}" target="_blank" rel="noopener">${esc(lm.attachment.name)}</a></p>`:""}`:""}`:""}
      ${reached||unreachable?`<label class="f"><span class="req">Findings: what happened and why</span><textarea rows="3" data-d="${k}" data-f="findings">${esc(dv(k,"findings",lm.findings||""))}</textarea></label>
        <div class="row"><button class="btn primary" data-act="cxResolve" data-ref="${k}">Submit as resolved</button></div>`:`<p class="hint">Log each call. Submit becomes available once the customer is reached or after three unsuccessful attempts.</p>`}
      </div>`;
  } else if(lm.submittedAt){
    s3=recallBtn+returns+attTable+kv([["Resolution agreed",esc(lm.resolution)],["Email to customer",lm.emailSubject?`“${esc(lm.emailSubject)}”${lm.sharedWithQG?", shared with Q&G":""}`:""],["Attachment",lm.attachment?`<a href="/_blob/${esc(lm.attachment.id)}" target="_blank" rel="noopener">${esc(lm.attachment.name)}</a>`:""],["Findings",esc(lm.findings)],["Submitted",esc(personName(lm.submittedBy))+" on "+esc(fmtDT(lm.submittedAt))]]);
  } else s3=recallBtn+returns+(attTable||`<p class="muted">${c.status==="with_lm"?"Waiting for "+esc(personName(i.lmId))+".":"Not reached yet."}</p>`);

  // 4 Q&G assessment
  let s4;
  if(c.status==="qg_review"&&act){
    const path=dv(k,"path",""), cons=dv(k,"consequence","");
    const evs=S.evals.slice(0,200);
    s4=`<div class="form">
      <div class="g3">${[["lmCallAssessed","Line manager's call assessed"],["findingsInPlace","Findings in place"],["resolutionAligned","Resolution meets what the customer asked for"]].map(([f,l])=>`<fieldset class="f"><legend class="req">${l}</legend><div class="row">${["yes","no"].map(v=>`<label class="radio"><input type="radio" name="${f}-${k}" data-d="${k}" data-f="${f}" value="${v}"${dv(k,f,"")===v?" checked":""}> ${v==="yes"?"Yes":"No"}</label>`).join("")}</div></fieldset>`).join("")}</div>
      <label class="f"><span>Notes on the line manager's handling</span><textarea rows="2" data-d="${k}" data-f="lmCallNotes">${esc(dv(k,"lmCallNotes",""))}</textarea></label>
      ${evs.length?`<label class="f"><span>Linked QA evaluation (optional)</span><select data-d="${k}" data-f="evalId">${opts(evs.map(e=>({v:e.id,l:(e.callId||e.id)+" · "+(e.advisorName||"")+" · "+e.totalScore+"%"})),dv(k,"evalId",""),"None")}</select></label>`:""}
      <fieldset class="f"><legend class="req">How Q&G validated</legend><div class="row"><label class="radio"><input type="radio" name="path-${k}" data-d="${k}" data-f="path" value="validated"${path==="validated"?" checked":""}> Called the customer to validate</label><label class="radio"><input type="radio" name="path-${k}" data-d="${k}" data-f="path" value="reviewed"${path==="reviewed"?" checked":""}> Reviewed the record, no call</label></div></fieldset>
      ${pendingBanner(c,"val")}${path==="validated"?`<div class="row">${callBtn(c,"val")}</div><div class="g3"><label class="f"><span class="req">Call ID</span><input data-d="${k}" data-f="valCallRef" value="${esc(dv(k,"valCallRef",""))}"></label>
        <label class="f"><span class="req">Call date</span><input type="date" data-d="${k}" data-f="valDate" value="${esc(dv(k,"valDate",todayD()))}" min="${todayD()}" max="${todayD()}"></label>
        <label class="f"><span class="req">Call time</span><input type="time" data-d="${k}" data-f="valTime" value="${esc(dv(k,"valTime",""))}"></label></div>
        <label class="f"><span class="req">What the customer confirmed</span><textarea rows="2" data-d="${k}" data-f="valOutcome">${esc(dv(k,"valOutcome",""))}</textarea></label>`:""}
      <div class="g3"><label class="f"><span class="req">Root cause</span><select data-d="${k}" data-f="rootCause">${opts(pick("rootCauses"),dv(k,"rootCause",""),"Choose")}</select></label>
        <label class="f"><span class="req">Closure reason</span><select data-d="${k}" data-f="closureReason">${opts(pick("closureReasons"),dv(k,"closureReason","Resolved"))}</select></label></div>
      <div class="g3"><label class="f"><span class="req">Validity</span><select data-d="${k}" data-f="verdict">${opts(pick("validity"),dv(k,"verdict",""),"Choose")}</select></label>
        <label class="f"><span class="req">Consequence</span><select data-d="${k}" data-f="consequence">${opts(pick("consequences"),cons,"Choose")}</select></label>
        ${cons&&cons!=="None"?`<label class="f"><span class="req">Applies to</span><select data-d="${k}" data-f="consequenceStaffId">${opts(staffFor(c.venture).map(p=>({v:p.id,l:p.name})),dv(k,"consequenceStaffId",c.staffId||""),"Choose person")}</select></label>`:""}</div>
      ${cons&&cons!=="None"?`<label class="f"><span class="req">Consequence detail for the line manager</span><textarea rows="2" data-d="${k}" data-f="consequenceNote">${esc(dv(k,"consequenceNote",""))}</textarea></label>`:""}
      <fieldset class="f"><legend>Other internal actions (never shared with the customer)</legend><div class="row">${pick("internalActions").map(a=>`<label class="radio"><input type="checkbox" data-d="${k}" data-f="internalActions" data-multi="${esc(a)}"${(dv(k,"internalActions",[])||[]).includes(a)?" checked":""}> ${esc(a)}</label>`).join("")}</div></fieldset>
      <label class="f"><span>Internal action detail</span><input data-d="${k}" data-f="internalNote" value="${esc(dv(k,"internalNote",""))}" placeholder="For example, refresher on renewal disclosure for the team"></label>
      <label class="f"><span class="req">Resolution and actions for the customer (shared with them)</span><textarea rows="2" data-d="${k}" data-f="finalSummary">${esc(dv(k,"finalSummary",""))}</textarea></label>
      <div class="g3"><label class="f"><span class="req">Business outcome</span><select data-d="${k}" data-f="businessOutcome">${opts(BIZ,dv(k,"businessOutcome",""),"Choose")}</select></label>
        <label class="f"><span>Value at stake (AED, optional)</span><input type="number" min="0" step="1" data-d="${k}" data-f="businessValue" value="${esc(dv(k,"businessValue",""))}"></label>
        <label class="f"><span>Business outcome note</span><input data-d="${k}" data-f="businessNote" value="${esc(dv(k,"businessNote",""))}" placeholder="For example, renewed policy, cancelled with provider"></label></div>
      ${responseBlock(c,k)}
      ${csatForm(k,c)}
      ${csatLinkBlock(k,c)}
      <div class="row"><button class="btn primary" data-act="cxExternal" data-ref="${k}">Close for the customer (external closure)</button></div>
      <details class="inset"><summary>Return to line manager instead</summary><label class="f"><span class="req">What needs to be redone</span><textarea rows="2" data-d="${k}" data-f="returnReason">${esc(dv(k,"returnReason",""))}</textarea></label><button class="btn" data-act="cxReturn" data-ref="${k}">Return to line manager</button></details>
      </div>`;
  } else if(r.at){
    s4=kv([["Line manager's call assessed",yn(r.lmCallAssessed)],["Findings in place",yn(r.findingsInPlace)],["Resolution meets the ask",yn(r.resolutionAligned)],["Notes",esc(r.lmCallNotes)],
      ["Validation",r.path==="validated"?`Called the customer, call ${esc(r.valCallRef)} on ${esc(fmtD(r.valDate))} at ${esc(r.valTime)}. ${esc(r.valOutcome)}`:"Reviewed the record without a call"],
      ["Linked QA evaluation",r.evalId?`<button class="linkbtn" data-act="openEval" data-id="${esc(r.evalId)}">${esc(r.evalId)}</button>`:""],
      ["Business outcome",r.businessOutcome?bizTag(r.businessOutcome)+(r.businessValue?" · AED "+esc(Number(r.businessValue).toLocaleString("en-GB")):"")+(r.businessNote?" · "+esc(r.businessNote):""):""],
      ["Root cause",esc(r.rootCause||"")],["Closure reason",esc(r.closureReason||"")],["Internal actions",esc([...(r.internalActions||[]),r.internalNote].filter(Boolean).join("; "))+((r.internalActions||[]).length||r.internalNote?' <span class="tag">Internal only</span>':"")],
      ["Satisfaction link",r.csatLink?(r.csatLink.sent?"Sent"+(r.csatLink.method?" by "+esc(r.csatLink.method):""):"Not sent: "+esc(r.csatLink.reason||"")):""],
      ["Validity",esc(r.verdict)],["Consequence",esc(r.consequence)+(r.consequenceStaffId?" for "+esc(personName(r.consequenceStaffId)):"")],["Consequence detail",esc(r.consequenceNote)],["Final resolution",esc(r.finalSummary)],["Assessed by",esc(r.byName||"")+" on "+esc(fmtDT(r.at))]]);
  } else s4=`<p class="muted">After the line manager submits.</p>`;

  // 5 closure + consequence
  let s5="";
  if(cl.externalAt) s5+=kv([["External closure",esc(fmtDT(cl.externalAt))+" by "+esc(cl.externalByName||"")]]);
  if(["consequence","ready_internal"].includes(c.status)||c.consequenceAck){
    s5+=`<div class="stamps flat"><span class="tag ok">Closed for the customer</span><span class="dot">·</span><span class="tag amb">Internal: pending ${esc(r.consequence)} for ${esc(personName(r.consequenceStaffId))}</span></div>`;
  }
  if(c.status==="consequence"&&act){
    s5+=`<div class="callout"><b>Consequence to action: ${esc(r.consequence)}</b> for ${esc(personName(r.consequenceStaffId))}. Routed to ${esc(personName(i.lmId))} pending this action. ${esc(r.consequenceNote)}</div>
    <div class="form"><label class="f"><span class="req">What you did, or why you dispute it</span><textarea rows="3" data-d="${k}" data-f="ackNote">${esc(dv(k,"ackNote",""))}</textarea></label>
    <div class="row"><button class="btn primary" data-act="cxAck" data-ref="${k}">Confirm consequence actioned</button><button class="btn" data-act="cxDispute" data-ref="${k}">Dispute the consequence</button></div></div>`;
  } else if(c.consequenceAck) s5+=kv([[c.consequenceAck.action==="ack"?"Consequence actioned":"Disputed",esc(c.consequenceAck.note)+" ("+esc(c.consequenceAck.byName||"")+", "+esc(fmtDT(c.consequenceAck.at))+")"]]);
  if(c.status==="ready_internal"&&act) s5+=`<div class="callout ok"><b>Internal action confirmed.</b> Ready for Q&G to close the case in full.</div><div class="row"><button class="btn primary" data-act="cxInternal" data-ref="${k}">Close internally, with validity ${esc(r.verdict)}</button></div><p class="hint">Internal closure completes the case. The line manager and their superior get the closure email.</p>`;
  if(cl.internalAt) s5+=kv([["Internal closure",esc(fmtDT(cl.internalAt))+" by "+esc(cl.internalByName||"")]]);
  if(cl.externalAt) s5+=`<div class="csatbox"><h4>Customer satisfaction (CSAT)</h4>${csatView(c)}${isQG()&&(!c.csat||c.csat.status!=="Captured")?`<details class="inset"><summary>${c.csat?"Update CSAT":"Record CSAT"}</summary>${csatForm("csat-"+c.ref,c)}<button class="btn sm primary" data-act="cxCsat" data-ref="${esc(c.ref)}">Save CSAT</button></details>`:""}</div>`;
  if(!s5) s5=`<p class="muted">After Q&G's assessment.</p>`;

  // 6 dispute
  let s6="";
  if(c.dispute){
    s6=kv([["Line manager's verbatim",esc(c.dispute.verbatim)],["Raised",esc(fmtDT(c.dispute.at))]]);
    if(c.status==="dispute"&&act) s6+=`<div class="form"><label class="f"><span class="req">Decision</span><select data-d="${k}" data-f="decision">${opts(["Uphold the consequence","Amend the consequence","Withdraw the consequence"],dv(k,"decision",""),"Choose")}</select></label>
      ${dv(k,"decision","")==="Amend the consequence"?`<label class="f"><span class="req">Amended consequence</span><select data-d="${k}" data-f="amended">${opts(pick("consequences").filter(x=>x!=="None"),dv(k,"amended",""),"Choose")}</select></label>`:""}
      <label class="f"><span class="req">Rationale</span><textarea rows="2" data-d="${k}" data-f="decisionNote">${esc(dv(k,"decisionNote",""))}</textarea></label>
      <button class="btn primary" data-act="cxDecide" data-ref="${k}">Record decision and close</button></div>`;
    else if(c.dispute.decision) s6+=kv([["Decision",esc(c.dispute.decision)+(c.dispute.amended?": "+esc(c.dispute.amended):"")],["Rationale",esc(c.dispute.decisionNote)],["Decided by",esc(c.dispute.decidedByName||"")+" on "+esc(fmtDT(c.dispute.decidedAt))]]);
  }

  const others=dupMatches(c.venture,c.mobile,c.dealRef,c.ref);
  const tl=`<aside class="timeline">${notesBlock(c)}${others.length?`<div class="callout amb" style="margin-bottom:10px"><b>${others.length} other open case${others.length>1?"s":""} for this customer</b></div>`:""}${customerHistory(c)}<h3>Case log</h3><ol>${[...(c.timeline||[])].reverse().map(t=>`<li class="${t.sys||t.by==="system"?"sys":""}"><b>${esc(t.ev)}</b>${t.sys||t.by==="system"?' <span class="tag">System activity</span>':""}${t.note?`<span>${esc(t.note)}</span>`:""}<small>${esc(t.byName||"System")}, ${esc(fmtDT(t.at))}</small></li>`).join("")}</ol></aside>`;
  return head+`<div class="casegrid"><div>
    ${sect(1,"Intake","done",s1,"Registered",ST_T[1],c)}
    ${sect(2,"Q&G first review and routing",stageState(c,0),s2,"Q&G",ST_T[2],c)}
    ${sect(3,"Line manager resolution",stageState(c,1),s3,i.lmId?personName(i.lmId):"Line manager",ST_T[3],c)}
    ${sect(4,"Q&G assessment",stageState(c,2),s4,"Q&G",ST_T[4],c)}
    ${sect(5,"Closure and consequence management",c.status==="closed"?"done":stageState(c,4),s5,"Q&G and line manager",ST_T[5],c)}
    ${c.dispute?sect(6,"Dispute decision",stageState(c,5),s6,"Chief Q&G",ST_T[6],c):""}
  </div>${tl}</div>`;
}

/* ---- actions ---- */
function need(cond,msg,list){ if(!cond) list.push(msg); }
async function cxAction(act,ref,el){
  if(["cxNote","cxDial","cxNoConnect","cxOpenOther","cxDupNote"].includes(act)) return cxSideAction(act,ref,el);
  if(act==="cxCsat") return saveCsat(ref);
  if(act==="cxFollowUp") return startFollowUp(ref);
  if(act==="cxCopyLink"){ try{ await navigator.clipboard.writeText(cxc("csatLink")); toast("Link copied."); }catch(_){ toast("Copy the link from the box."); } return; }
  if(["cxRespDraft","cxRespApprove","cxRespNone","cxRespPosted"].includes(act)){ const cc=S.cases.find(x=>x.ref===ref); if(cc) await respAction(act,cc); return; }
  if(act==="cxRecall"){
    const cc=S.cases.find(x=>x.ref===ref); if(!cc) return;
    if(!(S.admin||isQG())) return toast("Only Q&G can recall a case.");
    if(cc.status!=="with_lm") return toast("Only a case currently with the line manager can be recalled.");
    const why=prompt("Why is "+cc.ref+" being recalled to Q&G? For example, routed to the wrong queue, or the line manager's action is incomplete."); if(!why||!why.trim()) return;
    const i=cc.intake||{};
    const n=await moveCase(cc,"intake",{recalls:[...(cc.recalls||[]),{from:i.teamId,fromLm:i.lmId,at:nowMs(),by:S.uid,byName:S.meName,why:why.trim()}]},"Recalled to Q&G",why.trim()); if(!n) return;
    sendMail({to:[emailOf(i.lmId)],cc:[emailOf(i.superiorId)],subject:`Recalled to Q&G: ${cc.ref}`,lines:[`${cc.ref} has been pulled back to Q&G by ${S.meName}, and is no longer in your queue.`,`Reason: ${why.trim()}`],ref:cc.ref,kind:"recall"});
    return toast(cc.ref+" recalled to Q&G.");
  }
  if(act==="cxConvert"){
    const cc=S.cases.find(x=>x.ref===ref); if(!cc) return;
    if(!(S.admin||isQG())) return toast("Only Q&G can convert a callback.");
    if(!isCallback(cc)) return toast("Only a callback request can be converted.");
    if(cc.status==="closed") return toast("This case is already closed.");
    if(!confirm("Convert "+cc.ref+" from a callback request to a complaint? The reference, call log and full history stay as they are; this just changes how it's handled from here.")) return;
    const conv={at:nowMs(),by:S.uid,byName:S.meName,fromType:cc.type};
    if(await patch("mod/cx/cases/"+ref,{type:"Complaint",convertedFrom:[...(cc.convertedFrom||[]),conv],updatedAt:nowMs(),timeline:[...(cc.timeline||[]),ev("Converted to Complaint","From "+cc.type+", by "+S.meName)]})){
      await addAudit("case",ref,"Converted to Complaint",{type:cc.type},{type:"Complaint"},S.meName);
      S.sel.callbacks=null; S.sel.complaints=ref; go("complaints"); toast(ref+" converted to a complaint.");
    }
    return;
  }
  if(act==="cxReopen"){ const cc=S.cases.find(x=>x.ref===ref); if(!cc||!isQG()) return; const why=prompt("Why is this case being reopened?"); if(!why||!why.trim()) return;
    await moveCase(cc,"qg_review",{closure:{},closureHistory:[...(cc.closureHistory||[]),{...(cc.closure||{}),reopenedAt:nowMs(),reopenedBy:S.meName,why:why.trim()}]},"Reopened by Q&G",why.trim()); return toast("Reopened for Q&G review."); }
  if(act==="cxClassify"){ const cc=S.cases.find(x=>x.ref===ref); if(!cc||!isQG()) return; const d=draft("cl-"+ref);
    const part={}; ["requestSubtype","priority","staffId"].forEach(f=>{ if(d[f]!==undefined) part[f]=d[f]; }); Object.assign(part,classifyValues(d,cc));
    if(part.staffId!==undefined) part.staffTeamId=part.staffId?((asgAt(S.staff[part.staffId],dateOf(cc.receivedAt))||{}).teamId||null):null;
    if(!Object.keys(part).length) return toast("Nothing changed.");
    if(await patch("mod/cx/cases/"+ref,{...part,updatedAt:nowMs(),timeline:[...(cc.timeline||[]),ev("Classification updated",Object.entries(part).filter(([k])=>k!=="staffTeamId").map(([k,v])=>k==="staffId"?"staff: "+personName(v):k+": "+v).join("; "))]})){ delete S.drafts["cl-"+ref]; toast("Saved."); } return; }
  if(act==="cxNoMatch"){ const cc=S.cases.find(x=>x.ref===ref); if(!cc||!isQG()) return; const on=el.dataset.v==="on";
    await patch("mod/cx/cases/"+ref,{noMatchSince:on?nowMs():null,updatedAt:nowMs(),timeline:[...(cc.timeline||[]),ev(on?"No valid match in CRM yet":"Match found in CRM",on?"Stays in Draft; closes automatically after "+cxc("draftAutoCloseDays")+" days if still unmatched":"")]}); return; }
  const c=S.cases.find(x=>x.ref===ref); if(!c) return;
  if(!canAct(c)){ toast("This stage isn't yours to action."); return; }
  const d=draft(ref), p=[];
  if(act==="cxQAttempt"){
    if(pendingFor(c,"qg").length===0&&false) return;
    const tm=d.qTime, cid=String(d.qCall||"").trim(); if(!tm||!cid||!d.qOutcome) return toast("Add the time, call ID and outcome.");
    const qa=[...(c.qgAttempts||[]),{date:todayD(),time:tm,callId:cid,outcome:d.qOutcome,by:S.uid,byName:S.meName,at:nowMs()}];
    await patch("mod/cx/cases/"+ref,{qgAttempts:qa,...(await clearPending(c,"qg")),stageStartedAt:c.stageStartedAt||nowMs(),updatedAt:nowMs(),timeline:[...(c.timeline||[]),ev("Q&G call attempt "+qa.length,d.qOutcome+", call "+cid)]});
    ["qTime","qCall","qOutcome"].forEach(f=>delete d[f]); return;
  }
  if(act==="cxRoute"){
    const contacted=d.contacted||((c.qgAttempts||[]).length?"yes":"");
    need(String(d.comment||"").trim(),"your assessment",p); need(contacted,"whether Q&G contacted the customer",p);
    const qa=(c.qgAttempts||[]), reachedA=qa.find(a=>a.outcome==="Reached");
    if(contacted==="yes"){ need(qa.length,"at least one logged Q&G call attempt",p); need(reachedA||qa.length>=3,"the customer reached, or three attempts",p); need(qa.every(a=>a.date===todayD()),"Q&G call attempts dated today",p); }
    if(pendingFor(c,"qg").length) p.push("the outcome of the call you started");
    d.contacted=contacted; const lastA=reachedA||qa[qa.length-1]; if(lastA){ d.callRef=lastA.callId; d.contactDate=lastA.date; d.contactTime=lastA.time; }
    const t=S.teams[d.teamId]; need(t,"the team to route to",p); if(t&&t.lob!==c.lob) return lobMismatch(t,c);
    const tg=t?routeTargets(t,c.staffId,d.handlerId||null):null; if(t) need(tg&&tg.lmId,"who handles it ("+t.name+" has no line manager set)",p);
    if(p.length) return toast("Add "+p.join(", ")+".");
    const me=meStaff();
    const intake={comment:d.comment.trim(),contacted:d.contacted,callRef:d.callRef||"",contactDate:d.contacted==="yes"?(d.contactDate||todayD()):"",contactTime:d.contacted==="yes"?(d.contactTime||dLocal(nowMs()).toISOString().slice(11,16)):"",
      teamId:t.id,lmId:tg.lmId,superiorId:tg.superiorId,routedBy:me?me.id:null,routedByName:S.meName,routedAt:nowMs(),routeNote:tg.note};
    const n=await moveCase(c,"with_lm",{intake,noMatchSince:null},"Routed to "+t.name,"Handled by "+personName(tg.lmId)+(tg.note?". "+tg.note:"")); if(!n) return;
    if(S.admin&&!t.lineManagerId&&tg.lmId&&(d.setLm??true)){ if(await patch("mod/core/teams/"+t.id,{lineManagerId:tg.lmId,updatedAt:nowMs()})) await addAudit("team",t.id,"Line manager set",{lineManagerId:null},{lineManagerId:tg.lmId},"While routing "+c.ref+": "+personName(tg.lmId)); }
    delete S.drafts[ref];
    sendMail({to:[emailOf(tg.lmId)],cc:[emailOf(tg.superiorId)],subject:`New case submitted to you: ${c.ref} (${t.name})`,lines:[`Ticket ${c.ref} (${caseLine(c)}) has been submitted to you by Q&G and is in your queue.`,`Customer key: ${c.dealRef?"deal "+c.dealRef:maskMobile(c.mobile)}. Source: ${c.source}.`,`Q&G assessment: ${intake.comment}`,`Call the customer (up to three attempts), agree a resolution and submit it on the platform by ${fmtDT(dueOf(n))}.`],ref,kind:"routed"});
    return toast("Routed to "+personName(tg.lmId)+".");
  }
  if(act==="cxCloseDup"){
    const why=prompt("Why is this intake being closed? For example, duplicate of CX-2026-000012.");
    if(!why||!why.trim()) return;
    await moveCase(c,"closed",{closure:{externalAt:nowMs(),externalByName:S.meName,internalAt:nowMs(),internalByName:S.meName,reason:why.trim()}},"Closed at intake",why.trim());
    return toast("Closed.");
  }
  if(act==="cxAttempt"){
    d.aDate=d.aDate||todayD(); need(d.aDate,"the date",p); need(d.aTime,"the time",p); need(String(d.aCall||"").trim(),"the call ID",p); need(d.aOutcome,"the outcome",p);
    if(d.aDate&&d.aDate>todayD()) p.push("a date that isn't in the future");
    if(d.aOutcome&&d.aOutcome!=="Reached"&&!d.aEmail) p.push("confirmation that you emailed the customer after the missed call");
    if(p.length) return toast("Add "+p.join(", ")+".");
    const attempts=[...((c.lm||{}).attempts||[]),{date:d.aDate,time:d.aTime,callId:d.aCall.trim(),outcome:d.aOutcome,emailSent:d.aOutcome!=="Reached"?!!d.aEmail:null,emailSubject:String(d.aEmailSubject||"").trim(),by:S.uid,byName:S.meName,at:nowMs()}];
    await patch("mod/cx/cases/"+ref,{...(await clearPending(c,"lm")),lm:{...(c.lm||{}),attempts},stageStartedAt:c.stageStartedAt||nowMs(),timeline:[...(c.timeline||[]),ev("Call attempt "+attempts.length,d.aOutcome+", call "+d.aCall.trim())],updatedAt:nowMs()});
    ["aDate","aTime","aCall","aOutcome","aEmail","aEmailSubject"].forEach(f=>delete d[f]);
    if(attempts.length>=3&&!attempts.some(a=>a.outcome==="Reached")&&cxc("notReachableAutoClose")){
      const fresh=S.cases.find(x=>x.ref===ref)||c, now=nowMs(), i=c.intake||{};
      const part={status:"closed",stageAt:now,updatedAt:now,lm:{...(c.lm||{}),attempts,reached:false,submittedAt:now,submittedBy:(meStaff()||{}).id||null,findings:(c.lm||{}).findings||"Customer not reachable after three call attempts, each followed by an email."},
        closure:{externalAt:now,internalAt:now,externalByName:"Platform",internalByName:"Platform",reason:"Customer not reachable",auto:true},review:{...(c.review||{}),closureReason:"Customer not reachable"},
        timeline:[...((fresh&&fresh.timeline)||c.timeline||[]),sysEv("Closed automatically: customer not reachable","Three call attempts, each followed by an email to the customer")]};
      if(await patch("mod/cx/cases/"+ref,part)){
        sendMail({to:c.assigneeId&&emailOf(c.assigneeId)?[emailOf(c.assigneeId)]:qgEmails(),cc:[emailOf(i.lmId)],subject:`Closed, customer not reachable: ${c.ref}`,lines:[`${c.ref} closed automatically after three unsuccessful call attempts, each followed by an email to the customer.`,"Q&G can review it and reopen it if needed."],ref,kind:"closed"});
        toast("Third attempt logged. The case closed automatically as customer not reachable.");
      }
    }
    return;
  }
  if(act==="cxResolve"){
    const lm={...(c.lm||{})}, atts=lm.attempts||[], reached=atts.some(a=>a.outcome==="Reached");
    if(reached) need(String(d.resolution??lm.resolution??"").trim(),"the resolution agreed",p);
    else { need(atts.length>=3,"three call attempts",p); need(String(d.emailSubject??lm.emailSubject??"").trim(),"the email subject line",p); }
    need(String(d.findings??lm.findings??"").trim(),"your findings",p);
    if(pendingFor(c,"lm").length) p.push("the outcome of the call you started");
    if(p.length) return toast("Add "+p.join(", ")+".");
    const me=meStaff();
    Object.assign(lm,{resolution:String(d.resolution??lm.resolution??"").trim(),emailSubject:String(d.emailSubject??lm.emailSubject??"").trim(),sharedWithQG:!!(d.sharedWithQG??lm.sharedWithQG),findings:String(d.findings??lm.findings).trim(),submittedAt:nowMs(),submittedBy:me?me.id:null,reached});
    const n=await moveCase(c,"qg_review",{lm},"Submitted as resolved by line manager",reached?"Customer reached":"Not reached after three attempts; emailed the customer"); if(!n) return;
    delete S.drafts[ref];
    const i=c.intake||{};
    sendMail({to:i.routedBy&&emailOf(i.routedBy)?[emailOf(i.routedBy)]:qgEmails(),cc:i.routedBy?qgEmails():[],subject:`Ready for Q&G review: ${c.ref}`,lines:[`${personName(i.lmId)} submitted ${c.ref} as resolved.`,reached?`Resolution agreed: ${lm.resolution}`:`The customer couldn't be reached after three attempts. Email sent: “${lm.emailSubject}”.`,`Please assess it by ${fmtDT(dueOf(n))}.`],ref,kind:"lm_resolved"});
    return toast("Submitted to Q&G.");
  }
  if(act==="cxReturn"){
    if(!String(d.returnReason||"").trim()) return toast("Say what needs to be redone.");
    const lm={...(c.lm||{}),submittedAt:null,returns:[...((c.lm||{}).returns||[]),{at:nowMs(),by:S.uid,reason:d.returnReason.trim()}]};
    const n=await moveCase(c,"with_lm",{lm},"Returned to line manager",d.returnReason.trim()); if(!n) return;
    const i=c.intake||{}; delete S.drafts[ref];
    sendMail({to:[emailOf(i.lmId)],cc:[emailOf(i.superiorId)],subject:`Returned by Q&G: ${c.ref}`,lines:[`Q&G returned ${c.ref} for more work.`,`Reason: ${lm.returns[lm.returns.length-1].reason}`,`Please resubmit by ${fmtDT(dueOf(n))}.`],ref,kind:"returned"});
    return toast("Returned to the line manager.");
  }
  if(act==="cxExternal"){
    ["lmCallAssessed","findingsInPlace","resolutionAligned"].forEach(f=>need(d[f],"all three assessment answers",p));
    need(d.path,"how Q&G validated",p);
    if(d.path==="validated"){ need(String(d.valCallRef||"").trim(),"the validation call ID",p); need((d.valDate||todayD())===todayD(),"today's date for the validation call",p); need(d.valTime,"the validation call time",p); need(String(d.valOutcome||"").trim(),"what the customer confirmed",p); }
    need(d.verdict,"the case validity",p); need(d.consequence,"the consequence",p);
    if(d.consequence&&d.consequence!=="None"){ need(d.consequenceStaffId||c.staffId,"who the consequence applies to",p); need(String(d.consequenceNote||"").trim(),"the consequence detail",p); }
    need(String(d.finalSummary||"").trim(),"the resolution and actions for the customer",p);
    if(isUpheld(d.verdict)||flagOf(c.type)==="Complaint") need(d.rootCause,"the root cause",p);
    if((c.type==="Negative review"||/Google|Trustpilot/i.test(c.source||""))){ const rr=c.reviewResponse||{}; need(rr.approvedAt||rr.notNeeded,"a Q&G-approved response to the review, or confirmation that none is needed",p); }
    if(cxc("csatLinkRequired")) need(d.csatLinkSent||String(d.csatLinkReason||"").trim(),"confirmation the customer satisfaction link was sent, or why not",p);
    need(d.businessOutcome,"the business outcome (retained, lost or not applicable)",p);
    const cs=csatFromDraft(d,p);
    if(p.length) return toast("Add "+[...new Set(p)].join(", ")+".");
    const review={lmCallAssessed:d.lmCallAssessed,findingsInPlace:d.findingsInPlace,resolutionAligned:d.resolutionAligned,lmCallNotes:d.lmCallNotes||"",evalId:d.evalId||"",path:d.path,
      valCallRef:d.valCallRef||"",valDate:d.path==="validated"?(d.valDate||todayD()):"",valTime:d.valTime||"",valOutcome:d.valOutcome||"",verdict:d.verdict,consequence:d.consequence,
      consequenceStaffId:d.consequence!=="None"?(d.consequenceStaffId||c.staffId):null,consequenceNote:d.consequenceNote||"",finalSummary:d.finalSummary.trim(),rootCause:d.rootCause||"",closureReason:d.closureReason||"Resolved",internalActions:d.internalActions||[],internalNote:String(d.internalNote||"").trim(),csatLink:{sent:!!d.csatLinkSent,reason:String(d.csatLinkReason||"").trim(),method:d.csatLinkMethod||"",at:nowMs()},businessOutcome:d.businessOutcome,businessValue:d.businessValue?Number(d.businessValue):null,businessNote:String(d.businessNote||"").trim(),by:S.uid,byName:S.meName,at:nowMs()};
    const closure={...(c.closure||{}),externalAt:nowMs(),externalBy:S.uid,externalByName:S.meName};
    review.csatAt=nowMs(); const csatDoc={...cs,at:nowMs(),by:S.uid,byName:S.meName};
    if(pendingFor(c,"val").length&&review.path!=="validated") return toast("You started a validation call. Choose “Called the customer to validate” and log it, or mark it as not connected.");
    const i=c.intake||{};
    closure.reason=review.closureReason;
    if(review.consequence==="None"){
      closure.internalAt=nowMs(); closure.internalByName=S.meName;
      const n=await moveCase(c,"closed",{review,closure,csat:csatDoc,pendingCalls:pendingFor(c).filter(x=>x.purpose!=="val")},"Closed externally and internally","Validity: "+review.verdict+". No consequence."); if(!n) return;
      delete S.drafts[ref];
      sendMail({to:[emailOf(i.lmId)],cc:[emailOf(i.superiorId)],subject:`Closed: ${c.ref} (${review.verdict.toLowerCase()})`,lines:[`Q&G closed ${c.ref}.`,`Validity: ${review.verdict}. No consequence applies.`,`Final resolution: ${review.finalSummary}`],ref,kind:"closed"});
      return toast("Case closed.");
    }
    const n=await moveCase(c,"consequence",{review,closure,csat:csatDoc,pendingCalls:pendingFor(c).filter(x=>x.purpose!=="val")},"External closure; consequence relayed",review.consequence+" for "+personName(review.consequenceStaffId)); if(!n) return;
    delete S.drafts[ref];
    await logBreachFromCase(n);
    sendMail({to:[emailOf(i.lmId)],cc:[emailOf(i.superiorId)],subject:`Consequence to action: ${c.ref}`,lines:[`Q&G closed ${c.ref} for the customer. Validity: ${review.verdict}.`,`Consequence: ${review.consequence} for ${personName(review.consequenceStaffId)}.`,`Detail: ${review.consequenceNote}`,`Confirm it's actioned, or dispute it with your reasons, by ${fmtDT(dueOf(n))}. The case closes internally once this is done.`],ref,kind:"consequence"});
    return toast("Closed for the customer. Consequence sent to the line manager.");
  }
  if(act==="cxAck"||act==="cxDispute"){
    const note=String(d.ackNote||"").trim(); if(!note) return toast(act==="cxAck"?"Say what was done.":"Give your reasons for the dispute.");
    const ack={action:act==="cxAck"?"ack":"dispute",note,by:S.uid,byName:S.meName,at:nowMs()};
    if(act==="cxAck"){
      const n=await moveCase(c,"ready_internal",{consequenceAck:ack},"Consequence actioned by line manager",note); if(!n) return;
      delete S.drafts[ref];
      sendMail({to:qgEmails(),subject:`Ready for internal closure: ${c.ref}`,lines:[`${S.meName} confirmed the consequence for ${c.ref} is actioned.`,`Note: ${note}`],ref,kind:"ack"});
      return toast("Sent to Q&G for internal closure.");
    }
    const n=await moveCase(c,"dispute",{consequenceAck:ack,dispute:{verbatim:note,at:nowMs(),by:S.uid}},"Consequence disputed",note); if(!n) return;
    delete S.drafts[ref];
    sendMail({to:chiefEmails(),cc:qgEmails(),subject:`Consequence disputed: ${c.ref}`,lines:[`${S.meName} disputed the consequence on ${c.ref}.`,`Their verbatim: ${note}`,`The Chief Q&G decides: uphold, amend or withdraw.`],ref,kind:"dispute"});
    return toast("Dispute sent to the Chief Q&G.");
  }
  if(act==="cxInternal"){
    const n=await moveCase(c,"closed",{closure:{...(c.closure||{}),internalAt:nowMs(),internalBy:S.uid,internalByName:S.meName}},"Internal closure",""); if(!n) return;
    const i=c.intake||{};
    sendMail({to:[emailOf(i.lmId)],cc:[emailOf(i.superiorId)],subject:`Closed internally: ${c.ref}`,lines:[`${c.ref} is now fully closed on the platform.`],ref,kind:"closed"});
    return toast("Case closed.");
  }
  if(act==="cxDecide"){
    need(d.decision,"the decision",p); if(d.decision==="Amend the consequence") need(d.amended,"the amended consequence",p); need(String(d.decisionNote||"").trim(),"the rationale",p);
    if(p.length) return toast("Add "+p.join(", ")+".");
    const dispute={...c.dispute,decision:d.decision,amended:d.amended||"",decisionNote:d.decisionNote.trim(),decidedBy:S.uid,decidedByName:S.meName,decidedAt:nowMs()};
    const review={...c.review}; if(d.decision==="Amend the consequence") review.consequence=d.amended; if(d.decision==="Withdraw the consequence") review.consequence="None";
    const n=await moveCase(c,"closed",{dispute,review,closure:{...(c.closure||{}),internalAt:nowMs(),internalBy:S.uid,internalByName:S.meName}},"Dispute decided; internal closure",d.decision+". "+d.decisionNote.trim()); if(!n) return;
    delete S.drafts[ref];
    const i=c.intake||{};
    sendMail({to:[emailOf(i.lmId)],cc:[emailOf(i.superiorId),...qgEmails()],subject:`Dispute decided: ${c.ref}`,lines:[`The Chief Q&G decided: ${d.decision}${d.amended?" to "+d.amended:""}.`,`Rationale: ${d.decisionNote.trim()}`,`${c.ref} is now closed.`],ref,kind:"decision"});
    return toast("Decision recorded. Case closed.");
  }
}
async function uploadCorrespondence(ref,file){
  const c=S.cases.find(x=>x.ref===ref); if(!c||!ASSETS) return;
  if(file.size>20*1024*1024) return toast("That file is over 20 MB.");
  try{ const a=await ASSETS.upload(file); await patch("mod/cx/cases/"+ref,{lm:{...(c.lm||{}),attachment:{id:a.id,name:file.name,size:file.size}},stageStartedAt:c.stageStartedAt||nowMs()}); toast("Attached "+file.name+"."); }
  catch(e){ await logError("upload","Attachment upload failed on "+ref,{ref,name:file.name},e); toast("The upload failed. It's in the error report."); }
}

/* ---- reminders & escalation (runs in Q&G/admin sessions with Gmail) ---- */
async function sweep(){
  if(DB&&(isQG()||S.admin)) { try{ await recordTatBreaches(); }catch(e){ logError("sweep","Time limit check failed",null,e); } try{ await autoCloseDrafts(); }catch(e){ logError("sweep","Draft auto-closure failed",null,e); } }
  if(!DB||!MCP||!(isQG()||S.admin)) return;
  try{
    const lock=await DB.doc("mod/sys/locks/sweeper").acquire({holder:S.uid+"-"+SESSION,ttlMs:240000});
    if(!lock.acquired) return;
  }catch(e){ return; }
  const every=(S.cfg.reminderEveryHours||24)*3600e3;
  for(const c of S.cases){
    if(!isOpenCase(c)) continue;
    const due=dueOf(c); if(due==null||due>nowMs()) continue;
    if(c.lastReminderAt&&nowMs()-c.lastReminderAt<every) continue;
    const rc=stageRecipients(c), n=(c.reminderCount||0)+1;
    const escalate=["with_lm","consequence"].includes(c.status);
    const started=!!c.stageStartedAt;
    const ok=await sendMail({to:rc.to,cc:[...rc.cc,...(escalate?qgEmails():[])],subject:`${escalate?"Escalation":"Reminder"} ${n}: ${c.ref} is pending your action`,
      lines:[`${c.ref} (${caseLine(c)}) has been at “${ST[c.status]}” since ${fmtDT(c.stageAt)} and was due by ${fmtDT(due)}.`,started?"Work has started but the stage isn't complete.":"No action has been recorded on it yet.",`Please action it on the platform.`],ref:c.ref,kind:"reminder"});
    await patch("mod/cx/cases/"+c.ref,{reminderCount:n,lastReminderAt:nowMs(),escalated:escalate||c.escalated||false,timeline:[...(c.timeline||[]),{at:nowMs(),by:"system",byName:"Platform",ev:(escalate?"Escalation ":"Reminder ")+n+(ok?" sent":rc.to.filter(Boolean).length?" failed":" not sent"),note:rc.to.filter(Boolean).length?"To "+rc.to.filter(Boolean).join(", "):(["intake","qg_review","ready_internal"].includes(c.status)?"No one to send it to: mark your Q&G team as kind “Q&G team” in Staff list, or set a Q&G owner on the case.":"No one to send it to: set the team's line manager in Staff list.")}]});
  }
}
async function logBreachFromCase(c){
  const r=c.review||{};
  const doc={id:"cx-"+c.ref,section:"breaches",venture:c.venture,source:"Customer experience case",sourceRef:c.ref,date:todayD(),staffId:r.consequenceStaffId||null,
    staffIdTeam:r.consequenceStaffId?((asgAt(S.staff[r.consequenceStaffId])||{}).teamId||null):null,lob:c.venture+"|"+c.lob,severity:/HR|Written/.test(r.consequence)?"High":"Medium",
    breachType:"Customer complaint upheld ("+r.verdict.toLowerCase()+")",description:r.consequenceNote||r.finalSummary,consequence:r.consequence,status:"Open",createdAt:nowMs(),createdBy:S.uid,createdByName:S.meName,history:[{at:nowMs(),byName:S.meName,note:"Logged from "+c.ref}]};
  await put("mod/reg/records/"+doc.id,doc);
}

async function assignCase(ref,staffId){
  const c=S.cases.find(x=>x.ref===ref); if(!c||!isQG()) return;
  const ok=await patch("mod/cx/cases/"+ref,{assigneeId:staffId||null,timeline:[...(c.timeline||[]),ev(staffId?"Q&G owner: "+personName(staffId):"Q&G owner removed",c.assigneeId?"Previously "+personName(c.assigneeId):"")]});
  if(ok&&staffId&&(!meStaff()||staffId!==meStaff().id)) notifyAssigned(staffId,ref,isCallback(c)?"Callbacks":"Complaints management");
  if(ok) toast(staffId?"Assigned to "+personName(staffId)+".":"Unassigned.");
}

/* ---- calling from the platform (3CX), call gap control, notes, duplicates ---- */
const digits=m=>String(m||"").replace(/\D/g,"");
function dialHref(m){ const d=String(m||"").replace(/[^\d+]/g,""); if(!d) return ""; return (S.cfg.dialFormat||"tel:{number}").split("{number}").join(encodeURIComponent((S.cfg.dialPrefix||"")+d)); }
function callBtn(c,purpose){ const h=dialHref(c.mobile); return h?`<a class="btn call" href="${esc(h)}" data-act="cxDial" data-ref="${esc(c.ref)}" data-purpose="${purpose}">Call ${esc(maskMobile(c.mobile))} via 3CX</a>`:`<span class="hint" style="margin:0">No mobile number on this case, so it can't be dialled from here. Call through 3CX and log the attempt below.</span>`; }
const pendingFor=(c,purpose)=>(c.pendingCalls||[]).filter(x=>!purpose||x.purpose===purpose);
function pendingBanner(c,purpose){ const p=pendingFor(c,purpose); if(!p.length) return "";
  return p.map(x=>`<div class="callout amb"><b>Call started ${esc(fmtDT(x.at))} by ${esc(x.byName||"")} isn't logged yet.</b> Log its outcome below, or <button class="linkbtn" data-act="cxNoConnect" data-ref="${esc(c.ref)}" data-id="${esc(x.id)}">mark it as not connected</button>. The stage can't be submitted while a started call is unlogged.</div>`).join(""); }
async function clearPending(c,purpose){ const rest=(c.pendingCalls||[]); const ix=rest.findIndex(x=>x.purpose===purpose&&x.by===S.uid); if(ix<0) return {}; const n=rest.slice(); n.splice(ix,1); return {pendingCalls:n}; }
function attemptsTable(list){ return list.length?`<div class="tbl sm"><table><thead><tr><th>Attempt</th><th>Call date and time</th><th>Logged</th><th>Call ID</th><th>Outcome</th><th>Email to customer</th><th>By</th></tr></thead><tbody>${list.map((a,n)=>`<tr><td>${n+1}</td><td>${esc(fmtD(a.date))} ${esc(a.time)}</td><td>${stampCell(a.at)}</td><td>${esc(a.callId)}</td><td>${a.outcome==="Reached"?'<span class="tag ok">Reached</span>':esc(a.outcome)}</td><td>${a.outcome==="Reached"?"":a.emailSent?'<span class="tag ok">Sent</span>'+(a.emailSubject?" “"+esc(a.emailSubject)+"”":""):a.emailSent===false?'<span class="tag amb">Not sent</span>':'<span class="muted">–</span>'}</td><td>${esc(a.byName||"")}</td></tr>`).join("")}</tbody></table></div>`:""; }
function dupMatches(venture,mobile,deal,except){
  const m=digits(mobile).slice(-9), dl=norm(deal);
  if(m.length<7&&dl.length<3) return [];
  return S.cases.filter(c=>c.ref!==except&&c.venture===venture&&isOpenCase(c)&&((m.length>=7&&digits(c.mobile).slice(-9)===m)||(dl.length>=3&&norm(c.dealRef)===dl)));
}
function dupBox(k,venture){
  const d=S.drafts[k]||{}, list=dupMatches(venture,d.mobile,d.dealRef);
  if(!list.length) return "";
  return `<div class="callout amb"><b>${list.length} open case${list.length>1?"s":""} already exist${list.length>1?"":"s"} for this customer in ${esc(vInfo(venture).name)}.</b> Check before registering, so the same complaint isn't raised twice.
   <ul class="plain">${list.map(c=>`<li class="row between"><span><b>${esc(c.ref)}</b> · ${esc(c.type)} · ${esc(c.subject)} · <span class="tag cx">${esc(ST[c.status])}</span> · registered ${esc(fmtDT(c.createdAt))}</span><span class="row"><button class="btn sm" data-act="cxOpenOther" data-ref="${esc(c.ref)}">Open</button><button class="btn sm" data-act="cxDupNote" data-k="${esc(k)}" data-ref="${esc(c.ref)}">Add this as a note on ${esc(c.ref)} instead</button></span></li>`).join("")}</ul>
   <label class="radio"><input type="checkbox" data-d="${k}" data-f="notDup"${d.notDup?" checked":""}> This is a new, separate issue, not a duplicate</label></div>`;
}
function notesBlock(c){
  const can=isQG()||S.admin||canAct(c)||(meStaff()&&[(c.intake||{}).lmId,(c.intake||{}).superiorId].includes(meStaff().id));
  const n=(c.notes||[]);
  return `<div class="notes"><h3>Notes and comments <span class="muted">${n.length}</span></h3>
   ${can?`<textarea rows="2" data-d="note-${esc(c.ref)}" data-f="text" placeholder="Add a note. It's saved to the case log with your name and the time.">${esc(dv("note-"+c.ref,"text",""))}</textarea><div class="row" style="margin-top:6px"><button class="btn sm primary" data-act="cxNote" data-ref="${esc(c.ref)}">Add note</button></div>`:""}
   ${n.length?`<ol>${[...n].reverse().map(x=>`<li><span>${esc(x.text)}</span><small>${esc(x.byName||"")}, ${esc(fmtDT(x.at))}</small></li>`).join("")}</ol>`:""}</div>`;
}
async function cxSideAction(act,ref,el){
  const c=S.cases.find(x=>x.ref===ref);
  if(act==="cxOpenOther"){ S.sel[isCallback(c)?"callbacks":"complaints"]=ref; return go(isCallback(c)?"callbacks":"complaints"); }
  if(act==="cxDupNote"){ const k=el.dataset.k, d=draft(k); const txt=["Duplicate contact logged as a note"+(d.source?" (source: "+d.source+")":""),d.subject,d.description].filter(Boolean).join(". ");
    const note={at:nowMs(),by:S.uid,byName:S.meName,text:txt};
    if(await patch("mod/cx/cases/"+ref,{notes:[...(c.notes||[]),note],updatedAt:nowMs(),timeline:[...(c.timeline||[]),{...ev("Note","Duplicate contact added instead of a new case")}]})){ delete S.drafts[k]; const kind=k.replace("new-",""); S.sel[kind]=ref; toast("Added to "+ref+" as a note. No new case was created."); }
    return; }
  if(!c) return;
  if(act==="cxNote"){ const t=String(draft("note-"+ref).text||"").trim(); if(!t) return toast("Write the note first.");
    const note={at:nowMs(),by:S.uid,byName:S.meName,text:t};
    if(await patch("mod/cx/cases/"+ref,{notes:[...(c.notes||[]),note],updatedAt:nowMs(),timeline:[...(c.timeline||[]),ev("Note",t.slice(0,140))]})){ delete S.drafts["note-"+ref]; toast("Note added."); }
    return; }
  if(act==="cxDial"){ const purpose=el.dataset.purpose, now=nowMs(), hhmm=dLocal(now).toISOString().slice(11,16), d=draft(ref);
    if(purpose==="qg"){ d.qTime=hhmm; d.contacted="yes"; } else if(purpose==="lm"){ d.aDate=todayD(); d.aTime=hhmm; } else if(purpose==="val"){ d.valDate=todayD(); d.valTime=hhmm; d.path="validated"; }
    try{ navigator.clipboard&&navigator.clipboard.writeText(digits(c.mobile)); }catch(_){}
    const pc={id:rid("call-"),at:now,by:S.uid,byName:S.meName,purpose};
    await patch("mod/cx/cases/"+ref,{pendingCalls:[...(c.pendingCalls||[]),pc],stageStartedAt:c.stageStartedAt||now,timeline:[...(c.timeline||[]),ev("Call started from the platform",purpose==="qg"?"Q&G call":purpose==="lm"?"Line manager call":"Q&G validation call")]});
    toast("Calling through 3CX. The number is also copied. Log the outcome here when the call ends."); return; }
  if(act==="cxNoConnect"){ const x=(c.pendingCalls||[]).find(y=>y.id===el.dataset.id); if(!x) return;
    const rest=(c.pendingCalls||[]).filter(y=>y.id!==x.id), at={date:dateOf(x.at),time:dLocal(x.at).toISOString().slice(11,16),callId:"Not connected",outcome:"Not connected",by:S.uid,byName:S.meName,at:nowMs()};
    const p={pendingCalls:rest,timeline:[...(c.timeline||[]),ev("Call not connected","Started "+fmtDT(x.at))]};
    if(x.purpose==="qg") p.qgAttempts=[...(c.qgAttempts||[]),at]; if(x.purpose==="lm") p.lm={...(c.lm||{}),attempts:[...((c.lm||{}).attempts||[]),at]};
    await patch("mod/cx/cases/"+ref,p); return toast("Recorded as not connected."); }
}

/* ---- business outcome and CSAT ---- */
const BIZ=["Retained","Lost","Not applicable"];
const bizTag=v=>`<span class="tag ${v==="Retained"?"ok":v==="Lost"?"red":""}">${esc(v)}</span>`;
const CSAT_LABELS={1:"1 · Very dissatisfied",2:"2 · Dissatisfied",3:"3 · Neutral",4:"4 · Satisfied",5:"5 · Very satisfied"};
function csatForm(k,c){
  const st=dv(k,"csatStatus",(c.csat&&c.csat.status)||"Captured");
  return `<fieldset class="f csatform"><legend class="req">Customer satisfaction at closure (CSAT)</legend>
   <div class="row">${["Captured","Declined","Unreachable","Pending"].map(v=>`<label class="radio"><input type="radio" name="cs-${esc(k)}" data-d="${esc(k)}" data-f="csatStatus" value="${v}"${st===v?" checked":""}> ${v==="Captured"?"Customer gave a score":v==="Declined"?"Customer declined":v==="Unreachable"?"Customer couldn't be reached":"Survey sent, awaiting reply"}</label>`).join("")}</div>
   ${st==="Captured"?`<div class="row csatscale" role="radiogroup" aria-label="CSAT score">${[1,2,3,4,5].map(n=>`<label class="cs${n}"><input type="radio" name="csv-${esc(k)}" data-d="${esc(k)}" data-f="csatScore" value="${n}"${String(dv(k,"csatScore",(c.csat&&c.csat.score)||""))===String(n)?" checked":""}><span>${esc(CSAT_LABELS[n])}</span></label>`).join("")}</div>`:""}
   <div class="g2"><label class="f"><span>How it was collected</span><select data-d="${esc(k)}" data-f="csatMethod">${opts(["Closure call","WhatsApp","Email","SMS survey","Other"],dv(k,"csatMethod",(c.csat&&c.csat.method)||"Closure call"))}</select></label>
   <label class="f"><span>Customer's comment (no personal details)</span><input data-d="${esc(k)}" data-f="csatComment" value="${esc(dv(k,"csatComment",(c.csat&&c.csat.comment)||""))}"></label></div></fieldset>`;
}
function csatFromDraft(d,p){
  const status=d.csatStatus||"Captured";
  if(status==="Captured"&&!d.csatScore) p.push("the CSAT score, or why it wasn't captured");
  return {status,score:status==="Captured"?Number(d.csatScore)||null:null,method:d.csatMethod||"Closure call",comment:String(d.csatComment||"").trim()};
}
function csatView(c){
  const x=c.csat; if(!x) return `<p class="muted">Not recorded.</p>`;
  return `<p>${x.status==="Captured"?`<span class="csatpill cs${x.score}">${esc(CSAT_LABELS[x.score]||x.score)}</span>`:`<span class="tag amb">${esc(x.status==="Declined"?"Customer declined":x.status==="Unreachable"?"Customer couldn't be reached":"Awaiting survey reply")}</span>`} <span class="muted">via ${esc(x.method||"")}${x.comment?" · “"+esc(x.comment)+"”":""} · ${esc(x.byName||"")}, ${esc(fmtDT(x.at))}</span></p>`;
}
async function saveCsat(ref){
  const c=S.cases.find(x=>x.ref===ref); if(!c||!isQG()) return;
  const d=draft("csat-"+ref), p=[], cs=csatFromDraft(d,p); if(p.length) return toast("Add "+p.join(", ")+".");
  const doc={...cs,at:nowMs(),by:S.uid,byName:S.meName}, hist=[...(c.csatHistory||[]),...(c.csat?[c.csat]:[])];
  if(await patch("mod/cx/cases/"+ref,{csat:doc,csatHistory:hist,updatedAt:nowMs(),timeline:[...(c.timeline||[]),ev("CSAT recorded",cs.status==="Captured"?"Score "+cs.score+" of 5":cs.status)]})){ delete S.drafts["csat-"+ref]; toast("CSAT saved."); }
}

function csatLinkBlock(k,c){
  const link=cxc("csatLink"), req=cxc("csatLinkRequired");
  return `<fieldset class="f csatform"><legend class="${req?"req":""}">Customer satisfaction link (DHA requirement)</legend>
   ${link?`<div class="row"><code class="linkcode">${esc(link)}</code><button class="btn sm" data-act="cxCopyLink">Copy link</button></div>`:`<p class="hint" style="margin:0">The link isn't set yet. The administrator adds it in Settings.</p>`}
   <div class="row"><label class="radio"><input type="checkbox" data-d="${k}" data-f="csatLinkSent"${dv(k,"csatLinkSent",false)?" checked":""}> Sent to the customer with the resolution</label>
    <select data-d="${k}" data-f="csatLinkMethod">${opts(["Email","SMS","WhatsApp"],dv(k,"csatLinkMethod","Email"))}</select></div>
   ${!dv(k,"csatLinkSent",false)?`<label class="f"><span>If not sent, why</span><input data-d="${k}" data-f="csatLinkReason" value="${esc(dv(k,"csatLinkReason",""))}"></label>`:""}</fieldset>`;
}
function lobMismatch(t,c){
  const el=document.getElementById("alertHost");
  if(el) el.innerHTML=`<div class="alertbox" role="alertdialog" aria-modal="true" aria-labelledby="mmT"><h2 id="mmT" style="color:var(--red)">Incorrect selection</h2>
   <p><b>${esc(t.name)}</b> handles <b>${esc(t.lob)}</b>, but this case is logged as <b>${esc(c.lob)}</b>. A ${esc(c.lob)} case can't be routed to a ${esc(t.lob)} team.</p>
   <p>Either:</p><ul><li>Choose a team that handles ${esc(c.lob)}, or</li><li>If ${esc(c.lob)} is wrong on this case, open "Add or correct the classification" above and change the line of business first.</li></ul>
   <div class="row"><button class="btn primary" data-act="alertLater">Got it</button></div></div>`;
  if(el){ el.hidden=false; const b=el.querySelector(".btn"); if(b) b.focus(); }
  return toast("Can't route: "+t.name+" handles "+t.lob+", not "+c.lob+".");
}
