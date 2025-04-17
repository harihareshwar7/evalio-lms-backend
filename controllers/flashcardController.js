const { GoogleGenerativeAI } = require("@google/generative-ai");
// Added query, where, getDocs, updateDoc, arrayUnion
const { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, arrayUnion } = require('firebase/firestore');
// Import the initialized db instance from index.js
const { db } = require('../index'); // Adjust path if necessary

const dotenv = require('dotenv');
dotenv.config()

const apiKey = process.env.GEMINI_API_KEY || "YOUR_GOOGLE_API_KEY";

const generateFlashcards = async (req, res) => {
    const { topic, subject, numCards = 5 } = req.body; // Default to 5 cards if not specified

    if (!topic || !subject) {
        return res.status(400).json({ error: "Missing required fields: topic and subject" });
    }

    if (!apiKey || apiKey === "YOUR_GOOGLE_API_KEY") {
         console.error("Google API Key not configured.");
         return res.status(500).json({ error: "API key not configured on the server." });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const prompt = `Generate ${numCards} flashcards for studying ${topic} in ${subject}.
        Each flashcard should have a question on the front and the answer on the back.
        Format your response ONLY as a valid JSON array of objects, where each object has "front" and "back" string properties.
        Do NOT include any introductory text, markdown formatting (like \`\`\`json), or explanations outside the JSON array itself.
        Keep each card focused on a single concept. The front should be a question or key term, and the back should be the answer or definition.
        Example: [{"front": "What is photosynthesis?", "back": "The process by which plants use sunlight to synthesize foods from carbon dioxide and water."}]`;

        const result = await model.generateContent(prompt); // Pass prompt directly
        const textContent = result.response.text();

        console.log("API Response Text:", textContent); // Log the raw response for debugging

        // Attempt to parse the JSON response
        let flashcards;
        try {
            // Improved cleaning: remove fences and trim whitespace/newlines robustly
            const cleanedText = textContent
                .replace(/^```json\s*/, '') // Remove starting ```json and any following whitespace/newline
                .replace(/```\s*$/, '')     // Remove ending ``` and any preceding whitespace/newline
                .trim();                   // Trim final whitespace just in case
            flashcards = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("Failed to parse JSON response:", parseError);
            console.error("Raw response was:", textContent);
            // Send back the raw text content in the error details for easier debugging client-side
            return res.status(500).json({ error: "Failed to parse flashcards from AI response", details: textContent });
        }

        // Validate the structure (optional but recommended)
        if (!Array.isArray(flashcards) || flashcards.some(card => typeof card.front !== 'string' || typeof card.back !== 'string')) {
             console.error("Invalid flashcard structure received:", flashcards);
             return res.status(500).json({ error: "Received invalid flashcard structure from AI", details: flashcards });
        }

        res.status(200).json(flashcards);

    } catch (error) {
        console.error("Error generating flashcards:", error);
        res.status(500).json({ error: "Failed to generate flashcards", details: error.message });
    }
};

// --- Updated Function to Save Flashcards ---
const saveFlashcards = async (req, res) => {
    const { userEmail, username, topic, subject, flashcards } = req.body;

    // **SECURITY NOTE:** Still applies - userEmail/username should come from verified auth token.
    // Validate required fields for the set itself
    // Username is now also strictly required for the query
    if (!userEmail || !username || !topic || !subject || !Array.isArray(flashcards) || flashcards.length === 0) {
        return res.status(400).json({ error: "Missing required fields (userEmail, username, topic, subject, flashcards) or invalid flashcard data." });
    }

    // Validate flashcard structure within the array
    if (flashcards.some(card => typeof card.front !== 'string' || typeof card.back !== 'string')) {
        return res.status(400).json({ error: "Invalid flashcard structure in the array." });
    }

    try {
        // Define the collection reference
        const userFlashcardsCol = collection(db, "userFlashcards");

        // Query for existing user document by email AND username
        const q = query(userFlashcardsCol,
                        where("userEmail", "==", userEmail),
                        where("username", "==", username)); // Added username to query
        const querySnapshot = await getDocs(q);

        // Prepare the data for the individual flashcard set
        const newSetEntry = {
            topic,
            subject,
            setData: flashcards, // The array of {front, back} objects is nested here
            createdAt: serverTimestamp() // Timestamp for this specific set
        };

        if (querySnapshot.empty) {
            // --- No existing document found for this email/username combo, create a new one ---
            console.log(`No existing document for ${userEmail} / ${username}, creating new one.`);
            const newUserDocData = {
                userEmail,
                username, // Username is now required
                sets: [newSetEntry], // Initialize the sets array with the new structured entry
                createdAt: serverTimestamp() // Timestamp for user document creation
            };
            const docRef = await addDoc(userFlashcardsCol, newUserDocData);
            console.log("New user flashcard document created with ID: ", docRef.id);
            res.status(201).json({ message: "New user record created and flashcard set saved successfully!", id: docRef.id });

        } else {
            // --- Existing document found, update it ---
            // Assuming email + username combo is unique, take the first document
            const userDocRef = querySnapshot.docs[0].ref;
            console.log(`Existing document found for ${userEmail} / ${username} (ID: ${userDocRef.id}), updating.`);

            // Use arrayUnion to add the new structured set entry to the 'sets' array
            await updateDoc(userDocRef, {
                sets: arrayUnion(newSetEntry), // Add the structured entry
                lastUpdatedAt: serverTimestamp() // Timestamp for the update
                // No need to update username here as we queried by it
            });

            console.log("Flashcard set added to existing user document: ", userDocRef.id);
            res.status(200).json({ message: "Flashcard set added successfully to existing record!", id: userDocRef.id });
        }

    } catch (error) {
        console.error("Error saving/updating flashcard set in Firestore:", error);
        res.status(500).json({ error: "Failed to save or update flashcard set.", details: error.message });
    }
};

module.exports = {
    generateFlashcards,
    saveFlashcards,
};
