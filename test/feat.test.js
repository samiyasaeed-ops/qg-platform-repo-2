const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const ctx = await b.newContext({ viewport:{width:1400,height:950} });
  await ctx.route(/xlsx/, r => r.fulfill({path:require.resolve('xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'})); await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d=>d.accept());
  await p.goto('http://127.0.0.1:8301/index.html'); await p.waitForTimeout(1200);
  const click = async s => { await p.click(s); await p.waitForTimeout(350); };
  const store = k => p.evaluate(x=>window.__store.get(x), k);
  // duplicate detection: case 000009 has mobile 0501234567 open
  await click('#rail [data-nav="complaints"]'); await click('[data-act="cxNew"]'); await click('[data-act="vStepPick"][data-v="insurancemarket"]');
  await p.fill('[data-d="new-complaints"][data-f="mobile"]','050 123 4567'); await p.press('[data-d="new-complaints"][data-f="mobile"]','Tab'); await p.waitForTimeout(400);
  console.log('dup box', !!(await p.$('[data-act="cxDupNote"]')));
  await p.selectOption('[data-d="new-complaints"][data-f="source"]','Email'); await p.selectOption('[data-d="new-complaints"][data-f="lob"]','insurancemarket|Motor');
  await p.fill('[data-d="new-complaints"][data-f="subject"]','Same issue again'); await p.fill('[data-d="new-complaints"][data-f="description"]','Customer chasing');
  await click('[data-act="cxCreate"]'); console.log('blocked create toast:', await p.textContent('#toast'));
  await click('[data-act="cxDupNote"]'); const c9=await store('mod/cx/cases/CX-2026-000009'); console.log('note added to 000009:', (c9.notes||[]).length);
  await p.screenshot({path:'out/60-dupnote.png', fullPage:true});
  // notes + dial + gap control on case 000009 (with_lm, SS admin can act)
  await p.fill('[data-d="note-CX-2026-000009"][data-f="text"]','Spoke to branch, awaiting docs'); await click('[data-act="cxNote"]');
  console.log('notes now', (await store('mod/cx/cases/CX-2026-000009')).notes.length);
  await p.$eval('[data-act="cxDial"]', a=>a.setAttribute('href','#')); await click('[data-act="cxDial"]'); await p.waitForTimeout(400);
  console.log('pending calls', (await store('mod/cx/cases/CX-2026-000009')).pendingCalls.length, 'prefilled time', await p.inputValue('[data-d="CX-2026-000009"][data-f="aTime"]'));
  await p.screenshot({path:'out/61-pending.png', fullPage:true});
  await click('[data-act="cxNoConnect"]'); const c9b=await store('mod/cx/cases/CX-2026-000009'); console.log('after not connected: pending', c9b.pendingCalls.length, 'attempts', c9b.lm.attempts.length, c9b.lm.attempts[0].outcome);
  // journey test with image
  await click('#rail [data-nav="journey"]'); await click('[data-act="regNew"]'); await click('[data-act="vStepPick"][data-v="insurancemarket"]');
  await p.selectOption('[data-d="r-new-journey"][data-f="lob"]','insurancemarket|Motor'); await p.selectOption('[data-d="r-new-journey"][data-f="priority"]',{index:2}); await p.fill('[data-d="r-new-journey"][data-f="journey"]','Motor quote online'); await p.selectOption('[data-d="r-new-journey"][data-f="channel"]','Website'); await p.selectOption('[data-d="r-new-journey"][data-f="result"]','Fail');
  await click('[data-act="regSave"]'); await p.waitForTimeout(400);
  await p.setInputFiles('[data-recfile]', ['shot.png','shot.png']); await p.waitForTimeout(800);
  const jr=await p.evaluate(()=>[...window.__store.values()].find(v=>v.section==='journey'&&v.journey==='Motor quote online')); console.log('journey files', (jr.files||[]).length);
  await p.screenshot({path:'out/62-journey.png', fullPage:true});
  // backups
  await click('#rail [data-nav="data"]'); await click('[data-act="bkDrive"]'); await p.waitForTimeout(1200);
  console.log('drive uploads', await p.evaluate(()=>window.__drive.map(d=>d.title+' '+d.contentMimeType.slice(-5)+' '+Math.round(d.base64Content.length/1024)+'k parent '+d.parentId).join(' | ')));
  await click('[data-act="bkDownload"]'); await p.waitForTimeout(600); console.log('download', JSON.stringify(await p.evaluate(()=>window.__dl)));
  // import CSV
  await click('[data-act="impOpen"]'); await click('[data-act="impVen"][data-v="insurancemarket"]');
  await p.setInputFiles('[data-imp3file]','import.csv'); await p.waitForTimeout(800);
  console.log('import summary', (await p.textContent('.imppanel .figs4')).replace(/\s+/g,' '));
  await click('[data-act="impGo"]'); await p.waitForTimeout(1500);
  const imp=await p.evaluate(()=>[...window.__store.values()].filter(v=>v.imported&&v.ref).map(v=>v.ref+':'+v.status+':'+v.lob));
  console.log('imported', JSON.stringify(imp));
  // timings + performance
  await click('#rail [data-nav="calls"]'); await click('[data-act="setView"][data-v="timings"]'); await p.screenshot({path:'out/64-timings.png'});
  await p.waitForTimeout(12000);
  if(await p.$('#alertHost:not([hidden])')) { await p.screenshot({path:'out/65-alert.png'}); await click('[data-act="alertAck"]'); }
  await click('#rail [data-nav="perf"]'); await p.screenshot({path:'out/66-perf.png', fullPage:true});
  console.log('tat log', await p.evaluate(()=>[...window.__store.keys()].filter(k=>k.startsWith('mod/perf/tat/')).length));
  console.log('errs', errs.join('|'));
  await b.close();
})();
