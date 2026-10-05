const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const ctx = await b.newContext({viewport:{width:1400,height:950}}); await ctx.route(/xlsx/, r => r.fulfill({path:require.resolve('xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'})); await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8301/index.html'); await p.waitForTimeout(1300);
  const click = async s => { await p.click(s); await p.waitForTimeout(300); };
  const vals = () => p.evaluate(()=>[...window.__store.values()]);
  // spot checks
  await click('#rail [data-nav="spotchecks"]'); await click('[data-act="impOpen"][data-k="spotchecks"]'); await click('[data-act="impVen"][data-v="insurancemarket"]');
  await p.setInputFiles('[data-imp3file]','spot.csv'); await p.waitForTimeout(600);
  console.log('auto-map', JSON.stringify(await p.evaluate(()=>window.__qgDebug||null)) );
  const maps = await p.$$eval('[data-impmap]', s=>s.map(x=>x.dataset.impmap+'→'+(x.value||'(original only)')));
  console.log('spot mapping:', maps.join(' | '));
  await p.selectOption('[data-impmap="Result"]','rating'); await p.waitForTimeout(250);
  await p.selectOption('[data-impmap="Floor manager"]','owner'); await p.waitForTimeout(250);
  await p.screenshot({path:'out/97-map.png', fullPage:true});
  console.log('summary', (await p.textContent('.imppanel .figs4')).replace(/\s+/g,' '));
  await click('[data-act="impGo"]'); await p.waitForTimeout(800);
  const sp=(await vals()).filter(v=>v.section==='spotchecks'&&v.imported);
  console.log('spot saved', sp.length, '| raw kept', JSON.stringify(sp[0]&&sp[0].raw), '| owner', sp[0]&&sp[0].assigneeId, '| result', await p.textContent('.imppanel .callout'));
  await click(`[data-act="regOpen"][data-id="${sp[0].id}"]`); console.log('detail raw block', !!(await p.$('.rawbox')));
  // teams then staff
  await click('#rail [data-nav="staff"]'); await click('[data-act="staffTab"][data-k="teams"]'); await click('[data-act="impOpen"][data-k="teams"]'); await click('[data-act="impVen"][data-v="insurancemarket"]');
  await p.setInputFiles('[data-imp3file]','teams.csv'); await p.waitForTimeout(500); await click('[data-act="impGo"]'); await p.waitForTimeout(500);
  console.log('teams result', await p.textContent('.imppanel .callout'));
  await click('[data-act="impClose"]'); await click('[data-act="staffTab"][data-k="people"]'); await click('[data-act="impOpen"][data-k="staff"]');
  await p.setInputFiles('[data-imp3file]','staff.csv'); await p.waitForTimeout(500);
  console.log('staff checks', (await p.$$eval('.imppanel tbody tr', r=>r.map(x=>x.textContent.replace(/\s+/g,' ')))).slice(-3).join(' || '));
  await click('[data-act="impGo"]'); await p.waitForTimeout(500); console.log('staff result', await p.textContent('.imppanel .callout'));
  console.log('Nadia', JSON.stringify((await vals()).find(v=>v.name==='Nadia Khan')?.raw));
  // complaints
  await click('#rail [data-nav="complaints"]'); await click('[data-act="impOpen"][data-k="complaints"]'); await click('[data-act="impVen"][data-v="insurancemarket"]');
  await p.setInputFiles('[data-imp3file]','cases.csv'); await p.waitForTimeout(500);
  console.log('case mapping:', (await p.$$eval('[data-impmap]', s=>s.map(x=>x.dataset.impmap+'→'+(x.value||'-')))).join(' | '));
  await click('[data-act="impGo"]'); await p.waitForTimeout(800);
  const cs=(await vals()).filter(v=>v.ref&&v.imported&&v.ref.startsWith('CX'));
  console.log('cases', cs.map(c=>c.ref+':'+c.status+':'+c.source+':csat '+(c.csat&&c.csat.score)+':legacy '+c.raw['Legacy ID']).join(' | '));
  await click('#rail [data-nav="data"]'); console.log('history rows', (await p.$$('table tbody tr')).length); await p.screenshot({path:'out/98-history.png', fullPage:true});
  console.log('errs', errs.join('|')); await b.close();
})();
