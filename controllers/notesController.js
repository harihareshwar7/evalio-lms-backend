const { GoogleGenerativeAI } = require("@google/generative-ai");
const PDFDocument = require('pdfkit');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, arrayUnion } = require('firebase/firestore');
const { db } = require('../firebase');
const pdfParse = require('pdf-parse');
const axios = require('axios');

// IMPORTANT: Store your API key securely (e.g., environment variables)
const apiKey = process.env.GEMINI_API_KEY || "YOUR_GOOGLE_API_KEY"; // Reuse API key logic
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../../firebase-service-account.json');

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
        - "content": The text content of the note (string). Provide detailed explanations (atleast for two or more pages if put in a A4 sheet  ) for concepts, examples, or code snippets, but only when necessary to clarify or expand on the topic.
        - "isCode": A boolean indicating if the content represents a code block.
        - "code": (Optional) If "isCode" is true, include the code snippet as a string here. If "isCode" is false, this field can be omitted or null. Ensure that code snippets are accompanied by explanations of what the code does, why it is written that way, and any relevant context.
        let there my more content and fewer code snippets,maintain as 70% content and 30% code for the topic related to coding,if the topic is not related to coding or programming do not give code at all. 100% text content
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

const generateNotesPDF = async (req, res) => {
    const notes = req.body.notes;
    const username = req.body.username || "user";
    const topic = req.body.topic || "Notes";

    if (!Array.isArray(notes) || notes.length === 0) {
        return res.status(400).json({ error: "Missing or invalid notes array." });
    }

    try {
        const doc = new PDFDocument({ margin: 40 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));

        // Title
        doc.fontSize(22).text(`Notes: ${topic}`, { align: 'center', underline: true });
        doc.moveDown();

        notes.forEach((note, idx) => {
            if (!note.isCode) {
                // Just content
                doc.font('Helvetica').fontSize(13).fillColor('black').text(note.content, { lineGap: 2 });
                doc.moveDown(0.7);
            } else {
                // Description (content)
                if (note.content) {
                    doc.font('Helvetica-Bold').fontSize(13).fillColor('black').text(note.content, { lineGap: 2 });
                    doc.moveDown(0.3);
                }
                // Code block
                if (note.code) {
                    // Draw a gray box for code
                    const code = note.code;
                    const codeWidth = doc.page.width - 2 * doc.options.margin;
                    const codeHeight = doc.heightOfString(code, { width: codeWidth, font: 'Courier', fontSize: 11 }) + 16;
                    const startX = doc.x - 5;
                    const startY = doc.y;
                    doc.save();
                    doc.roundedRect(startX, startY, codeWidth + 10, codeHeight, 6)
                        .fillAndStroke('#2d2d2d', '#888');
                    doc.restore();
                    doc.fillColor('#e6db74')
                        .font('Courier')
                        .fontSize(11)
                        .text(code, doc.x, doc.y + 8, {
                            width: codeWidth,
                            lineGap: 2,
                            continued: false
                        });
                    doc.moveDown(1.2);
                    doc.fillColor('black').font('Helvetica');
                }
                doc.moveDown(0.7);
            }
        });

        doc.end();

        doc.on('end', async () => {
            try {
                const pdfBuffer = Buffer.concat(buffers);
                const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

                const storage = new Storage({ keyFilename: serviceAccountPath });
                const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;
                const bucket = storage.bucket(bucketName);
                const fileName = `notes/${username}-${Date.now()}.pdf`;
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

const saveNotesPDFAndRecord = async (req, res) => {
    const userId = req.body.userId;
    const topic = req.body.topic || "Notes";
    const pdfUrl = req.body.pdfUrl;

    if (!userId || !topic || !pdfUrl) {
        return res.status(400).json({ error: "Missing userId, topic, or pdfUrl." });
    }

    try {
        const notesCol = collection(db, 'notes-saved');
        const q = query(notesCol, where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        const noteObj = {
            createdAt: new Date().toISOString(),
            pdfUrl,
            topic
        };
        if (querySnapshot.empty) {
            // Create new document
            const newDoc = {
                userId,
                notes: [noteObj],
                createdAt: serverTimestamp()
            };
            await addDoc(notesCol, newDoc);
        } else {
            // Update existing document
            const userDocRef = querySnapshot.docs[0].ref;
            await updateDoc(userDocRef, {
                notes: arrayUnion(noteObj),
                lastUpdatedAt: serverTimestamp()
            });
        }
        res.status(200).json({ message: 'Note PDF URL saved successfully.' });
    } catch (error) {
        console.error('Error saving to Firestore:', error);
        res.status(500).json({ error: 'Failed to save to database.' });
    }
};

const getNotesByUserId = async (req, res) => {
    const userId = req.body.userId;
    if (!userId) {
        return res.status(400).json({ error: 'Missing userId.' });
    }
    try {
        const notesCol = collection(db, 'notes-saved');
        const q = query(notesCol, where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return res.status(200).json({ notes: [] });
        } else {
            const docData = querySnapshot.docs[0].data();
            return res.status(200).json({ notes: docData.notes || [] });
        }
    } catch (error) {
        console.error('Error retrieving notes:', error);
        res.status(500).json({ error: 'Failed to retrieve notes.', details: error.message });
    }
};

const extractNotesJsonFromPDF = async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Missing PDF URL.' });
    }
    if (!apiKey || apiKey === "YOUR_GOOGLE_API_KEY") {
        console.error("Google API Key not configured.");
        return res.status(500).json({ error: "API key not configured on the server." });
    }
    try {
        // Download the PDF
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const pdfBuffer = Buffer.from(response.data, 'binary');
        // Extract text from PDF
        const data = await pdfParse(pdfBuffer);
        const text = data.text;

        // Use Gemini API to structure the notes
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const prompt = `Given the following text, structure it into a JSON array of notes, preserving ALL content exactly as it appears (do NOT summarize, rephrase, or generate new content).
For each note:
- "content": The exact text content of the note (string), as it appears in the input.
- "isCode": true if the content is a code block, otherwise false.
- "code": (Optional) If "isCode" is true, include the code snippet as a string here (identical to the code in the input). If "isCode" is false, omit or set this field to null.
Do NOT add, remove, or alter any information. Do NOT include any introductory text, markdown formatting, or explanations outside the JSON array itself.
Return ONLY the JSON array, in this format:
[
  { "content": "Some explanation.", "isCode": false },
  { "content": "print('hello')", "isCode": true, "code": "print('hello')" }
]
Text:
${text}`;

        const result = await model.generateContent(prompt);
        const textContent = result.response.text();

        console.log("AI Notes Response Text:", textContent); // Log raw response

        // Attempt to parse the JSON response
        let notes;
        try {
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

        // Basic validation
        if (!Array.isArray(notes) || notes.some(note => typeof note.content !== 'string' || typeof note.isCode !== 'boolean')) {
            console.error("Invalid note structure received:", notes);
            return res.status(500).json({ error: "Received invalid note structure from AI", details: notes });
        }

        res.status(200).json(notes);
    } catch (error) {
        console.error('Error extracting notes from PDF:', error);
        res.status(500).json({ error: 'Failed to extract notes from PDF.', details: error.message });
    }
};

module.exports = {
    generateNotes,
    generateNotesPDF,
    saveNotesPDFAndRecord,
    getNotesByUserId,
    extractNotesJsonFromPDF,
};
