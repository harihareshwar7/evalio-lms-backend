const express = require("express");
const router = express.Router();
const {
    createGoogleForm,
    getGoogleFormResponses,
    saveGoogleFormDetails,
    getAllGoogleFormDetails,
    generateQuizPdf,
    saveQuizPdfUrl,
    getUserQuizPdfs,
    reviewQuiz // <-- add this import
} = require("../controllers/quizGoogleFormController");

router.post("/create", createGoogleForm);
router.post("/responses", getGoogleFormResponses);
router.post("/save", saveGoogleFormDetails);
router.get('/fetch-form-details', getAllGoogleFormDetails);
router.post('/generate-pdf', generateQuizPdf);
router.post('/save-pdf-url', saveQuizPdfUrl);

router.post('/user-pdf-urls', getUserQuizPdfs);

// Add the new review-quiz route
router.post('/review-quiz', reviewQuiz);
router.post('/save-review-pdf-url', saveQuizPdfUrl);

// API to fetch only the score from Google Form responses
router.post('/fetch-score', async (req, res) => {
    // Import controller here to avoid circular dependency
    const { getGoogleFormResponses } = require("../controllers/quizGoogleFormController");
    // Create a mock response object to capture the controller's output
    let capturedData = null;
    await getGoogleFormResponses(
        req,
        {
            status: (code) => ({
                json: (data) => {
                    if (code === 200) capturedData = data;
                    else capturedData = null;
                }
            })
        }
    );
    if (capturedData && capturedData.score !== undefined) {
        res.status(200).json({ ...capturedData.score });
    } else {
        res.status(404).json({ error: "Score not found in response." });
    }
});

module.exports = router;
