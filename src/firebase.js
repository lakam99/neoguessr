import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth'
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, doc, setDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore'
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}
const ready = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain)
let app, auth, db
if (ready) { app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app) }
export { ready, app, auth, db, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, updateProfile, collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, doc, setDoc, updateDoc, deleteDoc, increment }
