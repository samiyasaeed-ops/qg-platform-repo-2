const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const ctx = await b.newContext({viewport:{width:1400,height:1000}}); await ctx.route(/xlsx/, r => r.fulfill({path:require.resolve('xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'})); await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8301/rr.html'); await p.waitForTimeout(1300);
  console.log('nav groups', (await p.$$eval('#rail .grp', g=>g.map(x=>x.textContent))).join(' | '));
  console.log('home groups', (await p.$$eval('.tgroup h2', g=>g.map(x=>x.textContent))).join(' | '));
  await p.evaluate(()=>document.querySelector('.tgroup.rrg').scrollIntoView()); await p.waitForTimeout(200); await p.screenshot({path:'out/95-home.png'});
  await p.click('#rail [data-nav="rr"]'); await p.waitForTimeout(400); console.log('rr page', await p.textContent('#sechead h1'));
  console.log('errs', errs.join('|')); await b.close();
})();
