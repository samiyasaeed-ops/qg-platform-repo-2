/* ================= Staff list: add many people at once, catch duplicates ================= */
function lev(a,b){ a=norm(a); b=norm(b); if(a===b) return 0; const m=a.length,n=b.length; if(!m||!n) return Math.max(m,n); let prev=Array.from({length:n+1},(_,i)=>i);
  for(let i=1;i<=m;i++){ const cur=[i]; for(let j=1;j<=n;j++) cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1)); prev=cur; } return prev[n]; }
const nameKey=s=>norm(s).replace(/[^a-z ]/g,"").split(" ").filter(Boolean).sort().join(" ");
function dupOf(row,exceptId){
  const out=[];
  for(const p of Object.values(S.staff)){ if(p.id===exceptId) continue;
    if(row.email&&p.email&&norm(p.email)===norm(row.email)) out.push({p,why:"same work email",hard:true});
    else if(row.employeeId&&p.employeeId&&norm(p.employeeId)===norm(row.employeeId)) out.push({p,why:"same employee ID",hard:true});
    else if(row.name&&p.name&&(nameKey(p.name)===nameKey(row.name))) out.push({p,why:"same name",hard:false});
    else if(row.name&&p.name&&row.name.length>4&&lev(p.name,row.name)<=2) out.push({p,why:"very similar name",hard:false}); }
  return out;
}
function bulkRowsInit(){ return Array.from({length:5},()=>({})); }
function viewBulkAdd(){
  const ui=S.ui.bulk||(S.ui.bulk={rows:bulkRowsInit()}), rows=ui.rows;
  const teams=Object.values(S.teams).filter(t=>t.active!==false).sort((a,b)=>(a.venture+a.name).localeCompare(b.venture+b.name));
  const people=staffList().map(p=>({v:p.id,l:p.name}));
  const body=rows.map((r,i)=>{ const t=S.teams[r.teamId], dc=bulkDupCell(rows,i);
    return `<tr class="${dc.flag}" data-bulkrow="${i}"><td>${i+1}</td>
     <td><input data-bulk="${i}" data-f="name" value="${esc(r.name||"")}" placeholder="Full name"></td>
     <td><input data-bulk="${i}" data-f="employeeId" value="${esc(r.employeeId||"")}" placeholder="E1234"></td>
     <td><input data-bulk="${i}" data-f="email" type="email" value="${esc(r.email||"")}" placeholder="name@alfred.holdings"></td>
     <td><input data-bulk="${i}" data-f="designation" value="${esc(r.designation||"")}"></td>
     <td><select data-bulk="${i}" data-f="role">${opts(ROLES.map(([v,l])=>({v,l})),r.role||"advisor")}</select></td>
     <td><select data-bulk="${i}" data-f="teamId">${opts(teams.map(x=>({v:x.id,l:vInfo(x.venture).code+" · "+x.name})),r.teamId||"","Choose team")}</select></td>
     <td><select data-bulk="${i}" data-f="managerId">${opts(people,r.managerId||(t&&t.lineManagerId)||"",t&&t.lineManagerId?"Team's line manager":"Choose")}</select></td>
     <td><input data-bulk="${i}" data-f="from" type="date" value="${esc(r.from||todayD())}"></td>
     <td class="wrap dupcell">${dc.html}</td>
     <td><button class="btn sm" data-act="bulkDel" data-i="${i}" aria-label="Remove row">×</button></td></tr>`; }).join("");
  return `<div class="crumbs"><button class="linkbtn" data-act="staffBack">Staff list</button> / Add people</div><h2 class="h2">Add people</h2>
   <p class="lead">Add as many people as you need in one go, with their team, role and line manager. Duplicates are flagged as you type: an exact match on work email or employee ID, or a same or very similar name.</p>
   ${!teams.length?`<div class="callout amb">Add teams first (Staff list, Teams), then people.</div>`:""}
   <div class="tbl bulk"><table><thead><tr><th>#</th><th class="req">Full name</th><th>Employee ID</th><th>Work email</th><th>Designation</th><th>Role</th><th class="req">Team</th><th>Line manager</th><th>Start date</th><th>Duplicate check</th><th></th></tr></thead><tbody>${body}</tbody></table></div>
   <div class="row"><button class="btn" data-act="bulkAddRow">Add 5 more rows</button><button class="btn primary" data-act="bulkSave">Save people</button><button class="btn" data-act="staffBack">Cancel</button></div>
   <p class="hint">Rows left empty are ignored. A row matching someone already in the list is skipped, unless you tick to fill that person's empty fields; nothing already recorded is overwritten. The line manager defaults to the team's line manager.</p>`;
}
async function bulkAction(act,el){
  const ui=S.ui.bulk||(S.ui.bulk={rows:bulkRowsInit()});
  if(act==="bulkOpen"){ S.ui.bulk={rows:bulkRowsInit()}; S.sel.person="__bulk"; return; }
  if(act==="bulkAddRow"){ ui.rows.push(...bulkRowsInit()); return; }
  if(act==="bulkDel"){ ui.rows.splice(+el.dataset.i,1); if(!ui.rows.length) ui.rows=bulkRowsInit(); return; }
  if(act!=="bulkSave"||!S.admin) return;
  const filled=ui.rows.map((r,i)=>({r,i})).filter(({r})=>(r.name||"").trim()||(r.email||"").trim()||(r.employeeId||"").trim());
  if(!filled.length) return toast("Fill in at least one row.");
  const errs=[];
  filled.forEach(({r,i})=>{ if(!String(r.name||"").trim()) errs.push(`Row ${i+1}: add the name`); if(!r.teamId&&!r.fillExisting) errs.push(`Row ${i+1}: choose the team`);
    if(r.email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) errs.push(`Row ${i+1}: check the email`);
    const d=dupOf(r); if(!d.some(x=>x.hard)&&d.length&&!r.notDup) errs.push(`Row ${i+1}: confirm it's not the same person as ${d[0].p.name}`); });
  if(errs.length) return toast(errs.slice(0,3).join(". ")+(errs.length>3?` and ${errs.length-3} more`:"")+".");
  let added=0, filledN=0, skipped=0;
  for(const {r} of filled){
    const hard=dupOf(r).filter(x=>x.hard);
    if(hard.length){ if(!r.fillExisting){ skipped++; continue; }
      const p=hard[0].p, part={}; ["employeeId","email","designation"].forEach(f=>{ if(!p[f]&&r[f]) part[f]=f==="email"?r[f].trim().toLowerCase():r[f].trim(); }); if(!p.managerId&&r.managerId) part.managerId=r.managerId;
      if(Object.keys(part).length&&await patch("mod/core/staff/"+p.id,{...part,updatedAt:nowMs()})){ filledN++; await addAudit("person",p.id,"Filled from bulk add",null,part,Object.keys(part).join(", ")); } else skipped++;
      continue; }
    const t=S.teams[r.teamId];
    const np={id:rid("stf-"),name:r.name.trim(),employeeId:String(r.employeeId||"").trim(),email:String(r.email||"").trim().toLowerCase(),designation:String(r.designation||"").trim(),roles:[r.role||"advisor"],managerId:r.managerId&&r.managerId!==(t&&t.lineManagerId)?r.managerId:null,assignments:[{teamId:r.teamId,from:r.from||todayD(),to:null}],createdAt:nowMs(),updatedAt:nowMs()};
    if(await put("mod/core/staff/"+np.id,np)){ added++; await addAudit("person",np.id,"Added",null,null,"Bulk add: "+teamName(r.teamId)+" from "+fmtD(np.assignments[0].from)); syncAdvisor(np); }
  }
  S.ui.bulk={rows:bulkRowsInit()}; S.sel.person=null;
  toast(`${added} added${filledN?`, ${filledN} existing people updated`:""}${skipped?`, ${skipped} skipped as already in the list`:""}.`);
}
function bulkInput(el){ const ui=S.ui.bulk; if(!ui) return false; const i=+el.dataset.bulk, f=el.dataset.f; ui.rows[i]=ui.rows[i]||{}; ui.rows[i][f]=el.type==="checkbox"?el.checked:el.value; return true; }

/* review possible duplicates already in the list */
function dupGroups(){
  const ps=Object.values(S.staff), seen=new Set(), groups=[];
  for(const p of ps){ if(seen.has(p.id)) continue;
    const m=dupOf(p,p.id).filter(x=>!(p.notDupWith||[]).includes(x.p.id)&&!(x.p.notDupWith||[]).includes(p.id));
    if(m.length){ const g=[p,...m.map(x=>x.p)].filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i); g.forEach(x=>seen.add(x.id)); groups.push({g,why:m.map(x=>x.why)}); } }
  return groups;
}
function viewDupReview(){
  const gs=dupGroups();
  return `<h3 class="h3">Possible duplicates in the list</h3>${gs.length?gs.map((x,i)=>`<div class="dupgroup"><div class="row between"><b>${esc(x.g.map(p=>p.name).join(" · "))}</b><span class="tag amb">${esc([...new Set(x.why)].join(", "))}</span></div>
     <div class="tbl sm"><table><thead><tr><th>Name</th><th>Employee ID</th><th>Email</th><th>Team today</th><th>Added</th><th>Records linked</th><th></th></tr></thead><tbody>${x.g.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.employeeId)}</td><td>${esc(p.email)}</td><td>${esc(teamName((asgAt(p)||{}).teamId))}</td><td>${stampCell(p.createdAt)}</td><td>${linkedCount(p.id)}</td><td><button class="btn sm" data-act="personOpen" data-id="${esc(p.id)}">Open and edit</button></td></tr>`).join("")}</tbody></table></div>
     <div class="row"><button class="btn sm" data-act="dupNotSame" data-ids="${esc(x.g.map(p=>p.id).join(","))}">These are different people</button><span class="hint" style="margin:0">If they're the same person, correct the details on one and mark the other as a leaver, so records stay linked to the right person.</span></div></div>`).join(""):`<div class="emptybox">No possible duplicates found.</div>`}`;
}
function linkedCount(id){ return S.cases.filter(c=>c.staffId===id||c.assigneeId===id||(c.intake||{}).lmId===id).length+S.recs.filter(r=>Object.values(r).includes(id)).length+S.tasks.filter(t=>t.assigneeId===id).length; }
async function dupNotSame(ids){
  const list=ids.split(",");
  for(const id of list){ const p=S.staff[id]; await patch("mod/core/staff/"+id,{notDupWith:[...new Set([...(p.notDupWith||[]),...list.filter(x=>x!==id)])]}); }
  await addAudit("person",list[0],"Marked as different people",null,null,list.map(personName).join(", "));
  toast("Marked as different people.");
}

function bulkDupCell(rows,i){
  const r=rows[i]||{}, d=r.name||r.email||r.employeeId?dupOf(r):[], hard=d.filter(x=>x.hard), soft=d.filter(x=>!x.hard);
  const g=rows.findIndex((x,j)=>j<i&&((r.email&&norm(x.email)===norm(r.email))||(r.employeeId&&norm(x.employeeId)===norm(r.employeeId))||(r.name&&nameKey(x.name)===nameKey(r.name))));
  const html=hard.map(x=>`<span class="tag red">Already in Staff list (${esc(x.why)})</span> <button class="linkbtn" data-act="personOpen" data-id="${esc(x.p.id)}">${esc(x.p.name)}</button><br><label class="radio"><input type="checkbox" data-bulk="${i}" data-f="fillExisting"${r.fillExisting?" checked":""}> Fill ${esc(x.p.name.split(" ")[0])}'s empty fields instead</label>`).join("<br>")
    +(!hard.length&&soft.length?soft.map(x=>`<span class="tag amb">Possible duplicate (${esc(x.why)})</span> <button class="linkbtn" data-act="personOpen" data-id="${esc(x.p.id)}">${esc(x.p.name)}</button>`).join("<br>")+`<br><label class="radio"><input type="checkbox" data-bulk="${i}" data-f="notDup"${r.notDup?" checked":""}> Not the same person</label>`:"")
    +(g>=0?`<span class="tag amb">Same as row ${g+1}</span>`:"");
  return {html,flag:hard.length?"dup":soft.length||g>=0?"maybe":""};
}
function bulkRefresh(){
  const ui=S.ui.bulk; if(!ui) return;
  ui.rows.forEach((r,i)=>{ const tr=document.querySelector(`tr[data-bulkrow="${i}"]`); if(!tr) return; const dc=bulkDupCell(ui.rows,i);
    tr.className=dc.flag; const cell=tr.querySelector(".dupcell"); if(cell&&cell.innerHTML!==dc.html&&!cell.contains(document.activeElement)) cell.innerHTML=dc.html;
    const t=S.teams[r.teamId], ms=tr.querySelector('[data-f="managerId"]'); if(ms&&t&&!r.managerId&&t.lineManagerId) ms.value=t.lineManagerId; });
}
