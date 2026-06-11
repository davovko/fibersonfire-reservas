import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwpe8o3kWlHttDAkMGRSju6VpCL4Mafkk",
  authDomain: "fibersonfire-reservas.firebaseapp.com",
  projectId: "fibersonfire-reservas",
  storageBucket: "fibersonfire-reservas.firebasestorage.app",
  messagingSenderId: "216618920888",
  appId: "1:216618920888:web:9af6d86d5e5893395dbd4d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
