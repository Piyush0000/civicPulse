"use client";

// Firebase web SDK (free Spark plan): Google Sign-In for citizens and FCM web push.
// Everything is optional; features hide themselves when the NEXT_PUBLIC_FIREBASE_* config is absent.

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const firebaseConfigured = !!(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
export const pushConfigured = firebaseConfigured && !!vapidKey && !!cfg.messagingSenderId;

async function app() {
  const { initializeApp, getApps } = await import("firebase/app");
  return getApps()[0] ?? initializeApp(cfg as Record<string, string>);
}

/** Opens the Google account picker and returns a Firebase ID token for the server to verify. */
export async function googleIdToken(): Promise<string> {
  const { getAuth, GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  const auth = getAuth(await app());
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(auth, provider);
  return cred.user.getIdToken();
}

/** Ask permission, register the messaging service worker and return this browser's FCM token. */
export async function enablePush(): Promise<string> {
  if (!pushConfigured) throw new Error("Push notifications are not configured");
  const { isSupported, getMessaging, getToken } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("This browser does not support web push");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted");
  // The service worker is a static file; it receives the (public) web config via its URL.
  const qs = new URLSearchParams(cfg as Record<string, string>).toString();
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${qs}`);
  const token = await getToken(getMessaging(await app()), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Could not get a push token");
  return token;
}

/** Show pushes that arrive while the page is open (the service worker handles background ones). */
export async function onForegroundPush(cb: (title: string, body: string) => void) {
  if (!pushConfigured) return () => {};
  const { isSupported, getMessaging, onMessage } = await import("firebase/messaging");
  if (!(await isSupported())) return () => {};
  return onMessage(getMessaging(await app()), (p) => cb(p.notification?.title ?? "CivicPulse", p.notification?.body ?? ""));
}
