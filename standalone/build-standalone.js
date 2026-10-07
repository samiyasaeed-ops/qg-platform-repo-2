/* Build standalone/dist/index.html: same app with sign-in gate + Firebase adapter.
   Node.js replacement for build-standalone.py (no Python needed). */
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const appHtml = fs.readFileSync(path.join(ROOT, 'dist', 'qg-platform.html'), 'utf-8');

const bodyStart = appHtml.indexOf('<body');
const bodyOpenEnd = appHtml.indexOf('>', bodyStart) + 1;
const bodyClose = appHtml.lastIndexOf('</body>');
const head = appHtml.slice(0, bodyOpenEnd);
const body = appHtml.slice(bodyOpenEnd, bodyClose);

const FIREBASE_SDKS = `
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js"></script>
<script src="firebase-adapter.js"></script>
`;

const GATE = `
<div id="signinGate" style="position:fixed;inset:0;z-index:999;background:#0B1420;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif">
  <div style="background:#fff;border-radius:10px;padding:32px 36px;max-width:360px;text-align:center">
    <h1 style="font-size:18px;margin:0 0 6px">Q&amp;G Platform</h1>
    <p style="color:#667;font-size:14px;margin:0 0 20px">Sign in with your Alfred Holdings Google account to continue.</p>
    <button id="signinBtn" style="background:#13212A;color:#fff;border:0;border-radius:6px;padding:10px 20px;font-size:14px;cursor:pointer">Sign in with Google</button>
    <p id="signinErr" style="color:#c0392b;font-size:13px;margin-top:14px;display:none"></p>
  </div>
</div>
<script>
  document.getElementById('signinBtn').onclick = async () => {
    try { await window.standaloneSignIn(); }
    catch (e) { var p = document.getElementById('signinErr'); p.textContent = e.message || 'Sign-in failed.'; p.style.display = 'block'; }
  };
  window.standaloneAuth.onAuthStateChanged(function(u) { document.getElementById('signinGate').style.display = u ? 'none' : 'flex'; });
</script>
`;

const out = head + FIREBASE_SDKS + GATE + body + '</body></html>';
const distDir = path.join(__dirname, 'dist');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'index.html'), out, 'utf-8');
fs.copyFileSync(path.join(__dirname, 'firebase-adapter.js'), path.join(distDir, 'firebase-adapter.js'));
console.log('Built standalone/dist/index.html,', out.length, 'bytes');
