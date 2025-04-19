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

// Firebase SDK initialization
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCDWxyhg1BNsF-_VPLNuBolq0-qQaqWvkQ",
    authDomain: "evalio-lms.firebaseapp.com",
    projectId: "evalio-lms",
    storageBucket: "evalio-lms.firebasestorage.app",
    messagingSenderId: "906474100955",
    appId: "1:906474100955:web:b35fd7bd53152d065bd4fe",
    measurementId: "G-6HGG06T6D8"
  };
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.send('Backend is running with Firebase SDK!');
});

// Mount API routes
app.use('/api/flashcards', flashcardRoutes); // Routes can import db if needed
app.use('/api/notes', notesRoutes);
app.use('/api/quiz',quizRoutes)
app.use('/api/quiz-gform', require('./routes/quizGoogleFormRoutes')); // Google Form routes
// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
