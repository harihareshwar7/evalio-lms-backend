const { GoogleGenerativeAI } = require("@google/generative-ai");

// IMPORTANT: Store your API key securely (e.g., environment variables)
const apiKey = process.env.GEMINI_API_KEY || "YOUR_GOOGLE_API_KEY"; // Reuse API key logic

const generateNotes = async (req, res) => {
    const { topic, noteLength = "medium", focus = "comprehensive" } = req.body; // Default values

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

        const prompt = `Generate approximately ${noteLength} notes on the topic "${topic}" with a focus on ${focus}.
        Format the response ONLY as a valid JSON array of objects. Each object should have:
        - "content": The text content of the note (string).
        - "isCode": A boolean indicating if the content represents a code block.
        - "code": (Optional) If "isCode" is true, include the code snippet as a string here. If "isCode" is false, this field can be omitted or null and only generate code that has some output show that it gives some output,dont just generate snippets without output .
        Do NOT include any introductory text, markdown formatting (like \`\`\`json), or explanations outside the JSON array itself.
        Ensure the 'content' for code blocks is just the code itself.
        Example:
        [
          { "content": "Introduction to JavaScript variables.", "isCode": false },
          { "content": "let message = 'Hello';", "isCode": true, "code": "let message = 'Hello';" },
          { "content": "Variables declared with 'let' can be reassigned.", "isCode": false }
        ]`;

        const result = await model.generateContent(prompt);
        const textContent = result.response.text();

        console.log("AI Notes Response Text:", textContent); // Log raw response

        // Attempt to parse the JSON response
        let notes;
        try {
            // Improved cleaning: remove fences and trim whitespace/newlines robustly
            const cleanedText = textContent
                .replace(/^```json\s*/, '') // Remove starting ```json and any following whitespace/newline
                .replace(/```\s*$/, '')     // Remove ending ``` and any preceding whitespace/newline
                .trim();                   // Trim final whitespace just in case
            notes = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("Failed to parse JSON response for notes:", parseError);
            console.error("Raw response was:", textContent);
            return res.status(500).json({ error: "Failed to parse notes from AI response", details: textContent });
        }

        // Basic validation (can be expanded)
        if (!Array.isArray(notes) || notes.some(note => typeof note.content !== 'string' || typeof note.isCode !== 'boolean')) {
             console.error("Invalid note structure received:", notes);
             return res.status(500).json({ error: "Received invalid note structure from AI", details: notes });
        }

        res.status(200).json(notes);

    } catch (error) {
        console.error("Error generating notes:", error);
        res.status(500).json({ error: "Failed to generate notes", details: error.message });
    }
};

module.exports = {
    generateNotes,
};
