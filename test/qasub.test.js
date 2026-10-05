const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  const p = await b.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.|cdnjs/, r => r.abort());
  await p.goto('http://127.0.0.1:8301/index.html'); await p.waitForTimeout(1000);
  await p.click('#rail [data-nav="calls"]'); await p.waitForTimeout(2500);
  const f = p.frames().find(x=>x!==p.mainFrame());
  console.log(await f.evaluate(()=>JSON.stringify({
    noQuoteMarks: hasQuote("Advisor did not verify identity before discussing the policy"),
    tooShort: hasQuote("bad"),
    overrideWithRationale: overrideOK({ovr:{opening:{reason:""}},result:{rationales:{opening:"Advisor skipped the greeting and ID check"}}},"opening"),
    overrideNothing: overrideOK({ovr:{opening:{reason:""}},result:{rationales:{opening:""}}},"opening"),
    fatalWithReason: overrideOK({ovr:{fatal:{reason:"Wrong premium quoted"}},result:{rationales:{}}},"fatal")
  })));
  console.log('errs', errs.join('|'));
  await b.close();
})();
