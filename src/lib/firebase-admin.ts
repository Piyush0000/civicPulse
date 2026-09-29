import type { App } from "firebase-admin/app";

// Firebase (free Spark plan): Google Sign-In verification for citizens and FCM web push.
// Optional: without FIREBASE_SERVICE_ACCOUNT_JSON these features are simply disabled.

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as ServiceAccount;
    return j.project_id && j.client_email && j.private_key ? j : null;
  } catch {
    console.error("[firebase] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    return null;
  }
}

export const firebaseEnabled = () => serviceAccount() !== null;

type G = { __cpFirebase?: App };
const g = globalThis as unknown as G;

async function app(): Promise<App> {
  if (g.__cpFirebase) return g.__cpFirebase;
  const sa = serviceAccount();
  if (!sa) throw new Error("Firebase is not configured");
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  g.__cpFirebase =
    getApps().find((a) => a.name === "civicpulse") ??
    initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }) }, "civicpulse");
  return g.__cpFirebase;
}

export async function verifyFirebaseIdToken(idToken: string) {
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth(await app()).verifyIdToken(idToken, true);
}

/** Send a web push to many tokens; returns tokens that are no longer valid so callers can delete them. */
export async function sendPush(tokens: string[], msg: { title: string; body: string; link: string }): Promise<{ sent: number; invalid: string[] }> {
  if (!tokens.length) return { sent: 0, invalid: [] };
  const { getMessaging } = await import("firebase-admin/messaging");
  const res = await getMessaging(await app()).sendEachForMulticast({
    tokens,
    notification: { title: msg.title, body: msg.body },
    webpush: { fcmOptions: { link: msg.link }, notification: { icon: "/icon.svg" } },
  });
  const invalid: string[] = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code ?? "";
    if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token") || code.includes("invalid-argument")) invalid.push(tokens[i]);
  });
  return { sent: res.successCount, invalid };
}
