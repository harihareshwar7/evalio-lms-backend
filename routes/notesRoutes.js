const express = require('express');
const notesController = require('../controllers/notesController');

const router = express.Router();

// POST /api/notes/generate
router.post('/generate', notesController.generateNotes);

module.exports = router;
