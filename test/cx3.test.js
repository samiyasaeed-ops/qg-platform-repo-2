const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const ctx = await b.newContext({viewport:{width:1400,height:950}}); await ctx.route(/xlsx/, r => r.fulfill({path:require.resolve('xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'})); await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d=>d.accept('ok'));
  await p.goto('http://127.0.0.1:8301/cx.html'); await p.waitForTimeout(1200);
  const click = async s => { if(await p.$('#alertHost:not([hidden]) [data-act="alertAck"]')){ await p.click('[data-act="alertAck"]'); await p.waitForTimeout(250);} await p.click(s); await p.waitForTimeout(350); };
  const K='new-complaints', f=(k,v)=>p.fill(`[data-d="${K}"][data-f="${k}"]`,v), s=async(k,v)=>{ await p.selectOption(`[data-d="${K}"][data-f="${k}"]`,v); await p.waitForTimeout(150); };
  const store=k=>p.evaluate(x=>window.__store.get(x),k);
  // 1. Advisor change request about the line manager -> auto-route to superior
  await click('#rail [data-nav="complaints"]'); await click('[data-act="cxNew"]'); await click('[data-act="vStepPick"][data-v="insurancemarket"]');
  console.log('types', (await p.$$eval(`[data-d="${K}"][data-f="type"] option`, o=>o.map(x=>x.value))).join(' | '));
  await s('type','Service – Request'); await s('requestSubtype','Advisor change'); await s('source','HAPEX (call centre, 800-ALFRED)'); await f('dealRef','DL-501'); await s('lob','insurancemarket|Motor'); await s('staffId','stf-lm');
  await f('subject','Wants a different advisor'); await f('description','Customer unhappy with advisor, wants change.'); await click('[data-act="cxCreate"]'); await p.waitForTimeout(700);
  const r1=await p.evaluate(()=>[...window.__store.values()].find(v=>v.subject==='Wants a different advisor'));
  console.log('auto-route:', r1.status, 'to', r1.intake.lmId, '| system note:', r1.timeline.slice(-1)[0].ev, '|', r1.timeline.slice(-1)[0].note);
  // 2. Complaint with type/nature; LM 3 unreachable attempts -> auto close
  await click('#rail [data-nav="complaints"]'); if(await p.$('[data-act="cxBack"]')) await click('[data-act="cxBack"]'); await click('[data-act="cxNew"]'); await click('[data-act="vStepPick"][data-v="insurancemarket"]');
  await s('type','Complaint'); await s('source','Email'); await f('dealRef','DL-777'); await s('lob','insurancemarket|Motor'); await s('complaintType','Delay in process'); await s('nature','Claim'); await f('product','Comprehensive motor');
  await f('subject','Claim delay'); await f('description','Claim pending 3 weeks.'); await click('[data-act="cxCreate"]'); await p.waitForTimeout(500);
  const r2=await p.evaluate(()=>[...window.__store.values()].find(v=>v.subject==='Claim delay')); const ref=r2.ref;
  console.log('registered', ref, r2.complaintType, '·', r2.nature, '·', r2.product, '| status tag', await p.textContent('.casehead .tag'));
  await p.fill(`[data-d="${ref}"][data-f="comment"]`,'Valid concern'); await p.check(`input[name="ct-${ref}"][value="no"]`); await p.waitForTimeout(200);
  await p.selectOption(`[data-d="${ref}"][data-f="teamId"]`,'tm-motor'); await p.waitForTimeout(200); await click('[data-act="cxRoute"]');
  for (let i=0;i<3;i++){ await p.fill(`[data-d="${ref}"][data-f="aTime"]`,'1'+i+':00'); await p.fill(`[data-d="${ref}"][data-f="aCall"]`,'C'+i); await p.selectOption(`[data-d="${ref}"][data-f="aOutcome"]`,'No answer'); await p.waitForTimeout(200);
    if(i===0){ await click('[data-act="cxAttempt"]'); console.log('without email ->', await p.textContent('#toast')); }
    await p.check(`[data-d="${ref}"][data-f="aEmail"]`); await p.fill(`[data-d="${ref}"][data-f="aEmailSubject"]`,'We tried to reach you'); await click('[data-act="cxAttempt"]'); }
  const r2b=await store('mod/cx/cases/'+ref); console.log('after 3 attempts:', r2b.status, r2b.closure.reason, '| system?', r2b.timeline.slice(-1)[0].sys);
  await p.screenshot({path:'out/99-notreach.png', fullPage:true});
  await click('[data-act="cxReopen"]'); console.log('reopened ->', (await store('mod/cx/cases/'+ref)).status);
  // 3. draft auto-close (old no-match case) after sweeper
  await p.waitForTimeout(19000);
  const d88=await store('mod/cx/cases/CX-2026-000088'); console.log('draft auto-close:', d88.status, d88.closure.reason);
  // 4. reports
  await click('#rail [data-nav="complaints"]'); if(await p.$('[data-act="cxBack"]')) await click('[data-act="cxBack"]'); await click('[data-act="setView"][data-v="reports"]'); await p.selectOption('[data-ui="rep-complaints.by"]','complaintType'); await p.waitForTimeout(300);
  console.log('report rows', (await p.$$eval('.tbl tbody tr', r=>r.map(x=>x.children[0].textContent+':'+x.children[1].textContent))).join(' | '));
  await p.screenshot({path:'out/100-reports.png'});
  await click('[data-act="cxRepExport"]'); console.log('export', JSON.stringify(await p.evaluate(()=>window.__dl.map(x=>x.name))));
  // 5. staff bulk add with duplicates
  await click('#rail [data-nav="staff"]'); await click('[data-act="bulkOpen"]');
  const B=(i,f,v)=>p.fill(`[data-bulk="${i}"][data-f="${f}"]`,v), BS=async(i,f,v)=>{ await p.selectOption(`[data-bulk="${i}"][data-f="${f}"]`,v); await p.waitForTimeout(250); };
  await B(0,'name','Sara Ahmed'); await B(0,'email','sara@example.com'); await BS(0,'teamId','tm-motor');
  await B(1,'name','Lina Managr'); await BS(1,'teamId','tm-motor');
  await B(2,'name','Someone'); await B(2,'email','lm@example.com'); await BS(2,'teamId','tm-motor'); await p.press(`[data-bulk="2"][data-f="email"]`,'Tab'); await p.waitForTimeout(400);
  console.log('flags', (await p.$$eval('.bulk tbody tr', r=>r.slice(0,3).map(x=>x.className+':'+x.querySelector('.dupcell').textContent.replace(/\s+/g,' ').trim().slice(0,70)))).join(' || '));
  await p.screenshot({path:'out/101-bulk.png', fullPage:true});
  await click('[data-act="bulkSave"]'); console.log('save1 ->', await p.textContent('#toast'));
  await p.check('[data-bulk="1"][data-f="notDup"]'); await click('[data-act="bulkSave"]'); console.log('save2 ->', await p.textContent('#toast'));
  await click('[data-act="staffTab"][data-k="dups"]'); console.log('dup groups', (await p.$$('.dupgroup')).length);
  console.log('errs', errs.join('|')); await b.close();
})();
