const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const ctx = await b.newContext({ viewport:{width:1400,height:950} });
  await ctx.route(/xlsx/, r => r.fulfill({path:require.resolve('xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'})); await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d=>d.accept());
  await p.goto('http://127.0.0.1:8301/rr.html'); await p.waitForTimeout(1300);
  const click = async s => { await p.click(s); await p.waitForTimeout(350); };
  await click('#rail [data-nav="rr"]');
  const rows = await p.$$eval('section.sect', secs=>secs.map(s=>[s.querySelector('h3').textContent.split('·')[0].trim(), [...s.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()).join(' | '))]));
  for (const [h,r] of rows){ console.log('== '+h); r.forEach(x=>console.log('   '+x)); }
  await p.screenshot({path:'out/90-rr.png', fullPage:true});
  // nomination: self-nomination blocked? SS nominating F1 and F2, then a third from same team blocked
  await click('[data-act="rrTab2"][data-v="noms"]');
  for (const n of ['F1','F2','F1']) { await p.selectOption('[data-d="rrn-new"][data-f="groupId"]','sup-fin'); await p.selectOption('[data-d="rrn-new"][data-f="staffId"]','stf-'+n).catch(()=>{}); await p.fill('[data-d="rrn-new"][data-f="ev_volumes"]','1,200 refunds processed'); await p.check('[data-d="rrn-new"][data-f="noConflict"]'); await click('[data-act="rrSaveN"]'); console.log('nominate', n, '->', await p.textContent('#toast')); }
  // score F1 22 (client 5) and F2 22 (client 4)
  const ids = await p.evaluate(()=>[...window.__store.values()].filter(v=>v.track==='support').map(v=>[v.staffId,v.id]));
  const sc={'stf-F1':{client:5,internal:4,volumes:5,accuracy:4,extra:4},'stf-F2':{client:4,internal:5,volumes:5,accuracy:4,extra:4}};
  for (const [sid,id] of ids) for (const [c,v] of Object.entries(sc[sid])) { await p.selectOption(`[data-rrscore="${id}"][data-c="${c}"]`, String(v)); await p.waitForTimeout(120); }
  await click('[data-act="rrTab2"][data-v="standings"]');
  const sup = await p.$$eval('section.sect', secs=>secs.filter(s=>s.querySelector('h3').textContent.startsWith('Finance')).map(s=>[...s.querySelectorAll('tbody tr')].map(tr=>tr.textContent.replace(/\s+/g,' ').trim())));
  console.log('== Finance support', JSON.stringify(sup));
  // phases: close -> validation -> validate groups -> appeals
  await click('[data-act="rrPhase"][data-v="closed"]'); await click('[data-act="rrPhase"][data-v="validation"]');
  for (const g of ['adv-mo','clm-m','sup-fin']) await click(`[data-act="rrValidate"][data-g="${g}"]`);
  await click('[data-act="rrPhase"][data-v="appeals"]');
  console.log('phase', await p.evaluate(()=>window.__store.get('mod/rr/programmes/im-cx-2026-10').phase), '| finalise button shown during window?', !!(await p.$('[data-act="rrPhase"][data-v="final"]')));
  await click('[data-act="rrExport"]'); console.log('export', JSON.stringify(await p.evaluate(()=>window.__dl.map(x=>x.name))));
  console.log('errs', errs.join('|'));
  await b.close();
})();
