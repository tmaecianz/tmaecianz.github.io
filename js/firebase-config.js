// Firebase Initialization & Configuration Module
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc,
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  updateDoc 
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Your Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyAAubLj9lK8steZjMMOq62XybYRqi1VsUs",
  authDomain: "emergency-comms-6090c.firebaseapp.com",
  projectId: "emergency-comms-6090c",
  storageBucket: "emergency-comms-6090c.firebasestorage.app",
  messagingSenderId: "987649221907",
  appId: "1:987649221907:web:85b7c23ee02532caa3a6e6",
  measurementId: "G-BEQVWX5NB5"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Auth & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

// Export Firestore utilities for easy access
export {
  signInAnonymously,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc
};