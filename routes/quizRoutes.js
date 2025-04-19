const express = require('express');
const quizController = require('../controllers/quizController');

const router = express.Router();

// POST /api/quiz/generate
router.post('/generate', quizController.generateQuiz);
router.post('/generate-from-flashcard', quizController.generateQuizFromFlashcard);
router.post('/generate-from-notes'  , quizController.generateQuizFromNotes);
module.exports = router;
