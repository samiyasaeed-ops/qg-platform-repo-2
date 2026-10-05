/* Builds the test pages from dist/qg-platform.html, serves them with the same
   content-security policy the hosted platform uses, and runs every *.test.js. */
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const T = __dirname, DIST = path.join(T, '..', 'dist', 'qg-platform.html');
if (!fs.existsSync(DIST)) { console.error('Run "python3 tools/build.py" first.'); process.exit(1); }
fs.mkdirSync(path.join(T, 'out'), { recursive: true });
const html = fs.readFileSync(DIST, 'utf8'), mock = fs.readFileSync(path.join(T, 'mock.js'), 'utf8');
const seed = n => fs.readFileSync(path.join(T, n), 'utf8');
const page = (s, m) => html.replace('<script id="qa-src"', '<script>' + s + '</script><script>' + m + '</script><script id="qa-src"');
// line-manager session: same data, signed in as Lina Manager, not the owner
const lmSeed = (() => { const d = JSON.parse(seed('seed.js').slice('window.__SEED='.length, -1)); d['mod/core/staff/stf-lm'].userId = 'u_LM'; return 'window.__SEED=' + JSON.stringify(d) + ';'; })();
const lmMock = mock.replace("me:async()=>({id:'u_TEST',name:'SS Tester',email:'ss@example.com',isOwner:true,canEdit:true})", "me:async()=>({id:'u_LM',name:'Lina Manager',email:'',isOwner:false,canEdit:false})").replace('isOwner:async()=>true', 'isOwner:async()=>false').replace("id:async()=>'u_TEST'", "id:async()=>'u_LM'");
const pages = { 'index.html': page(seed('seed.js'), mock), 'rr.html': page(seed('seed_rr.js'), mock), 'cx.html': page(seed('seed_cx.js'), mock), 'lm.html': page(lmSeed, lmMock) };
const CSP = "default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob: 'self'; frame-src 'none'";
const server = http.createServer((q, r) => { const f = decodeURIComponent(q.url.split('?')[0]).slice(1);
  const body = pages[f] ?? (fs.existsSync(path.join(T, f)) ? fs.readFileSync(path.join(T, f)) : null);
  if (body == null) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', 'Content-Security-Policy': CSP }); r.end(body); });
server.listen(8301, '127.0.0.1', async () => {
  const only = process.argv.slice(2), files = fs.readdirSync(T).filter(f => f.endsWith('.test.js') && (!only.length || only.some(o => f.startsWith(o)))).sort();
  const results = [];
  for (const f of files) {
    const out = await new Promise(res => { let buf = ''; const p = spawn(process.execPath, [path.join(T, f)], { cwd: T });
      const timer = setTimeout(() => { p.kill(); buf += '\nTIMEOUT'; }, 180000);
      p.stdout.on('data', d => buf += d); p.stderr.on('data', d => buf += d); p.on('close', code => { clearTimeout(timer); res({ code, buf }); }); });
    const bad = out.code !== 0 || /TIMEOUT|TimeoutError|Error:/.test(out.buf) || /^errs .+/m.test(out.buf) || /^ERRORS: .+/m.test(out.buf);
    results.push([f, !bad]); console.log((bad ? 'FAIL ' : 'pass ') + f + (bad ? '\n' + out.buf.split('\n').slice(-12).join('\n') : ''));
  }
  server.close(); const failed = results.filter(r => !r[1]).length;
  console.log(`\n${results.length - failed} of ${results.length} test files passed.`); process.exit(failed ? 1 : 0);
});
