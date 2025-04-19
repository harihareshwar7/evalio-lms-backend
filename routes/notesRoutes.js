const express = require('express');
const notesController = require('../controllers/notesController');

const router = express.Router();

// POST /api/notes/generate
router.post('/generate', notesController.generateNotes);
router.post('/make-pdf', notesController.generateNotesPDF);
router.post('/save-db', notesController.saveNotesPDFAndRecord);
router.post('/saved', notesController.getNotesByUserId);
router.post('/json-from-pdf', notesController.extractNotesJsonFromPDF);
module.exports = router;
