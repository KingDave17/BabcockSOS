import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth } from "firebase/auth";
// @ts-ignore - Firebase JS SDK does not expose React Native exports to TypeScript properly
import { getReactNativePersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore"; // UPDATED IMPORT
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "", 
  authDomain: "babcock-emergency-app.firebaseapp.com",
  projectId: "babcock-emergency-app",
  storageBucket: "babcock-emergency-app.firebasestorage.app",
  messagingSenderId: "753302098218",
  appId: "1:753302098218:web:01067ff05fef15b362ce53"
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

let auth: any;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (error: any) {
    auth = getAuth(app);
    console.log("Firebase Auth re-attached.");
  }
}

// Ensure db initialization doesn't crash on multiple attempts
let db: any;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch (e) {
  const { getFirestore } = require('firebase/firestore');
  db = getFirestore(app);
}

export { auth, db };