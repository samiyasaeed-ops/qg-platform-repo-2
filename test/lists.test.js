const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const p = await b.newPage({viewport:{width:1300,height:900}}); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.|cdnjs/, r => r.abort());
  await p.goto('http://127.0.0.1:8301/index.html'); await p.waitForTimeout(1200);
  const click = async s => { await p.click(s); await p.waitForTimeout(300); };
  const K='[data-d="new-complaints"]';
  const openForm = async () => { await click('#rail [data-nav="complaints"]'); if(await p.$('[data-act="cxBack"]')) await click('[data-act="cxBack"]'); await click('[data-act="cxNew"]'); if(await p.$('[data-act="vStepPick"][data-v="insurancemarket"]')) await click('[data-act="vStepPick"][data-v="insurancemarket"]'); };
  await openForm();
  await p.selectOption(K+'[data-f="type"]','Negative review'); await p.waitForTimeout(200);
  await p.selectOption(K+'[data-f="complaintType"]','Other'); await p.waitForTimeout(250);
  console.log('Other -> free text nature?', !!(await p.$(K+'[data-f="natureOther"]')));
  await p.selectOption(K+'[data-f="complaintType"]','Delay in process'); await p.waitForTimeout(250);
  await p.selectOption(K+'[data-f="nature"]','Other'); await p.waitForTimeout(250);
  console.log('Delay + Other nature -> text?', !!(await p.$(K+'[data-f="natureOther"]')));
  await p.fill(K+'[data-f="natureOther"]','Endorsement certificate missing');
  await p.selectOption(K+'[data-f="source"]','Google review'); await p.fill(K+'[data-f="dealRef"]','DL-900'); await p.selectOption(K+'[data-f="lob"]','insurancemarket|Motor'); await p.waitForTimeout(250);
  await p.fill(K+'[data-f="subject"]','1 star review'); await p.fill(K+'[data-f="description"]','Customer posted 1 star.'); await click('[data-act="cxCreate"]'); await p.waitForTimeout(500);
  console.log('saved nature:', await p.evaluate(()=>[...window.__store.values()].find(v=>v.subject==='1 star review').nature));
  // lists page
  await click('#rail [data-nav="lists"]');
  console.log('lists', (await p.$$eval('[data-act="lsPick"]', x=>x.map(y=>y.textContent))).join(' | '));
  await p.fill('[data-lsnew=""]','Service – Complaint escalation'); await click('[data-act="lsAdd"]');
  await click('[data-act="lsPick"][data-v="complaintTaxonomy"]'); await click('[data-act="lsOpen"][data-v="Other"]');
  await p.fill('[data-lsnew="Other"]','General dissatisfaction'); await click('[data-act="lsAdd"][data-scope="Other"]');
  await p.fill('[data-lsnew=""]','Insurer or TPA'); await click('[data-act="lsAdd"][data-scope=""]');
  // hide "Misselling"
  const idx = await p.$$eval('[data-lsname=""]', x=>x.map(y=>y.value).indexOf('Misselling'));
  await click(`[data-act="lsHide"][data-scope=""][data-i="${idx}"]`);
  // rename "Service failure"
  const si = await p.$$eval('[data-lsname=""]', x=>x.map(y=>y.value).indexOf('Service failure'));
  await p.fill(`[data-lsname=""][data-i="${si}"]`,'Service failure or delay'); await click(`[data-act="lsRename"][data-scope=""][data-i="${si}"]`);
  // products for Motor
  await click('[data-act="lsPick"][data-v="products"]'); await p.selectOption('[data-ui="lists.lob"]','insurancemarket|Motor'); await p.waitForTimeout(250);
  for(const x of ['Comprehensive motor','Third-party motor']){ await p.fill('[data-lsnew="insurancemarket|Motor"]',x); await click('[data-act="lsAdd"]'); }
  await p.screenshot({path:'out/103-lists.png', fullPage:true});
  const cfg = await p.evaluate(()=>window.__store.get('mod/core/config/main'));
  console.log('cfg types+', cfg.caseTypes.slice(-1)[0], '| tax Other', JSON.stringify(cfg.cx.complaintTaxonomy['Other']), '| renamed', Object.keys(cfg.cx.complaintTaxonomy).includes('Service failure or delay'), '| hidden', JSON.stringify(cfg.hiddenItems), '| products', JSON.stringify(cfg.cx.products));
  // form reflects
  await openForm();
  await p.selectOption(K+'[data-f="lob"]','insurancemarket|Motor'); await p.waitForTimeout(250);
  console.log('form types has new', (await p.$$eval(K+'[data-f="type"] option', o=>o.map(x=>x.value))).includes('Service – Complaint escalation'));
  console.log('product options', (await p.$$eval(K+'[data-f="product"] option', o=>o.map(x=>x.textContent))).join(' | '));
  console.log('complaint types', (await p.$$eval(K+'[data-f="complaintType"] option', o=>o.map(x=>x.textContent))).join(' | '));
  console.log('errs', errs.join('|')); await b.close();
})();
