# Running the Q&G Platform standalone, on Vercel + Firebase

This makes the Vercel copy fully functional — real saving, real sign-in, real
email, real file storage — independent of claude.ai. It replaces the five
pieces claude.ai normally provides (see `docs/SESSION_CONTEXT.md` and the chat
history for why each one exists) with a free-tier Firebase project.

**Time:** a focused afternoon for steps 1–7. Expect to come back and tighten
the security rules (step 4) before this is used for anything but your own
testing.

**What you end up with:** the exact same app, same features, same data model
— just talking to your own Firebase project instead of claude.ai's runtime.
`firebase-adapter.js` is the only new code; nothing in `src/` changes.

---

## 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) →
   **Add project**. Name it (e.g. `qg-platform`). Google Analytics isn't
   needed — you can skip it.
2. Once created, you'll land on the project's Console home. Leave this tab
   open; you'll come back to it repeatedly below.

## 2. Turn on the four services

In the left sidebar, under **Build**:

- **Authentication** → Get started → **Sign-in method** tab → enable
  **Google**. (You can add others later; Google is the fastest to set up
  and matches a Workspace-based org well.)
- **Firestore Database** → Create database → **Start in production mode**
  → pick a region close to you (e.g. `eur3` for UAE/Europe) → Enable.
- **Storage** → Get started → **Start in production mode** → same region →
  Done.
- **Functions**: needs the project on the **Blaze (pay-as-you-go)** plan —
  Firebase requires this for any project calling external APIs (sending
  email), but the free tier underneath it is generous and a small team's
  usage will likely cost nothing or close to it. Click **Upgrade project**
  when prompted; you'll need a billing card on file, but Firebase doesn't
  charge beyond the free quota unless you set a budget alert and ignore it.

## 3. Get your config and fill in the adapter

Console home → the **</>** (web app) icon → register an app (any nickname,
e.g. "qg-web") → **don't** check "Firebase Hosting" → Register.

You'll see a config object like:
```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "qg-platform-xxxx.firebaseapp.com",
  projectId: "qg-platform-xxxx",
  storageBucket: "qg-platform-xxxx.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```
Open `standalone/firebase-adapter.js` and paste these six values into the
`FIREBASE_CONFIG` object near the top (replacing every `"REPLACE_ME"`).

These are public client identifiers, not secrets — it's normal and expected
for them to be visible in the page source. They identify which project to
talk to; the security rules (next step) are what actually control access.

## 4. Security rules, and granting yourself admin

1. Console → **Firestore Database** → **Rules** tab → replace the contents
   with `standalone/firestore.rules` → **Publish**.
2. Console → **Storage** → **Rules** tab → replace with
   `standalone/storage.rules` → **Publish**.
3. **Sign in once** through the app (step 8 below) so your account exists in
   Firebase Auth, then: Console → **Firestore Database** → **Data** tab →
   **Start collection** → collection ID `admins` → document ID: paste your
   own **User UID** (Console → Authentication → Users tab, copy the UID next
   to your email) → add any field, e.g. `grantedAt: true` → Save.

   This is the one manual, no-way-around-it bootstrap step: the rules say
   only an existing admin can grant admin, so the very first one has to be
   added by hand. Every admin after that, grant from inside the app's own
   Staff list, the same as on claude.ai.

Read the comment at the top of `firestore.rules` — it's deliberately
permissive beyond the admin-only collections (any signed-in user can read
and write everything else), matching what the claude.ai version itself
allows. Tighten this before anyone outside your own testing has the link —
particularly if you don't fully trust everyone who'll have the URL to only
do what the UI lets them do.

## 5. Email: get a Resend account (or swap in your own provider)

Sending email needs a real provider — you can't send mail straight from a
browser. [resend.com](https://resend.com) has a free tier (100/day) and the
simplest setup of the common options; swap `functions/index.js` for
SendGrid, Postmark, or Microsoft Graph if you'd rather use one of those.

1. Sign up at resend.com → **API Keys** → create one, starting with `re_`.
2. Verify a sending domain (Resend walks you through adding a couple of DNS
   records) — or use their shared test domain while you're just trying this
   out, which only delivers to your own verified email address.
3. Install the Firebase CLI if you don't have it: `npm install -g firebase-tools`,
   then `firebase login`.
4. From `standalone/`:
   ```
   firebase use --add          # pick your project, give it an alias like "default"
   firebase functions:config:set resend.key="re_your_key_here" resend.from="Q&G Platform <qg@yourdomain.com>"
   cd functions && npm install firebase-admin firebase-functions && cd ..
   firebase deploy --only functions
   ```
   This deploys `sendEmail` and `saveBackup` (replacing Gmail and Drive —
   see the comment at the top of `functions/index.js` for why backups land
   in your own Storage bucket instead of Drive).

## 6. The /_blob/ file-link resolver

Every attached document, journey-test screenshot and uploaded sheet is
linked in the app as `/_blob/<id>`. On claude.ai the platform serves those
directly; standalone, a small Vercel function does it instead —
`standalone/api/_blob/[id].js`, wired in by `standalone/vercel.json`.

It needs its own Firebase credentials (separate from the public ones in
step 3, because it runs server-side and can read anything):

1. Console → **Project settings** (gear icon) → **Service accounts** →
   **Generate new private key** → downloads a JSON file. Keep this file
   private — unlike the step-3 config, this one grants full admin access to
   your project.
2. In Vercel: your project → **Settings** → **Environment Variables**, add:
   - `FIREBASE_PROJECT_ID` — the `project_id` field from the JSON
   - `FIREBASE_CLIENT_EMAIL` — the `client_email` field
   - `FIREBASE_PRIVATE_KEY` — the `private_key` field, pasted as-is
     (Vercel's text area handles the embedded newlines correctly)

## 7. Build and deploy

From the repository root:
```
python3 tools/build.py                 # builds dist/qg-platform.html, as always
python3 standalone/build-standalone.py # wraps it with the sign-in gate + adapter
```
This produces `standalone/dist/index.html` and copies `firebase-adapter.js`
alongside it.

Deploy `standalone/` to Vercel (not the repo root — the `vercel.json` rewrite
and the `api/` function both need to be at the project's top level):
- **Vercel dashboard:** New Project → import the repo → set **Root Directory**
  to `standalone` → Deploy.
- **Or CLI:** `cd standalone && vercel --prod`.

Every time you rebuild (`tools/build.py` + `build-standalone.py`), redeploy
the same way to push the update.

## 8. Try it

Open the Vercel URL. You should see the sign-in screen from
`build-standalone.py`'s gate, not the "No venture access" message from
before. Sign in with Google, then follow step 4.3 above to make yourself
admin, reload, and you should land in a completely empty platform — no
staff, no ventures configured, nothing — because this is a brand new,
separate database from the one behind claude.ai. See step 9 for bringing
your existing data across.

## 9. Bringing your existing data across (optional)

This is a fresh, empty database — nothing from the live claude.ai platform
is here automatically, because the two are genuinely separate systems from
this point on, with no ongoing sync between them. If you want to start with
what's already there rather than from scratch, that's a one-time export/
import: ask Claude, in a claude.ai chat connected to the live artifact, to
export the current collections, then write a small script to import that
into this Firestore project (the Firebase Admin SDK's `batch()` writes are
the natural way to do this — a few hundred lines at most, and something
Claude can write for you if you share the exported data back).

## If something doesn't work

- **Still shows "No venture access":** the adapter's `FIREBASE_CONFIG` still
  has a `"REPLACE_ME"` in it, or `standalone/dist/index.html` was built
  before you filled it in — rebuild after editing `firebase-adapter.js`.
- **Sign-in button does nothing / console shows a popup-blocked error:**
  your browser blocked the Google sign-in popup — allow popups for the
  Vercel domain and try again.
- **Signed in, but every page says you can't do anything:** you haven't
  completed step 4.3 yet (granting yourself admin), or the Firestore rules
  weren't published.
- **Emails never arrive:** check Firebase Console → Functions → Logs for
  `sendEmail` — the most common cause is the Resend domain not being
  verified yet, or `resend.config` not actually deployed (rerun the
  `functions:config:set` + `firebase deploy --only functions` from step 5).
- **Uploaded files or exports 404:** check the three `FIREBASE_*` environment
  variables are set in Vercel exactly as in step 6, and that you deployed
  `standalone/` (with the `api/` folder) rather than the repo root.

This is genuinely a parallel platform from this point forward — changes
made in the live claude.ai artifact won't appear here, and vice versa,
unless someone exports and re-imports data by hand. Decide which one is
your actual system of record before both are in use.
