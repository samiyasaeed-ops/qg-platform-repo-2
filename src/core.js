"use strict";
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rid=(p="")=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const nowMs=()=>Date.now();
const isoNow=()=>new Date().toISOString();
const ts=v=>v==null||v===""?NaN:typeof v==="number"?v:new Date(v).getTime();
const norm=s=>String(s||"").toLowerCase().replace(/\s+/g," ").trim();
const clone=o=>JSON.parse(JSON.stringify(o));
const PLATFORM_URL="https://claude.ai/artifact/3JpHmzmenm6BBrDTbEF4VS";

/* ---------- Dubai time (UTC+4, no DST) ---------- */
const TZ=4*3600e3;
const dLocal=ms=>new Date(ms+TZ);
const todayD=()=>dLocal(nowMs()).toISOString().slice(0,10);
const dateOf=ms=>isNaN(ms)?"":dLocal(ms).toISOString().slice(0,10);
const fmtDT=v=>{ const t=ts(v); if(isNaN(t)) return ""; const d=dLocal(t), sameYr=d.getUTCFullYear()===dLocal(Date.now()).getUTCFullYear(); return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:sameYr?undefined:"numeric",timeZone:"UTC"})+", "+d.toISOString().slice(11,16); };
const stampCell=v=>{ const t=ts(v); return isNaN(t)?'<span class="muted">–</span>':`<time datetime="${new Date(t).toISOString()}">${esc(fmtDT(t))}</time>`; };
const lastOf=(...vals)=>{ const n=vals.flat(Infinity).map(ts).filter(x=>!isNaN(x)); return n.length?Math.max(...n):NaN; };
const fmtD=v=>{ const t=typeof v==="string"&&/^\d{4}-\d\d-\d\d$/.test(v)?Date.parse(v+"T00:00:00Z"):ts(v)+TZ; if(isNaN(t)) return ""; return new Date(t).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}); };
const localToMs=(date,time)=>Date.parse(date+"T"+(time||"00:00")+":00Z")-TZ;
function addDays(dateStr,n){ const d=new Date(dateStr+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }

/* ---------- working hours ---------- */
function isWorkDay(dateStr,cfg){ const dow=new Date(dateStr+"T00:00:00Z").getUTCDay(); return cfg.work.days.includes(dow)&&!(cfg.work.holidays||[]).includes(dateStr); }
function dayBounds(dateStr,cfg){ return [localToMs(dateStr,cfg.work.start),localToMs(dateStr,cfg.work.end)]; }
function addWorkHours(startMs,hours,cfg){
  let t=startMs, rem=hours*3600e3, day=dateOf(t);
  for(let i=0;i<500;i++){
    if(isWorkDay(day,cfg)){ const [a,b]=dayBounds(day,cfg); if(t<a) t=a; if(t<b){ const av=b-t; if(rem<=av) return t+rem; rem-=av; } }
    day=addDays(day,1); t=dayBounds(day,cfg)[0];
  }
  return t;
}
function workHoursBetween(a,b,cfg){
  if(!(b>a)) return 0; let tot=0, day=dateOf(a);
  for(let i=0;i<500&&localToMs(day,"00:00")<b;i++){ if(isWorkDay(day,cfg)){ const [s,e]=dayBounds(day,cfg); const x=Math.max(s,a), y=Math.min(e,b); if(y>x) tot+=y-x; } day=addDays(day,1); }
  return tot/3600e3;
}

/* ---------- capability bridge (QA frame) ---------- */
const realUse=n=>(window.claude&&window.claude.use?window.claude.use(n):Promise.resolve(null)).catch(()=>null);
const tag=x=>Object.prototype.toString.call(x);
function toP(x){
  if(x===null||typeof x!=="object"&&typeof x!=="function") return x;
  if(typeof x==="function") return function(...a){ const r=x.apply(this,a); return r&&typeof r.then==="function"?r.then(toP):toP(r); };
  const t=tag(x);
  if(t==="[object File]") return new File([x],x.name,{type:x.type,lastModified:x.lastModified});
  if(t==="[object Blob]") return new Blob([x],{type:x.type});
  if(t==="[object AbortSignal]"){ const ac=new AbortController(); if(x.aborted) ac.abort(x.reason); else x.addEventListener("abort",()=>ac.abort(x.reason)); return ac.signal; }
  if(t==="[object Date]"||t==="[object RegExp]"||t==="[object ArrayBuffer]"||ArrayBuffer.isView(x)) return structuredClone(x);
  if(Array.isArray(x)) return x.map(toP);
  const o={}; for(const k of Object.keys(x)) o[k]=toP(x[k]); return o;
}
const pa=a=>Array.from(a,toP);
function wQuery(q){ return { where:(f,op,v)=>wQuery(q.where(f,op,toP(v))), orderBy:(f,d)=>wQuery(d===undefined?q.orderBy(f):q.orderBy(f,d)), limit:n=>wQuery(q.limit(n)), get:()=>q.get(), onSnapshot:(...a)=>q.onSnapshot(...pa(a)) }; }
function wColl(c){ return Object.assign(wQuery(c),{ id:c.id, path:c.path, doc:(...a)=>wDoc(c.doc(...a)), add:d=>c.add(toP(d)).then(wDoc) }); }
function wDoc(r){ return { id:r.id, path:r.path, get:()=>r.get(), set:d=>r.set(toP(d)), update:d=>r.update(toP(d)), delete:()=>r.delete(), acquire:o=>r.acquire(toP(o)), onSnapshot:(...a)=>r.onSnapshot(...pa(a)), collection:p=>wColl(r.collection(p)) }; }
function wDb(db,pfx){ return { doc:p=>wDoc(db.doc(pfx+p)), collection:p=>wColl(db.collection(pfx+p)) }; }
function wNs(ns){ const call=(f,a)=>f(...pa(a)); const out=typeof ns==="function"?function(...a){ return call(ns,a); }:{}; for(const k of Object.keys(ns)){ const v=ns[k]; out[k]=typeof v==="function"?(...a)=>call(v.bind(ns),a):v; } return out; }
const capCache={};
function capFor(mod,n){ const key=mod+":"+n; if(!capCache[key]) capCache[key]=realUse(n).then(ns=>{ if(!ns) return null; return n==="db"?wDb(ns,"mod/"+mod+"/"):wNs(ns); }); return capCache[key]; }
window.__qgHost=function(mod){ return Object.freeze({ use:n=>capFor(mod,n), evaluations:()=>S.evals.slice(), evaluation:id=>S.evals.find(e=>e.id===id)||null, openModule:m=>go(m==="qa"?"calls":m) }); };

/* ---------- state ---------- */
const DEFAULT_CFG={
  work:{days:[1,2,3,4,5],start:"08:00",end:"18:00",holidays:[]},
  sla:{intake:4,lm:10,qgReview:10,consequence:10,dispute:10},
  reminderEveryHours:24,
  ventures:[{id:"insurancemarket",name:"InsuranceMarket.ae",code:"IM",color:"#1E5AA8",domain:"insurancemarket.ae",isActive:true,benchmarkPassingScore:85,lobs:["Motor","Health","Life","General","Commercial","Travel"],regulators:["Central Bank of the UAE (CBUAE)","Dubai Health Authority (DHA)","Ministry of Economy","UAE Data Office"]},
    {id:"creditmarket",name:"CreditMarket.ae",code:"CM",color:"#6B3FA0",domain:"creditmarket.ae",isActive:true,benchmarkPassingScore:85,lobs:["Loans","Cards","Mortgages"],regulators:["Central Bank of the UAE (CBUAE)","Ministry of Economy","UAE Data Office"]},
    {id:"holidaymarket",name:"HolidayMarket.ae",code:"HM",color:"#0E8C8C",domain:"holidaymarket.ae",isActive:true,benchmarkPassingScore:85,lobs:["Holidays","Visas"],regulators:["Dubai Department of Economy and Tourism (DET)","Ministry of Economy","UAE Data Office"]}],
  sources:["Website Contact Us form","HAPEX (call centre, 800-ALFRED)","Zoho inbox (HAPEX)","QA inbox","Email","WhatsApp","Google review","Social media","Trustpilot","Internal feedback","Senior management complaint","Internal escalation","RM, BDM or advisor raised","Walk-in","Other"],
  caseTypes:["Complaint","Negative review","Service – Request","Service – New claim","Service – Claim follow-up","Service – Enquiry","Service – Feedback","Service – Appreciation","Internal","Callback request"],
  consequences:["None","Feedback and coaching","Verbal warning","Written warning","HR warning"],
  platformUrl:PLATFORM_URL
};
const S={ section:"home", ready:{}, staff:{}, teams:{}, cfg:clone(DEFAULT_CFG), cases:[], recs:[], tasks:[], questions:[], regs:[], designlog:[], tatLog:[], backups:[], trash:[], qaTrash:[], links:[], rrProgs:[], rrEntries:[], imports:[], venture:"", view:"records", playbooks:{}, sops:[], errors:[], outbox:[], audit:[], evals:[],
  uid:null, meName:"", meEmail:"", admin:false, caps:{}, sel:{}, drafts:{}, ui:{} };
let DB=null, MCP=null, USER=null, ASSETS=null, DOWNLOADS=null;

/* ---------- people & roles ---------- */
function asgAt(p,date){ date=date||todayD(); return (p.assignments||[]).find(a=>a.from<=date&&(!a.to||a.to>=date))||null; }
function teamOf(p,date){ const a=asgAt(p,date); return a?S.teams[a.teamId]||null:null; }
function personName(id){ const p=S.staff[id]; return p?p.name:(id?"Unknown person":"—"); }
function teamName(id){ const t=S.teams[id]; return t?t.name:(id?"Unknown team":"—"); }
function staffList(date){ return Object.values(S.staff).filter(p=>asgAt(p,date)).sort((a,b)=>a.name.localeCompare(b.name)); }
function meStaff(){ if(S.uid){ const p=Object.values(S.staff).find(p=>p.userId===S.uid); if(p) return p; } const e=norm(S.meEmail); return e?Object.values(S.staff).find(p=>norm(p.email)===e)||null:null; }
const NAMES={};
async function resolveNames(ids){ ids=ids.filter(i=>i&&!(i in NAMES)); if(!ids.length||!USER||!USER.profiles) return; try{ const ps=await USER.profiles(ids); ids.forEach(i=>NAMES[i]=(ps[i]&&ps[i].name)||""); soon(); }catch(_){} }
function isQG(){ if(S.admin) return true; const p=meStaff(); const t=p&&teamOf(p); return !!(t&&t.kind==="qg"); }
function isChief(){ if(S.admin) return true; const p=meStaff(); return !!(p&&(p.roles||[]).includes("chief")); }
function myTeams(){ const p=meStaff(); if(!p) return []; return Object.values(S.teams).filter(t=>t.lineManagerId===p.id||t.superiorId===p.id); }
function qgEmails(){ return staffList().filter(p=>{ const t=teamOf(p); return t&&t.kind==="qg"&&p.email; }).map(p=>p.email); }
function chiefEmails(){ return staffList().filter(p=>(p.roles||[]).includes("chief")&&p.email).map(p=>p.email); }
function emailOf(id){ const p=S.staff[id]; return p&&p.email||""; }
function actorLabel(){ return S.meName||"Someone"; }
function lobs(){ const vs=ventures().filter(v=>inV(v.id)); return vs.flatMap(v=>(v.lobs||[]).map(l=>({v:v.id+"|"+l,l:(vs.length>1?v.name.replace(/\.ae$/,"")+" · ":"")+l,venture:v.id,lob:l}))); }

/* ---------- db helpers ---------- */
async function put(path,doc){ try{ await DB.doc(path).set(doc); return true; }catch(e){ await logError("write","Couldn't save "+path,{op:"set",path,data:doc},e); toast("That didn't save. It's in the error report for a retry."); return false; } }
async function patch(path,part){ try{ await DB.doc(path).update(part); return true; }catch(e){ await logError("write","Couldn't update "+path,{op:"update",path,data:part},e); toast("That didn't save. It's in the error report for a retry."); return false; } }
async function addAudit(entity,entityId,action,before,after,note){
  try{ await DB.collection("mod/core/audit").add({at:nowMs(),by:S.uid,byName:S.meName,entity,entityId,action,before:before??null,after:after??null,note:note||""}); }catch(e){}
}
async function logError(kind,message,payload,err){
  const doc={at:nowMs(),kind,message,detail:err?String(err.code||"")+" "+String(err.message||err).slice(0,300):"",payload:payload||null,status:"open",by:S.uid,byName:S.meName};
  try{ await DB.collection("mod/sys/errors").add(doc); }catch(_){ console.error("error log failed",doc); }
}
async function nextRef(prefix){
  const yr=todayD().slice(0,4), ref=DB.doc("mod/core/seq/"+prefix+"-"+yr);
  for(let i=0;i<8;i++){
    try{ const l=await ref.acquire({holder:S.uid+"-"+rid(),ttlMs:5000}); if(l.acquired){ const s=await ref.get(); const n=((s.exists&&s.data().n)||0)+1; await ref.set({n}); return prefix+"-"+yr+"-"+String(n).padStart(6,"0"); } }catch(e){}
    await new Promise(r=>setTimeout(r,400+Math.random()*400));
  }
  return prefix+"-"+yr+"-T"+Date.now().toString(36).toUpperCase();
}

/* ---------- email ---------- */
function emailHtml(lines,link){ return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#13212A">${lines.map(l=>`<p style="margin:0 0 10px">${esc(l)}</p>`).join("")}<p style="margin:16px 0 0"><a href="${esc(link||S.cfg.platformUrl)}">Open the Q&amp;G Platform</a></p><p style="color:#5B6B73;font-size:12px;margin-top:16px">Sent by the Q&amp;G Platform on behalf of ${esc(actorLabel())}. Customer details are never included in these emails.</p></div>`; }
async function sendMail({to,cc,subject,lines,ref,kind}){
  to=[...new Set((to||[]).filter(x=>/@/.test(x)))]; cc=[...new Set((cc||[]).filter(x=>/@/.test(x)&&!to.includes(x)))];
  const body=lines.join("\n\n")+"\n\nOpen the Q&G Platform: "+S.cfg.platformUrl;
  const payload={to,cc,subject,body,htmlBody:emailHtml(lines),ref:ref||"",kind:kind||""};
  if(!to.length){ await logError("email","No email address for the recipient of: "+subject,payload); return false; }
  return deliver(payload);
}
async function deliver(payload){
  const log={at:nowMs(),by:S.uid,byName:S.meName,to:payload.to,cc:payload.cc,subject:payload.subject,ref:payload.ref,kind:payload.kind};
  if(!MCP){ await logError("email","Gmail isn't connected in "+(S.meName||"this viewer")+"'s session, so this email wasn't sent: "+payload.subject,payload); try{ await DB.collection("mod/sys/outbox").add({...log,status:"failed",error:"Gmail not available"}); }catch(_){} return false; }
  try{
    const {ref,kind,...args}=payload;
    await MCP.callTool("Gmail","send_message",args);
    try{ await DB.collection("mod/sys/outbox").add({...log,status:"sent"}); }catch(_){}
    return true;
  }catch(e){
    await logError("email","Email failed: "+payload.subject,payload,e);
    try{ await DB.collection("mod/sys/outbox").add({...log,status:"failed",error:String(e.code||e.message||e).slice(0,200)}); }catch(_){}
    return false;
  }
}

/* ---------- toast ---------- */
let toastT;
function toast(m){ const t=$("#toast"); t.textContent=m; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,3800); }

/* ---------- small form helpers ---------- */
function opts(list,sel,ph){ return (ph!==undefined?`<option value="">${esc(ph)}</option>`:"")+list.map(o=>{ const v=typeof o==="object"?o.v:o, l=typeof o==="object"?o.l:o; return `<option value="${esc(v)}"${String(v)===String(sel??"")?" selected":""}>${esc(l)}</option>`; }).join(""); }
function draft(key){ return S.drafts[key]||(S.drafts[key]={}); }
function dv(key,f,saved){ const d=S.drafts[key]; return d&&f in d?d[f]:(saved??""); }
function typing(){ const a=document.activeElement; if(!a||!a.closest||!a.closest("#content")) return false; if(a.tagName==="TEXTAREA") return true; if(a.tagName!=="INPUT") return false; return !["radio","checkbox","file","button","submit"].includes(a.type); }
const identOk=(mobile,deal)=>(String(mobile||"").replace(/\D/g,"").length>=7)||String(deal||"").trim().length>=3;
const maskMobile=m=>{ const d=String(m||"").replace(/\D/g,""); return d?"•••• "+d.slice(-4):""; };
function mdLite(src){
  const lines=String(src||"").split("\n"); let html="", list=null;
  const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");
  const close=()=>{ if(list){ html+=`</${list}>`; list=null; } };
  for(const raw of lines){ const l=raw.trimEnd();
    if(/^#{1,3}\s/.test(l)){ close(); const n=l.match(/^#+/)[0].length; html+=`<h${n+2}>${inline(l.replace(/^#+\s/,""))}</h${n+2}>`; continue; }
    if(/^\s*[-*]\s/.test(l)){ if(list!=="ul"){ close(); html+="<ul>"; list="ul"; } html+=`<li>${inline(l.replace(/^\s*[-*]\s/,""))}</li>`; continue; }
    if(/^\s*\d+\.\s/.test(l)){ if(list!=="ol"){ close(); html+="<ol>"; list="ol"; } html+=`<li>${inline(l.replace(/^\s*\d+\.\s/,""))}</li>`; continue; }
    close(); if(l.trim()) html+=`<p>${inline(l)}</p>`;
  }
  close(); return html;
}
