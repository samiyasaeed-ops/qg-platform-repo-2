/* ================= Rewards & recognition: programmes per venture (IM Service Stars rules) ================= */
const RR_PHASES=[["live","Live"],["closed","Closed"],["validation","Q&G validation"],["appeals","Appeals window"],["final","Final"]];
const RR_CRIT=[["client","Client experience"],["internal","Internal support"],["volumes","Volumes managed"],["accuracy","Accuracy and turnaround"],["extra","Going the extra mile"]];
const ORD=n=>n+(["th","st","nd","rd"][((n%100)-20)%10]||["th","st","nd","rd"][n%100]||"th");
const rrProgs=()=>S.rrProgs.filter(p=>inV(p.venture)).sort((a,b)=>String(b.start).localeCompare(String(a.start)));
const rrEntries=pid=>S.rrEntries.filter(e=>e.programmeId===pid);
const rrBounds=p=>[localToMs(p.start,"00:00"),localToMs(p.end,"23:59")+60000];
const inCycle=(p,t)=>{ const [a,b]=rrBounds(p), x=ts(t); return x>=a&&x<b; };
const rrGroup=(p,id)=>(p.groups||[]).find(g=>g.id===id)||{name:"Unknown group",track:"advisor",winners:1};
const canNominate=()=>S.admin||isQG()||Object.values(S.teams).some(t=>meStaff()&&(t.lineManagerId===meStaff().id||t.superiorId===meStaff().id));
const UPHELD=["Valid","Partially valid"];

/* platform-derived facts for one person in a cycle */
function rrFacts(p,staffId){
  const person=S.staff[staffId]||{}, cases=S.cases.filter(c=>c.venture===p.venture&&inCycle(p,c.receivedAt||c.createdAt));
  const neg=cases.filter(c=>c.type==="Negative review"&&(c.staffId===staffId||(c.review||{}).consequenceStaffId===staffId));
  const cmp=cases.filter(c=>c.type!=="Negative review"&&!isCallback(c)&&(c.staffId===staffId||(c.review||{}).consequenceStaffId===staffId));
  const upheld=l=>l.filter(c=>isUpheld((c.review||{}).verdict));
  const pending=l=>l.filter(c=>!(c.review||{}).verdict&&c.status!=="closed");
  const openCons=[...S.recs.filter(r=>r.section==="breaches"&&r.staffId===staffId&&r.status!=="Closed"&&r.consequence&&r.consequence!=="None"),
    ...S.cases.filter(c=>["consequence","dispute"].includes(c.status)&&(c.review||{}).consequenceStaffId===staffId)];
  const rev=S.recs.filter(r=>r.section==="reviews"&&r.staffId===staffId&&["4","5"].includes(String(r.rating))&&r.date>=p.start&&r.date<=p.end);
  const verified=rev.filter(r=>r.verified==="yes");
  const qa=S.evals.filter(e=>(e.ventureId||"insurancemarket")===p.venture&&inCycle(p,e.interactionDate||e.createdAt)&&((person.email&&norm(e.advisorEmail)===norm(person.email))||norm(e.advisorName)===norm(person.name)));
  return {neg:upheld(neg),negPending:pending(neg),cmp:upheld(cmp),cmpPending:pending(cmp),cons:openCons,reviewsLogged:rev.length,reviewsVerified:verified.length,qaAvg:qa.length?Math.round(qa.reduce((s,e)=>s+Number(e.totalScore||0),0)/qa.length*10)/10:null,qaN:qa.length};
}
function rrClean(p,e){
  const f=rrFacts(p,e.staffId), o=e.cleanOverride||{};
  const fails=[];
  if(f.neg.length&&!o.neg) fails.push("review");
  if(f.cmp.length&&!o.cmp) fails.push("complaint");
  if((f.cons.length||e.openHR)&&!o.cons) fails.push("HR");
  return {ok:!fails.length,fails,f};
}
const val=(e,f,auto)=>e[f]===""||e[f]==null?auto:Number(e[f]);

/* standings for one group, following the programme rules */
function rrStandings(p,g){
  const list=rrEntries(p.id).filter(e=>e.groupId===g.id);
  const rows=list.map(e=>{ const c=rrClean(p,e), reviews=val(e,"reviews",c.f.reviewsVerified), qa=val(e,"qaScore",c.f.qaAvg);
    let why=null;
    if(e.disqualified) why="Disqualified (fair play)";
    else if(!c.ok) why="Not eligible ("+c.fails[0]+")";
    else if(g.track==="claims"&&Number(e.slaPct||0)<(g.minSla||90)) why="Not eligible: SLA";
    else if(g.track==="claims"&&Number(e.claimsManaged||0)<(g.minClaims||20)) why="Below minimum claims";
    else if(g.track!=="support"&&reviews<(g.minReviews||5)) why=`Below minimum (${reviews} of ${g.minReviews||5} verified reviews)`;
    return {e,c,reviews,qa,why,sales:Number(e.sales||0),claims:Number(e.claimsManaged||0),sla:Number(e.slaPct||0),rps:Number(e.sales||0)?reviews/Number(e.sales):0,conv:Number(e.claimsManaged||0)?reviews/Number(e.claimsManaged):0,total:RR_CRIT.reduce((s,[k])=>s+Number((e.scores||{})[k]||0),0)};
  });
  const el=rows.filter(r=>!r.why);
  if(g.track==="advisor"){ const mR=Math.max(0,...el.map(r=>r.reviews)), mP=Math.max(0,...el.map(r=>r.rps)); el.forEach(r=>r.score=Math.round(((mR?0.5*r.reviews/mR:0)+(mP?0.5*r.rps/mP:0))*100)/100); }
  const key=g.track==="advisor"?[r=>r.score,r=>r.rps,r=>r.reviews,r=>r.qa??-1]:g.track==="claims"?[r=>Math.round(r.conv*10000),r=>r.reviews,r=>r.sla,r=>r.claims]:[r=>r.total,r=>Number((r.e.scores||{}).client||0),r=>Number((r.e.scores||{}).volumes||0),r=>Number((r.e.scores||{}).accuracy||0)];
  const cmp=(a,b)=>{ for(let i=0;i<key.length;i++){ const d=key[i](b)-key[i](a); if(d) return {d,i}; } return {d:0,i:-1}; };
  el.sort((a,b)=>cmp(a,b).d);
  el.forEach((r,i)=>{
    if(i===0){ r.rank=1; return; }
    const c=cmp(el[i-1],r);
    if(c.i===-1){ r.rank=el[i-1].rank; r.joint=el[i-1].joint=true; }
    else { r.rank=i+1; if(c.i>0){ el[i-1].tieWin=true; r.tieLose=true; } }
  });
  return {el,inel:rows.filter(r=>r.why)};
}
function rrResult(p,g,r){
  const win=r.rank<=(g.winners||1)&&(g.track!=="support"||(r.e.panel!=="not_selected"));
  const fin=p.phase==="final";
  if(g.track==="support"&&fin) return r.e.panel==="selected"?`<b>${esc(g.name)} Support Star</b>`:`Rank ${r.rank}`;
  const tie=r.joint?" (joint)":r.tieWin?" (wins tie)":r.tieLose?" (loses tie)":"";
  if(win) return fin?`<b>Winner, ${ORD(r.rank)}${tie}</b>`:`<span class="tag amb">Provisional ${ORD(r.rank)}${tie}</span>`;
  return `Rank ${r.rank}${tie}`;
}

/* ---------------- views ---------------- */
function rrAddMenu(hasProg){
  const ui=S.ui.rr2||{}, me=meStaff();
  const items=[hasProg&&isQG()?["part","Advisor or claims participant","Add someone to a group with their sales, claims and reviews"]:null,hasProg&&canNominate()?["nom","Support nomination","Nominate a support colleague with evidence"]:null,
    isQG()?["appreciations","Appreciation","A compliment a customer gave about one of our people"]:null,isQG()?["reviews","Positive review","A 4–5★ Google or Trustpilot review naming someone"]:null,S.admin?["programme","Programme or new cycle","Start a new recognition programme or cycle"]:null].filter(Boolean);
  if(!items.length) return "";
  return `<div class="addwrap"><button class="btn primary" data-act="rrAdd" data-v="menu" aria-expanded="${!!ui.addMenu}">Add a record</button>${ui.addMenu?`<div class="addmenu" role="menu">${items.map(([v,l,d])=>`<button role="menuitem" data-act="rrAdd" data-v="${v}"><b>${esc(l)}</b><span>${esc(d)}</span></button>`).join("")}</div>`:""}</div>`;
}
function viewRR(){
  const ui=S.ui.rr2||(S.ui.rr2={tab:"standings",pid:""});
  const progs=rrProgs();
  if(!progs.length) return `<div class="row" style="justify-content:flex-end">${rrAddMenu(false)}</div><div class="emptybox">No recognition programme for ${esc(scopeLabel())} yet.${S.admin?` <button class="linkbtn" data-act="rrProgNew">Set one up</button>`:""}</div>${ui.newProg?rrProgForm():""}`;
  const p=progs.find(x=>x.id===ui.pid)||progs[0]; ui.pid=p.id;
  const tabs=[["standings","Standings"],["people","Advisors and claims"],["noms","Support nominations"],["clean","Clean record"],["appeals","Appeals"],["rules","Rules"]];
  const body=ui.tab==="people"?rrPeople(p):ui.tab==="noms"?rrNoms(p):ui.tab==="clean"?rrCleanView(p):ui.tab==="appeals"?rrAppeals(p):ui.tab==="rules"?rrRules(p):rrStandView(p);
  return `<div class="row between"><label class="inline">Programme <select data-ui="rr2.pid">${opts(progs.map(x=>({v:x.id,l:x.name+" · "+x.cycle+" · "+vInfo(x.venture).code+(x.pilot?" · soft launch":"")})),p.id)}</select></label>
   <div class="row">${rrAddMenu(true)}<button class="btn" data-act="rrExport" data-id="${esc(p.id)}">Download standings</button></div></div>
   ${ui.newProg?rrProgForm():""}
   ${rrHeader(p)}
   <div class="chips" style="margin:12px 0">${tabs.map(([k,l])=>`<button class="chip" data-act="rrTab2" data-v="${k}" aria-pressed="${ui.tab===k}">${l}</button>`).join("")}</div>${body}`;
}
function rrHeader(p){
  const ix=RR_PHASES.findIndex(x=>x[0]===p.phase), today=todayD(), afterEnd=today>p.end;
  const appealsClose=p.appealsOpenAt?addWorkHours(p.appealsOpenAt,(p.appealDays||5)*dayHours(),S.cfg):null;
  const dates=[["Starts",p.start],["Weekly standings from",p.standingsFrom],["Closes",p.end],["Support nominations due",p.nominationsDue]];
  return `<div class="rrhead">${vChip(p.venture)} <b>${esc(p.name)}</b> · ${esc(p.cycle)}${p.pilot?' <span class="tag amb">Soft launch</span>':""}
   <ol class="phases">${RR_PHASES.map(([k,l],i)=>`<li class="${i<ix?"done":i===ix?"cur":""}">${esc(l)}</li>`).join("")}</ol>
   <div class="stamps flat">${dates.filter(d=>d[1]).map(([l,d])=>`${esc(l)} <time>${esc(fmtD(d))}</time>`).join('<span class="dot">·</span>')}${appealsClose?`<span class="dot">·</span>Appeals close ${stampCell(appealsClose)}`:""}</div>
   <p class="hint" style="margin:4px 0 0">${p.phase==="final"?"Results are final. Winners are recognised at "+esc(p.awardsAt||"Sales & Service Connect")+".":"Nobody is shown as a winner until Q&G has validated the results and the appeals window has closed. Standings are provisional."}${afterEnd&&p.phase==="live"?" The competition period has ended; move it to Closed when the data is complete.":""}</p>
   ${isChief()&&p.phase!=="final"?`<div class="row" style="margin-top:6px">${rrPhaseBtn(p,appealsClose)}</div>`:""}
   ${p.deckAssetId?`<a class="linkbtn" href="/_blob/${esc(p.deckAssetId)}" target="_blank" rel="noopener">Open the programme deck</a>`:""}</div>`;
}
function rrPhaseBtn(p,appealsClose){
  if(p.phase==="live") return `<button class="btn" data-act="rrPhase" data-id="${esc(p.id)}" data-v="closed">Close the competition</button>`;
  if(p.phase==="closed") return `<button class="btn" data-act="rrPhase" data-id="${esc(p.id)}" data-v="validation">Start Q&G validation</button>`;
  if(p.phase==="validation"){ const nv=(p.groups||[]).filter(g=>!g.validatedAt&&rrEntries(p.id).some(e=>e.groupId===g.id)).length; return nv?`<span class="hint" style="margin:0">${nv} group${nv>1?"s":""} still to validate on Standings.</span>`:`<button class="btn primary" data-act="rrPhase" data-id="${esc(p.id)}" data-v="appeals">Share results and open the appeals window</button>`; }
  if(p.phase==="appeals"){ const open=rrEntries(p.id).flatMap(e=>(e.appeals||[]).filter(a=>!a.outcome)).length;
    if(appealsClose&&appealsClose>nowMs()) return `<span class="hint" style="margin:0">Appeals window open until ${esc(fmtDT(appealsClose))}.</span>`;
    return open?`<span class="hint" style="margin:0">${open} appeal${open>1?"s":""} still to decide.</span>`:`<button class="btn primary" data-act="rrPhase" data-id="${esc(p.id)}" data-v="final">Finalise winners</button>`; }
  return "";
}
function rrStandView(p){
  const grp=t=>(p.groups||[]).filter(g=>g.track===t);
  const table=g=>{ const s=rrStandings(p,g); const all=[...s.el,...s.inel];
    const head=g.track==="advisor"?"<th>Advisor</th><th class='n'>Sales</th><th class='n'>Verified reviews</th><th class='n'>Reviews per sale</th><th class='n'>Score</th>":g.track==="claims"?"<th>Handler</th><th class='n'>Claims managed</th><th class='n'>Verified reviews</th><th class='n'>Review conversion</th><th class='n'>SLA met</th>":"<th>Nominee</th><th>Team</th><th>Nominated by</th><th class='n'>Q&G score</th>";
    const cells=r=>g.track==="advisor"?`<td class="n">${r.sales}</td><td class="n">${r.reviews}</td><td class="n">${r.sales?(r.rps*100).toFixed(1)+"%":"–"}</td><td class="n">${r.score!=null&&!r.why?r.score.toFixed(2):"—"}</td>`:g.track==="claims"?`<td class="n">${r.claims}</td><td class="n">${r.reviews}</td><td class="n">${r.claims?(r.conv*100).toFixed(1)+"%":"–"}</td><td class="n">${r.sla}%</td>`:`<td>${esc(teamName(r.e.staffTeamId))}</td><td>${esc(personName((r.e.nomination||{}).by))}</td><td class="n">${r.total?r.total+"/25":'<span class="muted">Not scored</span>'}</td>`;
    return `<section class="sect"><div class="row between"><h3 class="h3">${esc(g.name)} <span class="muted">· ${g.winners||1} winner${(g.winners||1)>1?"s":""}${g.track!=="support"?" · min "+(g.minReviews||5)+" verified reviews":""}</span></h3>
      ${g.validatedAt?`<span class="tag ok">Validated by ${esc(g.validatedByName||"Q&G")} ${esc(fmtDT(g.validatedAt))}</span>`:p.phase==="validation"&&isQG()&&all.length?`<button class="btn sm primary" data-act="rrValidate" data-id="${esc(p.id)}" data-g="${esc(g.id)}">Validate ${esc(g.name)}</button>`:""}</div>
      ${all.length?`<div class="tbl"><table><thead><tr><th>Rank</th>${head}<th>Result</th></tr></thead><tbody>${all.map(r=>`<tr class="${r.why?"inel":r.rank<=(g.winners||1)?"win":""}"><td>${r.why?"":r.rank}</td><td><b>${esc(personName(r.e.staffId))}</b></td>${cells(r)}<td>${r.why?`<span class="tag red">${esc(r.why)}</span>`:rrResult(p,g,r)}${g.track==="support"&&isChief()&&["appeals","validation"].includes(p.phase)&&!r.why?` <select data-rrpanel="${esc(r.e.id)}">${opts([{v:"",l:"Panel decision"},{v:"selected",l:"Selected"},{v:"not_selected",l:"Not selected"}],r.e.panel||"")}</select>`:""}</td></tr>`).join("")}</tbody></table></div>`:`<p class="muted">No ${g.track==="support"?"nominations":"participants"} yet.</p>`}</section>`; };
  return `<h2 class="h3">Advisors</h2><p class="hint">Half on how many verified reviews, half on reviews per sale, each compared with the best eligible colleague in the same team. Ties: more reviews per sale, then more reviews, then QA score, then joint award.</p>${grp("advisor").map(table).join("")}
   <h2 class="h3">Claims</h2><p class="hint">At least ${(grp("claims")[0]||{}).minSla||90}% within SLA and ${(grp("claims")[0]||{}).minClaims||20} claims managed. Ranked on verified reviews ÷ claims managed. Ties: more verified reviews, higher SLA, more claims, then joint award.</p>${grp("claims").map(table).join("")}
   <h2 class="h3">Support teams</h2><p class="hint">Line manager nominations, pre-scored by Q&G out of 25; the panel (${esc(p.panel||"CEO and Chief Quality & Governance Officer")}) makes the final choice. Ties: client experience, then volumes, then accuracy.</p>${grp("support").filter(g=>rrEntries(p.id).some(e=>e.groupId===g.id)).map(table).join("")||`<p class="muted">No nominations yet.</p>`}`;
}
function rrPeople(p){
  const ui=S.ui.rr2, k="rrp-"+(ui.editE||"new"), e=ui.editE?S.rrEntries.find(x=>x.id===ui.editE):null, locked=p.phase==="final"&&!S.admin;
  const groups=(p.groups||[]).filter(g=>g.track!=="support"), gsel=dv(k,"groupId",e?e.groupId:""), g=groups.find(x=>x.id===gsel);
  const staff=staffFor(p.venture).map(x=>({v:x.id,l:x.name+" ("+teamName((asgAt(x)||{}).teamId)+")"}));
  const sid=dv(k,"staffId",e?e.staffId:""), facts=sid?rrFacts(p,sid):null;
  const form=isQG()&&!locked?`<div class="form inset"><b>${e?"Edit participant":"Add a participant"}</b>
    <div class="g3"><label class="f"><span class="req">Group</span><select data-d="${k}" data-f="groupId">${opts(groups.map(x=>({v:x.id,l:x.name})),gsel,"Choose")}</select></label>
     <label class="f"><span class="req">Person</span><select data-d="${k}" data-f="staffId">${opts(staff,sid,"Choose")}</select></label>
     ${g&&g.track==="claims"?`<label class="f"><span>Claims managed</span><input type="number" min="0" data-d="${k}" data-f="claimsManaged" value="${esc(dv(k,"claimsManaged",e?e.claimsManaged:""))}"></label>`:`<label class="f"><span>Sales in the cycle</span><input type="number" min="0" data-d="${k}" data-f="sales" value="${esc(dv(k,"sales",e?e.sales:""))}"></label>`}</div>
    <div class="g3">${g&&g.track==="claims"?`<label class="f"><span>Claims within SLA (%)</span><input type="number" min="0" max="100" step="0.1" data-d="${k}" data-f="slaPct" value="${esc(dv(k,"slaPct",e?e.slaPct:""))}"></label>`:""}
     <label class="f"><span>Verified 4–5★ reviews</span><input type="number" min="0" data-d="${k}" data-f="reviews" value="${esc(dv(k,"reviews",e?e.reviews:""))}" placeholder="${facts?facts.reviewsVerified+" on the platform":""}"></label>
     ${g&&g.track==="advisor"?`<label class="f"><span>QA score (tie-break)</span><input type="number" min="0" max="100" data-d="${k}" data-f="qaScore" value="${esc(dv(k,"qaScore",e?e.qaScore:""))}" placeholder="${facts&&facts.qaAvg!=null?facts.qaAvg+"% from "+facts.qaN+" evaluations":""}"></label>`:""}</div>
    ${facts?`<p class="hint">On the platform for this cycle: ${facts.reviewsVerified} verified and ${facts.reviewsLogged} logged 4–5★ reviews naming them${facts.qaAvg!=null?", QA average "+facts.qaAvg+"%":""}. Leave a box empty to use the platform figure.</p>`:""}
    <div class="row"><button class="btn primary" data-act="rrSaveE" data-id="${esc(p.id)}">${e?"Save":"Add participant"}</button>${e?`<button class="btn" data-act="rrCancelE">Cancel</button>`:""}<label class="btn" style="margin-left:auto">Upload figures (Excel or CSV)<input type="file" hidden accept=".xlsx,.xls,.csv" data-rrfile="${esc(p.id)}"></label></div>
    <p class="hint">Upload columns: Name, Group, Sales, Claims managed, SLA %, Verified reviews, QA score. Existing participants are updated, which suits the weekly standings.</p></div>`:"";
  const list=rrEntries(p.id).filter(x=>x.track!=="support").sort((a,b)=>rrGroup(p,a.groupId).name.localeCompare(rrGroup(p,b.groupId).name)||personName(a.staffId).localeCompare(personName(b.staffId)));
  return form+(list.length?`<div class="tbl"><table><thead><tr><th>Group</th><th>Person</th><th class="n">Sales</th><th class="n">Claims</th><th class="n">SLA</th><th class="n">Verified reviews</th><th>Clean record</th><th>Last updated</th><th></th></tr></thead><tbody>${list.map(x=>{ const c=rrClean(p,x); return `<tr><td>${esc(rrGroup(p,x.groupId).name)}</td><td><b>${esc(personName(x.staffId))}</b></td><td class="n">${x.sales||"–"}</td><td class="n">${x.claimsManaged||"–"}</td><td class="n">${x.slaPct!==""&&x.slaPct!=null?x.slaPct+"%":"–"}</td><td class="n">${val(x,"reviews",c.f.reviewsVerified)}${x.reviews===""||x.reviews==null?' <span class="muted">(platform)</span>':""}</td><td>${x.disqualified?'<span class="tag red">Disqualified</span>':c.ok?'<span class="tag ok">Clean</span>':`<span class="tag red">${esc(c.fails.join(", "))}</span>`}</td><td>${stampCell(x.updatedAt)}</td><td>${isQG()&&!locked?`<button class="btn sm" data-act="rrEditE" data-id="${esc(x.id)}">Edit</button>`:""}</td></tr>`; }).join("")}</tbody></table></div>`:`<div class="emptybox">No advisors or claims handlers added yet.</div>`);
}
function rrNoms(p){
  const ui=S.ui.rr2, k="rrn-"+(ui.editN||"new"), e=ui.editN?S.rrEntries.find(x=>x.id===ui.editN):null;
  const groups=(p.groups||[]).filter(g=>g.track==="support"), me=meStaff(), afterDue=p.nominationsDue&&todayD()>p.nominationsDue;
  const staff=staffFor(p.venture).filter(x=>!me||x.id!==me.id).map(x=>({v:x.id,l:x.name+" ("+teamName((asgAt(x)||{}).teamId)+")"}));
  const n=(e&&e.nomination)||{}, ev=n.evidence||{};
  const form=canNominate()&&p.phase!=="final"&&(!e||isQG()||(e.nomination||{}).by===(me&&me.id))?`<div class="form inset"><b>${e?"Edit nomination":"Nominate a colleague"}</b>${afterDue&&!e?`<div class="callout amb">Nominations were due by ${esc(fmtD(p.nominationsDue))}. Late nominations are marked late.</div>`:""}
    <div class="g2"><label class="f"><span class="req">Support function</span><select data-d="${k}" data-f="groupId">${opts(groups.map(x=>({v:x.id,l:x.name})),dv(k,"groupId",e?e.groupId:""),"Choose")}</select></label>
     <label class="f"><span class="req">Nominee</span><select data-d="${k}" data-f="staffId"${e?" disabled":""}>${opts(staff,dv(k,"staffId",e?e.staffId:""),"Choose")}</select></label></div>
    ${RR_CRIT.map(([c,l])=>`<label class="f"><span>${esc(l)}: evidence${c==="volumes"?" (for example, 1,200 refunds processed)":c==="accuracy"?" (for example, 99.5%, zero rework)":""}</span><textarea rows="2" data-d="${k}" data-f="ev_${c}">${esc(dv(k,"ev_"+c,ev[c]||""))}</textarea></label>`).join("")}
    <label class="radio"><input type="checkbox" data-d="${k}" data-f="noConflict"${dv(k,"noConflict",n.conflict==="none")?" checked":""}> I have no conflict of interest with this nominee, or I've declared it below</label>
    <label class="f"><span>Conflict of interest (if any)</span><input data-d="${k}" data-f="conflictNote" value="${esc(dv(k,"conflictNote",n.conflictNote||""))}"></label>
    <div class="row"><button class="btn primary" data-act="rrSaveN" data-id="${esc(p.id)}">${e?"Save nomination":"Submit nomination"}</button>${e?`<button class="btn" data-act="rrCancelN">Cancel</button>`:""}</div>
    <p class="hint">Nominate on this month's evidence, not seniority or popularity. No self-nominations. Up to ${groups[0]?groups[0].maxNominations||2:2} nominations per team.</p></div>`:"";
  const list=rrEntries(p.id).filter(x=>x.track==="support");
  const scoreForm=x=>isQG()&&["live","closed","validation"].includes(p.phase)?`<div class="row scorer">${RR_CRIT.map(([c,l])=>`<label class="inline">${esc(l.split(" ")[0])} <select data-rrscore="${esc(x.id)}" data-c="${c}">${opts([1,2,3,4,5].map(v=>({v,l:String(v)})),String((x.scores||{})[c]||""),"–")}</select></label>`).join("")}</div>`:"";
  return form+(list.length?list.map(x=>{ const nn=x.nomination||{}, c=rrClean(p,x), tot=RR_CRIT.reduce((s,[k])=>s+Number((x.scores||{})[k]||0),0);
    return `<div class="nomcard"><div class="row between"><span><b>${esc(personName(x.staffId))}</b> · ${esc(rrGroup(p,x.groupId).name)} · ${esc(teamName(x.staffTeamId))}</span><span>${tot?`<b>${tot}/25</b>`:'<span class="muted">Not scored</span>'} ${c.ok?'<span class="tag ok">Clean record</span>':`<span class="tag red">Not eligible (${esc(c.fails.join(", "))})</span>`}${nn.late?' <span class="tag amb">Late</span>':""}</span></div>
      <dl class="kv">${RR_CRIT.map(([k,l])=>(nn.evidence||{})[k]?`<dt>${esc(l)}</dt><dd>${esc(nn.evidence[k])}</dd>`:"").join("")}</dl>
      <p class="hint">Nominated by ${esc(personName(nn.by))} on ${esc(fmtDT(nn.at))}${nn.conflictNote?" · conflict declared: "+esc(nn.conflictNote):""}</p>${scoreForm(x)}
      ${(isQG()||(me&&nn.by===me.id))&&p.phase!=="final"?`<button class="btn sm" data-act="rrEditN" data-id="${esc(x.id)}">Edit</button>`:""}</div>`; }).join(""):`<div class="emptybox">No nominations yet.</div>`);
}
function rrCleanView(p){
  const list=rrEntries(p.id);
  return `<p class="lead">Everyone needs a clean record for the cycle: no negative review, no valid complaint and no open consequence. These are checked from the platform's own records. A complaint or review Q&G found invalid doesn't count, and Q&G can record an override with a reason.</p>
  ${list.length?`<div class="tbl"><table><thead><tr><th>Person</th><th>Group</th><th>Negative reviews</th><th>Valid complaints</th><th>Open consequence</th><th>Result</th><th></th></tr></thead><tbody>${list.map(x=>{ const c=rrClean(p,x), f=c.f, o=x.cleanOverride||{};
    const cell=(l,pend,key)=>`${l.length?`<span class="tag ${o[key]?"":"red"}">${l.length}</span> ${l.map(cs=>`<button class="linkbtn" data-act="cxOpenOther" data-ref="${esc(cs.ref||"")}">${esc(cs.ref||cs.id)}</button>`).join(" ")}${o[key]?' <span class="muted">overridden</span>':""}`:"0"}${pend&&pend.length?` <span class="tag amb">${pend.length} awaiting Q&G</span>`:""}`;
    return `<tr><td><b>${esc(personName(x.staffId))}</b></td><td>${esc(rrGroup(p,x.groupId).name)}</td><td>${cell(f.neg,f.negPending,"neg")}</td><td>${cell(f.cmp,f.cmpPending,"cmp")}</td><td>${f.cons.length||x.openHR?`<span class="tag ${o.cons?"":"red"}">${f.cons.length+(x.openHR?1:0)}</span>${x.openHR?' <span class="muted">HR action recorded</span>':""}${o.cons?' <span class="muted">overridden</span>':""}`:"0"}</td>
      <td>${x.disqualified?`<span class="tag red">Disqualified: ${esc(x.disqualified.reason)}</span>`:c.ok?'<span class="tag ok">Clean</span>':'<span class="tag red">Sits out this cycle</span>'}</td>
      <td>${isQG()&&p.phase!=="final"?`<details><summary class="linkbtn">Q&G action</summary><div class="form inset" style="min-width:280px">
       <label class="radio"><input type="checkbox" data-d="rrc-${esc(x.id)}" data-f="openHR"${dv("rrc-"+x.id,"openHR",!!x.openHR)?" checked":""}> Open HR or business action not on the platform</label>
       ${["neg","cmp","cons"].map(kk=>`<label class="radio"><input type="checkbox" data-d="rrc-${esc(x.id)}" data-f="ov_${kk}"${dv("rrc-"+x.id,"ov_"+kk,!!o[kk])?" checked":""}> Q&G override: ${kk==="neg"?"negative review found invalid":kk==="cmp"?"complaint found invalid":"consequence no longer open"}</label>`).join("")}
       <label class="f"><span>Reason</span><input data-d="rrc-${esc(x.id)}" data-f="reason" value="${esc(dv("rrc-"+x.id,"reason",o.reason||""))}"></label>
       <button class="btn sm" data-act="rrCleanSave" data-id="${esc(x.id)}">Save</button>
       <hr><label class="f"><span>Fair play breach: reason</span><input data-d="rrc-${esc(x.id)}" data-f="dq" value="${esc(dv("rrc-"+x.id,"dq",(x.disqualified||{}).reason||""))}"></label>
       <div class="row"><button class="btn sm danger" data-act="rrDisq" data-id="${esc(x.id)}">${x.disqualified?"Update":"Remove from the competition"}</button>${x.disqualified?`<button class="btn sm" data-act="rrReinstate" data-id="${esc(x.id)}">Reinstate</button>`:""}</div></div></details>`:""}</td></tr>`; }).join("")}</tbody></table></div>`:`<div class="emptybox">No participants yet.</div>`}`;
}
function rrAppeals(p){
  const list=rrEntries(p.id), appeals=list.flatMap(x=>(x.appeals||[]).map((a,i)=>({x,a,i})));
  const appealsClose=p.appealsOpenAt?addWorkHours(p.appealsOpenAt,(p.appealDays||5)*dayHours(),S.cfg):null, k="rra-new";
  return `<p class="lead">Queries go to the team lead within ${p.appealDays||5} working days of results. Q&G records each appeal here and decides it before winners are finalised.</p>
  ${isQG()&&["appeals","validation"].includes(p.phase)?`<div class="form inset"><div class="g2"><label class="f"><span class="req">Participant</span><select data-d="${k}" data-f="entryId">${opts(list.map(x=>({v:x.id,l:personName(x.staffId)+" · "+rrGroup(p,x.groupId).name})),dv(k,"entryId",""),"Choose")}</select></label>
   <label class="f"><span class="req">Date received</span><input type="date" data-d="${k}" data-f="received" value="${esc(dv(k,"received",todayD()))}" max="${todayD()}"></label></div>
   <label class="f"><span class="req">What they're appealing</span><textarea rows="2" data-d="${k}" data-f="text">${esc(dv(k,"text",""))}</textarea></label>
   <button class="btn primary" data-act="rrAppealAdd" data-id="${esc(p.id)}">Record appeal</button>${appealsClose?`<p class="hint">Appeals window closes ${esc(fmtDT(appealsClose))}.</p>`:""}</div>`:p.phase==="live"||p.phase==="closed"?`<p class="hint">The appeals window opens when Q&G shares validated results.</p>`:""}
  ${appeals.length?`<div class="tbl"><table><thead><tr><th>Participant</th><th>Received</th><th>Appeal</th><th>Outcome</th></tr></thead><tbody>${appeals.map(({x,a,i})=>`<tr><td><b>${esc(personName(x.staffId))}</b><br><span class="muted">${esc(rrGroup(p,x.groupId).name)}</span></td><td>${esc(fmtD(a.received))}${a.late?' <span class="tag amb">Late</span>':""}</td><td class="wrap">${esc(a.text)}</td>
    <td>${a.outcome?`<span class="tag ${a.outcome==="Upheld"?"ok":""}">${esc(a.outcome)}</span> ${esc(a.notes||"")}<br><small class="muted">${esc(a.byName||"")}, ${esc(fmtDT(a.decidedAt))}</small>`:isQG()?`<select data-d="rrd-${esc(x.id)}-${i}" data-f="outcome">${opts(["Upheld","Rejected"],dv(`rrd-${x.id}-${i}`,"outcome",""),"Decide")}</select> <input data-d="rrd-${esc(x.id)}-${i}" data-f="notes" placeholder="Reason" value="${esc(dv(`rrd-${x.id}-${i}`,"notes",""))}"> <button class="btn sm" data-act="rrAppealDecide" data-id="${esc(x.id)}" data-i="${i}">Save</button>`:'<span class="muted">Awaiting decision</span>'}</td></tr>`).join("")}</tbody></table></div>`:`<div class="emptybox">No appeals recorded.</div>`}`;
}
function rrRules(p){
  return `<article class="prose">${mdLite(p.rules||"")}</article>${p.deckAssetId?`<p><a class="btn" href="/_blob/${esc(p.deckAssetId)}" target="_blank" rel="noopener">Open the programme deck</a></p>`:""}`;
}
function rrProgForm(){
  const k="rrprog", srcs=[...S.rrProgs].sort((a,b)=>String(b.start).localeCompare(String(a.start))), tpl=srcs[0];
  return `<div class="form inset"><b>New recognition programme or cycle</b><p class="hint">Copies the tracks, groups, minimums and rules of the programme you choose, so lessons from earlier cycles carry forward. Earlier cycles stay as they are.</p>
   <label class="f"><span>Copy from</span><select data-d="${k}" data-f="copyFrom">${opts(srcs.map(x=>({v:x.id,l:x.name+" · "+x.cycle+" · "+vInfo(x.venture).code})),dv(k,"copyFrom",tpl?tpl.id:""),"Start with the standard three tracks")}</select></label>
   <div class="g3"><label class="f"><span class="req">Venture</span><select data-d="${k}" data-f="venture">${opts(ventures().map(v=>({v:v.id,l:v.name})),dv(k,"venture",S.venture||""),"Choose")}</select></label>
    <label class="f"><span class="req">Programme name</span><input data-d="${k}" data-f="name" value="${esc(dv(k,"name",""))}" placeholder="For example, HM Service Stars"></label>
    <label class="f"><span class="req">Cycle</span><input data-d="${k}" data-f="cycle" value="${esc(dv(k,"cycle",""))}" placeholder="For example, November 2026"></label></div>
   <div class="g4"><label class="f"><span class="req">Starts</span><input type="date" data-d="${k}" data-f="start" value="${esc(dv(k,"start",""))}"></label><label class="f"><span class="req">Closes</span><input type="date" data-d="${k}" data-f="end" value="${esc(dv(k,"end",""))}"></label>
    <label class="f"><span>Weekly standings from</span><input type="date" data-d="${k}" data-f="standingsFrom" value="${esc(dv(k,"standingsFrom",""))}"></label><label class="f"><span>Support nominations due</span><input type="date" data-d="${k}" data-f="nominationsDue" value="${esc(dv(k,"nominationsDue",""))}"></label></div>
   <label class="radio"><input type="checkbox" data-d="${k}" data-f="pilot"${dv(k,"pilot",false)?" checked":""}> This cycle is a soft launch or pilot</label>
   <div class="row"><button class="btn primary" data-act="rrProgSave">Create programme</button><button class="btn" data-act="rrProgNew">Cancel</button></div>${tpl?"":`<p class="hint">No template found; the programme starts with the standard three tracks.</p>`}</div>`;
}

/* ---------------- actions ---------------- */
async function rrAction(act,el){
  const ui=S.ui.rr2||(S.ui.rr2={tab:"standings"}), p=S.rrProgs.find(x=>x.id===(el.dataset.id||ui.pid))||S.rrProgs.find(x=>x.id===ui.pid);
  const hist=(e,note)=>[...((e&&e.history)||[]),{at:nowMs(),byName:S.meName,note}];
  if(act==="rrTab2"){ ui.tab=el.dataset.v; ui.editE=null; ui.editN=null; return; }
  if(act==="rrProgNew"){ ui.newProg=!ui.newProg; return; }
  if(act==="rrEditE"){ ui.editE=el.dataset.id; return; } if(act==="rrCancelE"){ ui.editE=null; delete S.drafts["rrp-"+el.dataset.id]; return; }
  if(act==="rrEditN"){ ui.editN=el.dataset.id; return; } if(act==="rrCancelN"){ ui.editN=null; return; }
  if(act==="rrExport") return rrExport(p);
  if(act==="rrProgSave"){ if(!S.admin) return; const d=draft("rrprog"); if(!d.venture||!d.name||!d.cycle||!d.start||!d.end) return toast("Add the venture, name, cycle and dates."); if(d.end<d.start) return toast("The close date is before the start.");
    const tpl=S.rrProgs.find(x=>x.id===d.copyFrom)||(d.copyFrom===""?{}:[...S.rrProgs].sort((a,b)=>String(b.start).localeCompare(String(a.start)))[0])||{};
    const doc={id:rid("rrp-"),venture:d.venture,name:d.name.trim(),cycle:d.cycle.trim(),start:d.start,end:d.end,standingsFrom:d.standingsFrom||"",nominationsDue:d.nominationsDue||"",appealDays:tpl.appealDays||5,panel:tpl.panel||"",awardsAt:tpl.awardsAt||"",phase:"live",pilot:!!d.pilot,copiedFrom:tpl.id||null,groups:(tpl.groups&&tpl.groups.length?tpl.groups:[{id:"adv-general",track:"advisor",name:"Advisors",winners:1,minReviews:5},{id:"clm-general",track:"claims",name:"Claims",winners:1,minReviews:5,minClaims:20,minSla:90},{id:"sup-general",track:"support",name:"Support functions",winners:1,maxNominations:2}]).map(g=>({...g,validatedAt:null,validatedByName:null})),rules:tpl.rules||"",createdAt:nowMs(),history:[{at:nowMs(),byName:S.meName,note:"Programme created"+(tpl.id?" from "+tpl.name+" · "+tpl.cycle:"")}]};
    if(await put("mod/rr/programmes/"+doc.id,doc)){ delete S.drafts.rrprog; ui.newProg=false; ui.pid=doc.id; toast("Programme created."); } return; }
  if(!p) return;
  if(act==="rrPhase"){ if(!isChief()) return; const v=el.dataset.v, lbl=(RR_PHASES.find(x=>x[0]===v)||[])[1];
    if(!confirm(`Move ${p.name} to “${lbl}”?`)) return;
    const part={phase:v,history:hist(p,"Phase: "+lbl),[v+"At"]:nowMs()}; if(v==="appeals") part.appealsOpenAt=nowMs();
    if(v==="final"){ for(const g of p.groups||[]){ const s=rrStandings(p,g); for(const r of s.el){ const win=r.rank<=(g.winners||1)&&(g.track!=="support"||r.e.panel==="selected"); await patch("mod/rr/entries/"+r.e.id,{finalResult:win?(g.track==="support"?"Support Star":"Winner, "+ORD(r.rank)):"Rank "+r.rank,finalRank:r.rank,updatedAt:nowMs()}); } for(const r of s.inel) await patch("mod/rr/entries/"+r.e.id,{finalResult:r.why,updatedAt:nowMs()}); } }
    if(await patch("mod/rr/programmes/"+p.id,part)){ await addAudit("rr",p.id,"Phase "+lbl,null,null,p.name); toast(p.name+" is now in “"+lbl+"”."); } return; }
  if(act==="rrValidate"){ if(!isQG()) return; const groups=(p.groups||[]).map(g=>g.id===el.dataset.g?{...g,validatedAt:nowMs(),validatedByName:S.meName}:g);
    if(await patch("mod/rr/programmes/"+p.id,{groups,history:hist(p,"Validated "+rrGroup(p,el.dataset.g).name)})) toast("Validated."); return; }
  if(act==="rrSaveE"){ if(!isQG()) return; const k="rrp-"+(ui.editE||"new"), d=draft(k), e=ui.editE?S.rrEntries.find(x=>x.id===ui.editE):null;
    const gid=d.groupId??(e&&e.groupId), sid=d.staffId??(e&&e.staffId); if(!gid||!sid) return toast("Choose the group and the person.");
    if(!e&&rrEntries(p.id).some(x=>x.groupId===gid&&x.staffId===sid)) return toast("That person is already in this group.");
    const g=rrGroup(p,gid), numf=f=>{ const v=d[f]??(e?e[f]:""); return v===""||v==null?"":Number(v); };
    const doc={...(e||{}),id:e?e.id:rid("rre-"),programmeId:p.id,venture:p.venture,groupId:gid,track:g.track,staffId:sid,staffTeamId:(asgAt(S.staff[sid],p.end<todayD()?p.end:todayD())||{}).teamId||null,sales:numf("sales"),claimsManaged:numf("claimsManaged"),slaPct:numf("slaPct"),reviews:numf("reviews"),qaScore:numf("qaScore"),updatedAt:nowMs(),createdAt:e?e.createdAt:nowMs(),history:hist(e,e?"Figures updated":"Added")};
    if(await put("mod/rr/entries/"+doc.id,doc)){ delete S.drafts[k]; ui.editE=null; toast("Saved."); } return; }
  if(act==="rrSaveN"){ if(!canNominate()) return toast("Only line managers and Q&G can nominate."); const k="rrn-"+(ui.editN||"new"), d=draft(k), e=ui.editN?S.rrEntries.find(x=>x.id===ui.editN):null, me=meStaff();
    const gid=d.groupId??(e&&e.groupId), sid=e?e.staffId:d.staffId; if(!gid||!sid) return toast("Choose the support function and the nominee.");
    if(me&&sid===me.id) return toast("Self-nominations aren't allowed.");
    const evd={}; RR_CRIT.forEach(([c])=>evd[c]=String(d["ev_"+c]??((e&&e.nomination&&e.nomination.evidence)||{})[c]??"").trim());
    if(!Object.values(evd).some(Boolean)) return toast("Add the evidence for the nomination.");
    if(!(d.noConflict??(e&&e.nomination&&e.nomination.conflict==="none"))&&!String(d.conflictNote||"").trim()) return toast("Confirm there's no conflict of interest, or declare it.");
    const team=(asgAt(S.staff[sid])||{}).teamId||null, maxN=rrGroup(p,gid).maxNominations||2;
    if(!e&&team&&rrEntries(p.id).filter(x=>x.track==="support"&&x.staffTeamId===team).length>=maxN) return toast(`${teamName(team)} already has ${maxN} nominations in this cycle.`);
    const nomination={...((e&&e.nomination)||{}),by:(e&&e.nomination&&e.nomination.by)||(me&&me.id)||null,byName:(e&&e.nomination&&e.nomination.byName)||S.meName,at:(e&&e.nomination&&e.nomination.at)||nowMs(),evidence:evd,conflict:d.noConflict??(e&&e.nomination&&e.nomination.conflict==="none")?"none":"declared",conflictNote:String(d.conflictNote??((e&&e.nomination)||{}).conflictNote??"").trim(),late:(e&&e.nomination&&e.nomination.late)||(p.nominationsDue&&todayD()>p.nominationsDue)};
    const doc={...(e||{}),id:e?e.id:rid("rrn-"),programmeId:p.id,venture:p.venture,groupId:gid,track:"support",staffId:sid,staffTeamId:team,nomination,scores:(e&&e.scores)||{},updatedAt:nowMs(),createdAt:e?e.createdAt:nowMs(),history:hist(e,e?"Nomination edited":"Nominated by "+S.meName)};
    if(await put("mod/rr/entries/"+doc.id,doc)){ delete S.drafts[k]; ui.editN=null; if(!e) sendMail({to:qgEmails(),subject:`New Service Stars nomination: ${personName(sid)}`,lines:[`${S.meName} nominated ${personName(sid)} (${rrGroup(p,gid).name}) for ${p.name}, ${p.cycle}.`,"Q&G validates and pre-scores; the panel makes the final choice."],ref:doc.id,kind:"rr"}); toast(e?"Saved.":"Nomination submitted."); } return; }
  if(act==="rrCleanSave"||act==="rrDisq"||act==="rrReinstate"){ if(!isQG()) return; const e=S.rrEntries.find(x=>x.id===el.dataset.id), d=draft("rrc-"+e.id);
    if(act==="rrDisq"){ const why=String(d.dq||"").trim(); if(!why) return toast("Give the fair play reason."); if(!confirm("Remove "+personName(e.staffId)+" from the competition?")) return;
      await patch("mod/rr/entries/"+e.id,{disqualified:{reason:why,at:nowMs(),byName:S.meName},updatedAt:nowMs(),history:hist(e,"Removed from the competition (fair play): "+why)}); return toast("Removed. Log it in the Breach tracker if consequence management applies."); }
    if(act==="rrReinstate"){ await patch("mod/rr/entries/"+e.id,{disqualified:null,updatedAt:nowMs(),history:hist(e,"Reinstated to the competition")}); return toast("Reinstated."); }
    const o={neg:!!(d.ov_neg??(e.cleanOverride||{}).neg),cmp:!!(d.ov_cmp??(e.cleanOverride||{}).cmp),cons:!!(d.ov_cons??(e.cleanOverride||{}).cons),reason:String(d.reason??(e.cleanOverride||{}).reason??"").trim()};
    if((o.neg||o.cmp||o.cons)&&!o.reason) return toast("Give the reason for the override.");
    await patch("mod/rr/entries/"+e.id,{cleanOverride:o,openHR:!!(d.openHR??e.openHR),updatedAt:nowMs(),history:hist(e,"Clean record updated"+(o.reason?": "+o.reason:""))}); delete S.drafts["rrc-"+e.id]; return toast("Saved."); }
  if(act==="rrAppealAdd"){ if(!isQG()) return; const d=draft("rra-new"), e=S.rrEntries.find(x=>x.id===d.entryId); if(!e||!String(d.text||"").trim()) return toast("Choose the participant and describe the appeal.");
    const close=p.appealsOpenAt?addWorkHours(p.appealsOpenAt,(p.appealDays||5)*dayHours(),S.cfg):null, rec=d.received||todayD();
    const a={text:d.text.trim(),received:rec,late:!!(close&&localToMs(rec,"00:00")>close),at:nowMs(),by:S.uid,byName:S.meName,outcome:null};
    await patch("mod/rr/entries/"+e.id,{appeals:[...(e.appeals||[]),a],updatedAt:nowMs(),history:hist(e,"Appeal recorded")}); delete S.drafts["rra-new"]; return toast("Appeal recorded."); }
  if(act==="rrAppealDecide"){ if(!isQG()) return; const e=S.rrEntries.find(x=>x.id===el.dataset.id), i=+el.dataset.i, d=draft(`rrd-${e.id}-${i}`); if(!d.outcome) return toast("Choose the outcome.");
    const ap=(e.appeals||[]).slice(); ap[i]={...ap[i],outcome:d.outcome,notes:String(d.notes||"").trim(),decidedAt:nowMs(),byName:S.meName};
    await patch("mod/rr/entries/"+e.id,{appeals:ap,updatedAt:nowMs(),history:hist(e,"Appeal "+d.outcome.toLowerCase())}); return toast("Saved."); }
}
async function rrChange(el){
  if(el.dataset.rrscore){ if(!isQG()) return; const e=S.rrEntries.find(x=>x.id===el.dataset.rrscore); const scores={...(e.scores||{}),[el.dataset.c]:Number(el.value)||null};
    await patch("mod/rr/entries/"+e.id,{scores,scoredBy:S.uid,scoredByName:S.meName,updatedAt:nowMs()}); return true; }
  if(el.dataset.rrpanel){ if(!isChief()) return; const e=S.rrEntries.find(x=>x.id===el.dataset.rrpanel); await patch("mod/rr/entries/"+e.id,{panel:el.value||null,panelByName:S.meName,panelAt:nowMs(),updatedAt:nowMs(),history:[...(e.history||[]),{at:nowMs(),byName:S.meName,note:"Panel: "+(el.value||"cleared")}]}); return true; }
  if(el.dataset.rrfile&&el.files[0]){ await rrUpload(el.dataset.rrfile,el.files[0]); return true; }
  return false;
}
async function rrUpload(pid,file){
  const p=S.rrProgs.find(x=>x.id===pid); if(!p||!window.XLSX) return;
  let rows; try{ const wb=XLSX.read(await file.arrayBuffer(),{type:"array"}); rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""}); }catch(_){ return toast("That file couldn't be read."); }
  let added=0, updated=0; const miss=[];
  for(const r of rows){ const g=k=>{ const key=Object.keys(r).find(x=>norm(x)===norm(k)); return key?r[key]:""; };
    const person=byName(g("Name")), grp=(p.groups||[]).find(x=>norm(x.name)===norm(g("Group")));
    if(!person||!grp||grp.track==="support"){ miss.push(String(g("Name")||"(blank)")); continue; }
    const ex=rrEntries(p.id).find(x=>x.groupId===grp.id&&x.staffId===person.id), num=k=>{ const v=g(k); return v===""?(ex?ex[k.replace(/ /g,"")]:""):Number(String(v).replace("%","")); };
    const doc={...(ex||{}),id:ex?ex.id:rid("rre-"),programmeId:p.id,venture:p.venture,groupId:grp.id,track:grp.track,staffId:person.id,staffTeamId:(asgAt(person)||{}).teamId||null,
      sales:g("Sales")===""?(ex?ex.sales:""):Number(g("Sales")),claimsManaged:g("Claims managed")===""?(ex?ex.claimsManaged:""):Number(g("Claims managed")),slaPct:g("SLA %")===""?(ex?ex.slaPct:""):Number(String(g("SLA %")).replace("%","")),reviews:g("Verified reviews")===""?(ex?ex.reviews:""):Number(g("Verified reviews")),qaScore:g("QA score")===""?(ex?ex.qaScore:""):Number(g("QA score")),
      updatedAt:nowMs(),createdAt:ex?ex.createdAt:nowMs(),history:[...((ex&&ex.history)||[]),{at:nowMs(),byName:S.meName,note:"Figures uploaded from "+file.name}]};
    if(await put("mod/rr/entries/"+doc.id,doc)) ex?updated++:added++; }
  toast(`${added} added, ${updated} updated${miss.length?`; ${miss.length} rows skipped (name or group not matched: ${miss.slice(0,3).join(", ")}${miss.length>3?"…":""})`:""}.`);
}
async function rrExport(p){
  if(!p||!DOWNLOADS||!window.XLSX) return toast("Downloads aren't available in this view.");
  const XL=XLSX, wb=XL.utils.book_new(), fin=p.phase==="final";
  XL.utils.book_append_sheet(wb,XL.utils.json_to_sheet([{"Programme":p.name,"Venture":vInfo(p.venture).name,"Cycle":p.cycle,"Status":fin?"Final results":"Provisional standings","Generated (Dubai time)":fmtX(nowMs())}]),"About");
  for(const g of p.groups||[]){ const s=rrStandings(p,g); const rows=[...s.el.map(r=>({Rank:r.rank,Name:personName(r.e.staffId),Team:teamName(r.e.staffTeamId),...(g.track==="advisor"?{Sales:r.sales,"Verified reviews":r.reviews,"Reviews per sale":r.sales?Math.round(r.rps*1000)/10+"%":"",Score:r.score}:g.track==="claims"?{"Claims managed":r.claims,"Verified reviews":r.reviews,"Review conversion":r.claims?Math.round(r.conv*1000)/10+"%":"","SLA met":r.sla+"%"}:{"Q&G score /25":r.total}),Result:r.rank<=(g.winners||1)?(fin?"Winner":"Provisional winner"):"Rank "+r.rank})),...s.inel.map(r=>({Rank:"",Name:personName(r.e.staffId),Team:teamName(r.e.staffTeamId),Result:r.why}))];
    if(rows.length) XL.utils.book_append_sheet(wb,XL.utils.json_to_sheet(rows),g.name.replace(/[\\/?*[\]:]/g,"").slice(0,31)); }
  const b64=XL.write(wb,{bookType:"xlsx",type:"base64"});
  try{ await DOWNLOADS.save({filename:`${p.name.replace(/\s+/g,"-")}-${fin?"final":"standings"}-${todayD()}.xlsx`,data:new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})}); }catch(e){ if(e&&e.code!=="cancelled") toast("The download didn't start."); }
}
