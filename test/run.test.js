const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const ctx = await b.newContext({ viewport:{width:1400,height:950} });
  await ctx.route(/xlsx/, r => r.fulfill({path:require.resolve('xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'})); await ctx.route(/fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs=[];
  p.on('pageerror', e => errs.push('PAGEERR '+e.message)); p.on('console', m => { if(m.type()==='error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept('Handled'));
  await p.goto('http://127.0.0.1:8301/index.html'); await p.waitForTimeout(1200);
  await p.screenshot({path:'out/01-home.png'});
  const nav = async k => { if(await p.$('#alertHost:not([hidden]) [data-act="alertAck"]')){ console.log('ALERT shown:', (await p.textContent('#alertHost')).replace(/\s+/g,' ').slice(0,160)); await p.click('[data-act="alertAck"]'); await p.waitForTimeout(300);} await p.click(`#rail [data-nav="${k}"]`); await p.waitForTimeout(250); };
  const fill = async (k,f,v) => { await p.fill(`[data-d="${k}"][data-f="${f}"]`, v); };
  const sel = async (k,f,v) => { await p.selectOption(`[data-d="${k}"][data-f="${f}"]`, v); await p.waitForTimeout(120); };
  const dismissAlert = async () => { if(await p.$('#alertHost:not([hidden]) [data-act="alertAck"]')){ await p.click('[data-act="alertAck"]'); await p.waitForTimeout(300); return true; } return false; };
  const click = async s => { await dismissAlert();
    try{ await p.click(s); }
    catch(e){ if(await dismissAlert()) await p.click(s); else throw e; }
    await p.waitForTimeout(350); };
  const store = path => p.evaluate(x=>window.__store.get(x), path);
  // register case
  await nav('complaints'); await click('[data-act="cxNew"]'); { await dismissAlert(); const vb=await p.$('[data-act="vStepPick"][data-v="insurancemarket"]'); if(vb){ await vb.click(); await p.waitForTimeout(250);} }
  const K='new-complaints';
  await sel(K,'source','Google review'); await fill(K,'dealRef','DL-4471'); await sel(K,'lob','insurancemarket|Motor');
  await fill(K,'subject','Renewal premium increased without explanation'); await fill(K,'description','Customer says premium went up 30% and nobody called back.');
  await click('[data-act="cxCreate"]'); await p.waitForTimeout(500);
  const ref = await p.evaluate(()=>[...window.__store.keys()].find(k=>k.startsWith('mod/cx/cases/CX-2026-0000')&&!k.endsWith('09')&&!k.endsWith('50')).split('/').pop());
  console.log('created', ref, (await store('mod/cx/cases/'+ref)).status);
  // route
  await fill(ref,'comment','Valid concern; pricing not explained.'); await p.check(`input[name="ct-${ref}"][value="yes"]`); await p.waitForTimeout(300);
  await fill(ref,'qTime','10:15'); await fill(ref,'qCall','3CX-889'); await sel(ref,'qOutcome','Reached'); await click('[data-act="cxQAttempt"]');
  await sel(ref,'teamId','tm-motor'); await p.screenshot({path:'out/02-route.png', fullPage:true});
  await click('[data-act="cxRoute"]'); console.log('after route', (await store('mod/cx/cases/'+ref)).status);
  // 3 failed attempts
  for (let i=0;i<2;i++){ await fill(ref,'aTime','1'+i+':00'); await fill(ref,'aCall','C'+i); await sel(ref,'aOutcome','No answer'); await p.check(`[data-d="${ref}"][data-f="aEmail"]`); await click('[data-act="cxAttempt"]'); }
  await fill(ref,'aTime','12:00'); await fill(ref,'aCall','C2'); await sel(ref,'aOutcome','Reached'); await click('[data-act="cxAttempt"]');
  await fill(ref,'resolution','Explained the premium change; customer accepted.');
  await fill(ref,'findings','Renewal letter missing breakdown.');
  await p.screenshot({path:'out/03-lm.png', fullPage:true});
  await click('[data-act="cxResolve"]'); console.log('after resolve', (await store('mod/cx/cases/'+ref)).status);
  // Q&G review
  for (const f of ['lmCallAssessed','findingsInPlace','resolutionAligned']) await p.check(`input[name="${f}-${ref}"][value="yes"]`);
  await p.check(`input[name="path-${ref}"][value="reviewed"]`); await p.waitForTimeout(250);
  await sel(ref,'verdict','Valid – closed in favour'); await sel(ref,'consequence','Verbal warning'); await sel(ref,'consequenceStaffId','stf-ana');
  await fill(ref,'consequenceNote','Verbal warning for not explaining premium change.'); await fill(ref,'finalSummary','Premium explained; customer accepted.');
  await fill(ref,'respText','Thank you for your feedback. We have reviewed your renewal and explained the change.'); await click('[data-act="cxRespApprove"]');
  await sel(ref,'rootCause','Knowledge gaps'); await p.check(`[data-d="${ref}"][data-f="csatLinkSent"]`); await p.waitForTimeout(200);
  await sel(ref,'businessOutcome','Retained'); await p.check(`input[name="csv-${ref}"][value="4"]`); await p.waitForTimeout(200);
  await p.screenshot({path:'out/04-review.png', fullPage:true});
  await click('[data-act="cxExternal"]'); console.log('toast:', await p.textContent('#toast')); console.log('after external', (await store('mod/cx/cases/'+ref)).status);
  await p.screenshot({path:'04b-consequence.png', fullPage:true});
  await fill(ref,'ackNote','Advisor followed procedure; warning is unfair.'); await click('[data-act="cxDispute"]');
  console.log('after dispute', (await store('mod/cx/cases/'+ref)).status);
  await sel(ref,'decision','Uphold the consequence'); await fill(ref,'decisionNote','Evidence supports it.'); await click('[data-act="cxDecide"]');
  const fin = await store('mod/cx/cases/'+ref); console.log('final', fin.status, fin.review.consequence, fin.timeline.length, 'events', 'biz', fin.review.businessOutcome, 'csat', JSON.stringify(fin.csat&&{s:fin.csat.status,v:fin.csat.score}));
  await p.screenshot({path:'out/05-closed.png', fullPage:true});
  console.log('emails', (await p.evaluate(()=>window.__sent.map(s=>s.subject+' → '+s.to.join(',')+' cc '+(s.cc||[]).join(',')))).join('\n  '));
  console.log('breach rec', JSON.stringify(await store('mod/reg/records/cx-'+ref)).slice(0,160));
  // breach tracker feed
  await nav('breaches'); await p.screenshot({path:'out/06-breaches.png'}); await click('[data-act="trackAll"]');
  console.log('breach recs', await p.evaluate(()=>[...window.__store.keys()].filter(k=>k.startsWith('mod/reg/records/')).length));
  // staff move
  await nav('staff'); await p.screenshot({path:'out/07-staff.png'});
  await click('[data-act="personOpen"][data-id="stf-ana"]'); await sel('p-stf-ana','moveTeam','tm-health'); await fill('p-stf-ana','moveFrom','2026-10-05'); await click('[data-act="personMove"]');
  console.log('ana asg', JSON.stringify((await store('mod/core/staff/stf-ana')).assignments));
  console.log('qa advisor sync', JSON.stringify(await store('mod/qa/advisors/stf-ana')));
  await p.screenshot({path:'out/08-person.png', fullPage:true});
  await click('[data-act="staffBack"]'); await click('[data-act="staffTab"][data-k="teams"]'); await click('[data-act="teamOpen"][data-id="tm-health"]'); await p.screenshot({path:'out/09-team.png', fullPage:true});
  // playbook
  await nav('mystery'); await click('[data-act="setView"][data-v="playbook"]'); await click('[data-act="pbEdit"]'); await fill('pb-mystery','note','First version'); await click('[data-act="pbSave"]');
  console.log('pb', JSON.stringify((await store('mod/pb/playbooks/mystery'))?.versions.length));
  await p.screenshot({path:'out/10-pb.png'});
  // register record
  await click('[data-act="setView"][data-v="records"]'); await click('[data-act="regNew"]'); { await dismissAlert(); const vb=await p.$('[data-act="vStepPick"][data-v="insurancemarket"]'); if(vb){ await vb.click(); await p.waitForTimeout(250);} } await sel('r-new-mystery','lob','insurancemarket|Motor'); await sel('r-new-mystery','channel','Call'); await fill('r-new-mystery','scenario','Ask for comprehensive quote'); await click('[data-act="regSave"]');
  console.log('ms rec', await p.evaluate(()=>[...window.__store.keys()].filter(k=>k.includes('/MS-')).length));
  // email failure + error report retry
  await p.evaluate(()=>window.__failMail=true);
  await nav('callbacks'); await click('[data-act="cxNew"]'); { await dismissAlert(); const vb=await p.$('[data-act="vStepPick"][data-v="insurancemarket"]'); if(vb){ await vb.click(); await p.waitForTimeout(250);} } await sel('new-callbacks','source','Website Contact Us form'); await fill('new-callbacks','mobile','0559876543'); await sel('new-callbacks','lob','insurancemarket|Health'); await fill('new-callbacks','subject','Call me about health plan'); await fill('new-callbacks','description','Wants a call.'); await click('[data-act="cxCreate"]'); await p.waitForTimeout(400);
  await p.evaluate(()=>window.__failMail=false);
  await nav('errors'); await p.screenshot({path:'out/11-errors.png'});
  const before=await p.evaluate(()=>window.__sent.length); await dismissAlert(); const rb=await p.$('[data-act="errRetry"]'); if(rb){ await rb.click(); await p.waitForTimeout(600); }
  console.log('retry sent', (await p.evaluate(()=>window.__sent.length))-before);
  // reminder sweep (waits for 20s timer)
  await p.waitForTimeout(16000);
  const old = await store('mod/cx/cases/CX-2026-000009'); console.log('reminder on old case', old.reminderCount, old.escalated);
  await nav('home'); await p.screenshot({path:'out/12-home.png', fullPage:true});
  await nav('calls'); await p.waitForTimeout(2500); await p.screenshot({path:'out/13-calls.png'});
  await nav('structure'); await p.screenshot({path:'out/14-structure.png', fullPage:true});
  const m = await ctx.newPage(); await m.setViewportSize({width:390,height:844}); await m.goto('http://127.0.0.1:8301/index.html'); await m.waitForTimeout(1000); await m.screenshot({path:'out/15-mobile.png'});
  console.log('ERRORS:', errs.join('\n'));
  await b.close();
})();
