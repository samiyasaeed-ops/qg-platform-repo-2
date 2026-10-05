import re, base64, json, sys, glob

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "vendor", "original")
CEM = os.path.join(SRC, "alfred-care-cem.html")   # Alfred Care: Customer Experience Management
QA  = os.path.join(SRC, "alfred-qa-portal.html")   # Alfred QA Multi-Venture Portal

def prelude(mod):
    # Runs first inside each module frame: hands the module the platform's
    # capabilities (namespaced database, shared sign-in) and mirrors the theme.
    return ("<script>(function(){var H=null;try{H=parent.__qgHost&&parent.__qgHost(%s);}catch(e){}"
            "if(H){try{Object.defineProperty(window,'claude',{value:{use:H.use},configurable:true});}catch(e){window.claude={use:H.use};}window.__qgHost=H;}"
            "try{var pr=parent.document.documentElement,me=document.documentElement,s=function(){var t=pr.getAttribute('data-theme');if(t)me.setAttribute('data-theme',t);else me.removeAttribute('data-theme');};s();new MutationObserver(s).observe(pr,{attributes:true,attributeFilter:['data-theme']});}catch(e){}"
            "})();</script>") % json.dumps(mod)

def once(src, old, new, label):
    n = src.count(old)
    if n != 1: sys.exit(f"anchor {label!r} matched {n} times")
    return src.replace(old, new)

def inject_prelude(src, mod):
    m = re.search(r"<meta charset=[^>]*>", src, re.I)
    if not m: sys.exit("no meta charset in " + mod)
    return src[:m.end()] + prelude(mod) + src[m.end():]

# ---------------- Customer Experience (Alfred Care) ----------------
cem = open(CEM, encoding="utf-8").read()
cem = inject_prelude(cem, "cem")

# 1. Recorded QA card says when it came from a QA evaluation, and links back to it.
cem = once(cem,
 'else if(q) qa=qaCard(q,"Interaction QA recorded by "+nameOf(q.by)+", "+fmt(q.at)+(q.fromAi?" (AI suggestion confirmed)":""));',
 'else if(q){ qa=qaCard(q,"Interaction QA recorded by "+nameOf(q.by)+", "+fmt(q.at)+(q.fromAi?" (AI suggestion confirmed)":"")+(q.fromQA?" (linked from QA evaluation "+q.callId+", "+q.qaTotal+"%)":"")); if(q.fromQA&&window.__qgHost) qa+=`<div class="row"><button class="btn sm" data-act="openQAEval" data-id="${esc(q.evalId)}">Open ${esc(q.callId)} in QA Evaluation</button></div>`; }',
 "qaCard recorded")

# 2. "Link a QA evaluation" next to the existing QA actions (edit mode only).
m = re.search(r'\n      if\(\(drafts\[r\]\|\|\{\}\)\._noneForm\) qa\+=[^\n]*', cem)
if not m: sys.exit("noneForm anchor")
cem = cem[:m.end()] + '\n      if(window.__qgHost){ qa+=`<div class="row"><button class="btn sm" data-act="linkQAEval">${q&&q.fromQA?"Link a different QA evaluation":"Link a QA evaluation"}</button></div>`; if((drafts[r]||{})._linkForm) qa+=qgLinkForm(c); }' + cem[m.end():]

# 3. The picker.
cem = once(cem, "function qaCard(q,foot){", r'''function qgLinkForm(c){
  const H=window.__qgHost, list=H?H.evaluations():[];
  if(!list.length) return `<div class="box stack"><p class="sm">No QA evaluations are available yet. Score the original call in QA Evaluation, then link it here.</p><div class="row"><button class="btn sm" data-act="openQAModule">Open QA Evaluation</button><button class="btn sm" data-act="linkQAEval">Cancel</button></div></div>`;
  const norm=s=>String(s||"").toLowerCase().replace(/\s+/g," ").trim();
  const adv=norm((c.advisor||{}).name), cus=norm((c.customer||{}).name);
  const rank=e=>(cus&&norm(e.customerName)===cus?3:0)+(adv&&norm(e.advisorName)===adv?2:0);
  const rows=list.slice().sort((a,b)=>rank(b)-rank(a)||(b.createdAt||0)-(a.createdAt||0)).slice(0,12);
  return `<div class="box stack"><b class="sm">Pick the QA evaluation of the original contact</b><p class="sm muted">Evaluations for this case's customer or advisor are listed first. Linking records the evaluation's score, breaches and coaching plan here as the interaction QA.</p>
  <div class="stack">${rows.map(e=>`<div class="row" style="justify-content:space-between;align-items:center;gap:8px;border-top:1px solid var(--line-2);padding-top:8px"><div class="sm" style="min-width:0;flex:1 1 200px"><b>${esc(e.callId||e.id)}</b>${rank(e)?' <span class="flag">Match</span>':""}${e.hasFatalError?' <span class="flag red">Fatal</span>':""}<br><span class="muted">${esc(e.advisorName||"Advisor")} with ${esc(e.customerName||"customer")}, ${esc(e.lob||"")}${e.interactionDate?", "+esc(new Date(e.interactionDate).toLocaleDateString()):""}. Score ${esc(e.totalScore)}%</span></div><button class="btn sm ok" data-act="pickQAEval" data-id="${esc(e.id)}">Link</button></div>`).join("")}</div>
  <div class="row"><button class="btn sm" data-act="linkQAEval">Cancel</button></div></div>`;
}
function qaCard(q,foot){''', "qaCard def")

# 4. Actions.
cem = once(cem, '    case "runQA": return runQA(c);', r'''    case "linkQAEval": d._linkForm=!d._linkForm; d._qaForm=false; d._noneForm=false; return;
    case "openQAModule": if(window.__qgHost) window.__qgHost.openModule("qa"); return;
    case "openQAEval": if(window.__qgHost) window.__qgHost.openEval(el.dataset.id); return;
    case "pickQAEval":{
      const H=window.__qgHost, e=H&&H.evaluation(el.dataset.id);
      if(!e){ toast("That evaluation isn't available any more. Reload and try again."); return; }
      const tot=Number(e.totalScore)||0, score=Math.max(1,Math.min(10,Math.round(tot/10)));
      const breaches=(e.policyBreaches||[]).map(b=>({breach:String(b.ruleTitle||"Policy breach")+(b.severity?" ("+b.severity+")":""),evidence:String(b.transcriptQuote||b.policySnippet||"See the QA evaluation")}));
      if(e.hasFatalError) breaches.unshift({breach:"Fatal error"+(e.fatalErrorCode?" "+e.fatalErrorCode:""),evidence:String(e.fatalErrorReason||"Recorded in the QA evaluation")});
      const coaching=lines(String((e.synopsis||{}).actionPlan||"").replace(/\s(?=\d+\)\s)/g,"\n"));
      const q={tone:tot>=90&&!breaches.length?"exemplary":"courteous",score,breaches,coaching,fromQA:true,fromAi:false,evalId:e.id,callId:e.callId||e.id,qaTotal:tot,qaStatus:e.status||"",by:me,at:iso()};
      try{ await updateCase(r,{interactionQA:q}); await addEvent(r,"EDIT",{reason:"Interaction QA linked to QA evaluation "+q.callId+" ("+tot+"%)"}); clr(r,["_linkForm"]); toast("Linked "+q.callId+"."); }catch(_){}
      return;
    }
    case "runQA": return runQA(c);''', "runQA case")

# 5. Deep-link hook for the platform Home.
cem = once(cem, "boot();\n})();\n</script>",
 'window.__qgOpenCase=function(ref){ if(!cases.some(x=>x.ref===ref)) return false; selRef=ref; watchEvents(ref); setView("cases"); return true; };\nboot();\n})();\n</script>', "cem boot")

# ---------------- QA Evaluation (Multi-Venture Portal) ----------------
qa = open(QA, encoding="utf-8").read()
qa = inject_prelude(qa, "qa")
# Business outcome on every evaluation
qa = once(qa, 'callReason:"", reference:"",', 'callReason:"", businessOutcome:"", reference:"",', "newDraft biz")
qa = once(qa, '    <label class="f">Call reason<select data-bind="intake.callReason" ${dis}><option value="">Select…</option>${opt(tx.callReasons, i.callReason)}</select></label>\n', '    <label class="f">Call reason<select data-bind="intake.callReason" ${dis}><option value="">Select…</option>${opt(tx.callReasons, i.callReason)}</select></label>\n    <label class="f">Business outcome<select data-bind="intake.businessOutcome" ${dis}><option value="">Select…</option>${opt(["Retained","Lost","Not applicable"], i.businessOutcome||"")}</select></label>\n', "intake biz field")
qa = once(qa, 'natureOfEvaluation: i.natureOfEvaluation, callReason: i.callReason,', 'natureOfEvaluation: i.natureOfEvaluation, callReason: i.callReason, businessOutcome: i.businessOutcome || "",', "save biz")
qa = once(qa, 'callReason:doc.callReason||"",', 'callReason:doc.callReason||"", businessOutcome:doc.businessOutcome||"",', "load biz")
# Deleted evaluations: kept, restore by admin only, no permanent deletion
qa = once(qa, '<td><div class="row"><button class="btn sm good" data-restore="${esc(x.id)}">Restore</button>${can("admin") ? `<button class="btn sm danger" data-purge="${esc(x.id)}">Delete permanently</button>` : ""}</div></td>', '<td><div class="row">${can("admin") ? `<button class="btn sm good" data-restore="${esc(x.id)}">Restore</button>` : `<span class="hint">Only the administrator can restore</span>`}</div></td>', "trash buttons")
qa = once(qa, '  if(ds.restore){ const x = state.data.trash.find(i => i.id === ds.restore); if(!x) return;', '  if(ds.restore){ if(!can("admin")){ toast("Only the administrator can restore deleted evaluations."); return; } const x = state.data.trash.find(i => i.id === ds.restore); if(!x) return;', "restore guard")
qa = once(qa, '  if(ds.purge){ const x = state.data.trash.find(i => i.id === ds.purge);', '  if(ds.purge){ toast("Permanent deletion is switched off. Deleted evaluations are kept and can be restored by the administrator."); return; const x = state.data.trash.find(i => i.id === ds.purge);', "purge off")
# Timing capture: when scoring starts, when it is first submitted, when a reviewer opens it
qa = once(qa, '    id:null, status:"draft", createdAt:null, createdBy:null,\n', '    id:null, status:"draft", createdAt:null, createdBy:null, startedAt:Date.now(), submittedAt:null, reviewStartedAt:null,\n', "newDraft timing")
qa = once(qa, '    id:doc.id, status:doc.status, createdAt:doc.createdAt, createdBy:doc.createdBy, savedAt:doc.updatedAt,\n', '    id:doc.id, status:doc.status, createdAt:doc.createdAt, createdBy:doc.createdBy, savedAt:doc.updatedAt, startedAt:doc.startedAt||null, submittedAt:doc.submittedAt||null, reviewStartedAt:doc.status==="pending_review"&&can("review")?(doc.reviewStartedAt||Date.now()):(doc.reviewStartedAt||null),\n', "load timing")
qa = once(qa, '    createdAt: d.createdAt || now, createdBy: d.createdBy || state.uid, updatedAt: now, updatedBy: state.uid\n  };', '    createdAt: d.createdAt || now, createdBy: d.createdBy || state.uid, updatedAt: now, updatedBy: state.uid,\n    startedAt: d.startedAt || d.createdAt || now, submittedAt: d.submittedAt || (route !== "draft" ? now : null), reviewStartedAt: reviewer ? (d.reviewStartedAt || now) : (d.reviewStartedAt || null)\n  };', "save timing")
# Simpler submit rules: a written rationale is enough evidence; no literal quote marks, no duplicate quote field
qa = once(qa, 'const hasQuote = s => /["“”«»]/.test(String(s||""));', 'const hasQuote = s => String(s||"").replace(/\\s+/g," ").trim().length >= 10;', "hasQuote")
qa = once(qa, 'function overrideOK(d, k){ const o = d.ovr[k] || {}; return k === "fatal" ? (o.reason||"").trim().length > 3 : (o.reason||"").trim().length > 3 && (o.evidence||"").trim().length > 3; }',
 'function overrideOK(d, k){ const o = d.ovr[k] || {}; if((o.reason||"").trim().length > 3) return true; return k !== "fatal" && hasQuote((d.result.rationales||{})[k]); }', "overrideOK")
qa = once(qa, 'reason:o.reason, evidence:o.evidence, role:myRole()});', 'reason:(o.reason||"").trim() || "See rationale", evidence:(o.evidence||"").trim() || String((r.rationales||{})[k]||""), role:myRole()});', "trail evidence")
qa = once(qa, 'say("Each changed score needs a reason and a transcript quote.");', 'say("Each changed score needs a short reason, or a rationale that explains it.");', "override msg")
qa = once(qa, 'problem = `Scores below 7 need a quoted rationale: ${rp.join(", ")}.`;', 'problem = `Scores below 7 need a short rationale explaining what was missing: ${rp.join(", ")}.`;', "rp msg")
qa = once(qa, 'else if(r.hasFatalError && !r.fatalErrorReason.trim()) problem = "Describe the fatal error, with a quote, before submitting.";', 'else if(r.hasFatalError && !r.fatalErrorReason.trim()) problem = "Describe what happened for the fatal error before submitting.";', "fatal msg")
qa = qa.replace('Below 7: quote the transcript line that justifies this score.', 'Below 7: say what was missing. A transcript line helps but quote marks aren\'t required.')
qa = qa.replace('<p>Scores 1–10; below 7 needs a quoted rationale</p>', '<p>Scores 1–10; below 7 needs a short rationale</p>')
qa = qa.replace('placeholder="Verbatim transcript quote"', 'placeholder="Transcript line (optional if the rationale already has it)"')
qa = once(qa, "boot();\n</script>\n</body></html>",
 'window.__qgOpenEval=function(id){ if(!state.data.evaluations.some(e=>e.id===id)) return false; openEval(id); return true; };\nwindow.__qgGo=function(t){ try{ go(t); return true; }catch(e){ return false; } };\nboot();\n</script>\n</body></html>', "qa boot")

b64 = lambda s: base64.b64encode(s.encode("utf-8")).decode("ascii")
json.dump({"cem": b64(cem), "qa": b64(qa)}, open(os.path.join(ROOT, "build", "modules.json"), "w"))
open(os.path.join(ROOT, "build", "cem.html"), "w").write(cem); open(os.path.join(ROOT, "build", "qa.html"), "w").write(qa)
print("ok", len(cem), len(qa))
