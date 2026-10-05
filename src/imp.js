/* ================= Upload existing data, per section, keeping the raw rows ================= */
const IMP_ALIASES={date:["date","date received","date raised","date tested","date of check","date identified","date opened","review date","date of shop","entry date"],mobile:["mobile","customer mobile","phone","mobile number","contact number"],dealRef:["deal reference","deal ref","deal","policy number","reference number","crm reference"],
  received:["received","date received","received date","date","created date"],subject:["subject","title","summary"],source:["source","channel","source channel","contact channel","received via"],type:["type","case type","category"],status:["status","case status","stage"],description:["description","details","complaint","what the customer raised","comments"],lob:["lob","line of business","product line"],staff:["staff concerned","advisor","staff","agent","employee"],owner:["q&g owner","owner","assigned to","handled by"],
  name:["name","full name","employee name","team","team name"],email:["email","work email","email address"],employeeId:["employee id","emp id","staff id","id"],team:["team","team name","department"],from:["start date","from","joined","date joined"],lineManager:["line manager","manager","team lead"],superior:["superior","head","head of department"]};
function impTargets(){ return [["complaints","Complaints management"],["callbacks","Callbacks"],...Object.keys(REG).map(k=>[k,NAVMAP[k]?NAVMAP[k].label:k]),["teams","Teams (Staff list)"],["staff","People (Staff list)"]]; }
function impFields(t){
  if(t==="complaints"||t==="callbacks") return [{k:"received",l:"Received",ty:"date",req:1},...(t==="complaints"?[{k:"type",l:"Type",ty:"select",opts:S.cfg.caseTypes.filter(x=>x!=="Callback request")}]:[]),{k:"source",l:"Source",ty:"select",req:1,opts:S.cfg.sources,loose:1},{k:"mobile",l:"Customer mobile",ty:"text"},{k:"dealRef",l:"Deal reference",ty:"text"},{k:"lob",l:"Line of business",ty:"lob",req:1},{k:"subject",l:"Subject",ty:"text",req:1},{k:"description",l:"Description",ty:"text",req:1},{k:"priority",l:"Priority",ty:"select",opts:["Normal","High","Critical"]},{k:"staff",l:"Staff concerned",ty:"staff"},{k:"owner",l:"Q&G owner",ty:"staff"},{k:"status",l:"Status (Open or Closed)",ty:"select",opts:["Open","Closed"]},{k:"closed",l:"Closed date",ty:"date"},{k:"verdict",l:"Validity",ty:"select",opts:[...cxc("validity"),"Valid","Partially valid","Not valid"]},{k:"rootCause",l:"Root cause",ty:"select",opts:cxc("rootCauses"),loose:1},{k:"closureReason",l:"Closure reason",ty:"select",opts:cxc("closureReasons"),loose:1},{k:"product",l:"Policy or product",ty:"text"},{k:"complaintType",l:"Complaint type",ty:"text"},{k:"nature",l:"Nature",ty:"text"},{k:"consequence",l:"Consequence",ty:"select",opts:S.cfg.consequences},{k:"resolution",l:"Resolution",ty:"text"},{k:"businessOutcome",l:"Business outcome",ty:"select",opts:BIZ},{k:"csat",l:"CSAT score (1 to 5)",ty:"int"}];
  if(t==="teams") return [{k:"name",l:"Team name",ty:"text",req:1},{k:"lob",l:"Line of business",ty:"lob",req:1},{k:"kind",l:"Kind (Business or Q&G)",ty:"select",opts:["Business","Q&G"]},{k:"lineManager",l:"Line manager",ty:"staff"},{k:"superior",l:"Superior",ty:"staff"}];
  if(t==="staff") return [{k:"name",l:"Full name",ty:"text",req:1},{k:"employeeId",l:"Employee ID",ty:"text"},{k:"email",l:"Work email",ty:"text"},{k:"designation",l:"Designation",ty:"text"},{k:"roles",l:"Roles",ty:"text"},{k:"team",l:"Team",ty:"team",req:1},{k:"from",l:"Start date in team",ty:"date"}];
  const def=REG[t]; if(!def) return [];
  return def.fields.flatMap(([k,l,ty,req,o])=>ty==="ident"?[{k:"mobile",l:"Customer mobile",ty:"text"},{k:"dealRef",l:"Deal reference",ty:"text"}]:[{k,l,ty:ty==="textarea"||ty==="url"?"text":ty==="consequence"?"select":ty,req,opts:ty==="consequence"?S.cfg.consequences:ty==="yesno"?["yes","no"]:o}]).concat([{k:"status",l:"Status",ty:"select",opts:def.statuses},{k:"owner",l:"Q&G owner",ty:"staff"}]);
}
function impAuto(fields,headers){
  const m={}, used=new Set();
  for(const h of headers){ const nh=norm(h).replace(/[*:]/g,"").trim();
    let f=fields.find(x=>!used.has(x.k)&&(norm(x.l)===nh||norm(x.k)===nh));
    if(!f) f=fields.find(x=>!used.has(x.k)&&(IMP_ALIASES[x.k]||[]).includes(nh));
    if(!f) f=fields.find(x=>!used.has(x.k)&&nh.length>3&&(norm(x.l).includes(nh)||nh.includes(norm(x.l))));
    if(!f){ const stop=new Set(["of","the","a","an","to","in","on","for","and","or","by","date"]), tok=x=>new Set(norm(x).replace(/[^a-z0-9 ]/g," ").split(" ").filter(w=>w&&!stop.has(w))), ht=tok(h);
      const hasDate=/date|when|day/.test(nh);
      f=fields.find(x=>{ if(used.has(x.k)) return false; const lt=tok(x.l); if(!ht.size||!lt.size) return false; const common=[...ht].filter(w=>lt.has(w)).length; const dateOk=x.ty!=="date"||hasDate; return dateOk&&common&&(common===ht.size||common===lt.size); }); }
    m[h]=f?f.k:""; if(f) used.add(f.k); }
  return m;
}
function impVenture(t){ return !["staff"].includes(t); }
function impValidate(st){
  const fields=impFields(st.target), v=st.venture?vInfo(st.venture):null, out=[];
  const inv={}; Object.entries(st.mapping).forEach(([h,k])=>{ if(k) inv[k]=h; });
  st.rows.forEach((row,ix)=>{
    const g=k=>inv[k]!=null?row[inv[k]]:"", errs=[], warns=[], val={};
    for(const f of fields){ let x=g(f.k); x=x==null?"":typeof x==="string"?x.trim():x;
      if(f.req&&(x===""||x==null)){ errs.push(f.l+" is missing"); continue; }
      if(x===""){ val[f.k]=""; continue; }
      if(f.ty==="date"){ const t=parseWhen(x); if(isNaN(t)) errs.push(f.l+" isn't a date"); else val[f.k]=t; continue; }
      if(f.ty==="lob"){ const l=(v.lobs||[]).find(y=>norm(y)===norm(x)); if(!l) errs.push(`“${x}” isn't a ${v.name} line of business`); else val[f.k]=l; continue; }
      if(f.ty==="staff"){ const p=byName(x)||Object.values(S.staff).find(y=>norm(y.email)===norm(x)||norm(y.employeeId)===norm(x)); if(!p){ (f.req?errs:warns).push(`${f.l} “${x}” isn't in Staff list`); val[f.k]=null; } else val[f.k]=p.id; continue; }
      if(f.ty==="team"){ const tm=Object.values(S.teams).find(y=>norm(y.name)===norm(x)); if(!tm) errs.push(`Team “${x}” isn't in Staff list (upload teams first)`); else val[f.k]=tm.id; continue; }
      if(f.ty==="select"&&f.opts){ const o=f.opts.find(y=>norm(y)===norm(x)||norm(y).startsWith(norm(x))); if(!o){ if(f.loose){ val[f.k]=String(x); warns.push(`${f.l} “${x}” isn't in the list; kept as written`); } else errs.push(`${f.l} “${x}” isn't one of: ${f.opts.join(", ")}`); } else val[f.k]=o; continue; }
      if(f.ty==="int"||f.ty==="number"){ const n=Number(String(x).replace(/[%,]/g,"")); if(isNaN(n)) errs.push(f.l+" isn't a number"); else val[f.k]=n; continue; }
      val[f.k]=String(x);
    }
    if((st.target==="complaints"||st.target==="callbacks")&&!identOk(val.mobile,val.dealRef)) errs.push("Needs a mobile number or deal reference");
    if(st.target!=="staff"&&Object.entries(row).some(([h,x])=>st.mapping[h]!=="__drop"&&/@[^@\s]+\.[a-z]{2,}/i.test(String(x)))) errs.push("Contains an email address; set that column to “Don't keep (customer details)”");
    if(st.target==="staff"){ const ex=Object.values(S.staff).find(p=>(val.email&&norm(p.email)===norm(val.email))||(val.employeeId&&norm(p.employeeId)===norm(val.employeeId))||norm(p.name)===norm(val.name)); if(ex) warns.push(`Already in Staff list as ${ex.name}; skipped`); val._exists=!!ex; }
    if(st.target==="teams"){ const ex=Object.values(S.teams).find(x=>norm(x.name)===norm(val.name)&&x.venture===st.venture); if(ex){ warns.push("Team already exists; only a missing line manager or superior is filled in"); val._exists=ex.id; } }
    if((st.target==="complaints"||st.target==="callbacks")&&dupMatches(st.venture,val.mobile,val.dealRef).length) warns.push("This customer already has an open case on the platform");
    out.push({ix:ix+2,row,val,errs,warns});
  });
  return out;
}
function impPanel(target){
  const st=S.ui.imp3&&S.ui.imp3.target===target?S.ui.imp3:null;
  if(!st||!st.open) return "";
  const fields=impFields(target), k="imp3";
  const needV=impVenture(target), v=needV?(S.venture||st.venture):"";
  let h=`<div class="imppanel"><div class="row between"><b>Upload existing data · ${esc((impTargets().find(x=>x[0]===target)||[])[1]||target)}</b><button class="btn sm" data-act="impClose">Close</button></div>
   <p class="hint">Upload an Excel or CSV file with one record per row. Columns are matched to this section's fields; fix any that weren't matched. Every row is checked before anything is saved. Each record keeps its original row, including columns that don't match a field, and the uploaded sheet is stored in the import history.</p>`;
  if(needV&&!v) h+=ventureStep("imp3v",(S.drafts.imp3v||{}).venture||"",S.venture).replace(/data-act="vStepPick"/g,'data-act="impVen"');
  else if(!st.rows) h+=`${needV?`<div class="vstep"><span>Venture</span>${vChip(v)} <b>${esc(vInfo(v).name)}</b>${!S.venture?` <button class="linkbtn" data-act="impVenClear">Change</button>`:""}</div>`:""}<label class="f"><span>File (.xlsx, .xls or .csv)</span><input type="file" accept=".xlsx,.xls,.csv" data-imp3file="${esc(target)}"></label>
     <p class="hint">Fields this section has: ${fields.map(f=>esc(f.l)+(f.req?" (required)":"")).join(", ")}.</p>`;
  else {
    st.venture=v;
    const res=impValidate(st), ok=res.filter(r=>!r.errs.length), bad=res.filter(r=>r.errs.length), mapped=Object.values(st.mapping).filter(Boolean).length;
    h+=`<div class="stamps flat">${esc(st.fileName)} · ${st.rows.length} rows · ${st.headers.length} columns, ${mapped} matched${needV?` · ${vChip(v)} ${esc(vInfo(v).name)}`:""}</div>
     <div class="tbl"><table><thead><tr><th>Column in your file</th><th>Example</th><th>Saved as</th></tr></thead><tbody>${st.headers.map(hd=>`<tr><td><b>${esc(hd)}</b></td><td class="clip">${esc(String((st.rows.find(r=>r[hd]!=="")||{})[hd]??"").slice(0,60))}</td><td><select data-impmap="${esc(hd)}">${opts([{v:"",l:"Keep as original data only"},{v:"__drop",l:"Don't keep (customer details)"},...fields.map(f=>({v:f.k,l:f.l+(f.req?" *":"")}))],st.mapping[hd]||"")}</select></td></tr>`).join("")}</tbody></table></div>
     ${fields.filter(f=>f.req&&!Object.values(st.mapping).includes(f.k)).length?`<div class="callout amb">Not matched yet: ${esc(fields.filter(f=>f.req&&!Object.values(st.mapping).includes(f.k)).map(f=>f.l).join(", "))}. Choose which column holds each.</div>`:""}
     <div class="figs4"><div><b>${res.length}</b><span>Rows</span></div><div><b>${ok.length}</b><span>Ready to save</span></div><div class="${bad.length?"warn":""}"><b>${bad.length}</b><span>Need fixing</span></div><div><b>${res.filter(r=>r.warns.length&&!r.errs.length).length}</b><span>Saved with a note</span></div></div>
     ${bad.length||res.some(r=>r.warns.length)?`<div class="tbl"><table><thead><tr><th>Row</th><th>What to check</th></tr></thead><tbody>${res.filter(r=>r.errs.length||r.warns.length).slice(0,60).map(r=>`<tr><td>${r.ix}</td><td class="wrap">${r.errs.map(e=>`<span class="tag red">Fix</span> ${esc(e)}`).join("<br>")}${r.errs.length&&r.warns.length?"<br>":""}${r.warns.map(w=>`<span class="tag amb">Note</span> ${esc(w)}`).join("<br>")}</td></tr>`).join("")}</tbody></table></div>`:""}
     <div class="row"><button class="btn primary" data-act="impGo"${ok.length&&!st.busy?"":" disabled"}>${st.busy?esc(st.progress||"Saving…"):`Save ${ok.filter(r=>!(r.val._exists&&target==="staff")).length} record${ok.length===1?"":"s"}`}</button><button class="btn" data-act="impRestart">Choose another file</button></div>
     <p class="hint">Rows that need fixing are not saved. Correct them in the file and upload it again; rows already saved won't be duplicated if you upload only the corrected rows.</p>`;
  }
  if(st.result) h+=`<div class="callout">${esc(st.result)}</div>`;
  return h+`</div>`;
}
function impButton(target){ const can=["staff","teams"].includes(target)?S.admin:isQG(); return can?`<button class="btn" data-act="impOpen" data-k="${esc(target)}">Upload existing data</button>`:""; }
function rawBlock(x){
  if(!x||!x.raw) return "";
  const b=x.imported&&x.imported.batchId?S.imports.find(i=>i.id===x.imported.batchId):null;
  return `<details class="inset rawbox"><summary>Original uploaded data${x.imported?` · row ${esc(x.imported.row)} of ${esc(x.imported.fileName||"the file")}`:""}</summary>
   <dl class="kv">${Object.entries(x.raw).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`).join("")}</dl>
   ${b&&b.assetId?`<a class="linkbtn" href="/_blob/${esc(b.assetId)}" target="_blank" rel="noopener">Open the uploaded sheet</a>`:""}<p class="hint">Uploaded ${esc(fmtDT(x.imported&&x.imported.at))} by ${esc((x.imported&&x.imported.byName)||"")}.</p></details>`;
}
async function impReadFile(target,file){
  if(!window.XLSX) return toast("The Excel library didn't load. Reload and try again.");
  try{
    const isCsv=/\.csv$/i.test(file.name)||file.type==="text/csv";
    const wb=isCsv?XLSX.read(await file.text(),{type:"string",raw:true}):XLSX.read(await file.arrayBuffer(),{type:"array"}), sh=wb.Sheets[wb.SheetNames[0]];
    const all=XLSX.utils.sheet_to_json(sh,{defval:"",raw:true}), shown=XLSX.utils.sheet_to_json(sh,{defval:"",raw:false,dateNF:"yyyy-mm-dd hh:mm"});
    const keep=all.map((r,i)=>[r,shown[i]]).filter(([r])=>Object.values(r).some(x=>String(x).trim()!==""));
    let rows=keep.map(x=>x[0]); const display=keep.map(x=>x[1]);
    if(!rows.length) return toast("No rows found in the first sheet.");
    const st=S.ui.imp3; st.fileName=file.name; st.headers=Object.keys(rows[0]).filter(h=>!/^__EMPTY/.test(h)||rows.some(r=>String(r[h]).trim()));
    if(rows.length>5000){ rows=rows.slice(0,5000); toast("Only the first 5,000 rows are read per file. Split larger files."); }
    st.rows=rows; st.display=display.slice(0,rows.length); st.mapping=impAuto(impFields(target),st.headers); st.result=null;
    if(target!=="staff"&&target!=="teams") st.headers.forEach(h=>{ if(!st.mapping[h]&&/(client|customer|insured|policy ?holder)('?s)? ?(full )?name|^name of (the )?(client|customer)|emirates|passport|e-?mail|^email/i.test(String(h).trim())) st.mapping[h]="__drop"; });
  }catch(e){ toast("That file couldn't be read. Save it as .xlsx or .csv and try again."); }
}
async function impRun(){
  const st=S.ui.imp3, t=st.target, v=st.venture, res=impValidate(st).filter(r=>!r.errs.length); if(!res.length) return;
  const drop=new Set(Object.entries(st.mapping).filter(([,v])=>v==="__drop").map(([h])=>h));
  if(window.XLSX) st.csv=XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet((st.display||st.rows).map(r=>Object.fromEntries(Object.entries(r).filter(([h])=>!drop.has(h))))));
  st.busy=true; st.progress="Saving…"; render(true);
  const batchId=rid("imp-"), now=nowMs();
  let assetId=null; try{ if(ASSETS){ const a=await ASSETS.upload(new File([st.csv],st.fileName.replace(/\.[^.]+$/,"")+".csv",{type:"text/csv"})); assetId=a.id; } }catch(e){ logError("upload","Couldn't store the uploaded sheet for "+st.fileName,{name:st.fileName},e); }
  const meta=ix=>({batchId,row:ix,fileName:st.fileName,at:now,by:S.uid,byName:S.meName});
  let done=0, skipped=0, failed=0; const refs=[];
  for(const r of res){
    const x=r.val, raw=Object.fromEntries(Object.entries((st.display||[])[r.ix-2]||r.row).filter(([k])=>!drop.has(k)).map(([k,v])=>[k,String(v).replace(/ 00:00$/,"")]).filter(([k,v])=>!/^__EMPTY/.test(k)||v));
    try{
      if(t==="complaints"||t==="callbacks"){
        const closed=x.status==="Closed", cAt=x.closed||x.received, ref=await nextRef(t==="callbacks"?"CB":"CX");
        const c={ref,type:t==="callbacks"?"Callback request":(x.type||"Complaint"),source:x.source,receivedAt:x.received,mobile:String(x.mobile||""),dealRef:String(x.dealRef||""),venture:v,lob:x.lob,subject:x.subject,description:x.description,priority:x.priority||"Normal",staffId:x.staff||null,staffTeamId:x.staff?((asgAt(S.staff[x.staff],dateOf(x.received))||{}).teamId||null):null,assigneeId:x.owner||null,
          status:closed?"closed":"intake",stageAt:closed?cAt:now,createdAt:x.received,updatedAt:now,createdBy:S.uid,createdByName:S.meName,intake:{},lm:{attempts:[],resolution:x.resolution||""},notes:[],qgAttempts:[],pendingCalls:[],
          product:x.product||"",complaintType:x.complaintType||"",nature:x.nature||"",
          review:closed?{verdict:x.verdict||"",consequence:x.consequence||"None",finalSummary:x.resolution||"",businessOutcome:x.businessOutcome||"",rootCause:x.rootCause||"",closureReason:x.closureReason||"Resolved",at:cAt,byName:"Uploaded"}:{},closure:closed?{externalAt:cAt,internalAt:cAt,externalByName:"Uploaded",internalByName:"Uploaded",reason:x.closureReason||"Resolved"}:{},
          csat:closed&&x.csat>=1&&x.csat<=5?{status:"Captured",score:Math.round(x.csat),method:"Uploaded",at:cAt,byName:"Uploaded"}:null,imported:meta(r.ix),raw,timeline:[{at:now,by:S.uid,byName:S.meName,ev:"Uploaded from existing data",note:st.fileName+", row "+r.ix}]};
        if(await put("mod/cx/cases/"+ref,c)){ done++; refs.push(ref); } else failed++;
      } else if(t==="teams"){
        if(x._exists){ const tm=S.teams[x._exists], part={}; if(!tm.lineManagerId&&x.lineManager) part.lineManagerId=x.lineManager; if(!tm.superiorId&&x.superior) part.superiorId=x.superior;
          if(Object.keys(part).length&&await patch("mod/core/teams/"+tm.id,{...part,updatedAt:now})){ done++; await addAudit("team",tm.id,"Filled from upload",null,part,st.fileName); } else skipped++; continue; }
        const tm={id:rid("tm-"),name:x.name,venture:v,lob:x.lob,kind:x.kind==="Q&G"?"qg":"business",lineManagerId:x.lineManager||null,superiorId:x.superior||null,active:true,createdAt:now,updatedAt:now,imported:meta(r.ix),raw};
        if(await put("mod/core/teams/"+tm.id,tm)){ done++; refs.push(tm.name); await addAudit("team",tm.id,"Added",null,tm,"Uploaded from "+st.fileName); } else failed++;
      } else if(t==="staff"){
        if(x._exists){ skipped++; continue; }
        const roles=String(x.roles||"").split(/[,;/]/).map(s=>norm(s)).filter(Boolean).map(s=>(ROLES.find(([k,l])=>norm(l)===s||k===s.replace(/ /g,"_"))||[])[0]).filter(Boolean);
        const p={id:rid("stf-"),name:x.name,employeeId:x.employeeId||"",email:String(x.email||"").toLowerCase(),designation:x.designation||"",roles:roles.length?roles:["advisor"],assignments:[{teamId:x.team,from:x.from?dateOf(x.from):todayD(),to:null}],createdAt:now,updatedAt:now,imported:meta(r.ix),raw};
        if(await put("mod/core/staff/"+p.id,p)){ done++; refs.push(p.name); await addAudit("person",p.id,"Added",null,null,"Uploaded from "+st.fileName); syncAdvisor(p); } else failed++;
      } else {
        const def=REG[t], out={};
        for(const [k,l,ty] of def.fields){ if(ty==="ident"){ out.mobile=String(x.mobile||""); out.dealRef=String(x.dealRef||""); continue; } const vv=x[k];
          if(ty==="date") out[k]=vv?dateOf(vv):""; else if(ty==="lob") out[k]=vv?v+"|"+vv:""; else if(ty==="staff"){ out[k]=vv||null; if(vv) out[k+"Team"]=(asgAt(S.staff[vv],out.date||todayD())||{}).teamId||null; } else out[k]=vv??""; }
        const status=x.status||def.statuses[0], ref=await nextRef(def.prefix), created=x.date||x.lastTested||now;
        const doc={id:ref,ref,section:t,...out,venture:v,status,assigneeId:x.owner||null,createdAt:created,updatedAt:now,closedAt:def.final.includes(status)?now:null,createdBy:S.uid,createdByName:S.meName,imported:meta(r.ix),raw,history:[{at:now,byName:S.meName,note:"Uploaded from existing data: "+st.fileName+", row "+r.ix}]};
        if(await put("mod/reg/records/"+ref,doc)){ done++; refs.push(ref); } else failed++;
      }
    }catch(e){ failed++; }
    if((done+failed+skipped)%10===0){ st.progress=`Saved ${done} of ${res.length}…`; render(true); }
  }
  const batch={id:batchId,section:t,venture:v||"",fileName:st.fileName,assetId,mapping:st.mapping,headers:st.headers,rows:st.rows.length,saved:done,skipped,failed,notSaved:st.rows.length-res.length,refs:refs.slice(0,500),at:now,by:S.uid,byName:S.meName};
  await put("mod/sys/imports/"+batchId,batch);
  await addAudit("import",batchId,"Uploaded "+done+" records",null,null,`${(impTargets().find(x=>x[0]===t)||[])[1]} · ${v?vInfo(v).name:"Group"} · ${st.fileName}`);
  st.busy=false; st.rows=null; st.result=`Saved ${done} record${done===1?"":"s"} from ${st.fileName}${skipped?`; ${skipped} already on the platform and skipped`:""}${failed?`; ${failed} failed and are in the error report`:""}. The uploaded sheet and every original row are kept.`;
}
async function impAction(act,el){
  const st=S.ui.imp3;
  if(act==="impOpen"){ S.ui.imp3={target:el.dataset.k,open:true,venture:S.venture||""}; return; }
  if(!st) return;
  if(act==="impClose"){ S.ui.imp3=null; return; }
  if(act==="impVen"){ st.venture=el.dataset.v; return; }
  if(act==="impVenClear"){ st.venture=""; st.rows=null; return; }
  if(act==="impRestart"){ st.rows=null; st.result=null; return; }
  if(act==="impGo") return impRun();
}
function viewImportHistory(){
  const list=[...S.imports].filter(b=>!S.venture||!b.venture||b.venture===S.venture).sort((a,b)=>b.at-a.at);
  return `<section class="sect"><h2 class="h3">Upload history</h2><p class="hint">Every upload of existing data, with the stored sheet. Each record created also keeps its original row.</p>
   ${list.length?`<div class="tbl"><table><thead><tr><th>When</th><th>Section</th><th>Venture</th><th>File</th><th class="n">Rows</th><th class="n">Saved</th><th class="n">Skipped</th><th class="n">Not saved</th><th>By</th></tr></thead><tbody>${list.map(b=>`<tr><td>${stampCell(b.at)}</td><td>${esc((impTargets().find(x=>x[0]===b.section)||[0,b.section])[1])}</td><td>${b.venture?vChip(b.venture):'<span class="tag">Group</span>'}</td><td>${b.assetId?`<a href="/_blob/${esc(b.assetId)}" target="_blank" rel="noopener">${esc(b.fileName)}</a>`:esc(b.fileName)}</td><td class="n">${b.rows}</td><td class="n">${b.saved}</td><td class="n">${b.skipped||0}</td><td class="n">${(b.notSaved||0)+(b.failed||0)}</td><td>${esc(b.byName||"")}</td></tr>`).join("")}</tbody></table></div>`:`<div class="emptybox">Nothing uploaded yet.</div>`}</section>`;
}
