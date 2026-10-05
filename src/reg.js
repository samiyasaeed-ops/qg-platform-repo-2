/* ================= Registers ================= */
const SEV=["Low","Medium","High","Critical"];
const RR_CATS=["Advisor – review conversion","Claims – Motor","Claims – Health","Support team – line manager nomination","Other"];
const PRIORITIES=["P1 – Business Critical","P2 – Processing / TAT Impact","P3 – Non‑Critical / Experience Enabler"];
const prioTag=v=>{ const p=String(v||"").slice(0,2); return v?`<span class="tag ${p==="P1"?"red":p==="P2"?"amb":"cx"}">${esc(v)}</span>`:'<span class="tag">Not set</span>'; };
const REG={
  appreciations:{prefix:"APR",noun:"appreciation",fields:[["date","Date received","date",1],["source","Source","select",1,["Email","Call (800-ALFRED)","WhatsApp","Website","Social media","Internal"]],["staffId","Staff member appreciated","staff",1],["lob","Line of business","lob",0],["ident","Customer key","ident",0],["summary","What the customer said","textarea",1],["sharedWithLM","Shared with line manager","yesno",0],["recognition","Put forward for recognition","yesno",0]],final:["Recognised"],statuses:["Logged","Shared with manager","Recognised"],cols:["date","staffId","source","summary"]},
  reviews:{prefix:"REV",noun:"positive review",fields:[["date","Review date","date",1],["platform","Platform","select",1,["Google","Trustpilot","Other"]],["rating","Rating","select",1,["5","4"]],["staffId","Staff member named","staff",0],["lob","Line of business","lob",0],["link","Review link","url",0],["summary","Review summary","textarea",1],["ident","Customer key (to match the transaction)","ident",0],["verified","Q&G matched it to the customer's transaction","yesno",0],["responded","Response posted","yesno",0]],final:["Shared with team"],statuses:["Logged","Responded","Shared with team"],cols:["date","platform","rating","staffId","verified"]},
  spotchecks:{prefix:"SPC",noun:"spot check",fields:[["date","Date of check","date",1],["lob","Line of business","lob",1],["area","Area checked","text",1],["staffId","Staff member checked","staff",0],["rating","Result","select",1,["Compliant","Minor gap","Major gap"]],["finding","Findings","textarea",1],["owner","Action owner","staff",0],["due","Action due","date",0]],final:["Closed"],statuses:["Open","Action in progress","Closed"],cols:["date","lob","area","rating","owner"]},
  breaches:{prefix:"BR",noun:"breach",fields:[["date","Date identified","date",1],["source","Source","select",1,["Call evaluation","Email evaluation","Customer experience case","Spot check","Mystery shopping","Manual"]],["sourceRef","Source reference","text",0],["staffId","Staff member","staff",1],["lob","Line of business","lob",0],["breachType","Breach","text",1],["severity","Severity","select",1,SEV],["description","Evidence and detail","textarea",0],["consequence","Consequence","consequence",0]],final:["Closed"],statuses:["Open","Actioned","Closed"],cols:["date","source","staffId","breachType","severity"]},
  noncompliance:{prefix:"NC",noun:"non-compliance",fields:[["date","Date identified","date",1],["lob","Line of business","lob",1],["area","Area","select",1,["Regulatory","Internal policy","SOP","Data protection","Sales conduct","Other"]],["description","What was found","textarea",1],["severity","Severity","select",1,SEV],["staffId","Staff member involved","staff",0],["owner","Remediation owner","staff",0],["remediation","Remediation plan","textarea",0],["due","Due date","date",0]],final:["Closed","Risk accepted"],statuses:["Open","Remediation in progress","Closed","Risk accepted"],cols:["date","lob","area","severity","owner"]},
  rca:{prefix:"RCA",noun:"root cause analysis",fields:[["date","Date opened","date",1],["caseRef","Linked case or finding","text",0],["lob","Line of business","lob",1],["problem","Problem statement","textarea",1],["category","Root cause category","select",1,["People","Process","System","Product","Partner or insurer","Customer"]],["whys","Five whys","textarea",0],["rootCause","Root cause","textarea",1],["corrective","Corrective action","textarea",0],["preventive","Preventive action","textarea",0],["owner","Action owner","staff",0],["due","Due date","date",0]],final:["Verified"],statuses:["Open","Actions agreed","Implemented","Verified"],cols:["date","caseRef","lob","category","owner"]},
  mystery:{prefix:"MS",noun:"mystery shop",fields:[["date","Date of shop","date",1],["lob","Line of business","lob",1],["channel","Channel","select",1,["Call","Email","WhatsApp","Website chat","Walk-in"]],["scenario","Scenario","text",1],["staffId","Staff member who handled it","staff",0],["score","Score (0 to 100)","number",0],["findings","Findings","textarea",0]],final:["Feedback shared"],statuses:["Planned","Completed","Feedback shared"],cols:["date","lob","channel","scenario","score"]},
  journey:{prefix:"JT",noun:"journey test",routable:true,fields:[["date","Date tested","date",1],["lob","Line of business","lob",1],["priority","Priority","select",1,PRIORITIES],["journey","Journey tested","text",1],["channel","Channel","select",1,["Website","App","Call","WhatsApp","Email"]],["steps","Steps tested","textarea",0],["result","Result","select",1,["Pass","Pass with issues","Fail"]],["defects","Defects found","textarea",0],["severity","Severity","select",0,SEV],["owner","Fix owner","staff",0]],final:["Closed"],statuses:["Open","Routed to team","Fix in progress","Ready for retest","Retest failed","Closed"],cols:["date","priority","lob","journey","result"]},
  controls:{prefix:"MC",noun:"control",fields:[["control","Control","text",1],["area","Area","select",1,["Customer experience","Complaints","Sales conduct","Claims","QA","Data protection","Regulatory reporting","Other"]],["lob","Line of business","lob",0],["owner","Control owner","staff",1],["frequency","Testing frequency","select",1,["Daily","Weekly","Monthly","Quarterly","Annually"]],["lastTested","Last tested","date",0],["result","Last result","select",0,["Effective","Partially effective","Ineffective","Not tested"]],["regRef","Regulation or policy reference","text",0],["description","What the control does","textarea",0],["testSteps","How it's tested","textarea",0]],final:["Retired"],statuses:["Active","Under review","Retired"],cols:["control","area","owner","frequency","result"]},
  product:{prefix:"PF",noun:"product finding",fields:[["date","Date raised","date",1],["lob","Line of business","lob",1],["priority","Priority","select",1,PRIORITIES],["product","Product","text",1],["finding","Finding","textarea",1],["impact","Impact","select",1,["Customer","Compliance","Revenue","Operational"]],["scope","Scope: journeys and customer groups affected","textarea",0],["raisedTo","Raised to","staff",0]],final:["Closed"],statuses:["Open","With product team","In scope for fix","Closed"],cols:["date","priority","lob","product","impact","raisedTo"]}
};
const recVenture=r=>r.venture||vOfLob(r.lob);
const recsOf=sec=>S.recs.filter(r=>r.section===sec&&inV(recVenture(r)));
function fieldVal(f,r){
  const [k,,t]=f, v=r[k];
  if(t==="staff") return v?esc(personName(v))+(r[k+"Team"]?` <span class="muted">${esc(teamName(r[k+"Team"]))}</span>`:""):"";
  if(t==="lob") return v?esc(String(v).split("|")[1]||v):"";
  if(t==="yesno") return v==="yes"?"Yes":v==="no"?"No":"";
  if(k==="priority") return prioTag(v);
  if(k==="result"&&r.section==="controls") return v?`<span class="tag ${v==="Effective"?"ok":v==="Ineffective"?"red":v==="Partially effective"?"amb":""}">${esc(v)}</span>`:"";
  if(t==="date") return esc(fmtD(v));
  if(t==="url") return v?`<a href="${esc(v)}" target="_blank" rel="noopener">Open link</a>`:"";
  if(t==="ident") return esc([r.dealRef&&"Deal "+r.dealRef,r.mobile&&"Mobile "+maskMobile(r.mobile)].filter(Boolean).join(", "));
  return esc(v);
}
function fieldInput(f,k,r){
  const [name,label,t,req,list]=f, val=dv(k,name,r?r[name]:(t==="date"?todayD():"")), cls=req?"req":"";
  const ro=!isQG()?" disabled":"";
  if(t==="ident") return `<div class="g2 span"><label class="f"><span>Customer mobile</span><input data-d="${k}" data-f="mobile" value="${esc(dv(k,"mobile",r&&r.mobile))}"${ro}></label><label class="f"><span>Deal reference</span><input data-d="${k}" data-f="dealRef" value="${esc(dv(k,"dealRef",r&&r.dealRef))}"${ro}></label></div>`;
  let inp;
  if(t==="textarea") inp=`<textarea rows="3" data-d="${k}" data-f="${name}"${ro}>${esc(val)}</textarea>`;
  else if(t==="select") inp=`<select data-d="${k}" data-f="${name}"${ro}>${opts(list,val,"Choose")}</select>`;
  else if(t==="consequence") inp=`<select data-d="${k}" data-f="${name}"${ro}>${opts(pick("consequences"),val,"Choose")}</select>`;
  else if(t==="yesno") inp=`<select data-d="${k}" data-f="${name}"${ro}>${opts([{v:"yes",l:"Yes"},{v:"no",l:"No"}],val,"Choose")}</select>`;
  else if(t==="staff") inp=`<select data-d="${k}" data-f="${name}"${ro}>${opts((REGV?staffFor(REGV):staffList()).map(p=>({v:p.id,l:p.name+" ("+teamName((asgAt(p)||{}).teamId)+")"})).concat(val&&!staffList().some(p=>p.id===val)?[{v:val,l:personName(val)+" (no longer in a team)"}]:[]),val,"Choose")}</select>`;
  else if(t==="lob") inp=`<select data-d="${k}" data-f="${name}"${ro}>${opts(REGV?lobsFor(REGV):lobs(),val,"Choose")}</select>`;
  else inp=`<input type="${t==="date"?"date":t==="number"||t==="int"?"number":t==="url"?"url":"text"}" data-d="${k}" data-f="${name}" value="${esc(val)}"${t==="date"?` max="${todayD()}"`:""}${t==="number"?' min="0" max="100"':t==="int"?' min="0" step="1"':""}${ro}>`;
  return `<label class="f${t==="textarea"?" span":""}"><span class="${cls}">${esc(label)}</span>${inp}</label>`;
}
function viewRegister(sec){
  const def=REG[sec], ui=S.ui[sec]||(S.ui[sec]={status:"",lob:"",q:""});
  const sel=S.sel[sec];
  if(sel){ const r=sel==="__new"?null:S.recs.find(x=>x.id===sel); if(sel!=="__new"&&!r) return `<p class="emptybox">Saving…</p>`; return regDetail(sec,r); }
  const all=recsOf(sec);
  const list=all.filter(r=>!ui.prio||String(r.priority||"").startsWith(ui.prio)).filter(r=>!ui.status||r.status===ui.status).filter(r=>!ui.lob||String(r.lob||"").endsWith("|"+ui.lob)).filter(r=>!ui.q||norm(JSON.stringify(r)).includes(norm(ui.q))).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))||(b.createdAt||0)-(a.createdAt||0));
  const colDefs=def.cols.map(c=>def.fields.find(f=>f[0]===c));
  const qaFeed=sec==="breaches"?breachFeed():"";
  return `${qaFeed}<div class="tools"><div class="chips"><button class="chip" data-act="regStatus" data-k="${sec}" data-v="" aria-pressed="${!ui.status}">All <span class="cnt">${all.length}</span></button>${def.statuses.map(s=>`<button class="chip" data-act="regStatus" data-k="${sec}" data-v="${esc(s)}" aria-pressed="${ui.status===s}">${esc(s)} <span class="cnt">${all.filter(r=>r.status===s).length}</span></button>`).join("")}</div>
    <div class="row"><input type="search" class="grow" placeholder="Search" data-ui="${sec}.q" value="${esc(ui.q)}">${sec==="product"?`<select data-ui="product.prio">${opts(PRIORITIES.map(x=>({v:x.slice(0,2),l:x})),ui.prio||"","All priorities")}</select>`:""}<select data-ui="${sec}.lob">${opts([...new Set(lobs().map(l=>l.lob))],ui.lob,"All LOBs")}</select>${impButton(sec)}${isQG()?`<button class="btn primary" data-act="regNew" data-k="${sec}">Add ${esc(def.noun)}</button>`:""}</div></div>${impPanel(sec)}
  ${list.length?`<div class="tbl"><table><thead><tr><th>Reference</th><th>Logged</th>${colDefs.map(f=>`<th>${esc(f[1])}</th>`).join("")}${sec==="controls"?"<th>Next test due</th>":""}${REG[sec].routable?"<th>With</th>":""}<th>Status</th><th>Last updated</th></tr></thead><tbody>${list.map(r=>`<tr class="click" data-act="regOpen" data-k="${sec}" data-id="${esc(r.id)}" tabindex="0"><td><b>${esc(r.ref||r.id)}</b></td><td>${stampCell(r.createdAt)}</td>${colDefs.map(f=>`<td class="${f[2]==="textarea"?"clip":""}">${fieldVal(f,r)}</td>`).join("")}${sec==="controls"?`<td>${(()=>{ const n=nextDue(r); return !n?'<span class="tag amb">Never tested</span>':n<todayD()?`<span class="tag red">Overdue ${esc(fmtD(n))}</span>`:esc(fmtD(n)); })()}</td>`:""}${REG[sec].routable?`<td>${r.route?esc(personName(r.route.hopId)):'<span class="muted">Not routed</span>'}</td>`:""}<td><span class="tag ${/Closed|Verified|Recognised|Feedback shared|Shared|Winner/.test(r.status)?"ok":r.status==="Retest failed"?"red":r.status==="Ready for retest"?"amb":"cx"}">${esc(r.status)}</span></td><td>${stampCell(r.updatedAt||r.createdAt)}</td></tr>`).join("")}</tbody></table></div>`
  :`<div class="emptybox">No ${esc(def.noun)} records${ui.status||ui.lob||ui.q?" match these filters":" yet"}.</div>`}`;
}
let REGV="";
function regDetail(sec,r){
  const def=REG[sec], k=r?"r-"+r.id:"r-new-"+sec;
  REGV=r?(recVenture(r)||""):formVenture(k);
  const vblock=r?(REGV?`<div class="vstep"><span>Venture</span>${vChip(REGV)} <b>${esc(vInfo(REGV).name)}</b><span class="hint" style="margin:0">A record's venture can't be changed after it's created.</span></div>`:""):ventureStep(k,formVenture(k),S.venture);
  if(!r&&!REGV) return `<div class="crumbs"><button class="linkbtn" data-act="regBack" data-k="${sec}">${esc(NAVMAP[sec].label)}</button> / New</div><h2 class="h2">Add ${esc(def.noun)}</h2>${vblock}`;
  const body=`${vblock}<div class="form"><div class="g2">${def.fields.map(f=>fieldInput(f,k,r)).join("")}</div>
    <div class="g2">${r?`<label class="f"><span>Status</span><select data-d="${k}" data-f="status"${isQG()&&!def.routable?"":" disabled"}>${opts(def.statuses.concat(def.statuses.includes(r.status)?[]:[r.status]),dv(k,"status",r.status))}</select>${def.routable?`<span class="hint" style="margin:0">Status moves with routing, updates and retest below.</span>`:""}</label>`:""}
    <label class="f"><span>Q&G owner</span><select data-d="${k}" data-f="assigneeId"${isQG()?"":" disabled"}>${qgOpts(dv(k,"assigneeId",r?r.assigneeId:(meStaff()&&isQG()?meStaff().id:"")))}</select></label></div>
    ${isQG()?`<div class="row"><button class="btn primary" data-act="regSave" data-k="${sec}"${r?` data-id="${esc(r.id)}"`:""}>${r?"Save changes":"Add "+esc(def.noun)}</button><button class="btn" data-act="regBack" data-k="${sec}">Cancel</button>${r&&S.admin?`<button class="btn danger" data-act="regDelete" data-k="${sec}" data-id="${esc(r.id)}">Move to Recycle bin</button>`:""}</div>`:""}</div>`;
  return `<div class="crumbs"><button class="linkbtn" data-act="regBack" data-k="${sec}">${esc(NAVMAP[sec].label)}</button> / ${r?esc(r.ref||r.id):"New"}</div><h2 class="h2">${r?esc(r.ref||r.id):"Add "+esc(def.noun)}</h2>
  ${r&&r.source&&r.sourceRef?`<p class="lead">From ${esc(r.source)} ${esc(r.sourceRef)}</p>`:""}
  ${r?`<div class="stamps flat">Logged ${stampCell(r.createdAt)}${r.createdByName?" by "+esc(r.createdByName):""}<span class="dot">·</span>Last updated ${stampCell(r.updatedAt||r.createdAt)}${r.closedAt?`<span class="dot">·</span>Closed ${stampCell(r.closedAt)}<span class="dot">·</span>took ${esc(fmtTat(workHoursBetween(r.createdAt,r.closedAt,S.cfg)))}`:`<span class="dot">·</span>Open for ${esc(fmtTat(workHoursBetween(r.createdAt,nowMs(),S.cfg)))}`}</div>`:""}
  <div class="split"><div>${body}${routeBlock(sec,r)}${filesBlock(sec,r)}${rawBlock(r)}</div>${r?`<aside class="timeline"><h3>History</h3><ol>${[...(r.history||[])].reverse().map(h=>`<li><b>${esc(h.note)}</b>${h.before&&Object.keys(h.before).length?`<span class="was">Was: ${esc(Object.entries(h.before).map(([k,v])=>((def.fields.find(f=>f[0]===k)||[k,k])[1])+" “"+(typeof v==="object"?JSON.stringify(v):String(v).slice(0,80))+"”").join("; "))}</span>`:""}<small>${esc(h.byName||"")}, ${esc(fmtDT(h.at))}</small></li>`).join("")}</ol></aside>`:""}</div>`;
}
async function regAction(act,el){
  const sec=el.dataset.k, def=REG[sec];
  if(act==="regStatus"){ S.ui[sec].status=el.dataset.v; return render(); }
  if(act==="regOpen"){ S.sel[sec]=el.dataset.id; return render(); }
  if(act==="regNew"){ S.sel[sec]="__new"; return render(); }
  if(act==="regBack"){ S.sel[sec]=null; return render(); }
  if(["regRoute","regUpdate","regReady","regRetest"].includes(act)) return routeAction(act,el);
  if(!isQG()) return toast("Only the Q&G team can change these records.");
  if(act==="regFileDel"){ if(!S.admin) return; const r=S.recs.find(x=>x.id===el.dataset.id), f=(r.files||[]).find(x=>x.id===el.dataset.f); if(!f) return;
    const why=prompt("Remove "+f.name+" from "+(r.ref||r.id)+"? It goes to the Recycle bin and can be restored. Reason:"); if(!why||!why.trim()) return;
    if(!await toTrash({kind:"file",title:f.name+" on "+(r.ref||r.id),recordId:r.id,file:f,venture:recVenture(r),reason:why.trim()})) return;
    await patch("mod/reg/records/"+r.id,{files:r.files.filter(x=>x.id!==f.id),updatedAt:nowMs(),history:[...(r.history||[]),{at:nowMs(),byName:S.meName,note:"Moved file "+f.name+" to the Recycle bin: "+why.trim()}]}); return; }
  if(act==="regDelete"){ if(!S.admin) return; const r=S.recs.find(x=>x.id===el.dataset.id); if(!r) return;
    const why=prompt("Delete "+(r.ref||r.id)+"? It moves to the Recycle bin, where only the administrator can restore it. Reason for deleting:"); if(!why||!why.trim()) return toast("Not deleted. A reason is needed.");
    if(!await toTrash({kind:"record",title:(r.ref||r.id)+" · "+NAVMAP[sec].label,path:"mod/reg/records/"+r.id,data:r,venture:recVenture(r),reason:why.trim()})) return;
    try{ await DB.doc("mod/reg/records/"+r.id).delete(); await addAudit("record",r.id,"Moved to Recycle bin",null,null,sec+": "+why.trim()); S.sel[sec]=null; toast("Moved to the Recycle bin."); }catch(e){ logError("write","Delete failed",{op:"delete",path:"mod/reg/records/"+r.id},e); } return; }
  if(act==="regSave"){
    const r=el.dataset.id?S.recs.find(x=>x.id===el.dataset.id):null, k=r?"r-"+r.id:"r-new-"+sec, d=draft(k);
    const out={}, miss=[];
    for(const [name,label,t,req] of def.fields){
      if(t==="ident"){ out.mobile=String(d.mobile??(r&&r.mobile)??"").trim(); out.dealRef=String(d.dealRef??(r&&r.dealRef)??"").trim(); if(req&&!identOk(out.mobile,out.dealRef)) miss.push("a mobile or deal reference"); continue; }
      const v=d[name]??(r?r[name]:(t==="date"?todayD():"")); out[name]=typeof v==="string"?v.trim():v;
      if(req&&(v===""||v==null)) miss.push(label.toLowerCase());
      if(t==="staff"&&v) out[name+"Team"]=(asgAt(S.staff[v],out.date||todayD())||{}).teamId||(r&&r[name+"Team"])||null;
    }
    if(out.date&&out.date>todayD()) miss.push("a date that isn't in the future");
    const recV=r?(recVenture(r)||""):formVenture(k);
    if(!r&&!recV) return toast("Choose the venture first.");
    for(const [name,,t] of def.fields) if(t==="lob"&&out[name]&&recV&&vOfLob(out[name])!==recV) out[name]="";
    if(miss.length) return toast("Add "+miss.join(", ")+".");
    if(r){
      const status=d.status||r.status; out.assigneeId=d.assigneeId??r.assigneeId??null; out.venture=r.venture||vOfLob(out.lob)||"";
      const changed=Object.keys(out).filter(f=>JSON.stringify(out[f]??"")!==JSON.stringify(r[f]??""));
      if(status!==r.status) changed.push("status");
      if(!changed.length) return toast("Nothing changed.");
      const note=status!==r.status?"Status: "+r.status+" → "+status+(changed.length>1?"; edited "+changed.filter(f=>f!=="status").join(", "):""):"Edited "+changed.join(", ");
      const before=Object.fromEntries(changed.map(f=>[f,f==="status"?r.status:(r[f]??"")]));
      const extra=def.final.includes(status)&&!def.final.includes(r.status)?{closedAt:nowMs()}:!def.final.includes(status)&&r.closedAt?{closedAt:null}:{};
      if(!await patch("mod/reg/records/"+r.id,{...out,...extra,status,updatedAt:nowMs(),history:[...(r.history||[]),{at:nowMs(),byName:S.meName,note:out.assigneeId!==(r.assigneeId||null)?note+"; owner "+personName(out.assigneeId):note,before}]})) return;
      if(out.assigneeId&&out.assigneeId!==(r.assigneeId||null)) notifyAssigned(out.assigneeId,r.ref||r.id,NAVMAP[sec].label);
      delete S.drafts[k]; return toast("Saved.");
    }
    const ref=await nextRef(def.prefix);
    out.assigneeId=d.assigneeId??(meStaff()&&isQG()?meStaff().id:null);
    out.venture=recV;
    const doc={id:ref,ref,section:sec,...out,status:def.statuses[0],updatedAt:nowMs(),createdAt:nowMs(),createdBy:S.uid,createdByName:S.meName,history:[{at:nowMs(),byName:S.meName,note:"Created"}]};
    if(!await put("mod/reg/records/"+ref,doc)) return;
    await addAudit("record",ref,"Created",null,null,sec);
    if(out.assigneeId&&(!meStaff()||out.assigneeId!==meStaff().id)) notifyAssigned(out.assigneeId,ref,NAVMAP[sec].label);
    delete S.drafts[k]; S.sel[sec]=ref; render(); return toast(ref+" added.");
  }
  if(act==="trackBreach"||act==="trackAll"){
    const items=act==="trackAll"?breachCandidates():breachCandidates().filter(x=>x.key===el.dataset.id);
    for(const it of items){ await put("mod/reg/records/"+it.key,{...it.doc,id:it.key,ref:it.key.toUpperCase(),createdAt:nowMs(),createdBy:S.uid,createdByName:S.meName,history:[{at:nowMs(),byName:S.meName,note:"Tracked from QA evaluation "+it.doc.sourceRef}]}); }
    return toast(items.length+" breach"+(items.length===1?"":"es")+" added to the tracker.");
  }
}
function breachCandidates(){
  const tracked=new Set(recsOf("breaches").map(r=>r.id)), out=[];
  for(const e of evalsV()){
    if(!["pending_review","confirmed","published"].includes(e.status)) continue;
    const staff=Object.values(S.staff).find(p=>(e.advisorEmail&&norm(p.email)===norm(e.advisorEmail))||p.qaAdvisorId===e.advisorId||p.id===e.advisorId);
    const lobKey=(e.ventureId||"insurancemarket")+"|"+e.lob;
    const src=/email/i.test(e.channel||"")?"Email evaluation":"Call evaluation";
    const base={section:"breaches",date:dateOf(e.interactionDate||e.createdAt),source:src,sourceRef:e.callId||e.id,staffId:staff?staff.id:null,staffIdTeam:staff?((asgAt(staff,dateOf(e.interactionDate||e.createdAt))||{}).teamId||null):null,lob:lobKey,status:"Open",advisorName:e.advisorName||""};
    if(e.hasFatalError){ const key="qa-"+String(e.id).toLowerCase()+"-fatal"; if(!tracked.has(key)) out.push({key,e,label:"Fatal error"+(e.fatalErrorCode?" "+e.fatalErrorCode:""),doc:{...base,breachType:"Fatal error"+(e.fatalErrorCode?" "+e.fatalErrorCode:""),severity:"Critical",description:e.fatalErrorReason||""}}); }
    (e.policyBreaches||[]).forEach((b,ix)=>{ const key="qa-"+String(e.id).toLowerCase()+"-"+ix; if(!tracked.has(key)) out.push({key,e,label:b.ruleTitle||"Policy breach",doc:{...base,breachType:b.ruleTitle||"Policy breach",severity:SEV.includes(b.severity)?b.severity:"Medium",description:[b.transcriptQuote&&"“"+b.transcriptQuote+"”",b.policySnippet].filter(Boolean).join(" ")}}); });
  }
  return out;
}
function breachFeed(){
  const c=breachCandidates(); if(!c.length) return "";
  return `<div class="feed"><div class="row between"><div><b>${c.length} breach${c.length===1?"":"es"} flagged in QA evaluations, not yet tracked</b><p class="hint">Policy breaches and fatal errors marked in Call and Email evaluations land here automatically.</p></div>${isQG()?`<button class="btn" data-act="trackAll" data-k="breaches">Track all</button>`:""}</div>
  <ul class="plain">${c.slice(0,10).map(x=>`<li class="row between"><span><b>${esc(x.doc.sourceRef)}</b> · ${esc(x.e.advisorName||"Advisor")} · ${esc(x.label)} <span class="tag ${x.doc.severity==="Critical"||x.doc.severity==="High"?"red":"amb"}">${esc(x.doc.severity)}</span>${!x.doc.staffId?' <span class="muted">Not matched to the staff list</span>':""}</span>${isQG()?`<button class="btn sm" data-act="trackBreach" data-k="breaches" data-id="${esc(x.key)}">Track</button>`:""}</li>`).join("")}</ul>${c.length>10?`<p class="hint">${c.length-10} more. Use Track all.</p>`:""}</div>`;
}

/* ================= Playbooks (versioned, admin-only edit) ================= */
const PB_TEMPLATE="# Purpose\n\n# Roles\n\n# Steps\n1. \n\n# Service levels\n\n# Records and evidence\n\n# Controls";
function pbOf(sec){ const p=S.playbooks[sec]; return p&&p.versions&&p.versions.length?p:null; }
function viewPlaybook(sec){
  const p=pbOf(sec), ui=S.ui["pb-"+sec]||(S.ui["pb-"+sec]={v:null,edit:false}), k="pb-"+sec;
  const cur=p?(ui.v?p.versions.find(x=>x.v===ui.v):p.versions[p.versions.length-1]):null;
  if(ui.edit&&S.admin){
    const last=p?p.versions[p.versions.length-1]:null;
    return `<div class="form"><p class="hint">Saving creates version ${(last?last.v:0)+1}. Earlier versions stay readable in the history. Use # for headings, - for bullets and 1. for steps.</p>
      <label class="f"><span class="req">Playbook</span><textarea rows="22" class="mono" data-d="${k}" data-f="body">${esc(dv(k,"body",last?last.body:PB_TEMPLATE))}</textarea></label>
      <label class="f"><span class="req">What changed and why</span><input data-d="${k}" data-f="note" value="${esc(dv(k,"note",""))}"></label>
      <div class="row"><button class="btn primary" data-act="pbSave" data-k="${sec}">Publish version ${(last?last.v:0)+1}</button><button class="btn" data-act="pbCancel" data-k="${sec}">Cancel</button></div></div>`;
  }
  return `<div class="pb">${cur?`<div class="pbmeta">Version ${cur.v}${cur.v!==p.versions[p.versions.length-1].v?' <span class="tag amb">Older version</span>':' <span class="tag ok">Current</span>'} · published ${esc(fmtDT(cur.at))} · ${esc(cur.byName||"")}${cur.note?" · "+esc(cur.note):""}</div><article class="prose">${mdLite(cur.body)}</article>`
    :`<div class="emptybox">No playbook for this section yet.${S.admin?" Write the first version.":""}</div>`}
    <div class="row">${S.admin?`<button class="btn primary" data-act="pbEdit" data-k="${sec}">${p?"Write a new version":"Write the playbook"}</button>`:""}</div>
    ${questionsFor(sec).length?`<h3 class="h3">Open questions for this section</h3><p class="hint">Answers here shape the next version of this playbook. The full list is in Open questions.</p><ol class="qlist">${questionsFor(sec).filter(q=>q.status!=="Answered"||S.admin).map(questionBlock).join("")}</ol>`:""}
    ${p&&p.versions.length>1?`<h3 class="h3">Version history</h3><ul class="plain">${[...p.versions].reverse().map(x=>`<li><button class="linkbtn" data-act="pbView" data-k="${sec}" data-v="${x.v}">Version ${x.v}</button> <span class="muted">${esc(fmtDT(x.at))}, ${esc(x.byName||"")}: ${esc(x.note||"")}</span></li>`).join("")}</ul>`:""}</div>`;
}
async function pbAction(act,el){
  const sec=el.dataset.k, ui=S.ui["pb-"+sec]||(S.ui["pb-"+sec]={});
  if(act==="pbView"){ ui.v=+el.dataset.v; return render(); }
  if(act==="pbEdit"){ ui.edit=true; return render(); }
  if(act==="pbCancel"){ ui.edit=false; delete S.drafts["pb-"+sec]; return render(); }
  if(act==="pbSave"){
    if(!S.admin) return;
    const d=draft("pb-"+sec), p=pbOf(sec), last=p?p.versions[p.versions.length-1]:null;
    const body=String(d.body??(last&&last.body)??PB_TEMPLATE).trim(), note=String(d.note||"").trim();
    if(!body||!note) return toast("Write the playbook and say what changed.");
    const versions=[...(p?p.versions:[]),{v:(last?last.v:0)+1,at:nowMs(),by:S.uid,byName:S.meName,body,note}];
    if(!await put("mod/pb/playbooks/"+sec,{section:sec,versions})) return;
    await addAudit("playbook",sec,"Published version "+versions.length,null,null,note);
    ui.edit=false; ui.v=null; delete S.drafts["pb-"+sec]; render(); return toast("Version "+versions.length+" published.");
  }
}

/* ================= SOP repository ================= */
function viewSOPs(){
  const ui=S.ui.sops||(S.ui.sops={q:"",lob:"",status:"Active"}), sel=S.sel.sops;
  if(sel){ const s=sel==="__new"?null:S.sops.find(x=>x.id===sel); if(sel!=="__new"&&!s) return `<p class="emptybox">Saving…</p>`; return sopDetail(s); }
  const list=S.sops.filter(s=>!S.venture||!s.venture||s.venture==="all"||s.venture===S.venture).filter(s=>!ui.status||s.status===ui.status).filter(s=>!ui.lob||s.lob===ui.lob||s.lob==="All").filter(s=>!ui.q||norm(s.title+" "+s.category).includes(norm(ui.q))).sort((a,b)=>a.title.localeCompare(b.title));
  return `<div class="tools"><div class="chips">${["Active","Draft","Retired",""].map(s=>`<button class="chip" data-act="sopStatus" data-v="${s}" aria-pressed="${ui.status===s}">${s||"All"}</button>`).join("")}</div>
  <div class="row"><input type="search" class="grow" placeholder="Search SOPs" data-ui="sops.q" value="${esc(ui.q)}"><select data-ui="sops.lob">${opts(["All",...new Set(lobs().map(l=>l.lob))],ui.lob,"Any LOB")}</select>${S.admin?`<button class="btn primary" data-act="sopNew">Add SOP</button>`:""}</div></div>
  ${list.length?`<div class="tbl"><table><thead><tr><th>SOP</th><th>Venture</th><th>Category</th><th>LOB</th><th>Version</th><th>Effective</th><th>Last updated</th><th>Status</th></tr></thead><tbody>${list.map(s=>{ const v=s.versions[s.versions.length-1]; return `<tr class="click" data-act="sopOpen" data-id="${esc(s.id)}" tabindex="0"><td><b>${esc(s.title)}</b></td><td>${!s.venture||s.venture==="all"?'<span class="tag">Group-wide</span>':vChip(s.venture)}</td><td>${esc(s.category)}</td><td>${esc(s.lob)}</td><td>v${v.v}</td><td>${esc(fmtD(v.effective))}</td><td>${stampCell(v.at)}</td><td><span class="tag ${s.status==="Active"?"ok":""}">${esc(s.status)}</span></td></tr>`; }).join("")}</tbody></table></div>`:`<div class="emptybox">No SOPs here yet.${S.admin?" Add SOPs with their version and effective date.":""}</div>`}`;
}
function sopDetail(s){
  const k=s?"sop-"+s.id:"sop-new", ui=S.ui["sop-"+(s?s.id:"new")]||(S.ui["sop-"+(s?s.id:"new")]={v:null,edit:!s});
  const last=s?s.versions[s.versions.length-1]:null, cur=s?(ui.v?s.versions.find(x=>x.v===ui.v):last):null;
  if(ui.edit&&S.admin) return `<div class="crumbs"><button class="linkbtn" data-act="sopBack">SOP repository</button> / ${s?esc(s.title):"New SOP"}</div><h2 class="h2">${s?"New version of "+esc(s.title):"Add an SOP"}</h2>
    <div class="form"><div class="g3"><label class="f"><span class="req">Title</span><input data-d="${k}" data-f="title" value="${esc(dv(k,"title",s&&s.title))}"></label>
      <label class="f"><span class="req">Category</span><select data-d="${k}" data-f="category">${opts(["Customer experience","Complaints","Sales","Service","Claims","Compliance","Quality assurance","Operations","HR and conduct"],dv(k,"category",s&&s.category),"Choose")}</select></label>
      <label class="f"><span class="req">Venture</span><select data-d="${k}" data-f="venture">${opts([{v:"all",l:"Group-wide"},...ventures().map(v=>({v:v.id,l:v.name}))],dv(k,"venture",s?s.venture||"all":(S.venture||"all")))}</select></label>
      <label class="f"><span class="req">LOB</span><select data-d="${k}" data-f="lob">${opts(["All",...new Set(lobs().map(l=>l.lob))],dv(k,"lob",s?s.lob:"All"))}</select></label></div>
      <div class="g3"><label class="f"><span class="req">Effective date</span><input type="date" data-d="${k}" data-f="effective" value="${esc(dv(k,"effective",todayD()))}"></label>
      <label class="f"><span>Status</span><select data-d="${k}" data-f="status">${opts(["Active","Draft","Retired"],dv(k,"status",s?s.status:"Active"))}</select></label>
      <label class="f"><span>Document link</span><input type="url" data-d="${k}" data-f="link" value="${esc(dv(k,"link",last&&last.link))}" placeholder="https://"></label></div>
      ${ASSETS?`<label class="f"><span>Or upload the document</span><input type="file" data-sopfile="${k}" accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.txt,.md"></label>${S.drafts[k]&&S.drafts[k].assetName?`<p class="hint">Uploaded: ${esc(S.drafts[k].assetName)}</p>`:""}`:""}
      <label class="f"><span>SOP text or summary</span><textarea rows="12" data-d="${k}" data-f="body">${esc(dv(k,"body",last&&last.body))}</textarea></label>
      <label class="f"><span class="req">What changed and why</span><input data-d="${k}" data-f="note" value="${esc(dv(k,"note",s?"":"First version"))}"></label>
      <div class="row"><button class="btn primary" data-act="sopSave"${s?` data-id="${esc(s.id)}"`:""}>${s?"Publish version "+(last.v+1):"Add SOP"}</button><button class="btn" data-act="${s?"sopCancel":"sopBack"}"${s?` data-id="${esc(s.id)}"`:""}>Cancel</button></div></div>`;
  return `<div class="crumbs"><button class="linkbtn" data-act="sopBack">SOP repository</button> / ${esc(s.title)}</div><h2 class="h2">${esc(s.title)} <span class="tag ${s.status==="Active"?"ok":""}">${esc(s.status)}</span></h2>
   <p class="lead">${esc(s.category)} · ${esc(s.lob)} · version ${cur.v}${cur.v!==last.v?" (older version)":""}, effective ${esc(fmtD(cur.effective))}</p>
   ${cur.link||cur.assetId?`<p>${cur.assetId?`<a class="btn" href="/_blob/${esc(cur.assetId)}" target="_blank" rel="noopener">Open ${esc(cur.assetName||"document")}</a> `:""}${cur.link?`<a class="btn" href="${esc(cur.link)}" target="_blank" rel="noopener">Open linked document</a>`:""}</p>`:""}
   ${cur.body?`<article class="prose">${mdLite(cur.body)}</article>`:""}
   ${S.admin?`<div class="row"><button class="btn primary" data-act="sopEdit" data-id="${esc(s.id)}">Publish a new version</button></div>`:""}
   <h3 class="h3">Version history</h3><ul class="plain">${[...s.versions].reverse().map(x=>`<li><button class="linkbtn" data-act="sopView" data-id="${esc(s.id)}" data-v="${x.v}">Version ${x.v}</button> <span class="muted">effective ${esc(fmtD(x.effective))}, published ${esc(fmtDT(x.at))} by ${esc(x.byName||"")}: ${esc(x.note||"")}</span></li>`).join("")}</ul>`;
}
async function sopAction(act,el){
  const id=el.dataset.id;
  if(act==="sopStatus"){ S.ui.sops.status=el.dataset.v; return render(); }
  if(act==="sopOpen"){ S.sel.sops=id; return render(); }
  if(act==="sopBack"){ S.sel.sops=null; return render(); }
  if(act==="sopNew"){ S.sel.sops="__new"; S.ui["sop-new"]={edit:true}; return render(); }
  if(act==="sopView"){ (S.ui["sop-"+id]||(S.ui["sop-"+id]={})).v=+el.dataset.v; return render(); }
  if(act==="sopEdit"){ (S.ui["sop-"+id]||(S.ui["sop-"+id]={})).edit=true; return render(); }
  if(act==="sopCancel"){ S.ui["sop-"+id].edit=false; return render(); }
  if(act==="sopSave"){
    if(!S.admin) return;
    const s=id?S.sops.find(x=>x.id===id):null, k=s?"sop-"+s.id:"sop-new", d=draft(k), last=s?s.versions[s.versions.length-1]:null;
    const title=String(d.title??(s&&s.title)??"").trim(), category=d.category??(s&&s.category), note=String(d.note??(s?"":"First version")).trim();
    if(!title||!category||!note) return toast("Add the title, category and what changed.");
    const v={v:(last?last.v:0)+1,effective:d.effective||todayD(),link:d.link??(last&&last.link)??"",assetId:d.assetId??(last&&last.assetId)??null,assetName:d.assetName??(last&&last.assetName)??"",body:d.body??(last&&last.body)??"",note,at:nowMs(),byName:S.meName};
    const doc={id:s?s.id:rid("sop-"),title,category,venture:d.venture??(s?s.venture||"all":(S.venture||"all")),lob:d.lob??(s?s.lob:"All"),status:d.status??(s?s.status:"Active"),versions:[...(s?s.versions:[]),v],updatedAt:nowMs()};
    if(!await put("mod/sop/docs/"+doc.id,doc)) return;
    await addAudit("sop",doc.id,"Published version "+v.v,null,null,title+": "+note);
    delete S.drafts[k]; S.ui["sop-"+doc.id]={edit:false,v:null}; S.ui["sop-new"]={edit:true}; S.sel.sops=doc.id; render(); return toast("Version "+v.v+" published.");
  }
}

function notifyAssigned(staffId,ref,where){ sendMail({to:[emailOf(staffId)],subject:`Assigned to you: ${ref}`,lines:[`${S.meName} made you the Q&G owner of ${ref} in ${where}.`],ref,kind:"assign"}); }

/* ---- evidence files and images on records ---- */
const isImg=f=>/^image\//.test(f.type||"")||/\.(png|jpe?g|gif|webp)$/i.test(f.name||"");
function filesBlock(sec,r){
  const label=sec==="journey"?"Screenshots and images":"Evidence files";
  if(!r) return `<p class="hint">${esc(label)}: save the record first, then add files.</p>`;
  const fs=r.files||[];
  return `<div class="files"><h3 class="h3">${esc(label)} <span class="muted">${fs.length}</span></h3>
   ${fs.length?`<div class="thumbs">${fs.map(f=>`<figure>${isImg(f)?`<a href="/_blob/${esc(f.id)}" target="_blank" rel="noopener"><img src="/_blob/${esc(f.id)}" alt="${esc(f.caption||f.name)}" loading="lazy"></a>`:`<a class="filecard" href="/_blob/${esc(f.id)}" target="_blank" rel="noopener">${esc((f.name.split(".").pop()||"file").toUpperCase())}</a>`}<figcaption>${esc(f.caption||f.name)}<br><small>${esc(f.byName||"")}, ${esc(fmtDT(f.at))}</small></figcaption>${S.admin?`<button class="linkbtn" data-act="regFileDel" data-k="${esc(sec)}" data-id="${esc(r.id)}" data-f="${esc(f.id)}">Remove</button>`:""}</figure>`).join("")}</div>`:`<p class="muted">No files yet.</p>`}
   ${ASSETS&&isQG()?`<label class="f" style="margin-top:8px"><span>Add ${sec==="journey"?"screenshots or images":"files"} (images, PDF; up to 20 MB each)</span><input type="file" multiple data-recfile="${esc(r.id)}" accept="${sec==="journey"?"image/*,.pdf":"image/*,.pdf,.txt,.csv"}"></label>`:""}</div>`;
}
async function uploadRecFiles(id,list){
  const r=S.recs.find(x=>x.id===id); if(!r||!ASSETS) return;
  const added=[];
  for(const f of list){
    if(f.size>20*1024*1024){ toast(f.name+" is over 20 MB."); continue; }
    try{ const a=await ASSETS.upload(f); added.push({id:a.id,name:f.name,type:f.type,size:f.size,at:nowMs(),by:S.uid,byName:S.meName}); }
    catch(e){ logError("upload","Upload failed on "+(r.ref||id)+": "+f.name,{id,name:f.name},e); toast(f.name+" didn't upload. It's in the error report."); }
  }
  if(!added.length) return;
  await patch("mod/reg/records/"+id,{files:[...(r.files||[]),...added],updatedAt:nowMs(),history:[...(r.history||[]),{at:nowMs(),byName:S.meName,note:"Added "+added.length+" file"+(added.length>1?"s":"")+": "+added.map(a=>a.name).join(", ")}]});
  toast(added.length+" file"+(added.length>1?"s":"")+" added.");
}

/* ---- controls: next test due ---- */
const FREQ_DAYS={Daily:1,Weekly:7,Monthly:31,Quarterly:92,Annually:366};
function nextDue(r){ if(!r.lastTested) return null; return addDays(r.lastTested,FREQ_DAYS[r.frequency]||31); }

/* ---- routing findings to a team and retest before closure (journey testing) ---- */
const routeOf=r=>r.route||null;
const isHop=r=>{ const me=meStaff(), rt=routeOf(r); return !!(me&&rt&&(rt.hopId===me.id)); };
function routeBlock(sec,r){
  const def=REG[sec]; if(!def.routable||!r) return "";
  const k="rt-"+r.id, rt=routeOf(r), ups=r.updates||[], rts=r.retests||[], closed=r.status==="Closed";
  const v=recVenture(r), teams=Object.values(S.teams).filter(t=>t.active!==false&&t.venture===v&&t.kind!=="qg").sort((a,b)=>a.name.localeCompare(b.name));
  const tsel=dv(k,"teamId",rt&&rt.teamId||""), t=S.teams[tsel];
  let h=`<section class="stage ${closed?"done":rt?"active":"todo"}"><header><span class="no">→</span><h3>Routing, updates and retest</h3><span class="own">${rt?esc(personName(rt.hopId)):"Not routed"}</span><span class="st">${esc(r.status)}</span></header>`;
  if(rt) h+=`<div class="stamps">Routed ${stampCell(rt.routedAt)} by ${esc(rt.routedByName||"")}${rt.dueDate?`<span class="dot">·</span>update expected by ${esc(fmtD(rt.dueDate))}`:""}<span class="dot">·</span>${closed?"Closed "+stampCell(r.closedAt):"open for "+esc(fmtTat(workHoursBetween(rt.routedAt,nowMs(),S.cfg)))}</div>`;
  h+=`<div class="b">`;
  if(!closed&&isQG()&&(!rt||r.status==="Retest failed")){
    h+=`<div class="form"><div class="g3"><label class="f"><span class="req">Route to team</span><select data-d="${k}" data-f="teamId">${opts(teams.map(x=>({v:x.id,l:x.name+" · "+x.lob})),tsel,teams.length?"Choose team":"No "+vInfo(v).name+" teams yet")}</select></label>
      <label class="f"><span class="req">Head of Product (receives it)</span><select data-d="${k}" data-f="hopId">${opts(staffFor(v).map(p=>({v:p.id,l:p.name})),dv(k,"hopId",(rt&&rt.hopId)||vInfo(v).headOfProductId||(t&&t.lineManagerId)||""),"Choose person")}</select>${!vInfo(v).headOfProductId?`<span class="hint" style="margin:0">Set ${esc(vInfo(v).name)}'s Head of Product in Ventures to pre-fill this.</span>`:""}</label>
      <label class="f"><span>Update expected by</span><input type="date" data-d="${k}" data-f="dueDate" min="${todayD()}" value="${esc(dv(k,"dueDate",(rt&&rt.dueDate&&rt.dueDate>=todayD()?rt.dueDate:addDays(todayD(),3))))}"></label></div>
      <label class="f"><span>Message to the team</span><textarea rows="2" data-d="${k}" data-f="msg">${esc(dv(k,"msg",""))}</textarea></label>
      <div class="row"><button class="btn primary" data-act="regRoute" data-k="${sec}" data-id="${esc(r.id)}">${rt?"Route again":"Route to team"}</button></div><p class="hint">The Head of Product gets an email that a new finding has been submitted to them, copied to the team's superior and the Q&G owner.</p></div>`;
  }
  if(ups.length) h+=`<h4 class="sub4">Updates</h4><ol class="ups">${ups.map(u=>`<li class="${esc(u.kind)}"><b>${esc(u.kind==="ready"?"Ready for retest":u.kind==="route"?"Routed":"Update")}</b> ${esc(u.text)}<small>${esc(u.byName)}, ${esc(fmtDT(u.at))}</small></li>`).join("")}</ol>`;
  if(rt&&!closed&&(isHop(r)||isQG())&&r.status!=="Ready for retest"){
    h+=`<div class="form inset"><label class="f"><span>${isHop(r)?"Share an update with Q&G":"Add an update"}</span><textarea rows="2" data-d="${k}" data-f="update">${esc(dv(k,"update",""))}</textarea></label>
     <div class="row"><button class="btn" data-act="regUpdate" data-k="${sec}" data-id="${esc(r.id)}">Post update</button>${isHop(r)||S.admin?`<button class="btn primary" data-act="regReady" data-k="${sec}" data-id="${esc(r.id)}">Fixed, ready for Q&G retest</button>`:""}</div></div>`;
  }
  if(rts.length) h+=`<h4 class="sub4">Q&G retests</h4>${rts.map(x=>`<div class="callout ${x.result==="Pass"?"":"amb"}"><b>${esc(x.result==="Pass"?"Passed, Q&G satisfied":"Failed")}</b> ${esc(x.notes)} <span class="muted">${esc(x.byName)}, ${esc(fmtDT(x.at))}</span></div>`).join("")}`;
  if(!closed&&isQG()&&rt&&["Ready for retest","Fix in progress","Routed to team"].includes(r.status)){
    h+=`<div class="form inset"><b class="sm">Retest by Q&G</b><div class="g2"><label class="f"><span class="req">Retest result</span><select data-d="${k}" data-f="result">${opts(["Pass","Fail"],dv(k,"result",""),"Choose")}</select></label><label class="f"><span>Retest date</span><input type="date" value="${todayD()}" disabled></label></div>
     <label class="f"><span class="req">What Q&G found on retest</span><textarea rows="2" data-d="${k}" data-f="notes">${esc(dv(k,"notes",""))}</textarea></label>
     ${dv(k,"result","")==="Pass"?`<label class="radio"><input type="checkbox" data-d="${k}" data-f="satisfied"${dv(k,"satisfied",false)?" checked":""}> Q&G has retested and is satisfied the finding is resolved</label>`:""}
     <div class="row"><button class="btn primary" data-act="regRetest" data-k="${sec}" data-id="${esc(r.id)}">Record retest</button></div><p class="hint">Only Q&G closes a journey test, and only after a passed retest. Add screenshots of the retest under Screenshots and images.</p></div>`;
  }
  if(!rt&&!isQG()) h+=`<p class="muted">Not routed yet.</p>`;
  return h+`</div></section>`;
}
async function routeAction(act,el){
  const sec=el.dataset.k, r=S.recs.find(x=>x.id===el.dataset.id); if(!r) return;
  const k="rt-"+r.id, d=draft(k), rt=routeOf(r), ref=r.ref||r.id, owner=r.assigneeId;
  const hist=note=>[...(r.history||[]),{at:nowMs(),byName:S.meName,note}];
  if(act==="regRoute"){
    if(!isQG()) return toast("Only Q&G routes findings.");
    const t=S.teams[d.teamId||(rt&&rt.teamId)], hop=d.hopId||(rt&&rt.hopId)||vInfo(recVenture(r)).headOfProductId||(t&&t.lineManagerId);
    if(!t||!hop) return toast("Choose the team and the Head of Product.");
    const route={teamId:t.id,hopId:hop,superiorId:t.superiorId||null,routedAt:nowMs(),routedBy:S.uid,routedByName:S.meName,dueDate:d.dueDate||addDays(todayD(),3)};
    const msg=String(d.msg||"").trim();
    if(!await patch("mod/reg/records/"+r.id,{route,status:"Routed to team",updatedAt:nowMs(),updates:[...(r.updates||[]),{kind:"route",text:"Routed to "+t.name+" ("+personName(hop)+")"+(msg?": "+msg:""),at:nowMs(),by:S.uid,byName:S.meName}],history:hist("Routed to "+t.name+", "+personName(hop))})) return;
    sendMail({to:[emailOf(hop)],cc:[emailOf(t.superiorId),emailOf(owner)],subject:`New ${REG[sec].noun} submitted to you: ${ref}`,lines:[`Q&G has submitted ${ref} to ${t.name} for action.`,[r.journey||r.product||"",r.priority||""].filter(Boolean).join(" · "),r.defects?`Defects found: ${r.defects}`:"",msg?`Message from Q&G: ${msg}`:"",`Please share your update on the platform by ${fmtD(route.dueDate)}. Q&G will retest once you mark it fixed, and only Q&G closes it.`].filter(Boolean),ref,kind:"route"});
    delete S.drafts[k]; return toast("Routed to "+personName(hop)+". They've been emailed.");
  }
  if(act==="regUpdate"||act==="regReady"){
    if(!(isHop(r)||isQG())) return toast("Only the team it was routed to, or Q&G, can update it.");
    const text=String(d.update||"").trim(); if(!text) return toast(act==="regReady"?"Describe the fix before marking it ready.":"Write the update first.");
    const status=act==="regReady"?"Ready for retest":(r.status==="Routed to team"||r.status==="Retest failed"?"Fix in progress":r.status);
    if(!await patch("mod/reg/records/"+r.id,{status,updatedAt:nowMs(),updates:[...(r.updates||[]),{kind:act==="regReady"?"ready":"update",text,at:nowMs(),by:S.uid,byName:S.meName}],history:hist((act==="regReady"?"Marked ready for retest: ":"Update: ")+text.slice(0,120))})) return;
    if(!isQG()||isHop(r)) sendMail({to:owner&&emailOf(owner)?[emailOf(owner)]:qgEmails(),subject:`${act==="regReady"?"Ready for Q&G retest":"Team update"}: ${ref}`,lines:[`${S.meName} ${act==="regReady"?"marked "+ref+" as fixed and ready for Q&G retest":"posted an update on "+ref}.`,text],ref,kind:"route_update"});
    delete d.update; return toast(act==="regReady"?"Sent to Q&G for retest.":"Update posted.");
  }
  if(act==="regRetest"){
    if(!isQG()) return toast("Only Q&G retests.");
    const res=d.result, notes=String(d.notes||"").trim(); if(!res||!notes) return toast("Add the retest result and what you found.");
    if(res==="Pass"&&!d.satisfied) return toast("Tick that Q&G has retested and is satisfied, to close it.");
    const retest={result:res,notes,at:nowMs(),by:S.uid,byName:S.meName}, status=res==="Pass"?"Closed":"Retest failed";
    if(!await patch("mod/reg/records/"+r.id,{status,closedAt:res==="Pass"?nowMs():null,retests:[...(r.retests||[]),retest],updatedAt:nowMs(),history:hist("Q&G retest "+(res==="Pass"?"passed; closed":"failed")+": "+notes.slice(0,120))})) return;
    if(rt) sendMail({to:[emailOf(rt.hopId)],cc:[emailOf(rt.superiorId)],subject:`${res==="Pass"?"Closed after Q&G retest":"Retest failed, action needed"}: ${ref}`,lines:[res==="Pass"?`Q&G retested ${ref} and is satisfied. It is now closed.`:`Q&G retested ${ref} and the issue is still there. Please fix it and update the platform.`,`Q&G findings: ${notes}`],ref,kind:"retest"});
    delete S.drafts[k]; return toast(res==="Pass"?"Closed after retest.":"Retest failed. Sent back to the team.");
  }
}
