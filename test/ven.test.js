const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const p = await b.newPage({viewport:{width:1400,height:950}}); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.|cdnjs/, r => r.abort());
  await p.goto('http://127.0.0.1:8301/index.html'); await p.waitForTimeout(1200);
  const click = async s => { await p.click(s); await p.waitForTimeout(350); };
  await p.screenshot({path:'out/30-home-all.png', fullPage:true});
  await click('#rail [data-nav="complaints"]'); await click('[data-act="cxQueue"][data-q="all"]');
  const rows = async()=> (await p.$$('tr.click')).length;
  console.log('all ventures rows', await rows());
  await p.selectOption('#vsel','creditmarket'); await p.waitForTimeout(400);
  console.log('CM rows', await rows(), await p.textContent('#sechead h1'));
  await p.selectOption('#vsel','insurancemarket'); await p.waitForTimeout(400);
  console.log('IM rows', await rows());
  await click('[data-act="cxNew"]'); console.log('IM lob options', (await p.$$eval('[data-f="lob"] option', o=>o.map(x=>x.value))).join(','));
  await click('#rail [data-nav="regulations"]'); await click('[data-act="regsSt"][data-v=""]'); console.log('IM regs', (await p.$$('tr.click')).length);
  await p.selectOption('#vsel','holidaymarket'); await p.waitForTimeout(300); console.log('HM regs', (await p.$$('tr.click')).length);
  await p.selectOption('#vsel',''); await p.waitForTimeout(300);
  // add venture
  await click('#rail [data-nav="ventures"]'); await click('[data-act="vNew"]');
  await p.fill('[data-d="v-new"][data-f="name"]','PropertyMarket.ae'); await p.fill('[data-d="v-new"][data-f="code"]','PM'); await p.fill('[data-d="v-new"][data-f="lobs"]','Rentals\nSales'); await click('[data-act="vSave"]');
  console.log('ventures', JSON.stringify((await p.evaluate(()=>window.__store.get('mod/core/config/main').ventures.map(v=>v.id)))), 'picker', (await p.$$eval('#vsel option', o=>o.map(x=>x.value))).join(','));
  // add regulation
  await click('#rail [data-nav="regulations"]'); await click('[data-act="regsNew"]');
  await p.fill('[data-d="rg-new"][data-f="title"]','Telemarketing Regulation'); await p.fill('[data-d="rg-new"][data-f="regulator"]','Central Bank of the UAE (CBUAE)'); await p.fill('[data-d="rg-new"][data-f="refNo"]','C 3/2026'); await p.fill('[data-d="rg-new"][data-f="summary"]','Telemarketing by LFIs.');
  await click('[data-act="regsSave"]'); await p.screenshot({path:'out/31-reg.png', fullPage:true});
  console.log('regs now', await p.evaluate(()=>[...window.__store.keys()].filter(k=>k.startsWith('mod/lib/regs/')).length));
  await click('#rail [data-nav="guide"]'); await click('[data-act="guideTab"][data-v="log"]'); await p.screenshot({path:'out/32-guide.png'});
  await p.selectOption('#vsel','insurancemarket'); await p.waitForTimeout(300); await click('#rail [data-nav="home"]'); await p.screenshot({path:'out/33-home-im.png', fullPage:true});
  await p.selectOption('#vsel',''); await p.waitForTimeout(300); await click('#rail [data-nav="home"]'); await p.screenshot({path:'out/34-home-all.png', fullPage:true});
  await click('#rail [data-nav="calls"]'); await p.waitForTimeout(2000); await p.selectOption('#vsel','creditmarket'); await p.waitForTimeout(800); await p.screenshot({path:'out/35-qa-cm.png'});
  console.log('errs', errs.join('|'));
  await b.close();
})();
