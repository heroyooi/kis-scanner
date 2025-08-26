import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ENV } from './env';

let app: App;

export function initFirebaseAdmin() {
  if (!getApps().length) {
    app = initializeApp({
      credential: cert({
        projectId: ENV.FIREBASE_PROJECT_ID,
        clientEmail: ENV.FIREBASE_CLIENT_EMAIL,
        privateKey: ENV.FIREBASE_PRIVATE_KEY,
      }),
    });
  }
  return {
    db: getFirestore(),
  };
}
