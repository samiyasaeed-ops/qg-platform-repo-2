const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const p = await b.newPage({viewport:{width:1400,height:800}}); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.|cdnjs/, r => r.abort());
  await p.goto('http://127.0.0.1:8301/index.html'); await p.waitForTimeout(1200);
  await p.click('#rail [data-nav="complaints"]'); await p.click('[data-act="cxNew"]'); await p.waitForTimeout(300);
  await p.screenshot({path:'out/40-pick.png'});
  for (const v of ['insurancemarket','creditmarket','holidaymarket']) { await p.selectOption('#vsel',v); await p.waitForTimeout(400); await p.click('#rail [data-nav="complaints"]'); await p.click('[data-act="cxNew"]'); await p.waitForTimeout(300); await p.screenshot({path:`41-${v}.png`}); }
  await p.selectOption('#vsel','holidaymarket'); await p.click('#rail [data-nav="calls"]'); await p.waitForTimeout(2500); await p.screenshot({path:'out/42-qa-hm.png'});
  const q = await b.newPage({viewport:{width:1400,height:800}}); q.on('pageerror', e => errs.push('LM '+e.message));
  await q.route(/fonts\.|cdnjs/, r => r.abort());
  await q.goto('http://127.0.0.1:8301/lm.html'); await q.waitForTimeout(1500);
  console.log('LM section', await q.textContent('#sechead h1'), '| picker', (await q.$$eval('#vsel option', o=>o.map(x=>x.value+':'+x.textContent))).join(','), 'disabled', await q.$eval('#vsel', e=>e.disabled));
  await q.click('#rail [data-nav="complaints"]'); await q.click('[data-act="cxQueue"][data-q="all"]'); await q.waitForTimeout(300);
  console.log('LM sees cases', (await q.$$('tr.click')).length, 'admin nav?', !!(await q.$('#rail [data-nav="settings"]')));
  await q.screenshot({path:'out/43-lm.png'});
  console.log('errs', errs.join('|'));
  await b.close();
})();
