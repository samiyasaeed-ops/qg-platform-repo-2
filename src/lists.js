/* ================= Dropdown lists, managed by the administrator ================= */
const LISTS=[
  {key:"caseTypes",label:"Case types",path:["caseTypes"],locked:["Callback request"],use:v=>S.cases.filter(c=>c.type===v).length},
  {key:"sources",label:"Source channels",path:["sources"],use:v=>S.cases.filter(c=>c.source===v).length},
  {key:"complaintTaxonomy",label:"Complaint types and natures",path:["cx","complaintTaxonomy"],tax:true,use:v=>S.cases.filter(c=>c.complaintType===v).length},
  {key:"products",label:"Policies and products",path:["cx","products"],perLob:true,use:v=>S.cases.filter(c=>c.product===v).length},
  {key:"requestSubtypes",label:"Request types",path:["cx","requestSubtypes"],use:v=>S.cases.filter(c=>c.requestSubtype===v).length},
  {key:"rootCauses",label:"Root causes",path:["cx","rootCauses"],use:v=>S.cases.filter(c=>(c.review||{}).rootCause===v).length},
  {key:"validity",label:"Validity",path:["cx","validity"],use:v=>S.cases.filter(c=>(c.review||{}).verdict===v).length},
  {key:"closureReasons",label:"Closure reasons",path:["cx","closureReasons"],locked:["Resolved","Customer not reachable","No valid match found"],use:v=>S.cases.filter(c=>(c.review||{}).closureReason===v||(c.closure||{}).reason===v).length},
  {key:"internalActions",label:"Other internal actions",path:["cx","internalActions"],use:v=>S.cases.filter(c=>((c.review||{}).internalActions||[]).includes(v)).length},
  {key:"consequences",label:"Consequences",path:["consequences"],locked:["None"],use:v=>S.cases.filter(c=>(c.review||{}).consequence===v).length+S.recs.filter(r=>r.consequence===v).length}
];
const listDef=k=>LISTS.find(l=>l.key===k);
function rawList(k){ const d=listDef(k); if(d.path[0]==="cx") return clone(cxc(d.path[1])??(d.perLob||d.tax?{}:[])); return clone(S.cfg[d.path[0]]||DEFAULT_CFG[d.path[0]]||[]); }
const hiddenOf=k=>((S.cfg.hiddenItems||{})[k]||[]);
/* what forms offer: the list without hidden items */
function pick(k){ const h=hiddenOf(k), r=rawList(k); return Array.isArray(r)?r.filter(x=>!h.includes(x)):r; }
function pickTax(){ const h=hiddenOf("complaintTaxonomy"), t=rawList("complaintTaxonomy"), o={}; Object.keys(t).filter(x=>!h.includes(x)).forEach(x=>o[x]=(t[x]||[]).filter(n=>!h.includes(x+"::"+n))); return o; }
function pickProducts(venture,lob){ const h=hiddenOf("products"), p=(rawList("products")[venture+"|"+lob]||[]); return p.filter(x=>!h.includes(venture+"|"+lob+"::"+x)); }

async function saveList(k,value,hidden,note){
  if(!S.admin) return false;
  const d=listDef(k), c=clone(S.cfg);
  if(d.path[0]==="cx"){ c.cx={...(c.cx||{}),[d.path[1]]:value}; } else c[d.path[0]]=value;
  if(hidden) c.hiddenItems={...(c.hiddenItems||{}),[k]:hidden};
  if(!await put("mod/core/config/main",c)) return false;
  await addAudit("lists",k,"List changed",null,null,d.label+": "+note); return true;
}
function viewLists(){
  const ui=S.ui.lists||(S.ui.lists={k:"caseTypes",open:null,lob:""});
  const d=listDef(ui.k), h=hiddenOf(ui.k), raw=rawList(ui.k);
  const nav=`<div class="chips" style="margin-bottom:12px">${LISTS.map(l=>`<button class="chip" data-act="lsPick" data-v="${l.key}" aria-pressed="${ui.k===l.key}">${esc(l.label)}</button>`).join("")}</div>`;
  const intro=`<p class="lead">Add, rename, reorder or hide the options people choose from. Hidden options stop appearing in forms but stay on the records that already use them, and renaming only changes the wording for new records.</p>`;
  const rowsHtml=(items,scope)=>items.map((x,i)=>{ const hk=scope?scope+"::"+x:x, hid=h.includes(hk), lock=!scope&&(d.locked||[]).includes(x), n=scope?0:d.use(x);
    return `<tr class="${hid?"inel":""}"><td class="n">${i+1}</td><td><input data-lsname="${esc(scope||"")}" data-i="${i}" value="${esc(x)}"${lock?" disabled":""}></td><td class="n">${scope?"":n}</td>
     <td class="row nowrap"><button class="btn sm" data-act="lsMove" data-scope="${esc(scope||"")}" data-i="${i}" data-v="-1"${i===0?" disabled":""} aria-label="Move up">↑</button><button class="btn sm" data-act="lsMove" data-scope="${esc(scope||"")}" data-i="${i}" data-v="1"${i===items.length-1?" disabled":""} aria-label="Move down">↓</button>
      <button class="btn sm" data-act="lsRename" data-scope="${esc(scope||"")}" data-i="${i}"${lock?" disabled":""}>Save name</button>
      ${lock?'<span class="tag">Used by the platform</span>':`<button class="btn sm" data-act="lsHide" data-scope="${esc(scope||"")}" data-i="${i}">${hid?"Show again":"Hide"}</button>`}${hid?' <span class="tag">Hidden</span>':""}
      ${d.tax&&!scope?`<button class="btn sm" data-act="lsOpen" data-v="${esc(x)}">${ui.open===x?"Close natures":"Natures ("+((raw[x]||[]).length)+")"}</button>`:""}${ui.k==="requestSubtypes"&&!scope?`<label class="radio"><input type="checkbox" data-lsauto="${esc(x)}"${cxc("autoRouteSubtypes").includes(x)?" checked":""}> Goes straight to the LOB manager</label>`:""}</td></tr>
     ${d.tax&&!scope&&ui.open===x?`<tr><td></td><td colspan="3"><div class="inset"><b class="sm">Natures of “${esc(x)}”</b>${listTable(raw[x]||[],x)}${addRow(x)}</div></td></tr>`:""}`; }).join("");
  const listTable=(items,scope)=>items.length?`<div class="tbl"><table><thead><tr><th class="n">#</th><th>Option</th><th class="n">${scope?"":"Records using it"}</th><th></th></tr></thead><tbody>${rowsHtml(items,scope)}</tbody></table></div>`:`<p class="muted">No options yet.</p>`;
  const addRow=scope=>`<div class="row"><input class="grow" data-lsnew="${esc(scope||"")}" placeholder="New option" value="${esc((S.ui.lists.newv||{})[scope||""]||"")}"><button class="btn primary" data-act="lsAdd" data-scope="${esc(scope||"")}">Add</button></div>`;
  let body;
  if(d.perLob){
    const lobOpts=ventures().flatMap(v=>(v.lobs||[]).map(l=>({v:v.id+"|"+l,l:v.code+" · "+l})));
    const lob=ui.lob||(lobOpts[0]||{}).v||"", items=raw[lob]||[];
    body=`<p class="hint">Policies and products for each line of business. When a line of business has a list, people choose from it (with “Other” to type something else); otherwise they type freely.</p>
     <label class="inline">Line of business <select data-ui="lists.lob">${opts(lobOpts,lob)}</select></label>
     ${listTable(items,lob)}${addRow(lob)}`;
  } else body=`${listTable(Array.isArray(raw)?raw:Object.keys(raw),"")}${addRow("")}`;
  return intro+nav+`<h2 class="h3">${esc(d.label)}</h2>`+body;
}
async function listAction(act,el){
  const ui=S.ui.lists||(S.ui.lists={k:"caseTypes"});
  if(act==="lsPick"){ ui.k=el.dataset.v; ui.open=null; return; }
  if(act==="lsOpen"){ ui.open=ui.open===el.dataset.v?null:el.dataset.v; return; }
  if(!S.admin) return;
  const k=ui.k, d=listDef(k), raw=rawList(k), h=[...hiddenOf(k)], scope=el.dataset.scope||"";
  const get=()=>d.perLob?(raw[scope]=raw[scope]||[]):d.tax&&scope?(raw[scope]=raw[scope]||[]):(d.tax?Object.keys(raw):raw);
  const put2=(arr,note,hid)=>{ let val;
    if(d.perLob||(d.tax&&scope)){ raw[scope]=arr; val=raw; }
    else if(d.tax){ const o={}; arr.forEach(x=>o[x]=raw[x]||[]); val=o; } else val=arr;
    return saveList(k,val,hid||h,note); };
  if(act==="lsAdd"){
    const inp=document.querySelector(`[data-lsnew="${CSS.escape(scope)}"]`), v=String(inp&&inp.value||"").trim(); if(!v) return toast("Type the new option.");
    const arr=get().slice(); if(arr.some(x=>norm(x)===norm(v))) return toast("That option is already in the list.");
    arr.push(v); if(await put2(arr,"added “"+v+"”"+(scope?" under "+scope:""))) toast("Added."); if(S.ui.lists.newv) delete S.ui.lists.newv[scope]; return; }
  const i=+el.dataset.i, arr=get().slice(), item=arr[i];
  if(act==="lsMove"){ const j=i+Number(el.dataset.v); if(j<0||j>=arr.length) return; [arr[i],arr[j]]=[arr[j],arr[i]]; await put2(arr,"reordered"); return; }
  if(act==="lsHide"){ const hk=scope&&!d.perLob?scope+"::"+item:d.perLob?scope+"::"+item:item, on=!h.includes(hk); const nh=on?[...h,hk]:h.filter(x=>x!==hk);
    if(await put2(arr,(on?"hid “":"showed “")+item+"”",nh)) toast(on?"Hidden. Records already using it keep it.":"Shown again."); return; }
  if(act==="lsRename"){ const inp=document.querySelector(`[data-lsname="${CSS.escape(scope)}"][data-i="${i}"]`), v=String(inp&&inp.value||"").trim();
    if(!v||v===item) return toast("Change the name first."); if(arr.some((x,j)=>j!==i&&norm(x)===norm(v))) return toast("That name is already in the list.");
    if((d.locked||[]).includes(item)) return toast("This option is used by the platform and can't be renamed.");
    arr[i]=v; let nh=h.map(x=>x===item?v:x.startsWith(item+"::")&&d.tax&&!scope?v+x.slice(item.length):x);
    if(d.tax&&!scope){ raw[v]=raw[item]||[]; delete raw[item]; }
    if(k==="requestSubtypes"&&cxc("autoRouteSubtypes").includes(item)){ const c=clone(S.cfg); c.cx={...(c.cx||{}),autoRouteSubtypes:cxc("autoRouteSubtypes").map(x=>x===item?v:x)}; S.cfg=c; }
    if(await put2(arr,"renamed “"+item+"” to “"+v+"”",nh)) toast("Renamed. Records that already use “"+item+"” keep that wording."); return; }
}
async function listAuto(el){ if(!S.admin) return; const v=el.dataset.lsauto, cur=cxc("autoRouteSubtypes"); const next=el.checked?[...new Set([...cur,v])]:cur.filter(x=>x!==v);
  const c=clone(S.cfg); c.cx={...(c.cx||{}),autoRouteSubtypes:next}; if(await put("mod/core/config/main",c)){ await addAudit("lists","autoRouteSubtypes","List changed",null,null,(el.checked?"auto-route ":"stop auto-routing ")+v); toast("Saved."); } }
