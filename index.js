const express = require('express');
const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');
const { getFirestore } = require('firebase/firestore'); // Added Firestore import
const cors = require('cors');
const dotenv = require('dotenv'); // Import dotenv

dotenv.config(); // Load .env variables

// Import routes
const flashcardRoutes = require('./routes/flashcardRoutes');
const notesRoutes = require('./routes/notesRoutes');
const quizRoutes = require('./routes/quizRoutes');
const app = express();
const port = process.env.PORT || 3000; // Use environment variable for port

// Firebase SDK initialization (ONLY ONCE HERE)
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "YOUR_FALLBACK_API_KEY", // Use env var
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "evalio-lms.firebaseapp.com", // Use env var
    projectId: process.env.FIREBASE_PROJECT_ID || "evalio-lms", // Use env var
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "evalio-lms.appspot.com", // Use env var
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "YOUR_FALLBACK_SENDER_ID", // Use env var
    appId: process.env.FIREBASE_APP_ID || "YOUR_FALLBACK_APP_ID", // Use env var
    measurementId: process.env.FIREBASE_MEASUREMENT_ID // Optional
  };

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp); // Initialize Firestore

// Middleware
app.use(cors());
app.use(express.json()); // Make sure body parsing middleware is before routes
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.send('Backend is running with Firebase SDK!');
});

// Mount API routes
app.use('/api/flashcards', flashcardRoutes); // Routes can import db if needed
app.use('/api/notes', notesRoutes);
app.use('/api/quiz',quizRoutes)
// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Export db and auth for use in other modules
module.exports = { db, auth };
