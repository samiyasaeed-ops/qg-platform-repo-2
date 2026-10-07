/* Cloud Functions backing the adapter's two MCP calls (email, backups).
   These run server-side because an email API key must never reach the
   browser, and because signed URLs for the backup files need the Admin SDK.

   Deploy with: firebase deploy --only functions   (from standalone/)
   Set the Resend key first:
     firebase functions:config:set resend.key="re_your_key_here"
   (or use `firebase functions:secrets:set RESEND_KEY` on newer CLI versions
   — either way, see README.md step 5.) */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const RESEND_KEY = functions.config().resend && functions.config().resend.key;
const FROM_ADDRESS = functions.config().resend && functions.config().resend.from; // e.g. "Q&G Platform <qg@yourdomain.com>"

async function requireSignedIn(context){
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in first.");
}

// Called as MCP.callTool("Gmail","send_message",{to,cc,subject,body,htmlBody})
exports.sendEmail = functions.https.onCall(async (data, context) => {
  await requireSignedIn(context);
  if (!RESEND_KEY) throw new functions.https.HttpsError("failed-precondition", "No email provider configured yet.");
  const { to, cc, subject, body, htmlBody } = data;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_ADDRESS, to, cc, subject, text: body, html: htmlBody })
  });
  if (!res.ok) throw new functions.https.HttpsError("internal", "Email provider error: " + (await res.text()).slice(0, 300));
  return { id: (await res.json()).id || "" };
});

// Called as MCP.callTool("Google Drive","create_file",{title,base64Content,...})
// Stores the backup in Firebase Storage instead of Google Drive, and
// returns a signed URL under "viewUrl" so the existing Backups page
// (which just needs {id, viewUrl}) works unmodified.
exports.saveBackup = functions.https.onCall(async (data, context) => {
  await requireSignedIn(context);
  const { title, base64Content, contentMimeType } = data;
  const bucket = admin.storage().bucket();
  const path = "backups/" + Date.now() + "_" + (title || "backup.xlsx").replace(/[^a-zA-Z0-9._-]/g, "_");
  const file = bucket.file(path);
  await file.save(Buffer.from(base64Content, "base64"), { contentType: contentMimeType });
  const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 7 * 24 * 3600 * 1000 });
  return { id: path, viewUrl: url };
});
