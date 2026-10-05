const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const p = await b.newPage({viewport:{width:1400,height:950}}); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.|cdnjs/, r => r.abort());
  await p.goto('http://127.0.0.1:8301/index.html'); await p.waitForTimeout(1000);
  const click = async s => { await p.click(s); await p.waitForTimeout(350); };
  // case: assignee auto
  await click('#rail [data-nav="complaints"]'); await click('[data-act="cxNew"]'); { const vb=await p.$('[data-act="vStepPick"][data-v="insurancemarket"]'); if(vb){ await vb.click(); await p.waitForTimeout(250);} }
  await p.selectOption('[data-d="new-complaints"][data-f="source"]','Email'); await p.fill('[data-d="new-complaints"][data-f="dealRef"]','DL-1'); await p.selectOption('[data-d="new-complaints"][data-f="lob"]','insurancemarket|Motor');
  await p.fill('[data-d="new-complaints"][data-f="subject"]','Test'); await p.fill('[data-d="new-complaints"][data-f="description"]','Test'); await click('[data-act="cxCreate"]'); await p.waitForTimeout(400);
  console.log('assignee', await p.evaluate(()=>window.__store.get('mod/cx/cases/CX-2026-000001').assigneeId));
  await p.selectOption('[data-assign="CX-2026-000001"]','stf-sus'); await p.waitForTimeout(400);
  console.log('reassigned', await p.evaluate(()=>window.__store.get('mod/cx/cases/CX-2026-000001').assigneeId));
  // spot check record assigned
  await click('#rail [data-nav="spotchecks"]'); await click('[data-act="regNew"]'); { const vb=await p.$('[data-act="vStepPick"][data-v="insurancemarket"]'); if(vb){ await vb.click(); await p.waitForTimeout(250);} }
  await p.selectOption('[data-d="r-new-spotchecks"][data-f="lob"]','insurancemarket|Motor'); await p.fill('[data-d="r-new-spotchecks"][data-f="area"]','Floor 3'); await p.selectOption('[data-d="r-new-spotchecks"][data-f="rating"]','Minor gap'); await p.fill('[data-d="r-new-spotchecks"][data-f="finding"]','Clean desk breach'); await click('[data-act="regSave"]');
  // team workload: assign task
  await click('#rail [data-nav="team"]'); await click('[data-act="taskNew"]');
  await p.fill('[data-d="task-new"][data-f="title"]','Prepare October QA calibration'); await p.selectOption('[data-d="task-new"][data-f="assigneeId"]','stf-sus'); await click('[data-act="taskSave"]');
  await click('[data-act="teamWho"][data-id="stf-sus"]'); await p.screenshot({path:'out/20-team.png', fullPage:true});
  // my work as SS
  await click('#rail [data-nav="mywork"]'); await p.screenshot({path:'out/21-mywork.png', fullPage:true});
  // task done via team
  await click('#rail [data-nav="team"]');
  await click('[data-act="openItem"][data-kind="task"]'); await click('[data-act="taskStatus"][data-v="Done"]');
  console.log('task', JSON.stringify(await p.evaluate(()=>[...window.__store.entries()].filter(([k])=>k.startsWith('mod/work/tasks/')).map(([,v])=>v.status))));
  // questions
  await click('#rail [data-nav="questions"]'); await click('[data-act="qFilter"][data-v=""]'); await p.screenshot({path:'out/22-questions.png', fullPage:true});
  await p.fill('[data-d="q-q2"][data-f="answer"]','Yes, round robin by LOB.'); await click('[data-act="qAnswer"][data-id="q2"]');
  console.log('q2', JSON.stringify(await p.evaluate(()=>window.__store.get('mod/pb/questions/q2').status)));
  await click('#rail [data-nav="complaints"]'); await click('[data-act="cxBack"]'); await click('[data-act="setView"][data-v="playbook"]'); await p.screenshot({path:'out/23-pbq.png', fullPage:true});
  console.log('emails', (await p.evaluate(()=>window.__sent.map(s=>s.subject))).join(' | '));
  console.log('errs', errs.join('|'));
  await b.close();
})();
