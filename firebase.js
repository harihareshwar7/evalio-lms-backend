const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');
const { getFirestore } = require('firebase/firestore');
const dotenv = require('dotenv');
dotenv.config();

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCDWxyhg1BNsF-_VPLNuBolq0-qQaqWvkQ",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "evalio-lms.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "evalio-lms",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "evalio-lms.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "906474100955",
    appId: process.env.FIREBASE_APP_ID || "1:906474100955:web:b35fd7bd53152d065bd4fe",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-6HGG06T6D8"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

module.exports = { db, auth };
