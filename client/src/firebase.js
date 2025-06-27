// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "mern-estate-b0d7e.firebaseapp.com",
  projectId: "mern-estate-b0d7e",
  storageBucket: "mern-estate-b0d7e.firebasestorage.app",
  messagingSenderId: "406389541945",
  appId: "1:406389541945:web:ae882489571b5b055c91e8"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);