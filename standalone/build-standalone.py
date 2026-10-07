"""Build standalone/dist/index.html: the same app, with a sign-in gate and
the Firebase adapter loaded before it, instead of expecting window.claude
to already exist. Run after tools/build.py (needs dist/qg-platform.html)."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app_html = open(os.path.join(ROOT, "dist", "qg-platform.html"), encoding="utf-8").read()

# Pull out everything after <body> so we can wrap it with a sign-in gate;
# the app's own CSS/head stays as-is.
body_start = app_html.index("<body")
body_open_end = app_html.index(">", body_start) + 1
body_close = app_html.rindex("</body>")
head = app_html[:body_open_end]
body = app_html[body_open_end:body_close]

GATE = """
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
    catch (e) { const p = document.getElementById('signinErr'); p.textContent = e.message || 'Sign-in failed.'; p.style.display = 'block'; }
  };
  window.standaloneAuth.onAuthStateChanged(u => { document.getElementById('signinGate').style.display = u ? 'none' : 'flex'; });
</script>
"""

FIREBASE_SDKS = """
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js"></script>
<script src="firebase-adapter.js"></script>
"""

out = head + FIREBASE_SDKS + GATE + body + "</body></html>"
os.makedirs(os.path.join(ROOT, "standalone", "dist"), exist_ok=True)
open(os.path.join(ROOT, "standalone", "dist", "index.html"), "w", encoding="utf-8").write(out)
print("Built standalone/dist/index.html,", len(out), "bytes")
