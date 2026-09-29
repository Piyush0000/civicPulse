/* Firebase Cloud Messaging service worker: shows CivicPulse notifications when the site is in the background.
   The public web config arrives as query parameters on the registration URL (see src/lib/client/firebase.ts). */
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

// Notifications carrying a "notification" payload are displayed automatically by the SDK;
// clicking one opens the link sent in webpush.fcmOptions.link (the complaint's tracking page).
firebase.messaging();
