const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
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

module.exports = {
    generateQuiz,
};
