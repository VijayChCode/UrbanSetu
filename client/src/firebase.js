// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCSIPavj9H3vKf_BfNHNL-l9BnbjgoGQcE",
  authDomain: "urbansetu-76c8c.firebaseapp.com",
  projectId: "urbansetu-76c8c",
  storageBucket: "urbansetu-76c8c.firebasestorage.app",
  messagingSenderId: "1085933309814",
  appId: "1:1085933309814:web:39232deaaee1f69272b457",
  measurementId: "G-M3EL8W29W9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };