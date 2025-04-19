const express = require('express');
const router = express.Router();
const quizGoogleFormController = require('../controllers/quizGoogleFormController');

router.post('/create', quizGoogleFormController.createGoogleForm);
router.post('/responses', quizGoogleFormController.getGoogleFormResponses);

module.exports = router;
