import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

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

export const getCurrentFirebaseUser = () => firebaseAuth.currentUser;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = async () => {
  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle({
      skipNativeAuth: true,
      useCredentialManager: true,
    });

    if (!result.user || !result.credential?.idToken) {
      throw new Error('Google sign-in haikukamilika ndani ya MKUU AI.');
    }

    const credential = GoogleAuthProvider.credential(
      result.credential.idToken,
      result.credential.accessToken,
    );

    return signInWithCredential(firebaseAuth, credential);
  }

  try {
    return await signInWithPopup(firebaseAuth, googleProvider);
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(firebaseAuth, googleProvider);
      return getRedirectResult(firebaseAuth);
    }
    throw error;
  }
};

export const signOutGoogle = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } finally {
      await signOut(firebaseAuth);
    }
    return;
  }
  await signOut(firebaseAuth);
};

export const subscribeToFirebaseAuth = (callback: (user: FirebaseUser | null) => void) =>
  onAuthStateChanged(firebaseAuth, callback);
