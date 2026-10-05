const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const ctx = await b.newContext(); await ctx.route(/xlsx/, r => r.fulfill({path:require.resolve('xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'})); await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8301/rr.html'); await p.waitForTimeout(1200);
  const click = async s => { await p.click(s); await p.waitForTimeout(300); };
  await click('#rail [data-nav="rr"]'); await click('[data-act="rrAdd"][data-v="menu"]'); await click('[data-act="rrAdd"][data-v="programme"]');
  const k='[data-d="rrprog"]';
  await p.selectOption(k+'[data-f="venture"]','insurancemarket'); await p.fill(k+'[data-f="name"]','IM Service Stars'); await p.fill(k+'[data-f="cycle"]','November 2026');
  await p.fill(k+'[data-f="start"]','2026-11-01'); await p.fill(k+'[data-f="end"]','2026-11-30');
  await click('[data-act="rrProgSave"]');
  const np = await p.evaluate(()=>[...window.__store.values()].find(v=>v.cycle==='November 2026'));
  console.log('new cycle', np.cycle, 'copiedFrom', np.copiedFrom, 'groups', np.groups.length, 'pilot', np.pilot, '| old cycle entries untouched', await p.evaluate(()=>[...window.__store.values()].filter(v=>v.programmeId==='im-cx-2026-10').length));
  console.log('errs', errs.join('|')); await b.close();
})();
