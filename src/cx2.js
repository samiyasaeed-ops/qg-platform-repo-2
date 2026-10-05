/* ================= Complaints & feedback: taxonomy, ticket status, automation, reports ================= */
const CX_DEFAULTS={
  caseTypes:["Complaint","Negative review","Service – Request","Service – New claim","Service – Claim follow-up","Service – Enquiry","Service – Feedback","Service – Appreciation","Internal","Callback request"],
  sources:["Website Contact Us form","HAPEX (call centre, 800-ALFRED)","Zoho inbox (HAPEX)","QA inbox","Email","WhatsApp","Google review","Social media","Trustpilot","Internal feedback","Senior management complaint","Internal escalation","RM, BDM or advisor raised","Walk-in","Other"],
  requestSubtypes:["Call back request","Advisor change","Document request","Policy change","Other"],
  autoRouteSubtypes:["Call back request","Advisor change"],
  complaintTaxonomy:{"Delay in process":["Policy issuance","Claim","Refund","Endorsement","Cancellation","Renewal","Documents"],"Incorrect information":["Coverage or benefits","Premium or price","Policy terms","Process"],"Misselling":["Unsuitable product","Exclusions not explained","Pressure selling","Add-ons not explained"],"Staff attitude or behaviour":["Rude or unprofessional","Not responsive","Did not call back"],"Service failure":["Not reachable","Request not actioned","Wrong action taken"],"Other":[]},
  validity:["Valid – closed in favour","Valid – closed not in favour","Invalid – closed in favour","Invalid – closed not in favour"],
  rootCauses:["System issue","Staff ignorance","Skill development","Knowledge gaps","Policy issue","Vendor issue","Other"],
  internalActions:["System improvement","Training","Process change","Vendor escalation","Knowledge base update"],
  closureReasons:["Resolved","Customer not reachable","Duplicate","No valid match found","Withdrawn by customer","Rejected"],
  draftAutoCloseDays:30, notReachableAutoClose:true, csatLink:"", csatLinkRequired:true,
  targetTat:{"Complaint":40,"Negative review":16,"Service – Request":16,"Service – New claim":8,"Service – Claim follow-up":16,"Service – Enquiry":8,"Service – Feedback":24,"Service – Appreciation":24,"Internal":40,"Callback request":4}
};
/* target resolution time per case type, end to end, in working hours */
const targetHrs=c=>Number((cxc("targetTat")||{})[c.type])||null;
function targetDue(c){ const h=targetHrs(c); return h?addWorkHours(ts(c.receivedAt||c.createdAt),h,S.cfg):null; }
function withinTarget(c){ const d=targetDue(c); if(!d) return null; const end=c.status==="closed"?ts((c.closure||{}).internalAt||(c.closure||{}).externalAt):nowMs(); return end<=d; }
function targetLine(c){ const d=targetDue(c); if(!d) return ""; const ok=withinTarget(c);
  return c.status==="closed"?`<span class="tag ${ok?"ok":"red"}">${ok?"Resolved within target":"Resolved after target"}</span>`:`<span class="${d<nowMs()?"tag red":"muted"}">Target resolution ${d<nowMs()?"passed ":""}${esc(fmtDT(d))}</span>`; }
const cxc=k=>(S.cfg.cx&&S.cfg.cx[k]!=null?S.cfg.cx[k]:CX_DEFAULTS[k]);
const isUpheld=v=>/^Valid|^Partially valid/i.test(String(v||""));
const isComplaintType=t=>t==="Complaint"||t==="Negative review";
const flagOf=t=>isComplaintType(t)?"Complaint":/^Service|Callback/.test(t||"")?"Service":t==="Internal"?"Internal":"Complaint";
function ticketStatus(c){
  if(c.status==="closed"){ const r=(c.closure||{}).reason||""; return ["Duplicate","No valid match found","Rejected"].includes(r)||/duplicate|invalid/i.test(r)?"Rejected":"Closed"; }
  if(c.status==="intake") return c.stageStartedAt||(c.intake||{}).comment?"Work in progress":"Draft";
  if(c.status==="with_lm") return "Assigned";
  return "Resolved";
}
const TS_CLASS={Draft:"",["Work in progress"]:"cx",Assigned:"amb",Resolved:"qa",Closed:"ok",Rejected:"red"};
const tsTag=c=>{ const s=ticketStatus(c); return `<span class="tag ${TS_CLASS[s]||""}">${esc(s)}</span>`; };
const sysEv=(text,note)=>({at:nowMs(),by:"system",byName:"Platform",sys:true,ev:text,note:note||""});

/* products already used for a LOB, offered as suggestions */
function productsFor(venture,lob){ return [...new Set(S.cases.filter(c=>c.venture===venture&&c.lob===lob&&c.product).map(c=>c.product))].sort(); }
function classifyFields(k,c,venture,lob,ro){
  const type=dv(k,"type",c?c.type:""), tax=pickTax(), ct=dv(k,"complaintType",c&&c.complaintType||""), dis=ro?" disabled":"";
  const natures=tax[ct]||[], curN=dv(k,"nature",c&&c.nature||""), natOther=ct&&(!natures.length||curN==="Other"||(curN&&!natures.includes(curN)&&curN!=="Other"));
  const prods=pickProducts(venture,lob), curP=dv(k,"product",c&&c.product||""), prodOther=prods.length&&(curP==="__other"||(curP&&!prods.includes(curP)));
  return `<div class="g3">
    ${type==="Service – Request"?`<label class="f"><span class="req">Request type</span><select data-d="${k}" data-f="requestSubtype"${dis}>${opts(pick("requestSubtypes"),dv(k,"requestSubtype",c&&c.requestSubtype||""),"Choose")}</select></label>`:""}
    ${prods.length?`<label class="f"><span>Policy or product</span><select data-d="${k}" data-f="product"${dis}>${opts([...prods.map(x=>({v:x,l:x})),{v:"__other",l:"Other (type it)"}],prodOther?"__other":curP,"Choose")}</select>${prodOther?`<input data-d="${k}" data-f="productOther" value="${esc(dv(k,"productOther",curP!=="__other"?curP:""))}" placeholder="Type the policy or product"${dis}>`:""}</label>`
      :`<label class="f"><span>Policy or product</span><input list="prod-${esc(k)}" data-d="${k}" data-f="product" value="${esc(curP)}" placeholder="For example, Comprehensive motor"${dis}><datalist id="prod-${esc(k)}">${productsFor(venture,lob).map(x=>`<option value="${esc(x)}">`).join("")}</datalist></label>`}
    ${isComplaintType(type)?`<label class="f"><span>Complaint type</span><select data-d="${k}" data-f="complaintType"${dis}>${opts(Object.keys(tax),ct,"Choose")}</select></label>
    <label class="f"><span>Nature</span>${!ct?`<select disabled><option>Choose the type first</option></select>`:natures.length?`<select data-d="${k}" data-f="nature"${dis}>${opts([...natures,"Other"],natOther?"Other":curN,"Choose")}</select>`:""}${natOther?`<input data-d="${k}" data-f="natureOther" value="${esc(dv(k,"natureOther",curN&&curN!=="Other"?curN:""))}" placeholder="Describe the nature"${dis}>`:""}</label>`:""}</div>`;
}

/* routing target: never the person the complaint is about */
const LM_ROLES=["line_manager","team_lead","head"];
function teamMembersToday(team){ return staffList().filter(p=>(asgAt(p)||{}).teamId===team.id); }
function lmCandidates(team){ return teamMembersToday(team).filter(p=>(p.roles||[]).some(r=>LM_ROLES.includes(r))); }
function routeTargets(team,staffId,chosen){
  if(!team) return null;
  let lm=chosen||team.lineManagerId, note="";
  if(!lm){ const c=lmCandidates(team).filter(p=>p.id!==staffId); if(c.length===1){ lm=c[0].id; note=team.name+" has no line manager set, so it goes to "+c[0].name+", the team's line manager by role."; } }
  if(staffId&&lm===staffId){ lm=team.superiorId||null; note="The line manager is the person the case is about, so it goes to their superior."; }
  return {lmId:lm,superiorId:lm===team.superiorId?null:team.superiorId||null,note};
}
/* request types the business handles directly go straight to the LOB manager */
async function maybeAutoRoute(c){
  const auto=c.type==="Callback request"||(c.type==="Service – Request"&&cxc("autoRouteSubtypes").includes(c.requestSubtype));
  if(!auto) return c;
  const teams=Object.values(S.teams).filter(t=>t.active!==false&&t.kind!=="qg"&&t.venture===c.venture&&t.lob===c.lob&&t.lineManagerId);
  if(teams.length!==1){ await patch("mod/cx/cases/"+c.ref,{timeline:[...(c.timeline||[]),sysEv("Not routed automatically",teams.length?"More than one "+c.lob+" team; Q&G to choose":"No "+c.lob+" team with a line manager in Staff list")]}); return c; }
  const t=teams[0], tg=routeTargets(t,c.staffId); if(!tg.lmId) return c;
  const intake={comment:"Routed automatically: "+(c.requestSubtype||c.type)+" requests go to the LOB manager.",contacted:"no",teamId:t.id,lmId:tg.lmId,superiorId:tg.superiorId,routedBy:null,routedByName:"Platform",routedAt:nowMs(),auto:true};
  const p={status:"with_lm",stageAt:nowMs(),stageStartedAt:null,intake,updatedAt:nowMs(),timeline:[...(c.timeline||[]),sysEv("Routed automatically to "+t.name,personName(tg.lmId)+(tg.note?". "+tg.note:""))]};
  if(!await patch("mod/cx/cases/"+c.ref,p)) return c;
  const n={...c,...p};
  sendMail({to:[emailOf(tg.lmId)],cc:[emailOf(tg.superiorId)],subject:`New case submitted to you: ${c.ref} (${t.name})`,lines:[`Ticket ${c.ref}: ${c.type}${c.requestSubtype?" ("+c.requestSubtype+")":""} for ${c.lob}.`,`Customer key: ${c.dealRef?"deal "+c.dealRef:maskMobile(c.mobile)}. Source: ${c.source}.`,`Please action it by ${fmtDT(dueOf(n))}.`],ref:c.ref,kind:"routed"});
  return n;
}

/* sweeper: drafts with no valid match close after the set number of days */
async function autoCloseDrafts(){
  const days=cxc("draftAutoCloseDays"); if(!days) return;
  for(const c of S.cases){
    if(c.status!=="intake"||!c.noMatchSince) continue;
    if(nowMs()-c.noMatchSince<days*864e5) continue;
    await patch("mod/cx/cases/"+c.ref,{status:"closed",stageAt:nowMs(),updatedAt:nowMs(),closure:{externalAt:nowMs(),internalAt:nowMs(),externalByName:"Platform",internalByName:"Platform",reason:"No valid match found",auto:true},timeline:[...(c.timeline||[]),sysEv("Closed automatically","No valid match found in CRM or internal systems after "+days+" days in Draft")]});
  }
}

/* Google review responses: drafted, approved by Q&G, then posted */
function responseBlock(c,k){
  if(c.type!=="Negative review"&&!/Google|Trustpilot/i.test(c.source||"")) return "";
  const r=c.reviewResponse||{}, me=meStaff(), canDraft=isQG()||(me&&[(c.intake||{}).lmId,(c.intake||{}).superiorId].includes(me.id));
  let h=`<div class="respbox"><h4>Response to the review</h4><p class="hint" style="margin:0 0 6px">Any public response must be approved by Q&G before it's posted.</p>`;
  if(r.approvedAt) h+=`<div class="callout"><b>Approved response</b> (${esc(r.approvedByName||"")}, ${esc(fmtDT(r.approvedAt))})<br>${esc(r.approvedText)}</div>${r.postedAt?`<p class="hint">Posted ${esc(fmtDT(r.postedAt))} by ${esc(r.postedByName||"")}.</p>`:canDraft?`<button class="btn sm" data-act="cxRespPosted" data-ref="${esc(c.ref)}">Mark as posted</button>`:""}`;
  else if(r.notNeeded) h+=`<p class="muted">No response needed: ${esc(r.notNeededReason||"")} (${esc(r.byName||"")})</p>`;
  else {
    if(r.draft) h+=`<div class="callout amb"><b>Proposed response awaiting Q&G approval</b> (${esc(r.draftByName||"")}, ${esc(fmtDT(r.draftAt))})<br>${esc(r.draft)}</div>`;
    if(canDraft&&c.status!=="closed") h+=`<label class="f"><span>${r.draft?"Edit the proposed response":"Propose a response"}</span><textarea rows="3" data-d="${k}" data-f="respText">${esc(dv(k,"respText",r.draft||""))}</textarea></label>
      <div class="row"><button class="btn sm" data-act="cxRespDraft" data-ref="${esc(c.ref)}">Save proposed response</button>${isQG()?`<button class="btn sm primary" data-act="cxRespApprove" data-ref="${esc(c.ref)}">Approve this response</button><button class="btn sm" data-act="cxRespNone" data-ref="${esc(c.ref)}">No response needed</button>`:""}</div>`;
  }
  return h+`</div>`;
}
async function respAction(act,c){
  const k=c.ref, d=draft(k), r={...(c.reviewResponse||{})}, txt=String(d.respText??r.draft??"").trim();
  if(act==="cxRespDraft"){ if(!txt) return toast("Write the response first."); Object.assign(r,{draft:txt,draftAt:nowMs(),draftByName:S.meName}); }
  else if(act==="cxRespApprove"){ if(!isQG()) return; if(!txt) return toast("Write or choose the response to approve."); Object.assign(r,{approvedText:txt,approvedAt:nowMs(),approvedByName:S.meName}); }
  else if(act==="cxRespNone"){ if(!isQG()) return; const why=prompt("Why is no response needed?"); if(!why) return; Object.assign(r,{notNeeded:true,notNeededReason:why,byName:S.meName}); }
  else if(act==="cxRespPosted"){ Object.assign(r,{postedAt:nowMs(),postedByName:S.meName}); }
  const evt={cxRespDraft:"Review response proposed",cxRespApprove:"Review response approved by Q&G",cxRespNone:"No review response needed",cxRespPosted:"Review response posted"}[act];
  if(await patch("mod/cx/cases/"+c.ref,{reviewResponse:r,updatedAt:nowMs(),timeline:[...(c.timeline||[]),ev(evt,act==="cxRespApprove"?txt.slice(0,120):"")]})){ delete d.respText; toast(evt+"."); }
  if(act==="cxRespDraft"&&!isQG()) sendMail({to:c.assigneeId&&emailOf(c.assigneeId)?[emailOf(c.assigneeId)]:qgEmails(),subject:`Review response to approve: ${c.ref}`,lines:[`${S.meName} proposed a response to the review on ${c.ref}.`,txt],ref:c.ref,kind:"resp"});
}

/* customer history (360 view by customer key) */
function customerHistory(c){
  const m=digits(c.mobile).slice(-9), dl=norm(c.dealRef);
  const match=x=>x.venture===c.venture&&((m.length>=7&&digits(x.mobile).slice(-9)===m)||(dl.length>=3&&norm(x.dealRef)===dl));
  const cs=S.cases.filter(x=>x.ref!==c.ref&&match(x)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const rs=S.recs.filter(x=>(x.mobile||x.dealRef)&&match({...x,venture:recVenture(x)}));
  if(!cs.length&&!rs.length) return "";
  return `<div class="hist"><h3>Customer history <span class="muted">${cs.length+rs.length}</span></h3><ul class="plain">${cs.map(o=>`<li><button class="linkbtn" data-act="cxOpenOther" data-ref="${esc(o.ref)}">${esc(o.ref)}</button> ${tsTag(o)}<br><small class="muted">${esc(o.type)} · ${esc(o.subject||"")} · ${esc(fmtD(o.createdAt))}</small></li>`).join("")}${rs.map(o=>`<li><button class="linkbtn" data-act="openItem" data-kind="rec" data-sec="${esc(o.section)}" data-id="${esc(o.id)}">${esc(o.ref||o.id)}</button> <span class="tag">${esc((NAVMAP[o.section]||{}).label||o.section)}</span><br><small class="muted">${esc(fmtD(o.date||o.createdAt))}</small></li>`).join("")}</ul></div>`;
}

/* reports by LOB, type, root cause, source and more */
function viewCxReports(kind){
  const ui=S.ui["rep-"+kind]||(S.ui["rep-"+kind]={from:todayD().slice(0,8)+"01",to:todayD(),by:"lob"});
  const from=localToMs(ui.from,"00:00"), to=localToMs(ui.to,"23:59")+60000;
  const list=cxCases(kind).filter(c=>ts(c.receivedAt||c.createdAt)>=from&&ts(c.receivedAt||c.createdAt)<to);
  const dims={lob:["Line of business",c=>c.lob],type:["Type",c=>c.type],complaintType:["Complaint type",c=>c.complaintType||"Not classified"],nature:["Nature",c=>c.complaintType?c.complaintType+" · "+(c.nature||"Not set"):"Not classified"],source:["Source channel",c=>c.source],rootCause:["Root cause",c=>(c.review||{}).rootCause||"Not recorded"],validity:["Validity",c=>(c.review||{}).verdict||"Not assessed"],closure:["Closure reason",c=>c.status==="closed"?((c.closure||{}).reason||"Resolved"):"Open"],status:["Ticket status",c=>ticketStatus(c)],staff:["Staff concerned",c=>c.staffId?personName(c.staffId):"Not named"],biz:["Business outcome",c=>(c.review||{}).businessOutcome||"Not recorded"]};
  const [lbl,fn]=dims[ui.by]||dims.lob, groups={};
  list.forEach(c=>{ const g=fn(c)||"—"; (groups[g]=groups[g]||[]).push(c); });
  const rows=Object.entries(groups).sort((a,b)=>b[1].length-a[1].length);
  const tat=l=>{ const d=l.filter(c=>c.status==="closed"&&(c.closure||{}).internalAt).map(c=>workHoursBetween(ts(c.receivedAt||c.createdAt),ts(c.closure.internalAt),S.cfg)); return d.length?d.reduce((a,b)=>a+b,0)/d.length:null; };
  const csat=l=>{ const s=l.filter(c=>c.csat&&c.csat.status==="Captured").map(c=>c.csat.score); return s.length?Math.round(s.reduce((a,b)=>a+b,0)/s.length*10)/10:null; };
  return `<div class="row between"><div class="row"><label class="inline">From <input type="date" data-ui="rep-${kind}.from" value="${esc(ui.from)}"></label><label class="inline">To <input type="date" data-ui="rep-${kind}.to" value="${esc(ui.to)}"></label>
    <label class="inline">Group by <select data-ui="rep-${kind}.by">${opts(Object.entries(dims).map(([v,[l]])=>({v,l})),ui.by)}</select></label></div><button class="btn" data-act="cxRepExport" data-k="${kind}">Download Excel</button></div>
   <div class="figs4"><div><b>${list.length}</b><span>Received in the period</span></div><div><b>${list.filter(c=>c.status==="closed").length}</b><span>Closed</span></div><div><b>${list.filter(c=>isUpheld((c.review||{}).verdict)).length}</b><span>Valid</span></div><div><b>${esc(fmtTat(tat(list)))}</b><span>Average time to close</span></div></div>
   ${successMeasures(list)}
   <h3 class="h3">By ${esc(lbl.toLowerCase())}</h3>
   ${rows.length?`<div class="tbl"><table><thead><tr><th>${esc(lbl)}</th><th class="n">Received</th><th class="n">Open</th><th class="n">Closed</th><th class="n">Valid</th><th class="n">Overdue</th><th class="n">Within target</th><th>Average time to close</th><th class="n">CSAT</th></tr></thead><tbody>${rows.map(([g,l])=>`<tr><td><b>${esc(g)}</b></td><td class="n">${l.length}</td><td class="n">${l.filter(isOpenCase).length}</td><td class="n">${l.filter(c=>c.status==="closed").length}</td><td class="n">${l.filter(c=>isUpheld((c.review||{}).verdict)).length}</td><td class="n">${l.filter(c=>isOpenCase(c)&&overdue(c)).length}</td><td class="n">${(()=>{ const z=l.filter(c=>c.status==="closed"&&withinTarget(c)!==null); return z.length?Math.round(z.filter(c=>withinTarget(c)).length/z.length*100)+"%":"–"; })()}</td><td>${esc(fmtTat(tat(l)))}</td><td class="n">${csat(l)??"–"}</td></tr>`).join("")}</tbody></table></div>`:`<div class="emptybox">Nothing received in this period${S.venture?" for "+esc(scopeLabel()):""}.</div>`}`;
}
async function cxRepExport(kind){
  if(!DOWNLOADS||!window.XLSX) return toast("Downloads aren't available in this view.");
  const ui=S.ui["rep-"+kind]||{}, from=localToMs(ui.from||todayD().slice(0,8)+"01","00:00"), to=localToMs(ui.to||todayD(),"23:59")+60000;
  const list=cxCases(kind).filter(c=>ts(c.receivedAt||c.createdAt)>=from&&ts(c.receivedAt||c.createdAt)<to);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(caseRows(list).map((r,i)=>({...r,"Ticket status":ticketStatus(list[i]),"Complaint type":list[i].complaintType||"","Nature":list[i].nature||"","Policy or product":list[i].product||"","Root cause":(list[i].review||{}).rootCause||"","Closure reason":(list[i].closure||{}).reason||""}))),"Cases");
  const b64=XLSX.write(wb,{bookType:"xlsx",type:"base64"});
  try{ await DOWNLOADS.save({filename:`QG-${kind}-report-${ui.from||""}-to-${ui.to||todayD()}.xlsx`,data:new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})}); }catch(e){ if(e&&e.code!=="cancelled") toast("The download didn't start."); }
}

/* follow-up cases linked to an earlier closed case */
function startFollowUp(ref){
  const c=S.cases.find(x=>x.ref===ref); if(!c) return;
  const kind=isCallback(c)?"callbacks":"complaints", k="new-"+kind;
  S.drafts[k]={venture:c.venture,type:c.type,source:"",lob:c.venture+"|"+c.lob,mobile:c.mobile||"",dealRef:c.dealRef||"",product:c.product||"",complaintType:c.complaintType||"",nature:c.nature||"",staffId:c.staffId||"",linkedTo:c.ref,notDup:true,subject:"Follow-up to "+c.ref+": "+(c.subject||"")};
  S.sel[kind]="__new"; go(kind);
}
function followUps(c){ return S.cases.filter(x=>x.linkedTo===c.ref); }
const isRepeat=c=>!!c.linkedTo||S.cases.some(o=>o.ref!==c.ref&&o.venture===c.venture&&isComplaintType(o.type)&&isComplaintType(c.type)&&ts(o.createdAt)<ts(c.createdAt)&&ts(c.createdAt)-ts(o.createdAt)<=90*864e5&&((digits(c.mobile).length>=7&&digits(o.mobile).slice(-9)===digits(c.mobile).slice(-9))||(norm(c.dealRef).length>=3&&norm(o.dealRef)===norm(c.dealRef))));

/* the CEM plan's success measures, for the period shown in Reports */
function successMeasures(list){
  const closed=list.filter(c=>c.status==="closed"), tgt=closed.filter(c=>withinTarget(c)!==null);
  const t=closed.filter(c=>(c.closure||{}).internalAt).map(c=>workHoursBetween(ts(c.receivedAt||c.createdAt),ts(c.closure.internalAt),S.cfg));
  const comp=list.filter(c=>isComplaintType(c.type)), rep=comp.filter(isRepeat);
  const gr=list.filter(c=>c.type==="Negative review"||/Google/i.test(c.source||"")), grOk=gr.filter(c=>(c.reviewResponse||{}).approvedAt||(c.reviewResponse||{}).notNeeded);
  const cs=list.filter(c=>c.csat&&c.csat.status==="Captured").map(c=>c.csat.score);
  const pct=(a,b)=>b?Math.round(a/b*100)+"%":"–";
  const byCh={}; list.forEach(c=>byCh[c.source]=(byCh[c.source]||0)+1);
  return `<h3 class="h3">CEM success measures</h3><p class="hint">The six measures in the CEM phased plan, for the period above. Targets will be set once there's a baseline.</p>
  <div class="tbl"><table><thead><tr><th>Measure</th><th>Result</th><th>What it tells us</th></tr></thead><tbody>
   <tr><td><b>Interactions recorded</b></td><td>${list.length} <span class="muted">(${Object.entries(byCh).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>esc(k)+" "+v).join(", ")})</span></td><td class="wrap">Are we capturing everything? Compare with channel volumes to get the percentage.</td></tr>
   <tr><td><b>Cases resolved within target time</b></td><td>${pct(tgt.filter(c=>withinTarget(c)).length,tgt.length)} <span class="muted">of ${tgt.length} closed</span></td><td>Are we meeting our service promise?</td></tr>
   <tr><td><b>Average time to resolve</b></td><td>${esc(fmtTat(t.length?t.reduce((a,b)=>a+b,0)/t.length:null))}</td><td>Are we getting faster?</td></tr>
   <tr><td><b>Repeat complaints</b></td><td>${pct(rep.length,comp.length)} <span class="muted">${rep.length} of ${comp.length}</span></td><td class="wrap">Are we fixing root causes? A follow-up case, or a complaint from the same customer within 90 days.</td></tr>
   <tr><td><b>Google reviews answered through approval</b></td><td>${pct(grOk.length,gr.length)} <span class="muted">of ${gr.length}</span></td><td>Is our public reputation under control?</td></tr>
   <tr><td><b>Customer satisfaction after closure</b></td><td>${cs.length?Math.round(cs.reduce((a,b)=>a+b,0)/cs.length*10)/10+"/5":"–"} <span class="muted">${cs.length} scores</span></td><td>How do customers rate our handling?</td></tr>
  </tbody></table></div>`;
}

/* resolve "Other" choices to the typed text */
function classifyValues(d,base){
  const out={};
  if("product" in d||"productOther" in d){ out.product=String((d.product==="__other"?d.productOther:d.product)??(base&&base.product)??"").trim(); }
  if("complaintType" in d) out.complaintType=d.complaintType;
  if("nature" in d||"natureOther" in d){ const tax=pickTax(), ct=d.complaintType??(base&&base.complaintType), list=tax[ct]||[];
    out.nature=String((!list.length||d.nature==="Other"||d.nature===undefined)&&d.natureOther!==undefined?d.natureOther:(d.nature??"")).trim(); }
  return out;
}
