const express = require('express');
const quizController = require('../controllers/quizController');

const router = express.Router();

// POST /api/quiz/generate
router.post('/generate', quizController.generateQuiz);

module.exports = router;
