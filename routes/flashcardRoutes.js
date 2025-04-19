const express = require('express');
const flashcardController = require('../controllers/flashcardController');

const router = express.Router();

// POST /api/flashcards/generate
router.post('/generate', flashcardController.generateFlashcards);

// POST /api/flashcards/save

// POST /api/flashcards/
router.post('/save-pdf', flashcardController.generateFlashcardsPDF);
router.post('/json-from-pdf',flashcardController.reverseEngineerFlashcardsFromPDF);
router.post('/saved',flashcardController.getFlashcardPDFUrlsByUser)
// Store flashcard PDF URL and user id
router.post('/save-db', flashcardController.saveFlashcardPDFUrl);

module.exports = router;
