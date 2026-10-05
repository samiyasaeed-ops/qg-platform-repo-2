const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const ctx = await b.newContext(); await ctx.route(/xlsx/, r => r.fulfill({path:require.resolve('xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'})); await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8301/index.html'); await p.waitForTimeout(1300);
  await p.click('#rail [data-nav="data"]'); await p.waitForTimeout(300);
  console.log('bkDrive present', !!(await p.$('[data-act="bkDrive"]')), 'alert', !!(await p.$('#alertHost:not([hidden])')));
  await p.click('[data-act="bkDrive"]'); await p.waitForTimeout(1500);
  console.log('drive', await p.evaluate(()=>window.__drive.map(d=>d.title).join(', ')), '| toast', await p.textContent('#toast'));
  await p.click('[data-act="bkDownload"]'); await p.waitForTimeout(600); console.log('dl', JSON.stringify(await p.evaluate(()=>window.__dl)));
  console.log('logged', await p.evaluate(()=>[...window.__store.entries()].filter(([k])=>k.startsWith('mod/sys/errors')).map(([,v])=>v.message+' :: '+v.detail).join(' || '))); console.log('errs', errs.join('|')); await b.close();
})();
