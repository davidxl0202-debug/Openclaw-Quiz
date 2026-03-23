import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  update,
  remove,
  serverTimestamp,
  off,
} from 'firebase/database';

let app = null;
let db = null;

export function initFirebase(config) {
  const cfg = config || {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  if (!cfg.databaseURL) {
    throw new Error('Firebase databaseURL is required');
  }

  app = initializeApp(cfg);
  db = getDatabase(app);
  return db;
}

export function getDb() {
  return db;
}

export function isFirebaseReady() {
  return !!db;
}

export { ref, set, get, onValue, update, remove, serverTimestamp, off };
