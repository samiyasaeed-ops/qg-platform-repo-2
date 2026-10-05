/* ================= Ventures and venture scope ================= */
const V_DEFAULTS={insurancemarket:{code:"IM",color:"#1E5AA8",domain:"insurancemarket.ae"},creditmarket:{code:"CM",color:"#6B3FA0",domain:"creditmarket.ae"},holidaymarket:{code:"HM",color:"#0E8C8C",domain:"holidaymarket.ae"}};
function ventures(all){ return S.cfg.ventures.filter(v=>all||v.isActive!==false).map(v=>({...(V_DEFAULTS[v.id]||{}),...v})); }
function vInfo(id){ return ventures(true).find(v=>v.id===id)||{id,name:id||"Unassigned",code:(id||"?").slice(0,2).toUpperCase(),color:"#5B6B73"}; }
function allowedVentures(){
  const all=ventures().map(v=>v.id);
  if(S.admin) return all;
  const me=meStaff(); if(!me) return [];
  if((me.ventureAccess||[]).length) return me.ventureAccess.filter(v=>all.includes(v));
  const t=teamOf(me); if(!t) return [];
  return t.kind==="qg"?all:[t.venture].filter(v=>all.includes(v));
}
const inV=v=>S.venture?v===S.venture:(S.admin||allowedVentures().includes(v));
/* palette from one brand colour */
const hx=h=>{ h=String(h||"#5B6B73").replace("#",""); if(h.length===3) h=h.split("").map(c=>c+c).join(""); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)||0); };
const toHx=a=>"#"+a.map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,"0")).join("");
const mix=(a,b,t)=>toHx(hx(a).map((x,i)=>x+(hx(b)[i]-x)*t));
function venturePalette(c){ return {accent:c,accentHi:mix(c,"#ffffff",.45),accentSoft:mix(c,"#ffffff",.88),accentSoftDark:mix(c,"#121c22",.78),chrome:mix(c,"#0a0f14",.72),chrome2:mix(c,"#0a0f14",.62),line:mix(c,"#0a0f14",.45)}; }
function applyTheme(){
  const r=document.documentElement.style, keys=["--chrome","--chrome-2","--accent","--accent-hi","--accent-soft","--accent-line"];
  if(!S.venture){ keys.forEach(k=>r.removeProperty(k)); document.body.removeAttribute("data-venture"); }
  else { const v=vInfo(S.venture), p=venturePalette(v.color); r.setProperty("--chrome",p.chrome); r.setProperty("--chrome-2",p.chrome2); r.setProperty("--accent",p.accent); r.setProperty("--accent-hi",p.accentHi); r.setProperty("--accent-soft",matchMedia("(prefers-color-scheme: dark)").matches&&document.documentElement.getAttribute("data-theme")!=="light"||document.documentElement.getAttribute("data-theme")==="dark"?p.accentSoftDark:p.accentSoft); r.setProperty("--accent-line",p.line); document.body.setAttribute("data-venture",S.venture); }
  const bv=$("#brandV"); if(bv) bv.innerHTML=S.venture?`<span class="bv" style="--vc:${esc(vInfo(S.venture).color)}">${esc(vInfo(S.venture).name)}</span>`:"Alfred Holdings";
  themeQA();
}
function themeQA(){
  try{ const d=qaFrame&&qaFrame.contentDocument; if(!d) return; const st=d.documentElement.style;
    if(S.venture){ const p=venturePalette(vInfo(S.venture).color); st.setProperty("--brand",p.accent); st.setProperty("--focus",p.accent); }
    else { st.removeProperty("--brand"); st.removeProperty("--focus"); } }catch(_){}
}
const vOfLob=l=>String(l||"").split("|")[0]||"";
const vChip=id=>{ const v=vInfo(id); return `<span class="vchip" style="--vc:${esc(v.color)}">${esc(v.code)}</span>`; };
function evalsV(){ return S.evals.filter(e=>inV(e.ventureId||"insurancemarket")); }
function setVenture(v){
  S.venture=v||""; try{ localStorage.setItem("qg2-venture",S.venture); }catch(_){}
  try{ if(qaFrame&&qaFrame.contentWindow&&qaFrame.contentWindow.setScope) qaFrame.contentWindow.setScope(S.venture||"all"); }catch(_){}
  Object.keys(S.sel).forEach(k=>S.sel[k]=null);
  Object.keys(S.drafts).filter(k=>k.startsWith("new-")||k.startsWith("r-new-")).forEach(k=>delete S.drafts[k]);
  renderVentureSel(); render(true);
}
function renderVentureSel(){
  const el=$("#vsel"); if(!el) return;
  const allowed=allowedVentures();
  if(S.ready.staff||S.admin){ if(allowed.length===1) S.venture=allowed[0]; else if(S.venture&&!allowed.includes(S.venture)) S.venture=""; }
  el.innerHTML=(allowed.length>1?`<option value="">${S.admin?"All ventures":"All my ventures"}</option>`:"")+ventures().filter(v=>allowed.includes(v.id)).map(v=>`<option value="${esc(v.id)}"${S.venture===v.id?" selected":""}>${esc(v.name)}</option>`).join("")+(!allowed.length?`<option value="">No venture access</option>`:"");
  el.disabled=allowed.length<=1;
  document.body.style.setProperty("--scope",S.venture?vInfo(S.venture).color:"transparent");
  applyTheme();
}
/* venture-first entry: one block used by every new-record form */
function ventureStep(k,current,locked){
  const allowed=allowedVentures(), v=locked||current;
  if(v) return `<div class="vstep"><span>Venture</span>${vChip(v)} <b>${esc(vInfo(v).name)}</b>${!locked&&!S.venture?` <button class="linkbtn" data-act="vStepClear" data-k="${esc(k)}">Change</button>`:""}${S.venture&&allowed.length>1?`<span class="hint" style="margin:0">To register for another venture, switch the venture at the top.</span>`:""}</div>`;
  return `<div class="vstep pick"><b>Choose the venture first</b><p class="hint">The rest of the form only offers that venture's lines of business, teams and people, so records can't cross ventures.</p><div class="row">${ventures().filter(x=>allowed.includes(x.id)).map(x=>`<button class="btn vbtn" style="--vc:${esc(x.color)}" data-act="vStepPick" data-k="${esc(k)}" data-v="${esc(x.id)}">${vChip(x.id)} ${esc(x.name)}</button>`).join("")}</div></div>`;
}
function formVenture(k){ return S.venture||(S.drafts[k]&&S.drafts[k].venture)||""; }
function lobsFor(v){ const x=vInfo(v); return (x.lobs||[]).map(l=>({v:v+"|"+l,l})); }
function staffFor(v,date){ return staffList(date).filter(p=>{ const t=teamOf(p,date); return t&&(t.kind==="qg"||t.venture===v); }); }
function scopeLabel(){ return S.venture?vInfo(S.venture).name:"All ventures"; }

/* ---- Ventures admin ---- */
function viewVentures(){
  const ui=S.ui.ventures||(S.ui.ventures={edit:null});
  const vs=ventures(true);
  if(ui.edit) return ventureForm(ui.edit==="__new"?null:vs.find(v=>v.id===ui.edit));
  return `<p class="lead">Every section, list and report is scoped by venture. Add a venture here and it appears in the venture filter, in every form's line of business list, in the Regulations library and in the QA Evaluation tool.</p>
  <div class="row"><button class="btn primary" data-act="vNew">Add a venture</button></div>
  <div class="tbl" style="margin-top:12px"><table><thead><tr><th>Venture</th><th>Code</th><th>Website</th><th>Lines of business</th><th>Head of Product</th><th>Regulators</th><th>QA benchmark</th><th>Status</th></tr></thead><tbody>
  ${vs.map(v=>`<tr class="click" data-act="vEdit" data-id="${esc(v.id)}" tabindex="0"><td><b>${esc(v.name)}</b></td><td>${vChip(v.id)}</td><td>${esc(v.domain||"")}</td><td class="wrap">${esc((v.lobs||[]).join(", "))}</td><td>${v.headOfProductId?esc(personName(v.headOfProductId)):'<span class="tag amb">Not set</span>'}</td><td class="wrap">${esc((v.regulators||[]).join(", "))}</td><td>${esc(v.benchmarkPassingScore??85)}%</td><td>${v.isActive===false?'<span class="tag">Inactive</span>':'<span class="tag ok">Active</span>'}</td></tr>`).join("")}</tbody></table></div>`;
}
function ventureForm(v){
  const k=v?"v-"+v.id:"v-new";
  return `<div class="crumbs"><button class="linkbtn" data-act="vBack">Ventures</button> / ${v?esc(v.name):"New venture"}</div><h2 class="h2">${v?esc(v.name):"Add a venture"}</h2>
  <div class="form"><div class="g3"><label class="f"><span class="req">Venture name</span><input data-d="${k}" data-f="name" value="${esc(dv(k,"name",v&&v.name))}" placeholder="For example, PropertyMarket.ae"></label>
    <label class="f"><span class="req">Short code</span><input data-d="${k}" data-f="code" maxlength="4" value="${esc(dv(k,"code",v&&v.code))}" placeholder="PM"></label>
    <label class="f"><span>Website</span><input data-d="${k}" data-f="domain" value="${esc(dv(k,"domain",v&&v.domain))}" placeholder="propertymarket.ae"></label></div>
   <div class="g3"><label class="f"><span>Brand colour (the platform theme is built from it)</span><input type="color" data-d="${k}" data-f="color" value="${esc(dv(k,"color",(v&&v.color)||"#5B6B73"))}"></label>
    <label class="f"><span>QA passing benchmark (%)</span><input type="number" min="1" max="100" data-d="${k}" data-f="bench" value="${esc(dv(k,"bench",v?v.benchmarkPassingScore??85:85))}"></label>
    <label class="f"><span>Status</span><select data-d="${k}" data-f="active">${opts([{v:"yes",l:"Active"},{v:"no",l:"Inactive"}],dv(k,"active",v&&v.isActive===false?"no":"yes"))}</select></label></div>
   ${(()=>{ const p=venturePalette(dv(k,"color",(v&&v.color)||"#5B6B73")); return `<div class="swatch"><span style="background:${p.chrome}">Top bar</span><span style="background:${p.chrome2}">Menu</span><span style="background:${p.accent}">Buttons</span><span style="background:${p.accentSoft};color:#13212A">Highlights</span></div>`; })()}
   <label class="f"><span class="req">Lines of business, one per line</span><textarea rows="5" data-d="${k}" data-f="lobs">${esc(dv(k,"lobs",v?(v.lobs||[]).join("\n"):""))}</textarea></label>
   <label class="f"><span>Head of Product (receives journey test findings)</span><select data-d="${k}" data-f="headOfProductId">${opts(staffList().map(p=>({v:p.id,l:p.name})),dv(k,"headOfProductId",v&&v.headOfProductId),"Not set")}</select></label>
   <label class="f"><span>Regulators and authorities, one per line</span><textarea rows="4" data-d="${k}" data-f="regulators">${esc(dv(k,"regulators",v?(v.regulators||[]).join("\n"):""))}</textarea></label>
   ${v?`<p class="hint">Records already saved keep their venture and line of business. Removing a line of business only stops it being offered for new records.</p>`:""}
   <div class="row"><button class="btn primary" data-act="vSave"${v?` data-id="${esc(v.id)}"`:""}>${v?"Save venture":"Add venture"}</button><button class="btn" data-act="vBack">Cancel</button></div></div>`;
}
async function ventureAction(act,el){
  const ui=S.ui.ventures||(S.ui.ventures={});
  if(act==="vNew"){ ui.edit="__new"; return; }
  if(act==="vEdit"){ ui.edit=el.dataset.id; return; }
  if(act==="vBack"){ ui.edit=null; return; }
  if(act!=="vSave"||!S.admin) return;
  const id=el.dataset.id, cur=id?ventures(true).find(v=>v.id===id):null, k=cur?"v-"+cur.id:"v-new", d=draft(k);
  const L=s=>String(s||"").split("\n").map(x=>x.trim()).filter(Boolean);
  const name=String(d.name??(cur&&cur.name)??"").trim(), code=String(d.code??(cur&&cur.code)??"").trim().toUpperCase(), lobsL=L(d.lobs??(cur?(cur.lobs||[]).join("\n"):""));
  if(!name||!code||!lobsL.length) return toast("Add the venture name, a short code and at least one line of business.");
  const nid=cur?cur.id:name.toLowerCase().replace(/\.[a-z]+$/,"").replace(/[^a-z0-9]+/g,"");
  if(!cur&&ventures(true).some(v=>v.id===nid||v.code===code)) return toast("A venture with that name or code already exists.");
  const nv={id:nid,name,code,domain:String(d.domain??(cur&&cur.domain)??"").trim(),color:d.color??(cur&&cur.color)??"#5B6B73",lobs:lobsL,regulators:L(d.regulators??(cur?(cur.regulators||[]).join("\n"):"")),benchmarkPassingScore:Number(d.bench??(cur?cur.benchmarkPassingScore??85:85))||85,headOfProductId:d.headOfProductId??(cur&&cur.headOfProductId)??null,isActive:(d.active??(cur&&cur.isActive===false?"no":"yes"))!=="no"};
  const list=cur?S.cfg.ventures.map(v=>v.id===cur.id?{...v,...nv}:v):[...S.cfg.ventures,nv];
  if(!await put("mod/core/config/main",{...S.cfg,ventures:list})) return;
  await addAudit("venture",nid,cur?"Edited":"Added",cur||null,nv,name);
  await syncQAVentures(list);
  delete S.drafts[k]; ui.edit=null; toast(cur?"Saved.":name+" added.");
}
async function syncQAVentures(list){
  try{
    const ref=DB.doc("mod/qa/settings/main"), s=await ref.get(); if(!s.exists) return;
    const qv=(s.data().ventures||[]).map(x=>({...x}));
    for(const v of list){ const i=qv.findIndex(x=>x.id===v.id), base={id:v.id,name:v.name,code:v.code,domain:v.domain||"",color:v.color,lobs:v.lobs,isActive:v.isActive!==false,benchmarkPassingScore:v.benchmarkPassingScore??85};
      if(i>=0) qv[i]={...qv[i],...base}; else qv.push(base); }
    await ref.update({ventures:qv});
  }catch(e){ logError("sync","Couldn't update ventures in the QA Evaluation tool",{op:"syncQAVentures"},e); }
}

/* ================= Regulations library ================= */
const REG_TYPES=["Federal law","Regulation","Standards","Circular","Resolution","Guidance","Local law","Policy directive"];
const REG_STATUS=["In force","Repealed","Superseded","Pending","Verify"];
function regsV(){ return S.regs.filter(r=>!S.venture||(r.ventures||[]).includes("all")||(r.ventures||[]).includes(S.venture)); }
function viewRegulations(){
  const ui=S.ui.regs||(S.ui.regs={reg:"",st:"In force",q:""}), sel=S.sel.regs;
  if(sel){ const r=sel==="__new"?null:S.regs.find(x=>x.id===sel); if(sel!=="__new"&&!r) return `<p class="emptybox">Saving…</p>`; return regDocView(r); }
  const all=regsV(), regulators=[...new Set(all.map(r=>r.regulator))].sort();
  const list=all.filter(r=>!ui.reg||r.regulator===ui.reg).filter(r=>!ui.st||r.status===ui.st).filter(r=>!ui.q||norm([r.title,r.refNo,r.summary,r.obligations].join(" ")).includes(norm(ui.q)));
  const groups=[...new Set(list.map(r=>r.regulator))].sort();
  return `<div class="callout amb">This library summarises the rules Q&G works to. It is a working reference, not legal advice. Check each instrument against the official source linked on it, and have Compliance confirm anything marked Verify.</div>
  <div class="tools"><div class="chips">${["In force","Verify","Superseded","Repealed",""].map(s=>`<button class="chip" data-act="regsSt" data-v="${s}" aria-pressed="${ui.st===s}">${s||"All"} <span class="cnt">${all.filter(r=>!s||r.status===s).length}</span></button>`).join("")}</div>
   <div class="row"><input type="search" class="grow" placeholder="Search title, reference or obligation" data-ui="regs.q" value="${esc(ui.q)}"><select data-ui="regs.reg">${opts(regulators,ui.reg,"All authorities")}</select>${S.admin?`<button class="btn primary" data-act="regsNew">Add an instrument or circular</button>`:""}</div></div>
  ${S.venture?`<p class="hint">Showing rules that apply to ${esc(scopeLabel())}, including group-wide rules.</p>`:`<p class="hint">Showing every venture. Pick a venture at the top to see only the rules that apply to it.</p>`}
  ${groups.length?groups.map(g=>`<section class="sect"><h2 class="h3">${esc(g)}</h2><div class="tbl"><table><thead><tr><th>Instrument</th><th>Reference</th><th>Type</th><th>Effective</th><th>Applies to</th><th>Status</th><th>Last updated</th></tr></thead><tbody>
    ${list.filter(r=>r.regulator===g).sort((a,b)=>String(b.effective||"").localeCompare(String(a.effective||""))).map(r=>`<tr class="click" data-act="regsOpen" data-id="${esc(r.id)}" tabindex="0"><td class="wrap"><b>${esc(r.title)}</b></td><td>${esc(r.refNo)}</td><td>${esc(r.type)}</td><td>${esc(fmtD(r.effective))}</td><td>${(r.ventures||[]).includes("all")?'<span class="tag">Group-wide</span>':(r.ventures||[]).map(vChip).join(" ")}</td><td><span class="tag ${r.status==="In force"?"ok":r.status==="Verify"?"amb":r.status==="Pending"?"cx":""}">${esc(r.status)}</span></td><td>${stampCell(r.updatedAt)}</td></tr>`).join("")}</tbody></table></div></section>`).join(""):`<div class="emptybox">No instruments in this view.</div>`}`;
}
function regDocView(r){
  const k=r?"rg-"+r.id:"rg-new", ui=S.ui[k]||(S.ui[k]={edit:!r});
  if(ui.edit&&S.admin){
    const vs=dv(k,"ventures",r?r.ventures:["all"]);
    return `<div class="crumbs"><button class="linkbtn" data-act="regsBack">Regulations</button> / ${r?esc(r.title):"New"}</div><h2 class="h2">${r?"Edit "+esc(r.title):"Add an instrument or circular"}</h2>
    <div class="form"><label class="f"><span class="req">Title</span><input data-d="${k}" data-f="title" value="${esc(dv(k,"title",r&&r.title))}"></label>
     <div class="g3"><label class="f"><span class="req">Authority</span><input data-d="${k}" data-f="regulator" list="regulatorList" value="${esc(dv(k,"regulator",r&&r.regulator))}"><datalist id="regulatorList">${[...new Set(S.regs.map(x=>x.regulator).concat(ventures().flatMap(v=>v.regulators||[])))].map(x=>`<option value="${esc(x)}">`).join("")}</datalist></label>
      <label class="f"><span class="req">Reference number</span><input data-d="${k}" data-f="refNo" value="${esc(dv(k,"refNo",r&&r.refNo))}" placeholder="For example, C 3/2026"></label>
      <label class="f"><span>Type</span><select data-d="${k}" data-f="type">${opts(REG_TYPES,dv(k,"type",r?r.type:"Circular"))}</select></label></div>
     <div class="g3"><label class="f"><span>Issued</span><input type="date" data-d="${k}" data-f="issued" value="${esc(dv(k,"issued",r&&r.issued))}"></label><label class="f"><span>Effective</span><input type="date" data-d="${k}" data-f="effective" value="${esc(dv(k,"effective",r&&r.effective))}"></label><label class="f"><span>Status</span><select data-d="${k}" data-f="status">${opts(REG_STATUS,dv(k,"status",r?r.status:"In force"))}</select></label></div>
     <fieldset class="f"><legend>Applies to</legend><div class="row"><label class="radio"><input type="checkbox" data-d="${k}" data-f="ventures" data-multi="all"${vs.includes("all")?" checked":""}> Group-wide</label>${ventures(true).map(v=>`<label class="radio"><input type="checkbox" data-d="${k}" data-f="ventures" data-multi="${esc(v.id)}"${vs.includes(v.id)?" checked":""}> ${esc(v.name)}</label>`).join("")}</div></fieldset>
     <label class="f"><span>Official link</span><input type="url" data-d="${k}" data-f="link" value="${esc(dv(k,"link",r&&r.link))}"></label>
     <label class="f"><span class="req">Summary</span><textarea rows="3" data-d="${k}" data-f="summary">${esc(dv(k,"summary",r&&r.summary))}</textarea></label>
     <label class="f"><span>Key obligations for us, one per line</span><textarea rows="6" data-d="${k}" data-f="obligations">${esc(dv(k,"obligations",r&&r.obligations))}</textarea></label>
     <label class="f"><span>Article references, one per line as “Art. 5(3): what it says”</span><textarea rows="4" data-d="${k}" data-f="articles">${esc(dv(k,"articles",r&&r.articles))}</textarea></label>
     <label class="f"><span>Where Q&G checks this on the platform</span><input data-d="${k}" data-f="controls" value="${esc(dv(k,"controls",r&&r.controls))}" placeholder="For example, Call evaluations, Complaints management"></label>
     <label class="f"><span>Replaces or replaced by</span><input data-d="${k}" data-f="supersedes" value="${esc(dv(k,"supersedes",r&&r.supersedes))}"></label>
     <label class="f"><span class="req">What changed and why</span><input data-d="${k}" data-f="note" value="${esc(dv(k,"note",r?"":"Added"))}"></label>
     <div class="row"><button class="btn primary" data-act="regsSave"${r?` data-id="${esc(r.id)}"`:""}>${r?"Save":"Add"}</button><button class="btn" data-act="${r?"regsCancel":"regsBack"}"${r?` data-id="${esc(r.id)}"`:""}>Cancel</button></div></div>`;
  }
  const lines=s=>String(s||"").split("\n").map(x=>x.trim()).filter(Boolean);
  return `<div class="crumbs"><button class="linkbtn" data-act="regsBack">Regulations</button> / ${esc(r.refNo||r.title)}</div>
  <h2 class="h2">${esc(r.title)} <span class="tag ${r.status==="In force"?"ok":r.status==="Verify"?"amb":""}">${esc(r.status)}</span></h2>
  <p class="lead">${esc(r.regulator)} · ${esc(r.type)} · ${esc(r.refNo)}${r.effective?" · effective "+esc(fmtD(r.effective)):""}</p>
  <div class="split"><div class="prose"><p>${esc(r.summary)}</p>
   ${lines(r.obligations).length?`<h3>Key obligations for us</h3><ul>${lines(r.obligations).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
   ${lines(r.articles).length?`<h3>Article references</h3><ul>${lines(r.articles).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
   ${r.supersedes?`<h3>Replaces or replaced by</h3><p>${esc(r.supersedes)}</p>`:""}</div>
  <aside class="timeline">${kv([["Applies to",(r.ventures||[]).includes("all")?"Group-wide":(r.ventures||[]).map(v=>esc(vInfo(v).name)).join(", ")],["Issued",esc(fmtD(r.issued))],["Where Q&G checks it",esc(r.controls)],["Official source",r.link?`<a href="${esc(r.link)}" target="_blank" rel="noopener">Open</a>`:""]])}
   <h3 style="margin-top:12px">Change history</h3><ol>${[...(r.history||[])].reverse().map(h=>`<li><b>${esc(h.note)}</b><small>${esc(h.byName)}, ${esc(fmtDT(h.at))}</small></li>`).join("")}</ol>
   ${S.admin?`<button class="btn" data-act="regsEdit" data-id="${esc(r.id)}">Edit</button>`:""}</aside></div>`;
}
async function regsAction(act,el){
  const id=el.dataset.id, ui=S.ui.regs||(S.ui.regs={});
  if(act==="regsSt"){ ui.st=el.dataset.v; return; }
  if(act==="regsOpen"){ S.sel.regs=id; return; }
  if(act==="regsBack"){ S.sel.regs=null; return; }
  if(act==="regsNew"){ S.sel.regs="__new"; S.ui["rg-new"]={edit:true}; return; }
  if(act==="regsEdit"){ S.ui["rg-"+id]={edit:true}; return; }
  if(act==="regsCancel"){ S.ui["rg-"+id]={edit:false}; return; }
  if(act!=="regsSave"||!S.admin) return;
  const r=id?S.regs.find(x=>x.id===id):null, k=r?"rg-"+r.id:"rg-new", d=draft(k);
  const g=f=>String(d[f]??(r&&r[f])??"").trim();
  const doc={title:g("title"),regulator:g("regulator"),refNo:g("refNo"),type:d.type??(r?r.type:"Circular"),issued:g("issued"),effective:g("effective"),status:d.status??(r?r.status:"In force"),ventures:d.ventures??(r?r.ventures:["all"]),link:g("link"),summary:g("summary"),obligations:g("obligations"),articles:g("articles"),controls:g("controls"),supersedes:g("supersedes"),updatedAt:nowMs()};
  const note=String(d.note??(r?"":"Added")).trim();
  if(!doc.title||!doc.regulator||!doc.refNo||!doc.summary||!note) return toast("Add the title, authority, reference, summary and what changed.");
  if(!doc.ventures.length) return toast("Choose which ventures it applies to.");
  const nid=r?r.id:rid("rg-");
  if(!await put("mod/lib/regs/"+nid,{...(r||{}),...doc,id:nid,history:[...((r&&r.history)||[]),{at:nowMs(),byName:S.meName,note}]})) return;
  await addAudit("regulation",nid,r?"Edited":"Added",null,null,doc.refNo+": "+note);
  delete S.drafts[k]; S.ui[k]={edit:false}; S.sel.regs=nid; toast("Saved.");
}

/* ================= Platform guide and design log ================= */
function viewGuide(){
  const ui=S.ui.guide||(S.ui.guide={tab:"guide"});
  const tabs=`<div class="chips" style="margin-bottom:14px">${[["guide","Platform guide"],["log","Design log"]].map(([k,l])=>`<button class="chip" data-act="guideTab" data-v="${k}" aria-pressed="${ui.tab===k}">${l}</button>`).join("")}</div>`;
  if(ui.tab==="guide") return tabs+viewPlaybook("guide");
  const k="dl-new", list=[...S.designlog].sort((a,b)=>(b.at||0)-(a.at||0));
  return tabs+`<p class="lead">Every requirement and decision that shaped the platform, in the order it was given. Use it to see why something works the way it does before changing it.</p>
   ${S.admin?`<details class="inset"><summary>Add an entry</summary><div class="form"><label class="f"><span class="req">Requirement or decision</span><textarea rows="3" data-d="${k}" data-f="summary">${esc(dv(k,"summary",""))}</textarea></label><label class="f"><span>What was built or decided</span><textarea rows="3" data-d="${k}" data-f="outcome">${esc(dv(k,"outcome",""))}</textarea></label><button class="btn primary" data-act="dlSave">Add entry</button></div></details>`:""}
   <ol class="dlog">${list.map(e=>`<li><div class="row between"><b>${esc(e.title||"Entry")}</b><span class="muted">${esc(fmtDT(e.at))}${e.version?" · "+esc(e.version):""}</span></div><p>${esc(e.summary)}</p>${e.outcome?`<p class="muted">${esc(e.outcome)}</p>`:""}</li>`).join("")}</ol>`;
}
async function guideAction(act,el){
  if(act==="guideTab"){ S.ui.guide.tab=el.dataset.v; return; }
  if(act==="dlSave"&&S.admin){ const d=draft("dl-new"); if(!String(d.summary||"").trim()) return toast("Write the requirement or decision.");
    if(await put("mod/lib/designlog/"+rid("dl-"),{at:nowMs(),title:"Note from "+S.meName,summary:d.summary.trim(),outcome:String(d.outcome||"").trim(),byName:S.meName})){ delete S.drafts["dl-new"]; toast("Added."); } }
}

/* ================= Open questions export ================= */
async function exportQuestions(){
  const secs=[...new Set(S.questions.map(q=>q.section))];
  let md="# Q&G Platform: open questions\n\nExported "+fmtDT(nowMs())+"\n";
  for(const st of ["Open","Parked","Answered"]){
    const qs=S.questions.filter(q=>q.status===st); if(!qs.length) continue;
    md+="\n## "+st+" ("+qs.length+")\n";
    for(const s of secs){ const l=qs.filter(q=>q.section===s).sort((a,b)=>(a.order||0)-(b.order||0)); if(!l.length) continue;
      md+="\n### "+((NAVMAP[s]||{label:"Platform-wide"}).label)+"\n"+l.map(q=>"- "+q.q+(q.answer?"\n  - Answer: "+q.answer:"")).join("\n")+"\n"; }
  }
  if(!DOWNLOADS) return toast("Downloads aren't available in this view.");
  try{ await DOWNLOADS.save({filename:"QG-open-questions-"+todayD()+".md",data:md}); }catch(e){ if(e&&e.code!=="cancelled") toast("The download didn't start."); }
}

function vStepAction(act,el){ const d=draft(el.dataset.k); if(act==="vStepPick"){ d.venture=el.dataset.v; delete d.lob; delete d.staffId; delete d.teamId; } else { delete d.venture; delete d.lob; } }

/* ================= Recycle bin: nothing is lost, only the administrator restores ================= */
async function toTrash(entry){
  const id=rid("del-"), doc={id,...entry,deletedAt:nowMs(),deletedBy:S.uid,deletedByName:S.meName,restoredAt:null};
  const ok=await put("mod/sys/trash/"+id,doc); if(ok) await addAudit("recycle",id,"Moved to Recycle bin",null,null,entry.title+": "+entry.reason);
  return ok;
}
function viewTrash(){
  const ui=S.ui.trash||(S.ui.trash={st:"deleted"});
  const plat=S.trash.map(t=>({...t,src:"platform"}));
  const qa=S.qaTrash.map(t=>({id:t.id,src:"qa",kind:"evaluation",title:(t.callId||t.id)+" · QA evaluation"+(t.advisorName?" · "+t.advisorName:""),venture:t.ventureId,reason:t.reason||t.deleteReason||"",deletedAt:t.deletedAt,deletedByName:"",deletedBy:t.deletedBy,restoredAt:null,raw:t}));
  const all=[...plat,...qa].filter(t=>!S.venture||!t.venture||t.venture===S.venture).filter(t=>ui.st==="restored"?t.restoredAt:!t.restoredAt).sort((a,b)=>(b.deletedAt||0)-(a.deletedAt||0));
  return `<p class="lead">Anything deleted on the platform lands here with who deleted it, when and why. Nothing is ever erased: files stay stored, edits keep their earlier values, backups in Drive are never removed. Only the administrator can restore.</p>
  <div class="chips">${[["deleted","In the bin"],["restored","Restored"]].map(([k,l])=>`<button class="chip" data-act="trashSt" data-v="${k}" aria-pressed="${ui.st===k}">${l}</button>`).join("")}</div>
  ${all.length?`<div class="tbl" style="margin-top:12px"><table><thead><tr><th>Item</th><th>Type</th><th>Venture</th><th>Deleted</th><th>By</th><th>Reason</th><th>${ui.st==="restored"?"Restored":""}</th></tr></thead><tbody>
   ${all.map(t=>`<tr><td class="wrap"><b>${esc(t.title)}</b></td><td>${esc(t.kind==="record"?"Record":t.kind==="file"?"File":"QA evaluation")}</td><td>${t.venture?vChip(t.venture):""}</td><td>${stampCell(t.deletedAt)}</td><td>${esc(t.deletedByName||"")}</td><td class="wrap">${esc(t.reason||"")}</td>
    <td>${t.restoredAt?`${stampCell(t.restoredAt)} by ${esc(t.restoredByName||"")}`:S.admin?`<button class="btn sm primary" data-act="trashRestore" data-src="${t.src}" data-id="${esc(t.id)}">Restore</button>`:""}</td></tr>`).join("")}</tbody></table></div>`:`<div class="emptybox">${ui.st==="restored"?"Nothing has been restored yet.":"The Recycle bin is empty."}</div>`}`;
}
async function trashAction(act,el){
  if(act==="trashSt"){ S.ui.trash.st=el.dataset.v; return; }
  if(act!=="trashRestore"||!S.admin) return;
  const id=el.dataset.id;
  if(el.dataset.src==="qa"){
    const t=S.qaTrash.find(x=>x.id===id); if(!t||!t.evaluation) return toast("This evaluation can't be restored from here. Use Reports & extraction in the QA tool.");
    if(S.evals.some(e=>e.id===t.id)) return toast("An evaluation with that ID already exists.");
    const now=nowMs(), doc={...t.evaluation,updatedAt:now,updatedBy:S.uid,auditTrail:[...(t.evaluation.auditTrail||[]),{at:now,by:S.uid,field:"status",from:"deleted",to:t.evaluation.status,reason:"Restored from the platform Recycle bin",role:"admin"}]};
    if(!await put("mod/qa/evaluations/"+t.id,doc)) return;
    try{ await DB.doc("mod/qa/trash/"+t.id).delete(); }catch(_){}
    await addAudit("recycle",t.id,"Restored QA evaluation",null,null,t.callId||t.id); return toast((t.callId||t.id)+" restored.");
  }
  const t=S.trash.find(x=>x.id===id); if(!t) return;
  if(t.kind==="record"){
    const ex=await DB.doc(t.path).get(); if(ex.exists) return toast("A record with that reference already exists, so it wasn't overwritten.");
    const data={...t.data,updatedAt:nowMs(),history:[...((t.data&&t.data.history)||[]),{at:nowMs(),byName:S.meName,note:"Restored from the Recycle bin"}]};
    if(!await put(t.path,data)) return;
  } else if(t.kind==="file"){
    const r=S.recs.find(x=>x.id===t.recordId); if(!r) return toast("The record this file belonged to is in the Recycle bin. Restore the record first.");
    if(!await patch("mod/reg/records/"+r.id,{files:[...(r.files||[]),t.file],updatedAt:nowMs(),history:[...(r.history||[]),{at:nowMs(),byName:S.meName,note:"Restored file "+t.file.name}]})) return;
  }
  await patch("mod/sys/trash/"+id,{restoredAt:nowMs(),restoredBy:S.uid,restoredByName:S.meName});
  await addAudit("recycle",id,"Restored",null,null,t.title); toast("Restored.");
}

/* ================= Rewards & recognition (IM Service Stars) ================= */
function viewRRLegacy(){
  const ui=S.ui.rrv||(S.ui.rrv={tab:"board",cycle:""});
  const tabs=`<div class="chips" style="margin-bottom:12px">${[["board","Leaderboard"],["entries","Entries and nominations"]].map(([k,l])=>`<button class="chip" data-act="rrTab" data-v="${k}" aria-pressed="${ui.tab===k}">${l}</button>`).join("")}</div>`;
  if(ui.tab==="entries"||S.sel.rr) return tabs+viewRegister("rr");
  const all=recsOf("rr"), cycles=[...new Set(all.map(r=>r.cycle).filter(Boolean))].sort().reverse(), cyc=ui.cycle||cycles[0]||"";
  const es=all.filter(r=>r.cycle===cyc);
  const num=v=>Number(v)||0;
  // advisors: blend of review count and reviews per sale, within own team (Option 2)
  const adv=es.filter(r=>/^Advisor/.test(r.category)), byTeam={};
  adv.forEach(r=>{ const t=r.staffIdTeam||"none"; (byTeam[t]=byTeam[t]||[]).push(r); });
  const advHtml=Object.entries(byTeam).map(([t,list])=>{
    const rps=r=>num(r.sales)?num(r.reviews)/num(r.sales):0, mx=Math.max(1,...list.map(r=>num(r.reviews))), mr=Math.max(0.0001,...list.map(rps));
    const ranked=list.map(r=>({r,score:Math.round((50*num(r.reviews)/mx+50*rps(r)/mr)*10)/10,rps:rps(r)})).sort((a,b)=>b.score-a.score);
    return `<h4 class="sub4">${esc(t==="none"?"No team":teamName(t))}</h4><div class="tbl"><table><thead><tr><th>Rank</th><th>Advisor</th><th class="n">Reviews</th><th class="n">Sales</th><th class="n">Reviews per sale</th><th class="n">Score</th><th>Status</th></tr></thead><tbody>${ranked.map((x,i)=>`<tr class="click${x.r.status==="Winner"?" win":""}" data-act="regOpen" data-k="rr" data-id="${esc(x.r.id)}" tabindex="0"><td>${i+1}</td><td><b>${esc(personName(x.r.staffId))}</b></td><td class="n">${num(x.r.reviews)}</td><td class="n">${num(x.r.sales)}</td><td class="n">${x.rps?x.rps.toFixed(2):"–"}</td><td class="n"><b>${x.score}</b></td><td><span class="tag ${x.r.status==="Winner"?"ok":""}">${esc(x.r.status)}</span></td></tr>`).join("")}</tbody></table></div>`;
  }).join("")||`<p class="muted">No advisor entries in this cycle.</p>`;
  const claims=k=>{ const l=es.filter(r=>r.category===k).sort((a,b)=>num(b.slaPct)-num(a.slaPct)||num(b.claimsManaged)-num(a.claimsManaged)||num(b.reviews)-num(a.reviews));
    return l.length?`<div class="tbl"><table><thead><tr><th>Rank</th><th>Name</th><th class="n">Within SLA</th><th class="n">Claims managed</th><th class="n">Reviews</th><th>Status</th></tr></thead><tbody>${l.map((r,i)=>`<tr class="click${r.status==="Winner"?" win":""}" data-act="regOpen" data-k="rr" data-id="${esc(r.id)}" tabindex="0"><td>${i+1}</td><td><b>${esc(personName(r.staffId))}</b></td><td class="n">${r.slaPct!==""&&r.slaPct!=null?num(r.slaPct)+"%":"–"}</td><td class="n">${num(r.claimsManaged)}</td><td class="n">${num(r.reviews)}</td><td><span class="tag ${r.status==="Winner"?"ok":""}">${esc(r.status)}</span></td></tr>`).join("")}</tbody></table></div>`:`<p class="muted">No entries.</p>`; };
  const nom=es.filter(r=>/^Support|^Other/.test(r.category));
  return tabs+`<div class="row between"><label class="inline">Cycle <select data-ui="rrv.cycle">${opts(cycles.length?cycles:["No cycles yet"],cyc)}</select></label>${isQG()?`<button class="btn primary" data-act="rrNew">Add an entry or nomination</button>`:""}</div>
   <p class="hint">Advisors are ranked within their own team on a 50/50 blend of review count and reviews per sale. Claims are ranked on SLA, then claims managed, then reviews. Support teams are recognised through line manager nominations.</p>
   <h3 class="h3">Advisors: review conversion</h3>${advHtml}
   <h3 class="h3">Claims: Motor</h3>${claims("Claims – Motor")}
   <h3 class="h3">Claims: Health</h3>${claims("Claims – Health")}
   <h3 class="h3">Support teams: line manager nominations</h3>${nom.length?`<ul class="plain">${nom.map(r=>`<li class="row between"><span><b>${esc(personName(r.staffId))}</b> · ${esc(teamName(r.staffIdTeam))} · nominated by ${esc(personName(r.nominatedBy))}<br><span class="muted">${esc(r.nomination||"")}</span></span><span class="tag ${r.status==="Winner"?"ok":""}">${esc(r.status)}</span></li>`).join("")}</ul>`:`<p class="muted">No nominations.</p>`}`;
}

/* ================= Linked dashboards ================= */
function viewLinks(){
  const ui=S.ui.links||(S.ui.links={edit:null});
  const list=S.links.filter(l=>!S.venture||!l.venture||l.venture==="all"||l.venture===S.venture).sort((a,b)=>(a.order||0)-(b.order||0));
  const form=l=>{ const k=l?"lk-"+l.id:"lk-new"; return `<div class="form inset"><div class="g3"><label class="f"><span class="req">Title</span><input data-d="${k}" data-f="title" value="${esc(dv(k,"title",l&&l.title))}"></label>
    <label class="f"><span>Link</span><input type="url" data-d="${k}" data-f="url" value="${esc(dv(k,"url",l&&l.url))}" placeholder="https://"></label>
    <label class="f"><span>Venture</span><select data-d="${k}" data-f="venture">${opts([{v:"all",l:"Group-wide"},...ventures().map(v=>({v:v.id,l:v.name}))],dv(k,"venture",(l&&l.venture)||"all"))}</select></label></div>
    <label class="f"><span>What it shows</span><input data-d="${k}" data-f="description" value="${esc(dv(k,"description",l&&l.description))}"></label>
    <div class="row"><button class="btn primary" data-act="linkSave"${l?` data-id="${esc(l.id)}"`:""}>Save</button><button class="btn" data-act="linkCancel">Cancel</button></div></div>`; };
  return `<p class="lead">Other dashboards and systems the Q&G team works in, one click away. They open in a new tab and use their own sign-in.</p>
   ${S.admin?`<div class="row"><button class="btn" data-act="linkNew">Add a dashboard link</button></div>`:""}${ui.edit==="__new"?form(null):""}
   <div class="linkgrid">${list.map(l=>ui.edit===l.id?form(l):`<div class="linkcard"><div class="row between"><b>${esc(l.title)}</b>${l.venture&&l.venture!=="all"?vChip(l.venture):'<span class="tag">Group-wide</span>'}</div><p>${esc(l.description||"")}</p>
     <div class="row">${l.url?`<a class="btn primary" href="${esc(l.url)}" target="_blank" rel="noopener">Open</a>`:'<span class="tag amb">Link to be added</span>'}${S.admin?`<button class="btn sm" data-act="linkEdit" data-id="${esc(l.id)}">Edit</button>`:""}</div>
     ${l.updatedAt?`<small class="muted">Updated ${esc(fmtDT(l.updatedAt))}</small>`:""}</div>`).join("")}</div>
   ${!list.length?`<div class="emptybox">No dashboard links yet.</div>`:""}`;
}
async function linkAction(act,el){
  const ui=S.ui.links||(S.ui.links={});
  if(act==="linkNew"){ ui.edit="__new"; return; } if(act==="linkEdit"){ ui.edit=el.dataset.id; return; } if(act==="linkCancel"){ ui.edit=null; return; }
  if(act==="rrTab"){ S.ui.rrv.tab=el.dataset.v; S.sel.rr=null; return; }
  if(act==="rrNew"){ S.ui.rrv.tab="entries"; S.sel.rr="__new"; return; }
  if(act!=="linkSave"||!S.admin) return;
  const l=el.dataset.id?S.links.find(x=>x.id===el.dataset.id):null, k=l?"lk-"+l.id:"lk-new", d=draft(k);
  const title=String(d.title??(l&&l.title)??"").trim(), url=String(d.url??(l&&l.url)??"").trim();
  if(!title) return toast("Add a title.");
  if(url&&!/^https?:\/\//i.test(url)) return toast("The link should start with https://");
  const doc={...(l||{}),id:l?l.id:rid("lk-"),title,url,venture:d.venture??(l&&l.venture)??"all",description:String(d.description??(l&&l.description)??"").trim(),placeholder:!url,order:l?l.order:nowMs(),updatedAt:nowMs(),updatedByName:S.meName};
  if(await put("mod/lib/links/"+doc.id,doc)){ await addAudit("link",doc.id,l?"Edited":"Added",l?{url:l.url}:null,{url},title); delete S.drafts[k]; ui.edit=null; toast("Saved."); }
}
