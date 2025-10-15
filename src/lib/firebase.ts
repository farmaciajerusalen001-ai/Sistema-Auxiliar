import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBzSRqiBrLugHC4M-1VWEIa8ipzFjOuPzU",
  authDomain: "studio-3598569322-9fa1e.firebaseapp.com",
  projectId: "studio-3598569322-9fa1e",
  storageBucket: "studio-3598569322-9fa1e.firebasestorage.app",
  messagingSenderId: "980989391179",
  appId: "1:980989391179:web:20920b69882649806678ce",
  // Configuración específica para Realtime Database
  databaseURL: "https://studio-3598569322-9fa1e-default-rtdb.firebaseio.com/"
};

// Inicializar Firebase
export const app = initializeApp(firebaseConfig);

// Inicializar Firestore (lo mantenemos por si hay otras partes de la app que lo usen)
export const db = getFirestore(app);

// Inicializar Realtime Database
export const realtimeDb = getDatabase(app);
