import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBzSRqiBrLugHC4M-1VWEIa8ipzFjOuPzU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-3598569322-9fa1e.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-3598569322-9fa1e",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-3598569322-9fa1e.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "980989391179",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:980989391179:web:20920b69882649806678ce",
  // Configuración específica para Realtime Database
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://studio-3598569322-9fa1e-default-rtdb.firebaseio.com/",
};

// Inicializar Firebase
export const app = initializeApp(firebaseConfig);

// Inicializar Firestore (lo mantenemos por si hay otras partes de la app que lo usen)
export const db = getFirestore(app);

// Inicializar Realtime Database
export const realtimeDb = getDatabase(app);
