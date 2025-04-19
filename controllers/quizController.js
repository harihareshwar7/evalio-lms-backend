const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const axios = require("axios");
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || "YOUR_GOOGLE_API_KEY";

const generateQuiz = async (req, res) => {
    const { topic, numQuestions = 5, difficulty = "medium" } = req.body; // Default values

    if (!topic) {
        return res.status(400).json({ error: "Missing required field: topic" });
    }

    if (!apiKey || apiKey === "YOUR_GOOGLE_API_KEY") {
        console.error("Google API Key not configured.");
        return res.status(500).json({ error: "API key not configured on the server." });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const prompt = `Generate ${numQuestions} quiz questions on the topic "${topic}" with a difficulty level of "${difficulty}".
        Each question should have:
        - "question": The text of the question (string).
        - "options": An array of 4 possible answers (strings).
        - "correctOption": The correct answer from the options array.
        Format the response ONLY as a valid JSON array of objects. Do NOT include any introductory text, markdown formatting (like \`\`\`json), or explanations outside the JSON array.
        Example:
        [
          {
            "question": "What is the capital of France?",
            "options": ["Paris", "London", "Berlin", "Madrid"],
            "correctOption": "Paris"
          }
        ]`;

        const result = await model.generateContent(prompt);
        const textContent = result.response.text();

        console.log("AI Quiz Response Text:", textContent); // Log raw response

        // Attempt to parse the JSON response
        let quiz;
        try {
            const cleanedText = textContent
                .replace(/^```json\s*/, '') // Remove starting ```json and any following whitespace/newline
                .replace(/```\s*$/, '')     // Remove ending ``` and any preceding whitespace/newline
                .trim();                   // Trim final whitespace just in case
            quiz = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("Failed to parse JSON response for quiz:", parseError);
            console.error("Raw response was:", textContent);
            return res.status(500).json({ error: "Failed to parse quiz from AI response", details: textContent });
        }

        // Basic validation
        if (!Array.isArray(quiz) || quiz.some(q => typeof q.question !== 'string' || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctOption !== 'string')) {
            console.error("Invalid quiz structure received:", quiz);
            return res.status(500).json({ error: "Received invalid quiz structure from AI", details: quiz });
        }

        res.status(200).json(quiz);

    } catch (error) {
        console.error("Error generating quiz:", error);
        res.status(500).json({ error: "Failed to generate quiz.", details: error.message });
    }
};

const generateQuizFromFlashcard = async (req, res) => {
    const { pdfurl, numQuestions = 5, difficulty = "medium" } = req.body;
    if (!pdfurl) {
        return res.status(400).json({ error: "Missing required field: pdfurl" });
    }
    if (!apiKey || apiKey === "YOUR_GOOGLE_API_KEY") {
        console.error("Google API Key not configured.");
        return res.status(500).json({ error: "API key not configured on the server." });
    }
    try {
        // Step 1: Call the json-from-pdf API to get flashcards JSON
        const jsonRes = await axios.post(
            "http://localhost:3000/api/flashcards/json-from-pdf",
            { url: pdfurl }
        );
        const flashcards = jsonRes.data;
        if (!Array.isArray(flashcards) || flashcards.length === 0) {
            return res.status(400).json({ error: "No flashcards found in PDF." });
        }
        // Step 2: Prompt Gemini to generate quiz questions from flashcards
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const prompt = `Using the following flashcards, generate ${numQuestions} quiz questions with a difficulty level of \"${difficulty}\".\nEach question should have:\n- \"question\": The text of the question (string).\n- \"options\": An array of 4 possible answers (strings).\n- \"correctOption\": The correct answer from the options array.\nFormat the response ONLY as a valid JSON array of objects.\nFlashcards: ${JSON.stringify(flashcards)}`;
        const result = await model.generateContent(prompt);
        const textContent = result.response.text();
        let quiz;
        try {
            const cleanedText = textContent
                .replace(/^```json\s*/, '')
                .replace(/```\s*$/, '')
                .trim();
            quiz = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("Failed to parse JSON response for quiz from flashcards:", parseError);
            console.error("Raw response was:", textContent);
            return res.status(500).json({ error: "Failed to parse quiz from AI response", details: textContent });
        }
        // Basic validation
        if (!Array.isArray(quiz) || quiz.some(q => typeof q.question !== 'string' || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctOption !== 'string')) {
            console.error("Invalid quiz structure received:", quiz);
            return res.status(500).json({ error: "Received invalid quiz structure from AI", details: quiz });
        }
        res.status(200).json(quiz);
    } catch (error) {
        console.error("Error generating quiz from flashcard PDF:", error);
        res.status(500).json({ error: "Failed to generate quiz from flashcard PDF.", details: error.message });
    }
};

const generateQuizFromNotes = async (req, res) => {
    const { notes, numQuestions = 5, difficulty = "medium" } = req.body;

    if (!Array.isArray(notes) || notes.length === 0) {
        return res.status(400).json({ error: "Missing or invalid notes array." });
    }

    if (!apiKey || apiKey === "YOUR_GOOGLE_API_KEY") {
        console.error("Google API Key not configured.");
        return res.status(500).json({ error: "API key not configured on the server." });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const prompt = `Using the following notes, generate ${numQuestions} quiz questions with a difficulty level of "${difficulty}".
Each question should have:
- "question": The text of the question (string).
- "options": An array of 4 possible answers (strings).
- "correctOption": The correct answer from the options array.
Format the response ONLY as a valid JSON array of objects. Do NOT include any introductory text, markdown formatting (like \`\`\`json), or explanations outside the JSON array.
Notes: ${JSON.stringify(notes)}`;

        const result = await model.generateContent(prompt);
        const textContent = result.response.text();

        let quiz;
        try {
            const cleanedText = textContent
                .replace(/^```json\s*/, '')
                .replace(/```\s*$/, '')
                .trim();
            quiz = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("Failed to parse JSON response for quiz from notes:", parseError);
            console.error("Raw response was:", textContent);
            return res.status(500).json({ error: "Failed to parse quiz from AI response", details: textContent });
        }

        // Basic validation
        if (!Array.isArray(quiz) || quiz.some(q => typeof q.question !== 'string' || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctOption !== 'string')) {
            console.error("Invalid quiz structure received:", quiz);
            return res.status(500).json({ error: "Received invalid quiz structure from AI", details: quiz });
        }

        res.status(200).json(quiz);

    } catch (error) {
        console.error("Error generating quiz from notes:", error);
        res.status(500).json({ error: "Failed to generate quiz from notes.", details: error.message });
    }
};

module.exports = {
    generateQuiz,
    generateQuizFromFlashcard,
    generateQuizFromNotes,
};
