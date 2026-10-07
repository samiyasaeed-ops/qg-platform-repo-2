/* ================= navigation ================= */
const NAV=[
  {g:"",items:[["home","Home","Every Q&G activity at a glance"]]},
  {g:"Customer experience",items:[["complaints","Complaints management","Complaints, negative reviews and feedback from every source, from intake to internal closure"],["callbacks","Callbacks","Customer callback requests, run through the same journey and tracked separately"]]},
  {g:"Quality assurance",items:[["calls","Call evaluations","QA scoring of calls, run in the QA Evaluation tool"],["emails","Email evaluations","QA scoring of email and chat interactions, run in the QA Evaluation tool"],["mystery","Mystery shopping","Planned shops of our own channels and what they found"],["journey","Journey testing","End-to-end tests of customer journeys and the defects found"],["spotchecks","Spot checks","Unannounced floor and desk checks"]]},
  {g:"Governance and risk",items:[["breaches","Breach tracker","Breaches from QA evaluations, upheld cases and checks, through to consequence"],["noncompliance","Non-compliance","Regulatory and policy non-compliance and its remediation"],["rca","RCA","Root cause analysis with corrective and preventive actions"],["product","Product findings and scope","Product issues found by Q&G and the scope they affect"]]},
  {g:"Rewards and recognition",items:[["rr","Recognition programmes","Programmes per venture, such as IM Service Stars: standings, nominations, clean record, appeals and winners"],["appreciations","Appreciations","Compliments customers give about our people"],["reviews","Positive reviews","Positive Google and Trustpilot reviews, matched to transactions to count as verified reviews"]]},
  {g:"Team",items:[["mywork","My cockpit","What's open for you right now, across every section"],["team","Team workload","Who has what, what's overdue and turnaround times, for the Chief Q&G"],["perf","Performance","Monthly Q&G performance: your own figures, or the whole team for the Chief Q&G"],["kpis","KPIs","Q&G key performance indicators: open items, turnaround, breaches, against target"]]},
  {g:"Monitoring",items:[["controls","Monitoring and controls","The controls Q&G monitors, who owns them, how often they're tested and how they performed"],["links","Linked dashboards","Google review dashboard, 3CX call recordings and missed calls, and other systems"]]},
  {g:"Library",items:[["sops","SOP repository","Versioned SOPs with effective dates"],["regulations","Regulations library","UAE laws, regulations and circulars each venture works under, with article references"],["structure","Structure and flow","Teams, routing and escalation, and the customer experience journey"],["staff","Staff list","One list of people and teams that every section uses"],["guide","Platform guide","How the platform is designed and why, with the log of every requirement"]]},
  {g:"Administration",admin:true,items:[["questions","Open questions","Everything waiting on a decision or answer, by section"],["ventures","Ventures","The group's ventures, their lines of business and regulators"],["lists","Dropdown lists","Case types, channels, complaint types and natures, products, root causes and every other list people choose from"],["data","Backups and import","Daily Excel backups to Google Drive, downloads, and importing existing data"],["trash","Recycle bin","Everything deleted, kept and restorable by the administrator"],["errors","Error report","Anything that failed, with a way to run it again"],["outbox","Email log","Every email the platform sent or tried to send"],["settings","Settings","Working hours, SLAs and lists"],["audit","Audit log","Every change made on the platform"]]}
];
const NAVMAP={}; NAV.forEach(g=>g.items.forEach(([k,l,d])=>NAVMAP[k]={label:l,group:g.g,desc:d,admin:!!g.admin}));
const FRAME_SECTIONS=["calls","emails"];
const NO_PLAYBOOK=["home","errors","outbox","settings","audit","questions","mywork","ventures","guide","data","trash","links","lists"];

function navCount(k){
  if(k==="complaints") return cxCases("complaints").filter(c=>isOpenCase(c)&&canAct(c)).length;
  if(k==="callbacks") return cxCases("callbacks").filter(c=>isOpenCase(c)&&canAct(c)).length;
  if(k==="breaches") return breachCandidates().length;
  if(k==="errors") return S.errors.filter(e=>e.status==="open").length;
  if(k==="questions") return S.questions.filter(q=>q.status==="Open").length;
  if(k==="mywork"){ const me=meStaff(); return me?workItems().filter(i=>i.assignee===me.id&&i.state==="open").length:0; }
  return 0;
}
function renderNav(){
  $("#rail").innerHTML=NAV.filter(g=>!g.admin||S.admin).map(g=>`${g.g?`<div class="grp">${esc(g.g)}</div>`:""}${g.items.filter(([k])=>k!=="team"||isChief()).filter(([k])=>!["perf","kpis"].includes(k)||isQG()).map(([k,l])=>{ const n=navCount(k); return `<button data-nav="${k}"${S.section===k?' aria-current="page"':""}><span>${esc(l)}</span>${n?`<b class="${k==="errors"||k==="breaches"?"red":""}">${n}</b>`:""}</button>`; }).join("")}`).join("");
}
function go(sec){
  if(!NAVMAP[sec]||(NAVMAP[sec].admin&&!S.admin)) sec="home";
  S.section=sec; S.view="records"; const ah=$("#alertHost"); if(ah&&!ah.hidden) ah.hidden=true; if(sec!=="mywork"&&sec!=="team") S.sel.task=null; document.body.classList.remove("navopen");
  try{ localStorage.setItem("qg2-sec",sec); }catch(_){}
  render(); $("#content").scrollTop=0;
}

/* ================= QA frame ================= */
let qaFrame=null;
function ensureQA(){
  if(qaFrame) return qaFrame;
  qaFrame=document.createElement("iframe"); qaFrame.className="qaframe"; qaFrame.title="QA Evaluation";
  qaFrame.setAttribute("allow","clipboard-read; clipboard-write; fullscreen");
  qaFrame.srcdoc=new TextDecoder().decode(Uint8Array.from(atob(JSON.parse($("#qa-src").textContent)),c=>c.charCodeAt(0)));
  qaFrame.addEventListener("load",()=>{ themeQA(); setTimeout(()=>{ try{ qaFrame.contentWindow.setScope(S.venture||"all"); }catch(_){} themeQA(); },800); });
  $("#frameHost").appendChild(qaFrame); return qaFrame;
}
function openEvalInQA(id){ go("calls"); ensureQA(); let n=0; const t=setInterval(()=>{ n++; let ok=false; try{ ok=!!(qaFrame.contentWindow.__qgOpenEval&&qaFrame.contentWindow.__qgOpenEval(id)); }catch(_){} if(ok||n>40) clearInterval(t); },250); }

/* ================= render ================= */
let pendingRender=false, rendering=false;
function render(force){
  if(rendering){ setTimeout(()=>render(force),0); return; }
  rendering=true; try{ renderInner(force); }finally{ rendering=false; }
}
function renderInner(force){
  if(!force&&typing()){ pendingRender=true; renderNav(); return; }
  pendingRender=false;
  const sec=S.section, meta=NAVMAP[sec];
  const focusKey=(()=>{ const a=document.activeElement; if(!a||!a.closest||!a.closest("#content")) return null; return a.dataset.ui?`[data-ui="${a.dataset.ui}"]`:null; })();
  renderNav();
  const frame=FRAME_SECTIONS.includes(sec)&&S.view==="records";
  const scoped=!["ventures","settings","errors","outbox","audit","questions","guide","staff"].includes(sec);
  $("#sechead").innerHTML=`<div><h1>${esc(meta.label)}${scoped?` <span class="scope" style="--vc:${S.venture?esc(vInfo(S.venture).color):"var(--muted)"}">${esc(scopeLabel())}</span>`:""}</h1><p>${esc(meta.desc)}</p></div>${!NO_PLAYBOOK.includes(sec)?`<div class="seg" role="group" aria-label="View"><button data-act="setView" data-v="records" aria-pressed="${S.view==="records"}">${FRAME_SECTIONS.includes(sec)?"Tool":"Records"}</button>${FRAME_SECTIONS.includes(sec)?`<button data-act="setView" data-v="timings" aria-pressed="${S.view==="timings"}">Timings</button>`:""}${sec==="complaints"||sec==="callbacks"?`<button data-act="setView" data-v="reports" aria-pressed="${S.view==="reports"}">Reports</button>`:""}<button data-act="setView" data-v="playbook" aria-pressed="${S.view==="playbook"}">Playbook${pbOf(sec)?" v"+pbOf(sec).versions.length:""}</button></div>`:""}`;
  { const la=lastActivity(sec); $("#sechead p").insertAdjacentHTML("afterend",`<div class="stamps flat secstamp">${!isNaN(la)?`Last activity ${stampCell(la)}<span class="dot">·</span>`:""}Viewed ${stampCell(nowMs())} · Dubai time</div>`); }
  $("#frameHost").hidden=!frame; $("#content").hidden=frame;
  if(frame){ ensureQA(); return; }
  let html;
  if(!S.ready.boot) html=`<p class="emptybox">Loading…</p>`;
  else if(!DB) html=`<div class="emptybox">Open the published platform while signed in to load and save records.</div>`;
  else if(!S.admin&&S.ready.staff&&!allowedVentures().length) html=`<div class="emptybox">Your sign-in isn't linked to the Staff list yet, so no venture is open to you. Ask the administrator to link your sign-in and set your team.</div>`;
  else if(S.view==="playbook") html=viewPlaybook(sec);
  else if(S.view==="timings") html=viewEvalTimings(sec);
  else if(S.view==="reports") html=viewCxReports(sec);
  else if(sec==="home") html=viewHome();
  else if(sec==="complaints"||sec==="callbacks") html=viewCX(sec);
  else if(sec==="rr") html=viewRR();
  else if(REG[sec]) html=viewRegister(sec);
  else if(sec==="links") html=viewLinks();
  else if(sec==="staff") html=viewStaff();
  else if(sec==="structure") html=viewStructure();
  else if(sec==="sops") html=viewSOPs();
  else if(S.sel.task&&(sec==="mywork"||sec==="team")){ const t=S.tasks.find(x=>x.id===S.sel.task); html=t?viewTask(t):(S.sel.task=null,"Task not found."); }
  else if(sec==="mywork") html=viewMyWork();
  else if(sec==="perf") html=isQG()?viewPerformance():`<div class="emptybox">Performance is visible to Q&G team members.</div>`;
  else if(sec==="kpis") html=isQG()?viewKPIs():`<div class="emptybox">KPIs are visible to Q&G team members.</div>`;
  else if(sec==="data") html=viewImport();
  else if(sec==="trash") html=viewTrash();
  else if(sec==="lists") html=S.admin?viewLists():`<div class="emptybox">Only the administrator manages dropdown lists.</div>`;
  else if(sec==="team") html=viewTeam();
  else if(sec==="questions") html=viewQuestions();
  else if(sec==="regulations") html=viewRegulations();
  else if(sec==="guide") html=viewGuide();
  else if(sec==="ventures") html=viewVentures();
  else if(sec==="errors") html=viewErrors();
  else if(sec==="outbox") html=viewOutbox();
  else if(sec==="settings") html=viewSettings();
  else if(sec==="audit") html=viewAudit();
  $("#content").innerHTML=`<div class="wrap">${html}</div>`;
  if(focusKey){ const el=$(focusKey); if(el){ el.focus(); if(el.setSelectionRange&&el.type!=="date"){ const n=el.value.length; try{ el.setSelectionRange(n,n); }catch(_){} } } }
}

/* ================= home ================= */
function underV(v,fn){ const keep=S.venture; S.venture=v; try{ return fn(); }finally{ S.venture=keep; } }
function homeMetrics(){
  const from=nowMs()-30*864e5, from30=dateOf(from);
  const ev=evalsV().filter(e=>["pending_review","confirmed","published"].includes(e.status)&&ts(e.createdAt)>=from);
  const calls=ev.filter(e=>!/email/i.test(e.channel||"")), mails=ev.filter(e=>/email/i.test(e.channel||""));
  const avgS=a=>a.length?Math.round(a.reduce((s,e)=>s+Number(e.totalScore||0),0)/a.length*10)/10:null;
  const open=sec=>recsOf(sec).filter(r=>!REG[sec].final.includes(r.status)).length;
  const recent=sec=>recsOf(sec).filter(r=>(r.date||"")>=from30).length;
  const cx=cxCases("complaints"), cb=cxCases("callbacks");
  return {
    complaints:[cx.filter(isOpenCase).length,cx.filter(c=>isOpenCase(c)&&overdue(c)).length],
    csat:(()=>{ const sc=[...cx,...cb].filter(c=>c.csat&&c.csat.status==="Captured"&&ts(c.csat.at)>=from).map(c=>c.csat.score); return [sc.length?Math.round(sc.reduce((a,b)=>a+b,0)/sc.length*10)/10:null,sc.length]; })(),
    biz:(()=>{ const rv=[...cx,...cb].filter(c=>(c.review||{}).businessOutcome&&ts((c.closure||{}).externalAt)>=from).map(c=>c.review.businessOutcome); const qv=evalsV().filter(e=>e.businessOutcome&&ts(e.createdAt)>=from).map(e=>e.businessOutcome); const all=[...rv,...qv]; return [all.filter(x=>x==="Retained").length,all.filter(x=>x==="Lost").length,rv.length,qv.length]; })(),
    callbacks:[cb.filter(isOpenCase).length,cb.filter(c=>isOpenCase(c)&&overdue(c)).length],
    appreciations:[recent("appreciations")],reviews:[recent("reviews")],
    calls:[calls.length,avgS(calls)],emails:[mails.length,avgS(mails)],mystery:[recent("mystery")],journey:[open("journey")],spotchecks:[open("spotchecks")],
    breaches:[open("breaches"),breachCandidates().length],
    controls:[recsOf("controls").filter(r=>r.status!=="Retired"&&(!nextDue(r)||nextDue(r)<todayD())).length,recsOf("controls").filter(r=>r.status!=="Retired").length],
    rr:(()=>{ const pr=rrProgs().filter(x=>x.phase!=="final"); const en=pr.flatMap(x=>rrEntries(x.id)); return [en.filter(e=>e.track!=="support").length,pr.length,en.filter(e=>e.track==="support").length,pr.map(x=>(RR_PHASES.find(p=>p[0]===x.phase)||[])[1]).filter(Boolean).join(", "),en.filter(e=>{ const x=pr.find(y=>y.id===e.programmeId); return x&&!rrClean(x,e).ok; }).length]; })(),
    journeyRet:[recsOf("journey").filter(r=>r.status==="Ready for retest").length],noncompliance:[open("noncompliance")],rca:[open("rca")],product:[open("product")],
    sops:[S.sops.filter(x=>x.status==="Active"&&(!S.venture||!x.venture||x.venture==="all"||x.venture===S.venture)).length],
    regulations:[regsV().filter(r=>r.status==="In force").length],
    staff:[staffList().filter(p=>{ const t=teamOf(p); return !S.venture||(t&&(t.venture===S.venture||t.kind==="qg")); }).length]
  };
}
function viewHome(){
  const M=homeMetrics(), all=!S.venture, vs=ventures();
  const per=all?Object.fromEntries(vs.map(v=>[v.id,underV(v.id,homeMetrics)])):null;
  const pct=x=>x==null?"–":x+"%";
  const split=(k,i=0)=>all&&vs.length>1?`<span class="vsplit">${vs.map(v=>`<span>${vChip(v.id)} ${per[v.id][k][i]??"–"}</span>`).join("")}</span>`:"";
  const tile=(k,big,small,warn)=>`<button class="tile${warn?" warn":""}" data-nav="${k}"><span class="tl">${esc(NAVMAP[k].label)}</span><b>${big}</b><span class="ts">${small}</span>${split(k)}</button>`;
  const groups=[
    ["Customer experience","cx",[tile("complaints",M.complaints[0],`open · ${M.complaints[1]} overdue`,M.complaints[1]),tile("callbacks",M.callbacks[0],`open · ${M.callbacks[1]} overdue`,M.callbacks[1]),
      `<button class="tile" data-nav="complaints"><span class="tl">CSAT at closure</span><b>${M.csat[0]==null?"–":M.csat[0]+"/5"}</b><span class="ts">${M.csat[1]} score${M.csat[1]===1?"":"s"}, last 30 days</span>${split("csat")}</button>`,
      `<button class="tile${M.biz[1]>M.biz[0]?" warn":""}" data-nav="complaints"><span class="tl">Business retained or lost</span><b>${M.biz[0]} / ${M.biz[1]}</b><span class="ts">retained / lost, last 30 days (cases and QA)</span>${split("biz")}</button>`]],
    ["Quality assurance","qa",[tile("calls",M.calls[0],`evaluations, 30 days · average ${pct(M.calls[1])}`),tile("emails",M.emails[0],`evaluations, 30 days · average ${pct(M.emails[1])}`),tile("mystery",M.mystery[0],"shops in the last 30 days"),tile("journey",M.journey[0],`open · ${M.journeyRet[0]} ready for retest`,M.journeyRet[0]>0),tile("spotchecks",M.spotchecks[0],"open actions")]],
    ["Governance and risk","gr",[tile("breaches",M.breaches[0],`open · ${M.breaches[1]} new from QA`,M.breaches[1]>0),tile("noncompliance",M.noncompliance[0],"open"),tile("rca",M.rca[0],"open"),tile("product",M.product[0],"open"),tile("controls",M.controls[0],`of ${M.controls[1]} active controls due or never tested`,M.controls[0]>0)]],
    ["Rewards and recognition","rrg",[`<button class="tile" data-nav="rr"><span class="tl">Recognition programmes</span><b>${M.rr[1]}</b><span class="ts">programme${M.rr[1]===1?"":"s"} running${M.rr[3]?" · "+esc(M.rr[3]):""}</span>${split("rr",1)}</button>`,
      `<button class="tile" data-nav="rr"><span class="tl">Advisors and claims handlers</span><b>${M.rr[0]}</b><span class="ts">taking part</span>${split("rr",0)}</button>`,
      `<button class="tile" data-nav="rr"><span class="tl">Support nominations</span><b>${M.rr[2]}</b><span class="ts">from line managers</span></button>`,
      `<button class="tile${M.rr[4]?" warn":""}" data-nav="rr"><span class="tl">Not on a clean record</span><b>${M.rr[4]}</b><span class="ts">sitting out this cycle</span></button>`,
      tile("appreciations",M.appreciations[0],"in the last 30 days"),tile("reviews",M.reviews[0],"in the last 30 days")]],
    ["Library","lib",[tile("sops",M.sops[0],"active SOPs"),tile("regulations",M.regulations[0],"instruments in force"),tile("staff",M.staff[0],"people today")]]
  ];
  const att=[];
  const od=S.cases.filter(c=>inV(c.venture)&&isOpenCase(c)&&overdue(c)); if(od.length) att.push([`${od.length} customer case${od.length>1?"s are":" is"} past SLA`,"complaints"]);
  const noLM=Object.values(S.teams).filter(t=>inV(t.venture)&&t.kind!=="qg"&&t.active!==false&&!t.lineManagerId); if(noLM.length) att.push([`${noLM.length} team${noLM.length>1?"s have":" has"} no line manager, so cases can't be routed there`,"staff"]);
  if(!Object.keys(S.teams).length) att.push(["Set up teams and people in Staff list so cases can be routed","staff"]);
  if(M.breaches[1]) att.push([`${M.breaches[1]} breach${M.breaches[1]>1?"es":""} flagged in QA evaluations aren't tracked yet`,"breaches"]);
  const vr=regsV().filter(r=>r.status==="Verify").length; if(vr) att.push([`${vr} regulation entr${vr>1?"ies need":"y needs"} checking with Compliance`,"regulations"]);
  if(isChief()){ const it=workItems(), un=it.filter(i=>i.state==="open"&&!i.assignee).length, ov=it.filter(isOver).length; if(un) att.push([`${un} Q&G item${un>1?"s are":" is"} unassigned`,"team"]); if(ov) att.push([`${ov} Q&G item${ov>1?"s are":" is"} overdue across the team`,"team"]); }
  if(S.admin){ const oq=S.questions.filter(q=>q.status==="Open").length; if(oq) att.push([`${oq} open question${oq>1?"s":""} waiting for your answer`,"questions"]); const er=S.errors.filter(e=>e.status==="open").length; if(er) att.push([`${er} failed action${er>1?"s":""} in the error report`,"errors"]); }
  const unlogged=S.cases.filter(c=>inV(c.venture)&&(c.pendingCalls||[]).some(x=>nowMs()-x.at>15*60000)); if(unlogged.length) att.push([`${unlogged.length} case${unlogged.length>1?"s have":" has"} a call started from the platform that hasn't been logged`,"complaints"]);
  if(isChief()){ const mb=S.tatLog.filter(x=>x.month===monthOf(nowMs())&&inV(x.venture||"")).length; if(mb) att.push([`${mb} time limit breach${mb>1?"es":""} recorded this month`,"perf"]); }
  if(!MCP) att.push(["Gmail isn't connected in your session, so emails and reminders you trigger won't send","settings"]);
  // venture comparison (kept side by side, never summed into one figure per row)
  const vtable=all&&vs.length>1?`<section class="sect"><h2 class="h3">By venture</h2><p class="hint">Each venture is reported on its own row. Pick a venture at the top to scope every section to it.</p>
    <div class="tbl"><table><thead><tr><th>Venture</th><th class="n sep">Open cases</th><th class="n">Overdue</th><th class="n sep">QA evaluations</th><th>Call average</th><th class="n sep">Open breaches</th><th class="n">Non-compliance</th><th class="n">Open RCAs</th><th class="n sep">CSAT</th><th class="n">Retained / lost</th><th></th></tr></thead><tbody>
    ${vs.map(v=>{ const m=per[v.id]; return `<tr><td>${vChip(v.id)} <b>${esc(v.name)}</b></td><td class="n sep">${m.complaints[0]+m.callbacks[0]}</td><td class="n">${m.complaints[1]+m.callbacks[1]?`<span class="tag red">${m.complaints[1]+m.callbacks[1]}</span>`:0}</td><td class="n sep">${m.calls[0]+m.emails[0]}</td><td>${pct(m.calls[1])}</td><td class="n sep">${m.breaches[0]}</td><td class="n">${m.noncompliance[0]}</td><td class="n">${m.rca[0]}</td><td class="n sep">${m.csat[0]==null?"–":m.csat[0]+"/5"}</td><td class="n">${m.biz[0]} / ${m.biz[1]}</td><td><button class="btn sm" data-act="pickVenture" data-v="${esc(v.id)}">View ${esc(v.code)} only</button></td></tr>`; }).join("")}</tbody></table></div></section>`:"";
  // LOB table, keyed by venture and LOB so ventures never merge
  const from=nowMs()-30*864e5, ev=evalsV().filter(e=>["pending_review","confirmed","published"].includes(e.status)&&ts(e.createdAt)>=from);
  const L={}, row=(v,l)=>{ const k=(v||"?")+"|"+(l||"Unassigned"); return L[k]||(L[k]={v,lob:l||"Unassigned",open:0,compl:0,over:0,ev:[],br:0}); };
  S.cases.filter(c=>inV(c.venture)&&isOpenCase(c)).forEach(c=>{ const r=row(c.venture,c.lob); r.open++; if(overdue(c)) r.over++; });
  S.cases.filter(c=>inV(c.venture)&&c.type==="Complaint"&&c.createdAt>=from).forEach(c=>row(c.venture,c.lob).compl++);
  ev.forEach(e=>row(e.ventureId||"insurancemarket",e.lob).ev.push(e));
  recsOf("breaches").filter(r=>r.status==="Open").forEach(r=>row(recVenture(r),String(r.lob||"").split("|")[1]).br++);
  const lobRows=Object.values(L).sort((a,b)=>String(a.v).localeCompare(String(b.v))||(b.compl+b.open)-(a.compl+a.open)||a.lob.localeCompare(b.lob)).map(r=>{ const a=r.ev.length?r.ev.reduce((s,e)=>s+Number(e.totalScore||0),0)/r.ev.length:null, bench=r.ev.length?r.ev.reduce((s,e)=>s+Number(e.benchmark??85),0)/r.ev.length:85, low=a!=null&&a<bench;
    return `<tr><td>${vChip(r.v)} <b>${esc(r.lob)}</b></td><td class="n sep">${r.open}</td><td class="n">${r.compl}</td><td class="n">${r.over?`<span class="tag red">${r.over}</span>`:0}</td><td class="n sep">${r.ev.length}</td><td>${a==null?'<span class="muted">None</span>':`<span class="meter" style="--w:${Math.min(100,a)}%;--c:${low?"var(--red)":"var(--qa)"}"><i></i>${Math.round(a*10)/10}%</span>`}</td><td class="n sep">${r.br}</td>
      <td class="sep">${r.compl&&low?'<span class="tag red">Complaints with QA below benchmark</span>':r.compl&&!r.ev.length?'<span class="tag amb">Complaints, no QA coverage</span>':low?'<span class="tag amb">QA below benchmark</span>':'<span class="muted">–</span>'}</td></tr>`; }).join("");
  return `${att.length?`<div class="attn"><h2 class="h3">Needs attention</h2><ul>${att.map(([t,k])=>`<li><button class="linkbtn" data-nav="${k}">${esc(t)}</button></li>`).join("")}</ul></div>`:""}
  ${vtable}
  ${groups.map(([g,c,t])=>`<section class="tgroup ${c}"><h2>${esc(g)}</h2><div class="tiles">${t.join("")}</div></section>`).join("")}
  <section class="sect"><h2 class="h3">By line of business</h2><p class="hint">Open customer cases, complaints in the last 30 days, QA results and open breaches for the same venture and LOB.</p>
  <div class="tbl"><table><thead><tr><th>Venture and LOB</th><th class="sep">Open cases</th><th>Complaints</th><th>Overdue</th><th class="sep">QA evaluations</th><th>Average</th><th class="sep">Open breaches</th><th class="sep">Signal</th></tr></thead><tbody>${lobRows||`<tr><td colspan="8" class="muted">Nothing recorded yet.</td></tr>`}</tbody></table></div></section>`;
}

/* ================= administration ================= */
function viewErrors(){
  const ui=S.ui.errors||(S.ui.errors={st:"open"});
  const list=S.errors.filter(e=>!ui.st||e.status===ui.st);
  return `<div class="chips"><button class="chip" data-act="errFilter" data-v="open" aria-pressed="${ui.st==="open"}">Open <span class="cnt red">${S.errors.filter(e=>e.status==="open").length}</span></button><button class="chip" data-act="errFilter" data-v="resolved" aria-pressed="${ui.st==="resolved"}">Resolved</button><button class="chip" data-act="errFilter" data-v="" aria-pressed="${!ui.st}">All</button></div>
  ${list.length?`<div class="tbl"><table><thead><tr><th>When</th><th>Kind</th><th>What went wrong</th><th>Session</th><th></th></tr></thead><tbody>${list.map(e=>`<tr><td>${esc(fmtDT(e.at))}</td><td>${esc(e.kind)}</td><td class="wrap"><b>${esc(e.message)}</b>${e.detail?`<br><span class="muted">${esc(e.detail)}</span>`:""}${e.resolution?`<br><span class="muted">Resolved: ${esc(e.resolution)}</span>`:""}</td><td>${esc(e.byName||"")}</td>
    <td>${e.status==="open"?`<div class="row nowrap">${["email","write","sync"].includes(e.kind)&&e.payload?`<button class="btn sm primary" data-act="errRetry" data-id="${esc(e._id)}">Run again</button>`:""}<button class="btn sm" data-act="errResolve" data-id="${esc(e._id)}">Mark resolved</button></div>`:'<span class="tag ok">Resolved</span>'}</td></tr>`).join("")}</tbody></table></div>`:`<div class="emptybox">Nothing has failed${ui.st==="open"?" that still needs action":""}.</div>`}
  <p class="hint">Emails and reminders are sent from the Gmail account of whoever is using the platform at the time. If their Gmail isn't connected, the email lands here. Run again sends it from your Gmail.</p>`;
}
async function errAction(act,el){
  const e=S.errors.find(x=>x._id===el.dataset.id); if(!e) return;
  if(act==="errResolve"){ const why=prompt("How was it resolved?","Handled manually"); if(why===null) return; await DB.doc("mod/sys/errors/"+e._id).update({status:"resolved",resolution:why,resolvedAt:nowMs(),resolvedBy:S.meName}); return; }
  if(act==="errRetry"){
    let ok=false;
    try{
      if(e.kind==="email") ok=await deliver(e.payload);
      else if(e.kind==="write"){ const r=DB.doc(e.payload.path); if(e.payload.op==="delete") await r.delete(); else if(e.payload.op==="update") await r.update(e.payload.data); else await r.set(e.payload.data); ok=true; }
      else if(e.kind==="sync"){ if(e.payload.op==="syncAdvisor"&&S.staff[e.payload.staffId]){ await syncAdvisor(S.staff[e.payload.staffId]); ok=true; } else if(e.payload.op==="importQA"){ await staffAction("importQA",{dataset:{}}); ok=true; } }
    }catch(err){ ok=false; }
    if(ok){ await DB.doc("mod/sys/errors/"+e._id).update({status:"resolved",resolution:"Run again by "+S.meName,resolvedAt:nowMs()}); toast("Done."); }
    else toast("It failed again. A new entry has been logged.");
  }
}
function viewOutbox(){
  return S.outbox.length?`<div class="tbl"><table><thead><tr><th>When</th><th>Subject</th><th>To</th><th>Copy</th><th>Sent from session</th><th>Result</th></tr></thead><tbody>${S.outbox.map(o=>`<tr><td>${esc(fmtDT(o.at))}</td><td class="wrap">${esc(o.subject)}</td><td class="wrap">${esc((o.to||[]).join(", "))}</td><td class="wrap">${esc((o.cc||[]).join(", "))}</td><td>${esc(o.byName||"")}</td><td>${o.status==="sent"?'<span class="tag ok">Sent</span>':`<span class="tag red">Failed</span> <span class="muted">${esc(o.error||"")}</span>`}</td></tr>`).join("")}</tbody></table></div>`:`<div class="emptybox">No emails yet.</div>`;
}
function viewAudit(){
  return S.audit.length?`<div class="tbl"><table><thead><tr><th>When</th><th>Who</th><th>Area</th><th>Record</th><th>Action</th><th>Detail</th></tr></thead><tbody>${S.audit.map(a=>`<tr><td>${esc(fmtDT(a.at))}</td><td>${esc(a.byName)}</td><td>${esc(a.entity)}</td><td>${esc(a.entity==="person"?personName(a.entityId):a.entity==="team"?teamName(a.entityId):a.entityId)}</td><td>${esc(a.action)}</td><td class="wrap">${esc(a.note)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="emptybox">No changes recorded yet.</div>`;
}
function viewSettings(){
  const c=S.cfg, k="cfg";
  const days=dv(k,"days",c.work.days);
  return `<div class="form">
   <h2 class="h3">Working hours (Dubai time)</h2>
   <fieldset class="f"><legend>Working days</legend><div class="row">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((n,i)=>`<label class="radio"><input type="checkbox" data-d="${k}" data-f="days" data-multi="${i}"${days.map(String).includes(String(i))?" checked":""}> ${n}</label>`).join("")}</div></fieldset>
   <div class="g3"><label class="f"><span>Day starts</span><input type="time" data-d="${k}" data-f="start" value="${esc(dv(k,"start",c.work.start))}"></label><label class="f"><span>Day ends</span><input type="time" data-d="${k}" data-f="end" value="${esc(dv(k,"end",c.work.end))}"></label><label class="f"><span>Reminder repeats every (hours)</span><input type="number" min="1" data-d="${k}" data-f="reminderEveryHours" value="${esc(dv(k,"reminderEveryHours",c.reminderEveryHours))}"></label></div>
   <label class="f"><span>Public holidays, one date per line (YYYY-MM-DD)</span><textarea rows="3" data-d="${k}" data-f="holidays">${esc(dv(k,"holidays",(c.work.holidays||[]).join("\n")))}</textarea></label>
   <h2 class="h3">Service levels, in working hours</h2>
   <div class="g3">${[["intake","Q&G intake and routing"],["lm","Line manager resolution"],["qgReview","Q&G assessment and internal closure"],["consequence","Consequence confirmation"],["dispute","Chief Q&G dispute decision"]].map(([f,l])=>`<label class="f"><span>${l}</span><input type="number" min="1" data-d="${k}" data-f="sla.${f}" value="${esc(dv(k,"sla."+f,c.sla[f]))}"></label>`).join("")}</div>
   <h2 class="h3">Turnaround targets</h2><p class="hint">Records past these targets raise a pop-up alert for the owner and their manager and are recorded on the person's monthly performance. Working hours unless shown in minutes.</p>
   <div class="g3">${Object.keys(REG).filter(x=>x in TAT_DEFAULTS).map(sec=>`<label class="f"><span>${esc(NAVMAP[sec].label)} (to close)</span><input type="number" min="1" data-d="${k}" data-f="tat.${sec}" value="${esc(dv(k,"tat."+sec,tatCfg()[sec]))}"></label>`).join("")}
    <label class="f"><span>Tasks without a due date</span><input type="number" min="1" data-d="${k}" data-f="tat.task" value="${esc(dv(k,"tat.task",tatCfg().task))}"></label>
    <label class="f"><span>Evaluation handling (minutes)</span><input type="number" min="1" data-d="${k}" data-f="tat.evalHandlingMin" value="${esc(dv(k,"tat.evalHandlingMin",tatCfg().evalHandlingMin))}"></label>
    <label class="f"><span>Evaluation review</span><input type="number" min="1" data-d="${k}" data-f="tat.evalReview" value="${esc(dv(k,"tat.evalReview",tatCfg().evalReview))}"></label>
    <label class="f"><span>Feedback sent after review</span><input type="number" min="1" data-d="${k}" data-f="tat.evalPublish" value="${esc(dv(k,"tat.evalPublish",tatCfg().evalPublish))}"></label></div>
   <h2 class="h3">Complaints and feedback</h2>
   <p class="hint">Case types, channels, complaint types and natures, products, root causes, validity, closure reasons, request types and internal actions are managed in <button class="linkbtn" data-nav="lists">Dropdown lists</button>.</p>
   <label class="f"><span>Target resolution time per case type, in working hours (to be agreed with Compliance), one per line as “Type: hours”</span><textarea rows="6" data-d="${k}" data-f="cx.targetTat">${esc(dv(k,"cx.targetTat",Object.entries(cxc("targetTat")).map(([t,h])=>t+": "+h).join("\n")))}</textarea></label>
   <div class="g3"><label class="f"><span>Customer satisfaction link (DHA)</span><input type="url" data-d="${k}" data-f="cx.csatLink" value="${esc(dv(k,"cx.csatLink",cxc("csatLink")))}" placeholder="https://"></label>
    <label class="f"><span>Close drafts with no valid match after (days)</span><input type="number" min="1" data-d="${k}" data-f="cx.draftAutoCloseDays" value="${esc(dv(k,"cx.draftAutoCloseDays",cxc("draftAutoCloseDays")))}"></label>
    <label class="f"><span>After three unsuccessful attempts</span><select data-d="${k}" data-f="cx.notReachableAutoClose">${opts([{v:"yes",l:"Close automatically as customer not reachable"},{v:"no",l:"Send to Q&G review"}],dv(k,"cx.notReachableAutoClose",cxc("notReachableAutoClose")?"yes":"no"))}</select></label></div>
   <h2 class="h3">Calling through 3CX</h2><p class="hint">The Call button, wherever it appears for Q&G, the line manager or validation calls, opens this link with the customer's number. Set to your 3CX web client's call link: it opens the web client with the number ready to dial. Use “tel:{number}” instead if everyone has the 3CX desktop app or browser extension installed, which intercepts tel: links directly.</p>
   <div class="g2"><label class="f"><span>Dial link format</span><input data-d="${k}" data-f="dialFormat" value="${esc(dv(k,"dialFormat",c.dialFormat||"tel:{number}"))}"></label><label class="f"><span>Outside-line prefix (if any)</span><input data-d="${k}" data-f="dialPrefix" value="${esc(dv(k,"dialPrefix",c.dialPrefix||""))}"></label></div>
   <h2 class="h3">Backups</h2><label class="f"><span>Google Drive folder ID for daily backups</span><input data-d="${k}" data-f="backupFolderId" value="${esc(dv(k,"backupFolderId",c.backupFolderId||DRIVE_FOLDER_DEFAULT))}"></label>
   <h2 class="h3">Lists</h2><p class="hint">Source channels, case types and consequences are managed in <button class="linkbtn" data-nav="lists">Dropdown lists</button>.</p>
   <p class="hint">Ventures and their lines of business are managed in Ventures.</p>
   <div class="row"><button class="btn primary" data-act="cfgSave">Save settings</button></div></div>`;
}
async function cfgSave(){
  const d=draft("cfg"), c=clone(S.cfg), lines=s=>String(s).split("\n").map(x=>x.trim()).filter(Boolean);
  if(d.days) c.work.days=d.days.map(Number).sort();
  if(d.start) c.work.start=d.start; if(d.end) c.work.end=d.end;
  if("holidays" in d){ const h=lines(d.holidays); if(h.some(x=>!/^\d{4}-\d\d-\d\d$/.test(x))) return toast("Holidays must be dates like 2026-12-02."); c.work.holidays=h; }
  for(const f of ["intake","lm","qgReview","consequence","dispute"]) if(("sla."+f) in d) c.sla[f]=Math.max(1,Number(d["sla."+f])||c.sla[f]);
  if(d.reminderEveryHours) c.reminderEveryHours=Math.max(1,Number(d.reminderEveryHours));
  c.cx={...(c.cx||{})};
  for(const key of Object.keys(d).filter(x=>x.startsWith("cx."))){ const f=key.slice(3), v=d[key];
    if(f==="targetTat"){ const o={}; lines(v).forEach(l=>{ const i=l.lastIndexOf(":"); if(i>0){ const n=Number(l.slice(i+1)); if(n>0) o[l.slice(0,i).trim()]=n; } }); c.cx[f]=o; }
    else if(f==="complaintTaxonomy"){ const o={}; lines(v).forEach(l=>{ const [t,rest]=l.split(":"); if(t&&t.trim()) o[t.trim()]=(rest||"").split(",").map(x=>x.trim()).filter(Boolean); }); c.cx[f]=o; }
    else if(f==="csatLink"){ if(v&&!/^https?:\/\//i.test(v.trim())) return toast("The satisfaction link should start with https://"); c.cx[f]=v.trim(); }
    else if(f==="draftAutoCloseDays") c.cx[f]=Math.max(1,Number(v)||30);
    else if(f==="notReachableAutoClose") c.cx[f]=v==="yes";
    else c.cx[f]=lines(v); }
  c.tat={...(c.tat||{})}; for(const key of Object.keys(d).filter(x=>x.startsWith("tat."))) c.tat[key.slice(4)]=Math.max(1,Number(d[key])||TAT_DEFAULTS[key.slice(4)]);
  if("dialFormat" in d){ if(!d.dialFormat.includes("{number}")) return toast("The dial link needs {number} where the number goes."); c.dialFormat=d.dialFormat.trim(); }
  if("dialPrefix" in d) c.dialPrefix=d.dialPrefix.trim(); if("backupFolderId" in d) c.backupFolderId=d.backupFolderId.trim();
  if("sources" in d) c.sources=lines(d.sources); if("caseTypes" in d) c.caseTypes=lines(d.caseTypes); if("consequences" in d) c.consequences=lines(d.consequences);
  if(!c.caseTypes.includes("Callback request")) c.caseTypes.push("Callback request");
  if(c.consequences[0]!=="None") c.consequences=["None",...c.consequences.filter(x=>x!=="None")];
  if(c.work.start>=c.work.end) return toast("The day must end after it starts.");
  if(!await put("mod/core/config/main",c)) return;
  await addAudit("settings","main","Settings saved",null,null,Object.keys(d).join(", "));
  delete S.drafts.cfg; toast("Settings saved.");
}

/* ================= events ================= */
document.addEventListener("click",async e=>{
  const n=e.target.closest("[data-nav]"); if(n){ e.preventDefault(); go(n.dataset.nav); return; }
  if(e.target.closest("#menuBtn")){ document.body.classList.toggle("navopen"); return; }
  if(e.target.id==="scrim"){ document.body.classList.remove("navopen"); return; }
  const b=e.target.closest("[data-act]"); if(!b) return;
  const act=b.dataset.act; if(act!=="cxDial") e.preventDefault();
  if(["alertAck","alertLater","alertOpen"].includes(act)) return alertAction(act,b);
  if(["impTemplate","impClear","impRun","bkDrive","bkDownload"].includes(act)){ try{ await importAction(act,b); }finally{ render(true); } return; }
  if(["impOpen","impClose","impVen","impVenClear","impRestart","impGo"].includes(act)){ try{ await impAction(act,b); }finally{ render(true); } return; }
  if(act==="cxRepExport") return cxRepExport(b.dataset.k);
  if(act.startsWith("kpi")){ b.disabled=true; try{ await kpiAction(act,b); }finally{ b.disabled=false; render(true); } return; }
  if(act==="cxAutoAssign"){ if(!isQG()) return; const c=S.cases.find(x=>x.ref===b.dataset.ref); const who=qgAutoAssign(c.venture); if(!who) return toast("No Q&G team to assign to. Set one up in Staff list.");
    if(await patch("mod/cx/cases/"+c.ref,{assigneeId:who,timeline:[...(c.timeline||[]),ev("Q&G owner: "+personName(who),"Auto-assigned")]})) toast(personName(who)+" assigned."); return; }
  if(act.startsWith("ls")){ b.disabled=true; try{ await listAction(act,b); }finally{ b.disabled=false; render(true); } return; }
  if(act==="rrAdd"){ const ui=S.ui.rr2||(S.ui.rr2={tab:"standings"}); const v=b.dataset.v;
    if(v==="menu"){ ui.addMenu=!ui.addMenu; return render(true); } ui.addMenu=false;
    if(v==="part"){ ui.tab="people"; ui.editE=null; render(true); const el=$('[data-d="rrp-new"][data-f="groupId"]'); if(el){ el.scrollIntoView({block:"center"}); el.focus(); } return; }
    if(v==="nom"){ ui.tab="noms"; ui.editN=null; render(true); const el=$('[data-d="rrn-new"][data-f="groupId"]'); if(el){ el.scrollIntoView({block:"center"}); el.focus(); } return; }
    if(v==="appreciations"||v==="reviews"){ S.sel[v]="__new"; return go(v); }
    if(v==="programme"){ ui.newProg=true; return render(true); } return; }
  if(act.startsWith("rr")&&act!=="rrTab"&&act!=="rrNew"){ b.disabled=true; try{ await rrAction(act,b); }finally{ b.disabled=false; render(true); } return; }
  if(["linkNew","linkEdit","linkCancel","linkSave","rrTab","rrNew"].includes(act)){ try{ await linkAction(act,b); }finally{ render(true); } return; }
  if(act==="trashSt"||act==="trashRestore"){ b.disabled=true; try{ await trashAction(act,b); }finally{ b.disabled=false; render(true); } return; }
  if(act==="perfWho"){ S.ui.perf.who=S.ui.perf.who===b.dataset.id?null:b.dataset.id; return render(); }
  if(act==="setView"){ S.view=b.dataset.v; return render(); }
  if(act==="openEval") return openEvalInQA(b.dataset.id);
  if(act==="cxQueue"){ S.ui[b.dataset.k].q=b.dataset.q; return render(); }
  if(act==="cxOpen"){ S.sel[b.dataset.k]=b.dataset.ref; render(); $("#content").scrollTop=0; return; }
  if(act==="cxNew"){ S.sel[b.dataset.k]="__new"; return render(); }
  if(act==="cxBack"){ S.sel[b.dataset.k]=null; return render(); }
  if(act==="cxCreate"){ b.disabled=true; try{ await createCase(b.dataset.k); }finally{ b.disabled=false; } return; }
  if(act.startsWith("cx")){ if(act!=="cxDial") b.disabled=true; try{ await cxAction(act,b.dataset.ref,b); }finally{ b.disabled=false; render(true); } return; }
  if((act.startsWith("reg")&&!act.startsWith("regs"))||act==="trackBreach"||act==="trackAll"){ b.disabled=true; try{ await regAction(act,b); }finally{ b.disabled=false; render(); } return; }
  if(act.startsWith("pb")) return pbAction(act,b);
  if(act.startsWith("sop")) return sopAction(act,b);
  if(["staffTab","staffBack","personOpen","teamOpen","personNew","teamNew","personSave","personMove","personLeave","teamSave","importQA","linkSearch","linkPick","linkClear","accessSave","accessReset","bulkOpen","bulkAddRow","bulkDel","bulkSave","dupNotSame","teamSetLm","teamMakeQg"].includes(act)){ b.disabled=true; try{ await staffAction(act,b); }finally{ b.disabled=false; render(); } return; }
  if(["teamDays","teamWho","taskNew","taskCancel","taskBack","taskEdit","openItem","taskSave","taskStatus"].includes(act)){ b.disabled=true; try{ await workAction(act,b); }finally{ b.disabled=false; render(); } return; }
  if(act.startsWith("q")&&["qFilter","qNew","qEdit","qCreate","qAnswer","qStatus"].includes(act)){ await qAction(act,b); return render(); }
  if(act==="errFilter"){ S.ui.errors.st=b.dataset.v; return render(); }
  if(act==="errRetry"||act==="errResolve"){ b.disabled=true; try{ await errAction(act,b); }finally{ b.disabled=false; } return; }
  if(act==="cfgSave") return cfgSave();
  if(act==="qExport") return exportQuestions();
  if(act==="pickVenture") return setVenture(b.dataset.v);
  if(act==="vStepPick"||act==="vStepClear"){ vStepAction(act,b); return render(true); }
  if(["vNew","vEdit","vBack","vSave"].includes(act)){ b.disabled=true; try{ await ventureAction(act,b); }finally{ b.disabled=false; render(); } return; }
  if(act.startsWith("regs")){ b.disabled=true; try{ await regsAction(act,b); }finally{ b.disabled=false; render(); } return; }
  if(act==="guideTab"||act==="dlSave"){ await guideAction(act,b); return render(); }
});
document.addEventListener("keydown",e=>{ if(e.key==="Enter"&&e.target.matches("tr.click")) e.target.click(); });
function onField(e,commit){
  const el=e.target;
  if(el.dataset.bulk!==undefined){ bulkInput(el); if(commit) bulkRefresh(); return; }
  if(el.dataset.ui){ const [k,f]=el.dataset.ui.split("."); (S.ui[k]||(S.ui[k]={}))[f]=el.value; clearTimeout(onField.t); onField.t=setTimeout(()=>render(),el.type==="search"?250:0); return; }
  if(!el.dataset.d) return;
  const d=draft(el.dataset.d), f=el.dataset.f;
  if(el.dataset.multi!==undefined){ const base=()=>{ if(el.dataset.d==="cfg") return S.cfg.work.days.map(String); if(el.dataset.d.startsWith("rg-")){ const r=S.regs.find(x=>"rg-"+x.id===el.dataset.d); return r?r.ventures||[]:["all"]; } if(f==="internalActions") return []; const id=el.dataset.d.slice(2), p=S.staff[id]; if(f==="ventureAccess") return (p&&p.ventureAccess)||[]; return (p&&p.roles)||(el.dataset.d==="p-new"?["advisor"]:[]); };
    const cur=new Set((d[f]??base()).map(String)); el.checked?cur.add(el.dataset.multi):cur.delete(el.dataset.multi); d[f]=[...cur]; }
  else if(el.type==="checkbox") d[f]=el.checked;
  else if(el.type==="radio"){ if(el.checked) d[f]=el.value; }
  else d[f]=el.value;
  const c=S.cases.find(x=>x.ref===el.dataset.d); if(c&&canAct(c)&&!c.stageStartedAt&&commit) markStarted(c);
  if(commit&&(el.tagName==="SELECT"||el.type==="radio"||el.type==="checkbox"||((f==="mobile"||f==="dealRef")&&String(el.dataset.d).startsWith("new-")))) setTimeout(()=>render(true),0);
}
document.addEventListener("input",e=>onField(e,false));
document.addEventListener("change",async e=>{
  const el=e.target;
  if(el.id==="vsel"){ setVenture(el.value); return; }
  if(el.dataset.assign!==undefined){ await assignCase(el.dataset.assign,el.value); return render(true); }
  if((el.dataset.cxnewfile||el.dataset.cxfile)&&el.files.length&&ASSETS){ const files=[]; for(const f of el.files){ if(f.size>20*1024*1024){ toast(f.name+" is over 20 MB."); continue; } try{ const a=await ASSETS.upload(f); files.push({id:a.id,name:f.name,type:f.type,size:f.size,at:nowMs(),byName:S.meName}); }catch(e){ logError("upload","Upload failed: "+f.name,{name:f.name},e); } }
    if(el.dataset.cxnewfile){ const d=draft(el.dataset.cxnewfile); d.files=[...(d.files||[]),...files]; }
    else { const cc=S.cases.find(x=>x.ref===el.dataset.cxfile); if(cc&&files.length) await patch("mod/cx/cases/"+cc.ref,{files:[...(cc.files||[]),...files],updatedAt:nowMs(),timeline:[...(cc.timeline||[]),ev("Documents added",files.map(f=>f.name).join(", "))]}); }
    toast(files.length+" file"+(files.length===1?"":"s")+" attached."); return render(true); }
  if(el.dataset.lsauto!==undefined){ await listAuto(el); return render(true); }
  if(el.dataset.kpi!==undefined){ if(kpiInput(el)) return; }
  if(el.dataset.impmap!==undefined&&S.ui.imp3){ S.ui.imp3.mapping[el.dataset.impmap]=el.value; return render(true); }
  if(el.dataset.imp3file&&el.files[0]){ await impReadFile(el.dataset.imp3file,el.files[0]); return render(true); }
  if(el.dataset.rrscore||el.dataset.rrpanel||el.dataset.rrfile){ if(await rrChange(el)) render(true); return; }
  if(el.dataset.recfile&&el.files.length){ await uploadRecFiles(el.dataset.recfile,[...el.files]); return render(true); }
  if(el.dataset.impfile&&el.files[0]){ await readImportFile(el.files[0]); return render(true); }
  if(el.dataset.upload&&el.files[0]){ await uploadCorrespondence(el.dataset.upload,el.files[0]); return render(); }
  if(el.dataset.sopfile&&el.files[0]){ if(!ASSETS) return; try{ const a=await ASSETS.upload(el.files[0]); const d=draft(el.dataset.sopfile); d.assetId=a.id; d.assetName=el.files[0].name; toast("Uploaded."); render(); }catch(err){ logError("upload","SOP upload failed",{name:el.files[0].name},err); toast("Upload failed. It's in the error report."); } return; }
  onField(e,true);
});
document.addEventListener("focusout",()=>{ setTimeout(()=>{ if(pendingRender&&!typing()) render(); },50); });

/* ================= boot ================= */
const SESSION=rid();
function sub(q,fn,label){ return q.onSnapshot(fn,err=>{ const b=$("#banner"); b.hidden=false; b.textContent=label+" couldn't load. Reload the page to try again."; }); }
let rT; const soon=()=>{ clearTimeout(rT); rT=setTimeout(render,60); };
async function boot(){
  try{ S.section=localStorage.getItem("qg2-sec")||"home"; S.venture=localStorage.getItem("qg2-venture")||""; }catch(_){}
  renderVentureSel();
  if(!NAVMAP[S.section]) S.section="home";
  render();
  const [db,user,mcp,assets,downloads]=await Promise.all([realUse("db"),realUse("user"),realUse("mcp"),realUse("assets"),realUse("downloads")]);
  DB=db; USER=user; MCP=mcp; ASSETS=assets; DOWNLOADS=downloads;
  if(user){ try{ const m=await user.me(); S.uid=m.id; S.meName=m.name||""; S.meEmail=m.email||""; }catch(_){} try{ S.admin=!!(await user.isOwner()); }catch(_){} }
  $("#who").innerHTML=`<span class="av">${esc((S.meName||"?").slice(0,1).toUpperCase())}</span><span class="nm"></span>`; $("#who .nm").textContent=S.meName+(S.admin?" · Admin":isQG()?" · Q&G":"");
  if(!db){ S.ready.boot=true; return render(); }
  sub(db.doc("mod/core/config/main"),s=>{ if(s.exists){ const c=s.data(); S.cfg={...clone(DEFAULT_CFG),...c,work:{...DEFAULT_CFG.work,...(c.work||{})},sla:{...DEFAULT_CFG.sla,...(c.sla||{})}}; S.cfg.ventures=(S.cfg.ventures||[]).map(v=>({...(DEFAULT_CFG.ventures.find(x=>x.id===v.id)||{}),...v})); } renderVentureSel(); soon(); },"Settings");
  sub(db.collection("mod/core/staff"),s=>{ S.staff={}; s.docs.forEach(d=>S.staff[d.id]=d.data()); S.ready.staff=true; renderVentureSel(); $("#who .nm")&&($("#who .nm").textContent=S.meName+(S.admin?" · Admin":isQG()?" · Q&G":"")); soon(); },"Staff list");
  sub(db.collection("mod/core/teams"),s=>{ S.teams={}; s.docs.forEach(d=>S.teams[d.id]=d.data()); renderVentureSel(); soon(); },"Teams");
  sub(db.collection("mod/cx/cases"),s=>{ S.cases=s.docs.map(d=>d.data()); soon(); },"Customer cases");
  sub(db.collection("mod/reg/records"),s=>{ S.recs=s.docs.map(d=>d.data()); soon(); },"Records");
  sub(db.collection("mod/pb/playbooks"),s=>{ S.playbooks={}; s.docs.forEach(d=>S.playbooks[d.id]=d.data()); soon(); },"Playbooks");
  sub(db.collection("mod/perf/tat"),s=>{ S.tatLog=s.docs.map(d=>d.data()); soon(); setTimeout(()=>showAlerts(false),300); },"Time limit log");
  if(S.admin){ sub(db.collection("mod/sys/trash"),s=>{ S.trash=s.docs.map(d=>d.data()); soon(); },"Recycle bin"); sub(db.collection("mod/qa/trash"),s=>{ S.qaTrash=s.docs.map(d=>d.data()); soon(); },"QA deleted evaluations"); }
  if(S.admin) sub(db.collection("mod/sys/backups"),s=>{ S.backups=s.docs.map(d=>d.data()); soon(); },"Backups");
  sub(db.collection("mod/sys/imports"),s=>{ S.imports=s.docs.map(d=>d.data()); soon(); },"Upload history");
  sub(db.collection("mod/rr/programmes"),s=>{ S.rrProgs=s.docs.map(d=>d.data()); soon(); },"Recognition programmes");
  sub(db.collection("mod/rr/entries"),s=>{ S.rrEntries=s.docs.map(d=>d.data()); soon(); },"Recognition entries");
  sub(db.collection("mod/lib/links"),s=>{ S.links=s.docs.map(d=>d.data()); soon(); },"Linked dashboards");
  sub(db.collection("mod/lib/regs"),s=>{ S.regs=s.docs.map(d=>d.data()); soon(); },"Regulations");
  sub(db.collection("mod/lib/designlog"),s=>{ S.designlog=s.docs.map(d=>d.data()); soon(); },"Design log");
  sub(db.collection("mod/work/tasks"),s=>{ S.tasks=s.docs.map(d=>d.data()); soon(); },"Tasks");
  sub(db.collection("mod/pb/questions"),s=>{ S.questions=s.docs.map(d=>d.data()); soon(); },"Open questions");
  sub(db.collection("mod/sop/docs"),s=>{ S.sops=s.docs.map(d=>d.data()); soon(); },"SOPs");
  sub(db.collection("mod/qa/evaluations").orderBy("createdAt","desc").limit(1000),s=>{ S.evals=s.docs.map(d=>d.data()).filter(e=>e&&e.status!=="deleted"); soon(); },"QA evaluations");
  if(S.admin){
    sub(db.collection("mod/sys/errors").orderBy("at","desc").limit(300),s=>{ S.errors=s.docs.map(d=>({...d.data(),_id:d.id})); soon(); },"Error report");
    sub(db.collection("mod/sys/outbox").orderBy("at","desc").limit(300),s=>{ S.outbox=s.docs.map(d=>d.data()); soon(); },"Email log");
    sub(db.collection("mod/core/audit").orderBy("at","desc").limit(500),s=>{ S.audit=s.docs.map(d=>d.data()); soon(); },"Audit log");
  }
  if(!S.admin){ S.section="mywork"; }
  if(S.venture&&!ventures().some(v=>v.id===S.venture)) S.venture="";
  S.ready.boot=true; renderVentureSel(); render();
  setTimeout(sweep,20000); setInterval(sweep,5*60000);
  setTimeout(dailyBackupCheck,25000);
  setInterval(()=>showAlerts(false),120000);
  setInterval(()=>{ if(!typing()) render(); },60000);
}
boot();

function lastActivity(sec){
  const up=x=>[x.updatedAt,x.createdAt,x.at];
  if(sec==="complaints"||sec==="callbacks") return lastOf(cxCases(sec).map(up));
  if(REG[sec]) return lastOf(recsOf(sec).map(up));
  if(sec==="links") return lastOf(S.links.map(up));
  if(sec==="lists") return lastOf(S.audit.filter(a=>a.entity==="lists").map(a=>a.at));
  if(sec==="rr") return lastOf(S.rrEntries.map(up),S.rrProgs.map(p=>(p.history||[]).map(h=>h.at)));
  if(sec==="calls"||sec==="emails") return lastOf(evalsV().filter(e=>(sec==="emails")===/email/i.test(e.channel||"")).map(e=>[e.updatedAt,e.createdAt]));
  if(sec==="sops") return lastOf(S.sops.flatMap(s=>(s.versions||[]).map(v=>v.at)));
  if(sec==="regulations") return lastOf(regsV().map(up));
  if(sec==="staff"||sec==="structure") return lastOf(Object.values(S.staff).map(up),Object.values(S.teams).map(up));
  if(sec==="mywork"||sec==="team") return lastOf(S.tasks.map(up),S.cases.map(up),S.recs.map(up));
  if(sec==="questions") return lastOf(S.questions.map(q=>[q.askedAt,q.answeredAt,q.parkedAt,q.reopenedAt]));
  if(sec==="guide") return lastOf(S.designlog.map(e=>e.at),((S.playbooks.guide||{}).versions||[]).map(v=>v.at));
  if(sec==="trash") return lastOf(S.trash.map(t=>[t.deletedAt,t.restoredAt]),S.qaTrash.map(t=>t.deletedAt));
  if(sec==="errors") return lastOf(S.errors.map(up)); if(sec==="outbox") return lastOf(S.outbox.map(up)); if(sec==="audit") return lastOf(S.audit.map(up));
  if(sec==="home") return lastOf(S.cases.map(up),S.recs.map(up),S.evals.map(e=>[e.updatedAt,e.createdAt]),S.tasks.map(up));
  return NaN;
}
