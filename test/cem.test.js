const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const ctx = await b.newContext({viewport:{width:1400,height:950}}); await ctx.route(/xlsx/, r => r.fulfill({path:require.resolve('xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'})); await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d=>d.accept('ok'));
  await p.goto('http://127.0.0.1:8301/cx.html'); await p.waitForTimeout(1500);
  const click = async s => { if(await p.$('#alertHost:not([hidden]) [data-act="alertAck"]')){ await p.click('[data-act="alertAck"]'); await p.waitForTimeout(250);} await p.click(s); await p.waitForTimeout(350); };
  await click('#rail [data-nav="complaints"]'); await click('[data-act="cxQueue"][data-q="all"]');
  await click('[data-act="cxOpen"][data-ref="CX-2026-000009"]');
  console.log('target line:', await p.textContent('.casehead .lead'));
  // follow-up from the closed draft case 88 (it auto-closes after sweeper; use it once closed)
  await p.waitForTimeout(19000);
  await click('#rail [data-nav="complaints"]'); await click('[data-act="cxBack"]').catch(()=>{}); await click('[data-act="cxQueue"][data-q="closed"]'); await click('[data-act="cxOpen"][data-ref="CX-2026-000088"]');
  await click('[data-act="cxFollowUp"]');
  console.log('follow-up form:', (await p.textContent('.callout')).trim(), '| venture step', await p.textContent('.vstep'));
  await p.selectOption('[data-d="new-complaints"][data-f="source"]','QA inbox'); await p.fill('[data-d="new-complaints"][data-f="description"]','Customer came back about the same issue.');
  await click('[data-act="cxCreate"]'); await p.waitForTimeout(500);
  const fu=await p.evaluate(()=>[...window.__store.values()].find(v=>v.linkedTo==='CX-2026-000088'));
  console.log('follow-up created', fu&&fu.ref, fu&&fu.source, '| original timeline', (await p.evaluate(()=>window.__store.get('mod/cx/cases/CX-2026-000088').timeline.slice(-1)[0].ev)));
  await click('#rail [data-nav="complaints"]'); if(await p.$('[data-act="cxBack"]')) await click('[data-act="cxBack"]'); await click('[data-act="setView"][data-v="reports"]');
  await p.fill('[data-ui="rep-complaints.from"]','2026-08-01'); await p.press('[data-ui="rep-complaints.from"]','Tab'); await p.waitForTimeout(400);
  console.log('measures:', (await p.$$eval('h3.h3 + p + .tbl tbody tr', r=>r.map(x=>x.children[0].textContent+' = '+x.children[1].textContent.replace(/\s+/g,' ')))).join(' | '));
  await p.screenshot({path:'out/102-measures.png', fullPage:true});
  console.log('types', (await p.evaluate(()=>1)), 'errs', errs.join('|')); await b.close();
})();
