/* ============================================================================
   Firebase adapter — stands in for the claude.ai runtime (window.claude.use)
   when this platform is hosted independently.

   This implements the EXACT interface the app code expects for db, user,
   mcp, assets and downloads. Nothing in core.js / cx.js / etc. needs to
   change — this file is the only thing that's new.

   Load this BEFORE qg-platform.html's own scripts, as a classic <script>
   tag (not type="module" — we need window.claude to exist before boot()
   runs). See standalone/index.html for the exact load order, and
   standalone/README.md for full setup steps.
   ============================================================================ */
(function(){
  "use strict";

  // ---- 1. Fill these in from your Firebase project settings ----
  // Firebase Console → Project settings → General → Your apps → SDK setup
  // These are PUBLIC client keys — safe to ship in the HTML. They identify
  // your project; they don't grant access on their own. Access is controlled
  // by firestore.rules and storage.rules (see standalone/README.md).
  const FIREBASE_CONFIG = {
    apiKey: "REPLACE_ME",
    authDomain: "REPLACE_ME.firebaseapp.com",
    projectId: "REPLACE_ME",
    storageBucket: "REPLACE_ME.appspot.com",
    messagingSenderId: "REPLACE_ME",
    appId: "REPLACE_ME"
  };
  // The region your Cloud Functions are deployed to (see functions/index.js).
  const FUNCTIONS_REGION = "us-central1";
  // Where the blob-resolving API route lives (see standalone/api/_blob/[id].js
  // and standalone/vercel.json). Leave as "/_blob/" if you keep the rewrite.
  const BLOB_BASE = "/_blob/";

  const app = firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();
  const functions = app.functions(FUNCTIONS_REGION);

  // ---------------------------------------------------------------- db ----
  // Matches: db.doc(path).get/set/update/delete/onSnapshot/acquire/collection
  //          db.collection(path).onSnapshot/add
  // Paths are slash-separated strings like "mod/cx/cases/CX-2026-000001" —
  // Firestore's own doc()/collection() take exactly that shape, so this is
  // a thin pass-through, not a translation.
  function wrapDoc(ref){
    return {
      id: ref.id,
      path: ref.path,
      get: async () => { const s = await ref.get(); return { exists: s.exists, data: () => s.data() }; },
      set: (data) => ref.set(data),
      update: (data) => ref.update(data),
      delete: () => ref.delete(),
      collection: (sub) => wrapCollection(ref.collection(sub)),
      // Simple lease-style lock: succeeds only if nobody holds it, or the
      // previous holder's lease has expired. Used for the daily-backup and
      // reminder-sweep locks so only one open tab does the work.
      acquire: async ({ holder, ttlMs }) => {
        try {
          return await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const now = Date.now();
            const cur = snap.exists ? snap.data() : null;
            if (cur && cur.expiresAt && cur.expiresAt > now && cur.holder !== holder) {
              return { acquired: false };
            }
            tx.set(ref, { holder, expiresAt: now + (ttlMs || 60000) });
            return { acquired: true };
          });
        } catch (e) { return { acquired: false }; }
      },
      onSnapshot: (cb, errCb) => ref.onSnapshot(
        (s) => cb({ exists: s.exists, data: () => s.data() }),
        errCb
      )
    };
  }
  function wrapCollection(ref){
    return {
      add: (data) => ref.add(data),
      doc: (id) => wrapDoc(id ? ref.doc(id) : ref.doc()),
      onSnapshot: (cb, errCb) => ref.onSnapshot(
        (s) => cb({ docs: s.docs.map(d => ({ id: d.id, data: () => d.data() })) }),
        errCb
      )
    };
  }
  const dbApi = {
    doc: (path) => wrapDoc(db.doc(path)),
    collection: (path) => wrapCollection(db.collection(path))
  };

  // -------------------------------------------------------------- user ----
  // "Admin" (user.isOwner) is read from a Firestore flag rather than a
  // Firebase Auth custom claim, to keep first-time setup simple: see
  // README.md step 4 for how to grant it. This is a convenience trade-off,
  // not a security boundary — real enforcement is in firestore.rules, which
  // checks the same admins/{uid} document server-side.
  let currentUser = null;
  auth.onAuthStateChanged((u) => { currentUser = u; });

  async function waitForAuth(){
    if (currentUser !== null) return currentUser;
    return new Promise((resolve) => {
      const unsub = auth.onAuthStateChanged((u) => { unsub(); resolve(u); });
    });
  }

  const userApi = {
    me: async () => {
      const u = await waitForAuth();
      if (!u) throw new Error("Not signed in");
      return { id: u.uid, name: u.displayName || u.email || "", email: u.email || "" };
    },
    id: async () => { const u = await waitForAuth(); return u ? u.uid : null; },
    isOwner: async () => {
      const u = await waitForAuth(); if (!u) return false;
      try { const d = await db.doc("admins/" + u.uid).get(); return d.exists; }
      catch (e) { return false; }
    },
    canEdit: async () => true,
    // Searches Staff list by name, for the "Linked sign-in" picker — simple
    // client-side filter since the staff list is already loaded locally.
    search: async (q) => {
      const nq = String(q || "").toLowerCase();
      const snap = await db.collection("mod/core/staff").get();
      return snap.docs.map(d => d.data()).filter(p => !nq || (p.name || "").toLowerCase().includes(nq))
        .map(p => ({ id: p.id, name: p.name })).slice(0, 20);
    },
    profiles: async (ids) => {
      const out = {};
      await Promise.all(ids.map(async (id) => {
        try { const d = await db.doc("mod/core/staff/" + id).get(); if (d.exists) out[id] = { name: d.data().name || "" }; }
        catch (e) {}
      }));
      return out;
    }
  };

  // --------------------------------------------------------------- mcp ----
  // Routes the two tools the app actually calls to Cloud Functions (see
  // functions/index.js). Email goes through a transactional email API
  // (Resend) rather than literally sending as Gmail — see README.md for why.
  const sendEmailFn = functions.httpsCallable("sendEmail");
  const backupFn = functions.httpsCallable("saveBackup");
  const mcpApi = {
    callTool: async (server, tool, args) => {
      if (server === "Gmail" && tool === "send_message") {
        const r = await sendEmailFn(args);
        return { payload: r.data };
      }
      if (server === "Google Drive" && tool === "create_file") {
        const r = await backupFn(args);
        return { payload: r.data };
      }
      throw new Error("Not implemented in the standalone adapter: " + server + "/" + tool);
    }
  };

  // ------------------------------------------------------------ assets ----
  // Uploads to Firebase Storage under uploads/<id>. The app only ever
  // reads these back via a literal "/_blob/<id>" URL it builds itself, so
  // the blob-resolving route (standalone/api/_blob/[id].js) is what
  // actually serves the file — this just needs to produce a matching id.
  const assetsApi = {
    upload: async (file) => {
      const id = Date.now() + "_" + Math.random().toString(36).slice(2) + "_" + (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const ref = storage.ref("uploads/" + id);
      await ref.put(file, { contentType: file.type || "application/octet-stream" });
      return { id };
    }
  };

  // --------------------------------------------------------- downloads ----
  // Pure client-side — no backend needed. This is the one piece that
  // doesn't depend on anything you set up below.
  const downloadsApi = {
    save: async ({ filename, data }) => {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click();
      a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      return {};
    }
  };

  // ---- Wire it up as window.claude.use(name), exactly what boot() calls ----
  const APIS = { db: dbApi, user: userApi, mcp: mcpApi, assets: assetsApi, downloads: downloadsApi };
  window.claude = window.claude || {};
  window.claude.use = async (name) => APIS[name] || null;

  // Minimal sign-in UI: the app itself has no sign-in screen (claude.ai
  // handles that there), so this adapter provides the smallest possible
  // one. Replace with your own if you want something nicer or want to
  // restrict sign-in to your own domain (see README.md step 4).
  window.standaloneSignIn = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  };
  window.standaloneSignOut = () => auth.signOut();
  window.standaloneAuth = auth;
})();
