const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const ctx = await b.newContext({viewport:{width:1400,height:950}}); await ctx.route(/xlsx/, r => r.fulfill({path:require.resolve('xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'})); await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8301/rr.html'); await p.waitForTimeout(1300);
  const click = async s => { await p.click(s); await p.waitForTimeout(300); };
  const grp = await p.$$eval('#rail .grp', g=>g.map(x=>x.textContent)); const items = await p.$$eval('#rail button', b=>b.map(x=>x.dataset.nav));
  console.log('R&R items', items.slice(items.indexOf('rr'), items.indexOf('rr')+3).join(','), '| CX items', items.slice(1,3).join(','));
  await click('#rail [data-nav="rr"]'); await click('[data-act="rrAdd"][data-v="menu"]'); await p.screenshot({path:'out/96-addmenu.png'});
  console.log('menu', (await p.$$eval('.addmenu b', x=>x.map(y=>y.textContent))).join(' | '));
  await click('[data-act="rrAdd"][data-v="part"]'); console.log('participant form focused', await p.evaluate(()=>document.activeElement.dataset.f));
  await click('[data-act="rrAdd"][data-v="menu"]'); await click('[data-act="rrAdd"][data-v="reviews"]'); console.log('went to', await p.textContent('#sechead h1'), '| new form', !!(await p.$('[data-act="vStepPick"]')));
  await click('#rail [data-nav="home"]'); console.log('home R&R tiles', (await p.$$eval('.tgroup.rrg .tl', x=>x.map(y=>y.textContent))).join(' | '));
  console.log('errs', errs.join('|')); await b.close();
})();
