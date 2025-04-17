const express = require('express');
const flashcardController = require('../controllers/flashcardController');

const router = express.Router();

// POST /api/flashcards/generate
router.post('/generate', flashcardController.generateFlashcards);

// POST /api/flashcards/save
router.post('/save', flashcardController.saveFlashcards);

module.exports = router;
