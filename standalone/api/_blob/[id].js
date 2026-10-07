/* Resolves the app's hardcoded "/_blob/<id>" links (used for every
   attached file, journey-test screenshot, uploaded sheet, etc.) to a real,
   signed Firebase Storage URL, then redirects there.

   On claude.ai, "/_blob/" is handled by the platform itself. Standalone,
   this route plus the rewrite in vercel.json is what makes those same
   links work unmodified — nothing in the built HTML needs to change.

   Needs a Firebase service account: Firebase Console → Project settings →
   Service accounts → Generate new private key. In Vercel, set these as
   environment variables (Project → Settings → Environment Variables):
     FIREBASE_PROJECT_ID
     FIREBASE_CLIENT_EMAIL
     FIREBASE_PRIVATE_KEY   (paste the key including the BEGIN/END lines;
                             Vercel's UI handles the newlines for you)
*/
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
    }),
    storageBucket: process.env.FIREBASE_PROJECT_ID + ".appspot.com"
  });
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || Array.isArray(id)) return res.status(400).send("Missing file id");
  try {
    const file = admin.storage().bucket().file("uploads/" + id);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).send("Not found");
    const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 3600 * 1000 });
    res.writeHead(302, { Location: url });
    res.end();
  } catch (e) {
    res.status(500).send("Couldn't resolve that file.");
  }
}
