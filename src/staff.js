/* ================= Staff list (single source) ================= */
const ROLES=[["advisor","Advisor"],["team_lead","Team lead"],["line_manager","Line manager"],["head","Head of department"],["qg_analyst","Q&G analyst"],["chief","Chief Q&G"]];
const roleLabel=r=>(ROLES.find(x=>x[0]===r)||[r,r])[1];
function moves(teamId,fromDate,toDate){
  const out=[];
  for(const p of Object.values(S.staff)){
    const as=p.assignments||[];
    as.forEach((a,ix)=>{
      if(a.teamId===teamId&&a.to&&a.to>=fromDate&&a.to<=toDate){ const nx=as[ix+1]; out.push({p,kind:"out",date:a.to,next:nx?nx.teamId:null,nextFrom:nx?nx.from:null}); }
      if(a.teamId===teamId&&ix>0&&a.from>=fromDate&&a.from<=toDate) out.push({p,kind:"in",date:a.from,prev:as[ix-1].teamId});
    });
  }
  return out.sort((a,b)=>b.date.localeCompare(a.date));
}
function viewStaff(){
  const ui=S.ui.staff||(S.ui.staff={tab:"people",asOf:todayD(),team:"",q:""});
  const nd=S.admin?dupGroups().length:0;
  const tabs=[["people","People"],["teams","Teams"],...(S.admin?[["dups","Possible duplicates"+(nd?" ("+nd+")":"")]]:[]),["log","Change log"]];
  let body="";
  if(S.sel.person==="__bulk") body=viewBulkAdd();
  else if(S.sel.person) body=personPanel(S.sel.person==="__new"?null:S.staff[S.sel.person]);
  else if(S.sel.team) body=teamPanel(S.sel.team==="__new"?null:S.teams[S.sel.team]);
  else if(ui.tab==="people") body=peopleTable(ui);
  else if(ui.tab==="teams") body=teamsTable(ui);
  else if(ui.tab==="dups") body=viewDupReview();
  else body=changeLog();
  return `${!S.sel.person&&!S.sel.team?`<div class="tools"><div class="chips">${tabs.map(([k,l])=>`<button class="chip" data-act="staffTab" data-k="${k}" aria-pressed="${ui.tab===k}">${l}</button>`).join("")}</div>
    <div class="row">${ui.tab!=="log"?`<label class="inline">As of <input type="date" data-ui="staff.asOf" value="${esc(ui.asOf)}"></label>`:""}
    ${S.admin&&ui.tab==="people"?`${impButton("staff")}<button class="btn" data-act="personNew">Add one person</button><button class="btn primary" data-act="bulkOpen">Add people</button>`:""}${S.admin&&ui.tab==="teams"?`${impButton("teams")}<button class="btn primary" data-act="teamNew">Add team</button>`:""}</div></div>${ui.tab==="people"?impPanel("staff"):ui.tab==="teams"?impPanel("teams"):""}`:""}
    ${!S.admin?`<p class="hint">Only the platform administrator can add, move or edit people and teams.</p>`:""}${body}`;
}
function peopleTable(ui){
  const date=ui.asOf||todayD();
  const ppl=Object.values(S.staff).filter(p=>asgAt(p,date)||(!ui.team&&S.admin&&!(p.assignments||[]).length))
    .filter(p=>!ui.team||(asgAt(p,date)||{}).teamId===ui.team).filter(p=>!ui.q||norm([p.name,p.email,p.employeeId].join(" ")).includes(norm(ui.q))).sort((a,b)=>a.name.localeCompare(b.name));
  const teams=Object.values(S.teams).sort((a,b)=>a.name.localeCompare(b.name));
  return `<div class="row"><input type="search" class="grow" placeholder="Search name, email or employee ID" data-ui="staff.q" value="${esc(ui.q)}"><select data-ui="staff.team">${opts(teams.map(t=>({v:t.id,l:t.name})),ui.team,"All teams")}</select></div>
  ${ppl.length?`<div class="tbl"><table><thead><tr><th>Name</th><th>Employee ID</th><th>Designation</th><th>Team on ${esc(fmtD(date))}</th><th>Roles</th><th>Line manager</th><th>Email</th><th>Last updated</th></tr></thead><tbody>
  ${ppl.map(p=>{ const a=asgAt(p,date); return `<tr class="click" data-act="personOpen" data-id="${esc(p.id)}" tabindex="0"><td><b>${esc(p.name)}</b></td><td>${esc(p.employeeId)}</td><td>${esc(p.designation)}</td><td>${a?esc(teamName(a.teamId)):'<span class="muted">No team</span>'}</td><td>${esc((p.roles||[]).map(roleLabel).join(", "))}</td><td>${esc(personName(managerOf(p.id)))}</td><td>${esc(p.email)}</td><td>${stampCell(p.updatedAt||p.createdAt)}</td></tr>`; }).join("")}</tbody></table></div>`
  :`<div class="emptybox">${Object.keys(S.staff).length?"No one matches on this date.":"The staff list is empty."}${S.admin&&!Object.keys(S.staff).length?` Add teams first, then people. <button class="linkbtn" data-act="importQA">Import the 3 advisors from the QA directory</button>`:""}</div>`}`;
}
function teamsTable(ui){
  const date=ui.asOf||todayD(), teams=Object.values(S.teams).sort((a,b)=>(a.venture+a.name).localeCompare(b.venture+b.name));
  if(!teams.length) return `<div class="emptybox">No teams yet.${S.admin?" Add each LOB team with its line manager and the superior who gets copied.":""}</div>`;
  const noLm=teams.filter(t=>t.active!==false&&!t.lineManagerId), noQg=!teams.some(t=>t.kind==="qg"), qgLike=teams.filter(t=>t.kind!=="qg"&&/q\s*&\s*g|quality/i.test(t.name));
  return `${noLm.length?`<div class="callout amb"><b>${noLm.length} team${noLm.length>1?"s have":" has"} no line manager:</b> ${noLm.map(t=>esc(t.name)).join(", ")}. Cases can't be routed to ${noLm.length>1?"them":"it"} automatically until one is set. Open the team to choose, or use the button below.</div>`:""}
  ${noQg?`<div class="callout amb"><b>No team is marked as the Q&G team.</b> ${qgLike.length?`“${esc(qgLike[0].name)}” is set up as a business team. `:""}Q&G reminders and intake emails go to the members of the Q&G team, so mark it as kind “Q&G team”.${S.admin&&qgLike.length?` <button class="btn sm" data-act="teamMakeQg" data-id="${esc(qgLike[0].id)}">Mark “${esc(qgLike[0].name)}” as the Q&G team</button>`:""}</div>`:""}
  <div class="tbl"><table><thead><tr><th>Team</th><th>Venture and LOB</th><th>Kind</th><th>Line manager</th><th>Superior (copied)</th><th>Members on ${esc(fmtD(date))}</th><th>Last updated</th></tr></thead><tbody>
  ${teams.map(t=>`<tr class="click" data-act="teamOpen" data-id="${esc(t.id)}" tabindex="0"><td><b>${esc(t.name)}</b>${t.active===false?' <span class="tag">Inactive</span>':""}</td><td>${esc(ventureName(t.venture))} · ${esc(t.lob)}</td><td>${t.kind==="qg"?'<span class="tag qa">Q&G</span>':"Business"}</td><td>${t.lineManagerId?esc(personName(t.lineManagerId)):`<span class="tag red">Not set</span>${S.admin&&lmCandidates(t).length?lmCandidates(t).map(p=>` <button class="btn sm" data-act="teamSetLm" data-id="${esc(t.id)}" data-p="${esc(p.id)}">Make ${esc(p.name)} line manager</button>`).join(""):""}`}</td><td>${esc(personName(t.superiorId))}</td><td>${staffList(date).filter(p=>(asgAt(p,date)||{}).teamId===t.id).length}</td><td>${stampCell(t.updatedAt||t.createdAt)}</td></tr>`).join("")}</tbody></table></div>`;
}
const ventureName=id=>(S.cfg.ventures.find(v=>v.id===id)||{name:id||"—"}).name;
function personPanel(p){
  const k=p?"p-"+p.id:"p-new", ed=S.admin;
  const teams=Object.values(S.teams).filter(t=>t.active!==false).sort((a,b)=>a.name.localeCompare(b.name));
  const roles=dv(k,"roles",p?p.roles||[]:["advisor"]);
  const fields=`<div class="g3"><label class="f"><span class="req">Full name</span><input data-d="${k}" data-f="name" value="${esc(dv(k,"name",p&&p.name))}"${ed?"":" disabled"}></label>
    <label class="f"><span>Employee ID</span><input data-d="${k}" data-f="employeeId" value="${esc(dv(k,"employeeId",p&&p.employeeId))}"${ed?"":" disabled"}></label>
    <label class="f"><span>Work email</span><input type="email" data-d="${k}" data-f="email" value="${esc(dv(k,"email",p&&p.email))}"${ed?"":" disabled"}></label></div>
    <div class="g3"><label class="f"><span>Designation</span><input data-d="${k}" data-f="designation" value="${esc(dv(k,"designation",p&&p.designation))}"${ed?"":" disabled"}></label>
    <label class="f"><span>Line manager</span><select data-d="${k}" data-f="managerId"${ed?"":" disabled"}>${(()=>{ const tm=p?teamOf(p):S.teams[dv(k,"teamId","")]; return opts(staffList().filter(x=>!p||x.id!==p.id).map(x=>({v:x.id,l:x.name})),dv(k,"managerId",p&&p.managerId||""),tm&&tm.lineManagerId?"Team's line manager ("+personName(tm.lineManagerId)+")":"Choose"); })()}</select></label></div>
    ${(()=>{ const tm=S.teams[dv(k,"teamId",p?(asgAt(p)||{}).teamId:"")], roles=dv(k,"roles",p&&p.roles||[])||[]; return ed&&tm&&!tm.lineManagerId&&roles.some(r=>LM_ROLES.includes(r))?`<label class="radio"><input type="checkbox" data-d="${k}" data-f="makeTeamLm"${dv(k,"makeTeamLm",true)?" checked":""}> ${esc(tm.name)} has no line manager. Make this person its line manager.</label>`:""; })()}
    ${(()=>{ const d=dupOf({name:dv(k,"name",p&&p.name),email:dv(k,"email",p&&p.email),employeeId:dv(k,"employeeId",p&&p.employeeId)},p&&p.id); return d.length?`<div class="callout amb"><b>Possible duplicate.</b> ${d.map(x=>`${esc(x.why)}: <button class="linkbtn" data-act="personOpen" data-id="${esc(x.p.id)}">${esc(x.p.name)}</button> (${esc(teamName((asgAt(x.p)||{}).teamId))})`).join("; ")}. Check before saving so records stay linked to the right person.</div>`:""; })()}
    <fieldset class="f"><legend>Roles</legend><div class="row">${ROLES.map(([v,l])=>`<label class="radio"><input type="checkbox" data-d="${k}" data-f="roles" data-multi="${v}"${roles.includes(v)?" checked":""}${ed?"":" disabled"}> ${l}</label>`).join("")}</div></fieldset>
    <p class="hint">Q&G team members act on Q&G stages. Chief Q&G decides disputes. The work email is where the platform sends this person's notifications.</p>`;
  if(!p) return `<div class="crumbs"><button class="linkbtn" data-act="staffBack">Staff list</button> / New person</div><h2 class="h2">Add a person</h2><div class="form">${fields}
    <div class="g3"><label class="f"><span class="req">Team</span><select data-d="${k}" data-f="teamId">${opts(teams.map(t=>({v:t.id,l:t.name})),dv(k,"teamId",""),"Choose team")}</select></label>
    <label class="f"><span class="req">Start date in this team</span><input type="date" data-d="${k}" data-f="from" value="${esc(dv(k,"from",todayD()))}"></label></div>
    <div class="row"><button class="btn primary" data-act="personSave">Add person</button><button class="btn" data-act="staffBack">Cancel</button></div></div>`;
  const as=p.assignments||[], cur=asgAt(p);
  const hist=`<ol class="assign">${[...as].reverse().map(a=>`<li><b>${esc(teamName(a.teamId))}</b><span>${esc(fmtD(a.from))} to ${a.to?esc(fmtD(a.to)):"present"}</span></li>`).join("")}</ol>`;
  return `<div class="crumbs"><button class="linkbtn" data-act="staffBack">Staff list</button> / ${esc(p.name)}</div>
  <div class="stamps flat" style="margin-bottom:6px">Added ${stampCell(p.createdAt)}<span class="dot">·</span>Last updated ${stampCell(p.updatedAt||p.createdAt)}</div>
  <h2 class="h2">${esc(p.name)} ${cur?`<span class="tag cx">${esc(teamName(cur.teamId))}</span>`:'<span class="tag">Not in a team today</span>'}</h2>
  <div class="split"><div class="form">${fields}${ed?`<div class="row"><button class="btn primary" data-act="personSave" data-id="${esc(p.id)}">Save details</button></div>`:""}
  <h3 class="h3">Platform sign-in</h3>${signinBlock(p)}
  <h3 class="h3">Ventures this person can see</h3>${accessBlock(p)}${rawBlock(p)}</div>
  <div><h3 class="h3">Team history</h3>${hist}<p class="hint">Records made while someone was in a team keep that team. A move only changes records from its effective date.</p>
  ${ed?`<details class="inset" open><summary>Move to another team</summary><div class="form"><label class="f"><span class="req">New team</span><select data-d="${k}" data-f="moveTeam">${opts(teams.filter(t=>!cur||t.id!==cur.teamId).map(t=>({v:t.id,l:t.name})),dv(k,"moveTeam",""),"Choose team")}</select></label>
    <label class="f"><span class="req">Effective date</span><input type="date" data-d="${k}" data-f="moveFrom" value="${esc(dv(k,"moveFrom",todayD()))}"></label><button class="btn" data-act="personMove" data-id="${esc(p.id)}">Record the move</button></div></details>
    ${cur?`<details class="inset"><summary>Mark as leaver</summary><div class="form"><label class="f"><span class="req">Last working day</span><input type="date" data-d="${k}" data-f="leaveOn" value="${esc(dv(k,"leaveOn",todayD()))}"></label><button class="btn danger" data-act="personLeave" data-id="${esc(p.id)}">Record leaver</button></div></details>`:""}`:""}
  </div></div>`;
}
function signinBlock(p){
  if(p.userId) resolveNames([p.userId]);
  const lk=S.ui.link||(S.ui.link={q:"",res:[],for:null});
  const linked=p.userId?`<p>Linked to <b>${esc(NAMES[p.userId]||"a platform user")}</b>${p.userId===S.uid?" (you)":""}. Their queue and permissions follow this record.</p>`:`<p class="hint">Not linked yet. Until it is, this person can't action their stages on the platform.</p>`;
  if(!S.admin) return linked;
  return linked+`<div class="row"><input type="search" class="grow" placeholder="Search people in your organisation" data-ui="link.q" value="${esc(lk.for===p.id?lk.q:"")}"><button class="btn" data-act="linkSearch" data-id="${esc(p.id)}">Search</button>${p.userId?`<button class="btn" data-act="linkClear" data-id="${esc(p.id)}">Unlink</button>`:""}</div>
  ${lk.for===p.id&&lk.res.length?`<ul class="plain">${lk.res.map(h=>`<li class="row between"><span>${esc(h.name||"Unnamed")}</span><button class="btn sm" data-act="linkPick" data-id="${esc(p.id)}" data-uid="${esc(h.id)}">Link</button></li>`).join("")}</ul>`:lk.for===p.id&&lk.searched?`<p class="hint">No one found. They may need to open the platform once first.</p>`:""}`;
}
function accessBlock(p){
  const t=teamOf(p), def=t?(t.kind==="qg"?"every venture (Q&G team)":vInfo(t.venture).name+" (their team's venture)"):"none (not in a team)";
  const cur=p.ventureAccess||[], k="p-"+p.id, sel=dv(k,"ventureAccess",cur);
  if(!S.admin) return `<p>${cur.length?esc(cur.map(v=>vInfo(v).name).join(", ")):"By default: "+esc(def)}</p>`;
  return `<p class="hint">By default a person sees ${esc(def)}. Tick ventures to override it. The administrator always sees everything.</p>
   <div class="row">${ventures().map(v=>`<label class="radio"><input type="checkbox" data-d="${k}" data-f="ventureAccess" data-multi="${esc(v.id)}"${sel.includes(v.id)?" checked":""}> ${vChip(v.id)} ${esc(v.name)}</label>`).join("")}</div>
   <div class="row" style="margin-top:8px"><button class="btn" data-act="accessSave" data-id="${esc(p.id)}">Save venture access</button>${cur.length?`<button class="btn" data-act="accessReset" data-id="${esc(p.id)}">Use the default</button>`:""}</div>`;
}
function teamPanel(t){
  const k=t?"t-"+t.id:"t-new", ed=S.admin, ppl=staffList().map(p=>({v:p.id,l:p.name}));
  const form=`<div class="form"><div class="g3"><label class="f"><span class="req">Team name</span><input data-d="${k}" data-f="name" value="${esc(dv(k,"name",t&&t.name))}"${ed?"":" disabled"} placeholder="For example, Retail Motor"></label>
    <label class="f"><span class="req">Venture and LOB</span><select data-d="${k}" data-f="lob"${ed?"":" disabled"}>${opts(lobs(),dv(k,"lob",t?t.venture+"|"+t.lob:""),"Choose")}</select></label>
    <label class="f"><span>Kind</span><select data-d="${k}" data-f="kind"${ed?"":" disabled"}>${opts([{v:"business",l:"Business team"},{v:"qg",l:"Q&G team"}],dv(k,"kind",t?t.kind:"business"))}</select></label></div>
    <div class="g3"><label class="f"><span class="req">Line manager</span><select data-d="${k}" data-f="lineManagerId"${ed?"":" disabled"}>${opts(ppl,dv(k,"lineManagerId",t&&t.lineManagerId),"Choose")}</select></label>
    <label class="f"><span>Superior (copied on routing and escalations)</span><select data-d="${k}" data-f="superiorId"${ed?"":" disabled"}>${opts(ppl,dv(k,"superiorId",t&&t.superiorId),"Choose")}</select></label>
    <label class="f"><span>Status</span><select data-d="${k}" data-f="active"${ed?"":" disabled"}>${opts([{v:"yes",l:"Active"},{v:"no",l:"Inactive"}],dv(k,"active",t&&t.active===false?"no":"yes"))}</select></label></div>
    ${!ppl.length?`<p class="hint">Add people first if the line manager isn't listed yet; you can save the team and set its line manager after.</p>`:""}
    ${ed?`<div class="row"><button class="btn primary" data-act="teamSave"${t?` data-id="${esc(t.id)}"`:""}>${t?"Save team":"Add team"}</button><button class="btn" data-act="staffBack">Cancel</button></div>`:""}</div>`;
  if(!t) return `<div class="crumbs"><button class="linkbtn" data-act="staffBack">Staff list</button> / New team</div><h2 class="h2">Add a team</h2>${form}`;
  const date=(S.ui.staff||{}).asOf||todayD(), mem=staffList(date).filter(p=>(asgAt(p,date)||{}).teamId===t.id);
  const mv=moves(t.id,addDays(date,-120),addDays(date,90));
  return `<div class="crumbs"><button class="linkbtn" data-act="staffBack">Staff list</button> / ${esc(t.name)}</div><h2 class="h2">${esc(t.name)}</h2>${form}
   <h3 class="h3">Members on ${esc(fmtD(date))}</h3>${mem.length?`<ul class="plain">${mem.map(p=>`<li>${esc(p.name)} <span class="muted">${esc((p.roles||[]).map(roleLabel).join(", "))}</span></li>`).join("")}</ul>`:`<p class="muted">No members on this date.</p>`}
   ${mv.length?`<h3 class="h3">Moves in the last 120 days and upcoming</h3>${mv.map(m=>m.kind==="out"?`<div class="callout amb">${esc(m.p.name)} left this team after ${esc(fmtD(m.date))}${m.next?` and moved to ${esc(teamName(m.next))} from ${esc(fmtD(m.nextFrom))}`:" (leaver)"}. Earlier records stay under ${esc(t.name)}.</div>`:`<div class="callout">${esc(m.p.name)} ${m.date>date?"joins":"joined"} from ${esc(teamName(m.prev))} on ${esc(fmtD(m.date))}.</div>`).join("")}`:""}`;
}
function changeLog(){
  const rows=S.audit.filter(a=>["person","team"].includes(a.entity)).slice(0,300);
  if(!S.admin) return `<p class="muted">The change log is visible to the administrator.</p>`;
  return rows.length?`<div class="tbl"><table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Record</th><th>Detail</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${esc(fmtDT(a.at))}</td><td>${esc(a.byName)}</td><td>${esc(a.action)}</td><td>${esc(a.entity==="person"?personName(a.entityId):teamName(a.entityId))}</td><td class="wrap">${esc(a.note)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="emptybox">No changes recorded yet.</div>`;
}
async function staffAction(act,el){
  if(!S.admin&&!["personOpen","teamOpen","staffBack","staffTab"].includes(act)) return toast("Only the administrator can change the staff list.");
  if(act==="personOpen"&&S.sel.person==="__bulk"){ S.sel.person=el.dataset.id; return render(); }
  const id=el.dataset.id;
  if(act==="staffTab"){ S.ui.staff.tab=el.dataset.k; return render(); }
  if(act==="staffBack"){ S.sel.person=null; S.sel.team=null; return render(); }
  if(act==="personOpen"){ S.sel.person=id; return render(); }
  if(act==="accessSave"||act==="accessReset"){ const p=S.staff[id], k="p-"+id, v=act==="accessReset"?[]:(draft(k).ventureAccess??p.ventureAccess??[]);
    if(!await patch("mod/core/staff/"+id,{ventureAccess:v,updatedAt:nowMs()})) return;
    await addAudit("person",id,"Venture access",{ventureAccess:p.ventureAccess||[]},{ventureAccess:v},v.length?v.map(x=>vInfo(x).name).join(", "):"Default"); delete draft(k).ventureAccess; return toast("Saved."); }
  if(act==="linkSearch"){ const lk=S.ui.link; lk.for=id; lk.searched=true; try{ lk.res=USER&&USER.search?(await USER.search(lk.q||"")).slice(0,10):[]; }catch(_){ lk.res=[]; } return render(); }
  if(act==="linkPick"||act==="linkClear"){ const p=S.staff[id], u=act==="linkPick"?el.dataset.uid:null;
    if(u&&Object.values(S.staff).some(x=>x.id!==id&&x.userId===u)) return toast("That sign-in is already linked to someone else.");
    if(!await patch("mod/core/staff/"+id,{userId:u,updatedAt:nowMs()})) return;
    await addAudit("person",id,u?"Sign-in linked":"Sign-in unlinked",null,null,u?"Linked to "+(NAMES[u]||((S.ui.link.res.find(h=>h.id===u)||{}).name)||"user"):"");
    if(u){ NAMES[u]=(S.ui.link.res.find(h=>h.id===u)||{}).name||NAMES[u]; } S.ui.link={q:"",res:[],for:null}; return toast(u?"Linked.":"Unlinked."); }
  if(act==="teamOpen"){ S.sel.team=id; return render(); }
  if(act==="personNew"){ S.sel.person="__new"; return render(); }
  if(act==="teamSetLm"&&S.admin){ const t=S.teams[el.dataset.id]; if(await patch("mod/core/teams/"+t.id,{lineManagerId:el.dataset.p,updatedAt:nowMs()})){ await addAudit("team",t.id,"Line manager set",{lineManagerId:null},{lineManagerId:el.dataset.p},personName(el.dataset.p)); toast(personName(el.dataset.p)+" is now "+t.name+"'s line manager."); } return render(); }
  if(act==="teamMakeQg"&&S.admin){ const t=S.teams[el.dataset.id]; if(!confirm("Mark “"+t.name+"” as the Q&G team? Its members get Q&G access to every venture and receive Q&G intake and reminder emails.")) return; if(await patch("mod/core/teams/"+t.id,{kind:"qg",updatedAt:nowMs()})){ await addAudit("team",t.id,"Marked as the Q&G team",{kind:t.kind},{kind:"qg"},t.name); toast(t.name+" is now the Q&G team."); } return render(); }
  if(["bulkOpen","bulkAddRow","bulkDel","bulkSave"].includes(act)){ await bulkAction(act,el); return; }
  if(act==="dupNotSame"){ if(S.admin) await dupNotSame(el.dataset.ids); return; }
  if(act==="teamNew"){ S.sel.team="__new"; return render(); }
  if(act==="personSave"){
    const p=id?S.staff[id]:null, k=p?"p-"+p.id:"p-new", d=draft(k);
    const name=String(d.name??(p&&p.name)??"").trim(), email=String(d.email??(p&&p.email)??"").trim().toLowerCase();
    if(!name) return toast("Add the person's name.");
    if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("That email doesn't look right.");
    if(email&&Object.values(S.staff).some(x=>x.id!==(p&&p.id)&&norm(x.email)===email)) return toast("Someone else already has that email.");
    const base={name,email,employeeId:String(d.employeeId??(p&&p.employeeId)??"").trim(),designation:String(d.designation??(p&&p.designation)??"").trim(),roles:d.roles??(p&&p.roles)??["advisor"],managerId:d.managerId??(p&&p.managerId)??null,updatedAt:nowMs(),updatedBy:S.uid};
    if(!p&&dupOf(base).some(x=>x.hard)) return toast("Someone with that email or employee ID is already in the list. Open them instead.");
    if(!p){ d.from=d.from||todayD(); if(!d.teamId||!d.from) return toast("Choose a team and start date.");
      const np={id:rid("stf-"),...base,assignments:[{teamId:d.teamId,from:d.from,to:null}],createdAt:nowMs()};
      if(!await put("mod/core/staff/"+np.id,np)) return; await addAudit("person",np.id,"Added",null,np,"Added to "+teamName(d.teamId)+" from "+fmtD(d.from));
      await maybeSetTeamLm(d,np); delete S.drafts[k]; S.sel.person=np.id; syncAdvisor(np); render(); return toast(name+" added."); }
    const changed=Object.keys(base).filter(f=>!["updatedAt","updatedBy"].includes(f)&&JSON.stringify(base[f])!==JSON.stringify(p[f]));
    if(!changed.length) return toast("Nothing changed.");
    if(!await patch("mod/core/staff/"+p.id,base)) return;
    await addAudit("person",p.id,"Edited",Object.fromEntries(changed.map(f=>[f,p[f]])),Object.fromEntries(changed.map(f=>[f,base[f]])),changed.map(f=>f+": "+JSON.stringify(p[f]??"")+" → "+JSON.stringify(base[f])).join("; "));
    await maybeSetTeamLm(d,{...p,...base}); delete S.drafts[k]; syncAdvisor({...p,...base}); return toast("Saved.");
  }
  if(act==="personMove"||act==="personLeave"){
    const p=S.staff[id], k="p-"+p.id, d=draft(k); const as=clone(p.assignments||[]);
    if(act==="personMove"){
      const E=d.moveFrom||todayD(), T=d.moveTeam; if(!E||!T) return toast("Choose the new team and effective date.");
      const cur=as.find(a=>a.from<=E&&(!a.to||a.to>=E)), last=as[as.length-1];
      if(as.some(a=>a.from>E)) return toast("There's already a later move on record. Correct that first.");
      if(cur&&cur.from===E) cur.teamId=T; else { if(cur) cur.to=addDays(E,-1); as.push({teamId:T,from:E,to:null}); }
      if(!await patch("mod/core/staff/"+p.id,{assignments:as,updatedAt:nowMs()})) return;
      await addAudit("person",p.id,"Moved",{teamId:cur&&cur.teamId},{teamId:T},`${cur?teamName(cur.teamId):"No team"} → ${teamName(T)}, effective ${fmtD(E)}`);
      delete d.moveTeam; syncAdvisor({...p,assignments:as}); return toast(p.name+" moves to "+teamName(T)+" from "+fmtD(E)+".");
    }
    const L=d.leaveOn||todayD(); const cur=as.find(a=>a.from<=L&&(!a.to||a.to>=L)); if(!cur) return toast("They aren't in a team on that date.");
    cur.to=L; const after=as.filter(a=>a.from>L); if(after.length) return toast("There's a move after that date. Correct it first.");
    if(!await patch("mod/core/staff/"+p.id,{assignments:as,updatedAt:nowMs()})) return;
    await addAudit("person",p.id,"Leaver",null,{to:L},"Left "+teamName(cur.teamId)+"; last day "+fmtD(L));
    syncAdvisor({...p,assignments:as}); return toast("Recorded.");
  }
  if(act==="teamSave"){
    const t=id?S.teams[id]:null, k=t?"t-"+t.id:"t-new", d=draft(k);
    const name=String(d.name??(t&&t.name)??"").trim(), lobv=d.lob??(t?t.venture+"|"+t.lob:"");
    if(!name||!lobv) return toast("Add the team name and LOB.");
    const [venture,lob]=lobv.split("|");
    const doc={name,venture,lob,kind:d.kind??(t&&t.kind)??"business",lineManagerId:d.lineManagerId??(t&&t.lineManagerId)??null,superiorId:d.superiorId??(t&&t.superiorId)??null,active:(d.active??(t&&t.active===false?"no":"yes"))!=="no",updatedAt:nowMs()};
    if(!t){ const nt={id:rid("tm-"),...doc,createdAt:nowMs()}; if(!await put("mod/core/teams/"+nt.id,nt)) return; await addAudit("team",nt.id,"Added",null,nt,name); delete S.drafts[k]; S.sel.team=nt.id; render(); return toast("Team added."); }
    const changed=Object.keys(doc).filter(f=>f!=="updatedAt"&&JSON.stringify(doc[f])!==JSON.stringify(t[f]));
    if(!changed.length) return toast("Nothing changed.");
    if(!await patch("mod/core/teams/"+t.id,doc)) return;
    await addAudit("team",t.id,"Edited",null,null,changed.map(f=>f==="lineManagerId"||f==="superiorId"?f.replace("Id","")+": "+personName(t[f])+" → "+personName(doc[f]):f+": "+(t[f]??"")+" → "+doc[f]).join("; "));
    delete S.drafts[k]; staffList().filter(p=>(asgAt(p)||{}).teamId===t.id).forEach(p=>syncAdvisor(p,{...t,...doc})); return toast("Saved.");
  }
  if(act==="importQA"){
    try{ const s=await DB.collection("mod/qa/advisors").get(); const advs=s.docs.map(x=>x.data());
      for(const a of advs){
        let t=Object.values(S.teams).find(x=>norm(x.name)===norm(a.team||a.lob));
        if(!t){ t={id:rid("tm-"),name:a.team||a.lob,venture:a.ventureId||"insurancemarket",lob:a.lob||a.team,kind:"business",lineManagerId:null,superiorId:null,active:true,createdAt:nowMs()}; await put("mod/core/teams/"+t.id,t); S.teams[t.id]=t; await addAudit("team",t.id,"Added",null,t,"Imported from QA directory"); }
        const p={id:rid("stf-"),name:a.name,email:(a.email||"").toLowerCase(),employeeId:"",designation:"",roles:["advisor"],assignments:[{teamId:t.id,from:dateOf(a.createdAt||nowMs()),to:null}],createdAt:nowMs(),updatedAt:nowMs(),qaAdvisorId:a.id};
        await put("mod/core/staff/"+p.id,p); await addAudit("person",p.id,"Added",null,p,"Imported from QA directory");
      }
      toast(advs.length+" advisors imported. Set each team's line manager next.");
    }catch(e){ logError("sync","QA directory import failed",{op:"importQA"},e); toast("Import failed. It's in the error report."); }
  }
}
async function syncAdvisor(p,teamOverride){
  if(!(p.roles||[]).includes("advisor")) return;
  const a=asgAt(p), t=teamOverride||(a?S.teams[a.teamId]:null);
  const id=p.qaAdvisorId||p.id;
  const doc={id,staffId:p.id,name:p.name,email:p.email||"",lob:t?t.lob:"",team:t?t.name:"",ventureId:t?t.venture:"",manager:t?personName(t.lineManagerId):"",managerEmail:t?emailOf(t.lineManagerId):"",active:!!a,updatedAt:nowMs(),createdAt:p.createdAt||nowMs()};
  try{ await DB.doc("mod/qa/advisors/"+id).set(doc); }catch(e){ logError("sync","Couldn't update "+p.name+" in the QA advisor directory",{op:"syncAdvisor",staffId:p.id},e); }
}

/* ================= Structure and flow ================= */
function viewStructure(){
  const date=todayD();
  const byV=S.cfg.ventures.map(v=>({v,teams:Object.values(S.teams).filter(t=>t.venture===v.id&&t.active!==false)})).filter(x=>x.teams.length);
  const flow=[["Intake","Any source channel. Q&G registers or receives the case.","Q&G",S.cfg.sla.intake],["Q&G first review","Assess, record any Q&G call with the customer (same day), route to the LOB team.","Q&G",S.cfg.sla.intake],
    ["Line manager resolution","Up to three call attempts, resolution agreed, or a notification email after three failed attempts.","Line manager, copy superior",S.cfg.sla.lm],
    ["Q&G assessment","Assess the manager's call and findings, optionally validate with the customer, decide validity and consequence.","Q&G",S.cfg.sla.qgReview],
    ["External closure","Closed for the customer. Consequence relayed to the line manager.","Q&G",null],["Consequence","Line manager confirms it's actioned or disputes it.","Line manager",S.cfg.sla.consequence],
    ["Dispute","Chief Q&G upholds, amends or withdraws.","Chief Q&G",S.cfg.sla.dispute],["Internal closure","Case fully closed on the platform.","Q&G",null]];
  const cs=S.cases.filter(c=>inV(c.venture)), avgStage=n=>{ const v=cs.map(c=>stageTimes(c)[n]).filter(x=>x&&!isNaN(ts(x.start))&&!isNaN(ts(x.end))).map(x=>workHoursBetween(ts(x.start),ts(x.end),S.cfg)); return v.length?[v.reduce((a,b)=>a+b,0)/v.length,v.length]:null; };
  const map={"Q&G first review":2,"Line manager resolution":3,"Q&G assessment":4,"Consequence":5,"Dispute":6};
  const lastCase=lastOf(cs.map(c=>c.updatedAt||c.createdAt));
  return `<div class="stamps flat" style="margin-bottom:8px">As of ${stampCell(nowMs())} Dubai time<span class="dot">·</span>Based on ${cs.length} case${cs.length===1?"":"s"}${S.venture?" in "+esc(scopeLabel()):""}${!isNaN(lastCase)?`<span class="dot">·</span>Last case activity ${stampCell(lastCase)}`:""}</div>
  <h3 class="h3">Customer experience journey</h3><ol class="flow">${flow.map(([t,dsc,o,h])=>{ const a=map[t]?avgStage(map[t]):null; return `<li><b>${esc(t)}</b><span>${esc(dsc)}</span><small>${esc(o)}${h?` · due within ${h} working hours`:""}</small>${map[t]?`<small class="actual">${a?`Actual average ${esc(fmtTat(a[0]))} over ${a[1]} case${a[1]===1?"":"s"}${h?(a[0]>h?' <span class="tag red">Over SLA</span>':' <span class="tag ok">Within SLA</span>'):""}`:"No completed cases yet"}</small>`:""}</li>`; }).join("")}</ol>
  <p class="hint">Working hours: ${S.cfg.work.start} to ${S.cfg.work.end}, ${S.cfg.work.days.map(d=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(", ")}, Dubai time. Overdue stages get a reminder${" "}every ${S.cfg.reminderEveryHours} hours; line manager stages also copy the superior and Q&G as an escalation.</p>
  <h3 class="h3">Routing and escalation matrix</h3>
  ${Object.keys(S.teams).length?`<div class="tbl"><table><thead><tr><th>Venture</th><th>LOB</th><th>Team</th><th>Routed to</th><th>Copied and escalated to</th><th>Members today</th></tr></thead><tbody>
  ${byV.flatMap(({v,teams})=>teams.map(t=>`<tr><td>${esc(v.name)}</td><td>${esc(t.lob)}</td><td><b>${esc(t.name)}</b>${t.kind==="qg"?' <span class="tag qa">Q&G</span>':""}</td><td>${t.lineManagerId?esc(personName(t.lineManagerId)):'<span class="tag red">Not set</span>'}</td><td>${esc(personName(t.superiorId))}</td><td>${staffList(date).filter(p=>(asgAt(p,date)||{}).teamId===t.id).length}</td></tr>`)).join("")}</tbody></table></div>`:`<div class="emptybox">Teams appear here once they're added in Staff list.</div>`}`;
}

async function maybeSetTeamLm(d,person){
  const tm=S.teams[(asgAt(person)||{}).teamId]; if(!tm||tm.lineManagerId||!(d.makeTeamLm??true)) return;
  if(!(person.roles||[]).some(r=>LM_ROLES.includes(r))) return;
  if(await patch("mod/core/teams/"+tm.id,{lineManagerId:person.id,updatedAt:nowMs()})) await addAudit("team",tm.id,"Line manager set",{lineManagerId:null},{lineManagerId:person.id},person.name);
}
