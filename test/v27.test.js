const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const ctx = await b.newContext({ viewport:{width:1400,height:950} });
  await ctx.route(/xlsx/, r => r.fulfill({path:require.resolve('xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'})); await ctx.route(/fonts\./, r => r.abort());
  const errs=[];
  // LM (head of team) session
  const q = await ctx.newPage(); q.on('pageerror', e => errs.push('LM '+e.message));
  await q.goto('http://127.0.0.1:8301/lm.html'); await q.waitForTimeout(1500);
  console.log('LM cockpit routed findings', !!(await q.$('text=Findings routed to your team')));
  await q.click('[data-act="openItem"][data-id="JT-R1"]'); await q.waitForTimeout(400);
  await q.fill('[data-d="rt-JT-R1"][data-f="update"]','Payment gateway timeout raised with vendor, fix deployed'); await q.click('[data-act="regReady"]'); await q.waitForTimeout(500);
  console.log('LM after ready', await q.evaluate(()=>window.__store.get('mod/reg/records/JT-R1').status), '| email', await q.evaluate(()=>window.__sent.map(s=>s.subject+' → '+s.to).join('; ')));
  await q.screenshot({path:'out/80-lm-journey.png', fullPage:true});
  // Admin session: create + route + retest
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8301/index.html'); await p.waitForTimeout(1200);
  const click = async s => { await p.click(s); await p.waitForTimeout(350); };
  await click('#rail [data-nav="journey"]'); await click('[data-act="regNew"]'); await click('[data-act="vStepPick"][data-v="insurancemarket"]');
  await p.selectOption('[data-d="r-new-journey"][data-f="lob"]','insurancemarket|Motor'); await p.selectOption('[data-d="r-new-journey"][data-f="priority"]',{index:1});
  await p.fill('[data-d="r-new-journey"][data-f="journey"]','Motor quote to buy'); await p.selectOption('[data-d="r-new-journey"][data-f="channel"]','Website'); await p.selectOption('[data-d="r-new-journey"][data-f="result"]','Fail'); await p.fill('[data-d="r-new-journey"][data-f="defects"]','Quote page shows wrong excess');
  await click('[data-act="regSave"]'); await p.waitForTimeout(300);
  const id = await p.evaluate(()=>[...window.__store.values()].find(v=>v.section==='journey'&&v.ref!=='JT-2026-000050').id);
  await p.selectOption(`[data-d="rt-${id}"][data-f="teamId"]`,'tm-motor'); await p.waitForTimeout(300);
  console.log('hop default', await p.inputValue(`[data-d="rt-${id}"][data-f="hopId"]`));
  await p.fill(`[data-d="rt-${id}"][data-f="msg"]`,'Please fix before the weekend campaign'); await click('[data-act="regRoute"]');
  console.log('routed', await p.evaluate(i=>window.__store.get('mod/reg/records/'+i).status, id), '| email', await p.evaluate(()=>window.__sent.slice(-1).map(s=>s.subject+' → '+s.to+' cc '+s.cc).join('')));
  // retest fail then pass
  await p.selectOption(`[data-d="rt-${id}"][data-f="result"]`,'Fail'); await p.fill(`[data-d="rt-${id}"][data-f="notes"]`,'Still wrong excess'); await click('[data-act="regRetest"]');
  console.log('after fail', await p.evaluate(i=>window.__store.get('mod/reg/records/'+i).status, id));
  await p.selectOption(`[data-d="rt-${id}"][data-f="teamId"]`,'tm-motor'); await click('[data-act="regRoute"]');
  await p.selectOption(`[data-d="rt-${id}"][data-f="result"]`,'Pass'); await p.waitForTimeout(250); await p.fill(`[data-d="rt-${id}"][data-f="notes"]`,'Excess now correct'); await click('[data-act="regRetest"]');
  console.log('pass without satisfied ->', await p.textContent('#toast'));
  await p.check(`[data-d="rt-${id}"][data-f="satisfied"]`); await p.waitForTimeout(200); await click('[data-act="regRetest"]');
  console.log('final', await p.evaluate(i=>window.__store.get('mod/reg/records/'+i).status, id), 'closedAt', !!(await p.evaluate(i=>window.__store.get('mod/reg/records/'+i).closedAt, id)));
  await p.screenshot({path:'out/81-journey.png', fullPage:true});
  await click('#rail [data-nav="rr"]'); await p.screenshot({path:'out/82-rr.png', fullPage:true});
  console.log('rr ranks', (await p.$$eval('tr.click td:nth-child(2)', t=>t.map(x=>x.textContent))).join(','));
  await click('#rail [data-nav="links"]'); await p.screenshot({path:'out/83-links.png'});
  await click('#rail [data-nav="controls"]'); await click('[data-act="regNew"]'); await click('[data-act="vStepPick"][data-v="insurancemarket"]');
  await p.fill('[data-d="r-new-controls"][data-f="control"]','Daily complaint log reconciliation'); await p.selectOption('[data-d="r-new-controls"][data-f="area"]','Complaints'); await p.selectOption('[data-d="r-new-controls"][data-f="owner"]','stf-sus'); await p.selectOption('[data-d="r-new-controls"][data-f="frequency"]','Weekly');
  await click('[data-act="regSave"]'); await click('[data-act="regBack"]'); await p.screenshot({path:'out/84-controls.png'});
  await click('#rail [data-nav="home"]'); await p.screenshot({path:'out/85-home.png', fullPage:true});
  console.log('errs', errs.join('|'));
  await b.close();
})();
