"""Build dist/qg-platform.html from src/ and the patched QA and CEM tools."""
import base64, json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
subprocess.run([sys.executable, os.path.join(ROOT, "tools", "patch.py")], check=True, cwd=ROOT, capture_output=True)
qa = open(os.path.join(ROOT, "build", "qa.html"), encoding="utf-8").read()
ORDER = ["core.js","cx.js","cx2.js","staff.js","staff2.js","reg.js","work.js","lib.js","lists.js","perf.js","kpi.js","io.js","imp.js","rr.js","main.js"]
app = "\n".join(open(os.path.join(ROOT, "src", f), encoding="utf-8").read() for f in ORDER)
assert "</script" not in app.lower(), "A source file contains </script, which would break the page"
shell = open(os.path.join(ROOT, "src", "shell.html"), encoding="utf-8").read()
out = shell.replace("__QA__", json.dumps(base64.b64encode(qa.encode()).decode())).replace("__APP__", app)
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
open(os.path.join(ROOT, "dist", "qg-platform.html"), "w", encoding="utf-8").write(out)
print("Built dist/qg-platform.html,", len(out), "bytes")
