const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const ctx = await b.newContext({ viewport:{width:1400,height:950} });
  await ctx.route(/xlsx/, r => r.fulfill({path:require.resolve('xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'})); await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d=>d.accept('Logged twice by mistake'));
  await p.goto('http://127.0.0.1:8301/index.html'); await p.waitForTimeout(1200);
  const click = async s => { await p.click(s); await p.waitForTimeout(350); };
  const keys = pre => p.evaluate(x=>[...window.__store.keys()].filter(k=>k.startsWith(x)), pre);
  // product finding with priority
  await click('#rail [data-nav="product"]'); await click('[data-act="regNew"]'); await click('[data-act="vStepPick"][data-v="insurancemarket"]');
  console.log('priority options', (await p.$$eval('[data-d="r-new-product"][data-f="priority"] option', o=>o.map(x=>x.textContent))).join(' | '));
  await p.selectOption('[data-d="r-new-product"][data-f="lob"]','insurancemarket|Health'); await p.selectOption('[data-d="r-new-product"][data-f="priority"]',{index:1});
  await p.fill('[data-d="r-new-product"][data-f="product"]','Health renewal journey'); await p.fill('[data-d="r-new-product"][data-f="finding"]','Renewal link expires early'); await p.selectOption('[data-d="r-new-product"][data-f="impact"]','Customer');
  await click('[data-act="regSave"]'); await click('[data-act="regBack"]'); await p.screenshot({path:'out/70-product.png'});
  const pf=(await keys('mod/reg/records/PF-'))[0]; console.log('saved priority', (await p.evaluate(k=>window.__store.get(k).priority, pf)));
  // edit keeps old values
  await click(`[data-act="regOpen"][data-id="${pf.split('/').pop()}"]`); await p.selectOption(`[data-d="r-${pf.split('/').pop()}"][data-f="priority"]`,{index:2}); await click('[data-act="regSave"]');
  console.log('history before', JSON.stringify((await p.evaluate(k=>window.__store.get(k).history.slice(-1)[0].before, pf))));
  // delete -> recycle bin -> restore
  await click('[data-act="regDelete"]'); console.log('record gone', !(await p.evaluate(k=>window.__store.has(k), pf)), 'trash', (await keys('mod/sys/trash/')).length);
  await click('#rail [data-nav="trash"]'); await p.screenshot({path:'out/71-trash.png'});
  console.log('bin rows', (await p.$$('[data-act="trashRestore"]')).length);
  await click('[data-act="trashRestore"][data-src="platform"]'); console.log('record restored', await p.evaluate(k=>window.__store.has(k), pf));
  await click('[data-act="trashRestore"][data-src="qa"]'); console.log('qa eval restored', await p.evaluate(()=>window.__store.has('mod/qa/evaluations/IM-MOT-9')));
  // QA tool: business outcome field present, restore admin-only, purge off
  await click('#rail [data-nav="calls"]'); await p.waitForTimeout(2500);
  const f = p.frames().find(x=>x!==p.mainFrame());
  console.log('QA biz field', await f.evaluate(()=>{ go("evaluate"); return !!document.querySelector('[data-bind="intake.businessOutcome"]'); }));
  console.log('errs', errs.join('|'));
  await b.close();
})();
