const { GoogleGenerativeAI } = require("@google/generative-ai");
// Added query, where, getDocs, updateDoc, arrayUnion
const { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, arrayUnion } = require('firebase/firestore');
// Import the initialized db instance from firebase.js (no longer from index.js)
const { db } = require('../firebase'); // Adjust path if necessary
const PDFDocument = require('pdfkit');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const pdfParse = require('pdf-parse');
const axios = require('axios');

const dotenv = require('dotenv');
dotenv.config()

const apiKey = process.env.GEMINI_API_KEY || "YOUR_GOOGLE_API_KEY";
const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

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


const generateFlashcardsPDF = async (req, res) => {
    const { flashcards, username, topic } = req.body;
    console.log(serviceAccountPath);
    if (!Array.isArray(flashcards) || flashcards.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty flashcards array.' });
    }
    try {
        const doc = new PDFDocument();
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.fontSize(20).text(`Flashcards: ${topic || ''}`, { align: 'center' });
        doc.moveDown();
        flashcards.forEach((card, idx) => {
            doc.fontSize(14).text(`Q${idx + 1}: ${card.front}`);
            doc.moveDown(0.5);
            doc.fontSize(12).text(`A: ${card.back}`);
            doc.moveDown();
        });
        doc.end();
        doc.on('end', async () => {
            try {
                const pdfBuffer = Buffer.concat(buffers);
                const storage = new Storage({ keyFilename: serviceAccountPath });
                const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;
                const bucket = storage.bucket(bucketName);
                const fileName = `flashcards/${username || 'user'}-${Date.now()}.pdf`;
                const file = bucket.file(fileName);
                await file.save(pdfBuffer, { contentType: 'application/pdf', public: true });
                await file.makePublic();
                const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
                res.status(200).json({ url: publicUrl });
            } catch (error) {
                console.error('Error uploading PDF:', error);
                res.status(500).json({ error: 'Failed to upload PDF.' });
            }
        });
        doc.on('error', (error) => {
            console.error('PDFKit error:', error);
            res.status(500).json({ error: 'Failed to generate PDF.' });
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF.' });
    }
};

// --- Reverse Engineer Flashcards from PDF URL ---
const reverseEngineerFlashcardsFromPDF = async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Missing PDF URL.' });
    }
    try {
        // Download the PDF
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const pdfBuffer = Buffer.from(response.data, 'binary');
        // Extract text from PDF
        const data = await pdfParse(pdfBuffer);
        const text = data.text;

        if (!apiKey || apiKey === "YOUR_GOOGLE_API_KEY") {
            console.error("Google API Key not configured.");
            return res.status(500).json({ error: "API key not configured on the server." });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const prompt = `Extract flashcards from the following text. Each flashcard should have a question on the front and the answer on the back.
        Format your response ONLY as a valid JSON array of objects, where each object has "front" and "back" string properties.
        Do NOT include any introductory text, markdown formatting (like \`\`\`json), or explanations outside the JSON array itself.
        Text: ${text}`;

        const result = await model.generateContent(prompt);
        const textContent = result.response.text();

        console.log("API Response Text:", textContent); // Log the raw response for debugging

        // Attempt to parse the JSON response
        let flashcards;
        try {
            const cleanedText = textContent
                .replace(/^```json\s*/, '') // Remove starting ```json and any following whitespace/newline
                .replace(/```\s*$/, '')     // Remove ending ``` and any preceding whitespace/newline
                .trim();                   // Trim final whitespace just in case
            flashcards = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("Failed to parse JSON response:", parseError);
            console.error("Raw response was:", textContent);
            return res.status(500).json({ error: "Failed to parse flashcards from AI response", details: textContent });
        }

        // Validate the structure (optional but recommended)
        if (!Array.isArray(flashcards) || flashcards.some(card => typeof card.front !== 'string' || typeof card.back !== 'string')) {
            console.error("Invalid flashcard structure received:", flashcards);
            return res.status(500).json({ error: "Received invalid flashcard structure from AI", details: flashcards });
        }

        res.status(200).json(flashcards);
    } catch (error) {
        console.error('Error extracting flashcards from PDF:', error);
        res.status(500).json({ error: 'Failed to extract flashcards from PDF.', details: error.message });
    }
};

// Save flashcard PDF URL for a user (single pdfurl per request)
const saveFlashcardPDFUrl = async (req, res) => {
    const { topic,subject,userid, pdfurl } = req.body;
    if (!userid || !pdfurl) {
        return res.status(400).json({ error: 'Missing userid or pdfurl.' });
    }
    const flashcardObj = {
        pdfurl,
        topic,
        subject,
        createdAt: new Date().toISOString(),
    };
    try {
        const userPDFCol = collection(db, 'flashcards');
        const q = query(userPDFCol, where('userid', '==', userid));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            // No document for this userid, create new
            const newDoc = {
                userid,
                flashcards: [flashcardObj],
                createdAt: serverTimestamp(),
            };
            const docRef = await addDoc(userPDFCol, newDoc);
            return res.status(201).json({ message: 'Created new user PDF record.', id: docRef.id });
        } else {
            // Document exists, append to flashcards array
            const userDocRef = querySnapshot.docs[0].ref;
            await updateDoc(userDocRef, {
                flashcards: arrayUnion(flashcardObj),
                lastUpdatedAt: serverTimestamp(),
            });
            return res.status(200).json({ message: 'Appended PDF URL to existing user record.', id: userDocRef.id });
        }
    } catch (error) {
        console.error('Error saving PDF URL:', error);
        res.status(500).json({ error: 'Failed to save PDF URL.', details: error.message });
    }
};

// Retrieve saved flashcard PDF URLs for a user by userid
const getFlashcardPDFUrlsByUser = async (req, res) => {
    const userid = req.query.userid || req.body.userid;
    if (!userid) {
        return res.status(400).json({ error: 'Missing userid.' });
    }
    try {
        const userPDFCol = collection(db, 'flashcards');
        const q = query(userPDFCol, where('userid', '==', userid));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return res.status(200).json({ flashcards: [] });
        } else {
            const docData = querySnapshot.docs[0].data();
            return res.status(200).json({ flashcards: docData.flashcards || [] });
        }
    } catch (error) {
        console.error('Error retrieving PDF URLs:', error);
        res.status(500).json({ error: 'Failed to retrieve PDF URLs.', details: error.message });
    }
};

module.exports = {
    generateFlashcards,
    generateFlashcardsPDF,
    reverseEngineerFlashcardsFromPDF,
    saveFlashcardPDFUrl,
    getFlashcardPDFUrlsByUser,
};
