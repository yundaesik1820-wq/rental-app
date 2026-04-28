import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const messaging = getMessaging(app);
export const VAPID_KEY = "BLPGJBCYMn5hajgFcqpus-4noZQwFtpD4pZOV93yWk2cO1dCWEd_iS7m-9qMV2Dr_MtcAlMHjF7EPdY1z8BzNds";
export const db      = getFirestore(app);
export const storage = getStorage(app);
