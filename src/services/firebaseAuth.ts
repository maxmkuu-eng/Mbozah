import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBVYPOIPhEB7xgi7tdGyFFmc4ByTOL8rkE',
  authDomain: 'com-mkuu-ai.firebaseapp.com',
  projectId: 'com-mkuu-ai',
  storageBucket: 'com-mkuu-ai.firebasestorage.app',
  messagingSenderId: '850880444376',
  appId: '1:850880444376:web:a9db37836f137c873624ad',
  measurementId: 'G-302DMH1S27',
};

const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = () => signInWithPopup(firebaseAuth, googleProvider);
export const signOutGoogle = () => signOut(firebaseAuth);
export const subscribeToFirebaseAuth = (callback: (user: FirebaseUser | null) => void) =>
  onAuthStateChanged(firebaseAuth, callback);
