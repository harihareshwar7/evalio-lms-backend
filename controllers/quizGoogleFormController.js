const axios = require("axios");
const { db } = require("../firebase");
const { addDoc, collection, serverTimestamp, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion } = require("firebase/firestore");
const GOOGLE_FORM_SCRIPT_URL_FORM = "https://script.google.com/macros/s/AKfycbxBvUD0H-NamZhHpKNdJdvpS4RAuuM6gZAPC1mFfvna-9PQqC68xbJGvJl8pLt5CTz3Tg/exec";

const GOOGLE_FORM_SCRIPT_URL_SHEET = "https://script.google.com/macros/s/AKfycbzYutVkcOOluHhLSn2iruRPtXtXr0r_rEpgOEBFw9kJPzMVC70KLcDZiZxBbSfaXRJb_w/exec";
const PDFDocument = require("pdfkit");
const { Storage } = require("@google-cloud/storage");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const createGoogleForm = async (req, res) => {
    const quizData = req.body;
    if (!quizData || !quizData.quizTitle || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
        return res.status(400).json({ error: "Invalid quiz data. 'quizTitle' and 'questions' are required." });
    }
    try {
        const response = await axios.post(GOOGLE_FORM_SCRIPT_URL_FORM, quizData, {
            headers: { "Content-Type": "application/json" }
        });
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Error creating Google Form:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to create Google Form.", details: error.response?.data || error.message });
    }
};

const getGoogleFormResponses = async (req, res) => {
    const { email, sheetId } = req.body;
    if (!email || !sheetId) {
        return res.status(400).json({ error: "Missing required fields: email and sheetId." });
    }
    try {
        const response = await axios.post(
            GOOGLE_FORM_SCRIPT_URL_SHEET,
            { email, sheetId,},
            { headers: { "Content-Type": "application/json" } }
        );
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Error retrieving Google Form responses:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to retrieve Google Form responses.", details: error.response?.data || error.message });
    }
};


const saveGoogleFormDetails = async (req, res) => {
    const { uid, formUrl, spreadsheetUrl, formId, spreadsheetId, email, quizTitle } = req.body;
    if (!uid || !formUrl || !spreadsheetUrl || !formId || !spreadsheetId || !email || !quizTitle) {
        return res.status(400).json({ error: "Missing required fields." });
    }
    try {
        const docRef = await addDoc(collection(db, "quiz-google-forms"), {
            uid,
            formUrl,
            spreadsheetUrl,
            formId,
            spreadsheetId,
            email,
            quizTitle,
            createdAt: serverTimestamp()
        });
        res.status(200).json({ message: "Google Form details saved.", id: docRef.id });
    } catch (error) {
        console.error("Error saving Google Form details:", error);
        res.status(500).json({ error: "Failed to save Google Form details." });
    }
};

const getAllGoogleFormDetails = async (req, res) => {
    try {
        const snapshot = await getDocs(collection(db, "quiz-google-forms"));
        const forms = [];
        snapshot.forEach(doc => {
            forms.push({ id: doc.id, ...doc.data() });
        });
        res.status(200).json(forms);
    } catch (error) {
        console.error("Error fetching Google Form details:", error);
        res.status(500).json({ error: "Failed to fetch Google Form details." });
    }
};

const generateQuizPdf = async (req, res) => {
    const {  email,questionAnswers, quizTitle } = req.body;
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "../firebase-service-account.json");
    if ( !Array.isArray(questionAnswers) || !quizTitle) {
        return res.status(400).json({ error: "Missing required fields: uid, questionAnswers, email, quizTitle." });
    }
    try {
        const doc = new PDFDocument();
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.fontSize(20).text(`Quiz: ${quizTitle}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text(`User: ${email}`);
        doc.moveDown();
        questionAnswers.forEach((qa, idx) => {
            doc.fontSize(14).text(`Q${idx + 1}: ${qa.question}`);
            doc.moveDown(0.5);
            if (Array.isArray(qa.options)) {
                const optionLabels = ['a)', 'b)', 'c)', 'd)', 'e)', 'f)', 'g)', 'h)'];
                qa.options.forEach((opt, optIdx) => {
                    const label = optionLabels[optIdx] || `${String.fromCharCode(97 + optIdx)})`;
                    if (opt === qa.correctOption) {
                        doc.font('Helvetica-Bold').fillColor('green').fontSize(12).text(`${label} ${opt}`, { indent: 20 });
                        doc.font('Helvetica').fillColor('black');
                    } else {
                        doc.fontSize(12).text(`${label} ${opt}`, { indent: 20 });
                    }
                });
            }
            doc.moveDown(0.5);
            doc.fontSize(12).fillColor('green').text(`Correct Answer: ${qa.correctOption}`, { indent: 20 });
            doc.fillColor('black');
            doc.moveDown();
        });
        doc.end();
        doc.on('end', async () => {
            try {
                // Fix for OpenSSL 3+ error: set legacy provider if needed
                // This is a runtime workaround for Node.js/OpenSSL incompatibility with some Google libraries
                if (process.env.NODE_OPTIONS === undefined) {
                    process.env.NODE_OPTIONS = "--openssl-legacy-provider";
                }
                const pdfBuffer = Buffer.concat(buffers);
                const storage = new Storage({ keyFilename: serviceAccountPath });
                const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;
                const bucket = storage.bucket(bucketName);
                const fileName = `quiz-pdfs/${'user'}-${Date.now()}.pdf`;
                const file = bucket.file(fileName);
                await file.save(pdfBuffer, { contentType: 'application/pdf', public: true });
                await file.makePublic();
                const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
                res.status(200).json({ url: publicUrl });
            } catch (error) {
                // Add more helpful error message for OpenSSL issues
                if (
                    error.code === 'ERR_OSSL_UNSUPPORTED' ||
                    (error.opensslErrorStack && error.opensslErrorStack.some(e => e.includes('DECODER routines')))
                ) {
                    console.error('OpenSSL legacy provider may be required. Try running your app with:');
                    console.error('node --openssl-legacy-provider your-app.js');
                    res.status(500).json({
                        error: 'Failed to upload PDF due to OpenSSL/crypto incompatibility. Try running Node.js with --openssl-legacy-provider.'
                    });
                } else {
                    console.error('Error uploading PDF:', error);
                    res.status(500).json({ error: 'Failed to upload PDF.' });
                }
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

const saveQuizPdfUrl = async (req, res) => {
    const { uid, pdfurl, quizTitle } = req.body;
    if (!uid || !pdfurl || !quizTitle) {
        return res.status(400).json({ error: "Missing required fields: uid, pdfurl, quizTitle." });
    }
    try {
        const userDocRef = doc(db, "quiz-pdf-urls", uid);
        const userDocSnap = await getDoc(userDocRef);
        const quizObj = {
            pdfurl,
            quizTitle,
            createdAt: new Date().toISOString()
        };
        if (userDocSnap.exists()) {
            await updateDoc(userDocRef, {
                "saved-quizes": arrayUnion(quizObj)
            });
        } else {
            await setDoc(userDocRef, {
                uid,
                "saved-quizes": [quizObj]
            });
        }
        res.status(200).json({ message: "PDF URL saved successfully." });
    } catch (error) {
        console.error("Error saving PDF URL:", error);
        res.status(500).json({ error: "Failed to save PDF URL." });
    }
};

const getUserQuizPdfs = async (req, res) => {
    const { uid } = req.body;
    if (!uid) {
        return res.status(400).json({ error: "Missing required field: uid." });
    }
    try {
        const userDocRef = doc(db, "quiz-pdf-urls", uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
            return res.status(200).json({ "saved-quizes":[] });
        }
        const data = userDocSnap.data();
        res.status(200).json({ "saved-quizes": data["saved-quizes"] || [] });
    } catch (error) {
        console.error("Error fetching user PDF URLs:", error);
        res.status(500).json({ error: "Failed to fetch user PDF URLs." });
    }
};

const reviewQuiz = async (req, res) => {
    const { email, timestamp, questions, score } = req.body;
    if (!email || !timestamp || !Array.isArray(questions) || !score) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    // Compose a prompt for Gemini
    let prompt = `A user has completed a quiz. Here are the details:\n\n`;
    prompt += `User Email: ${email}\nTimestamp: ${timestamp}\n\n`;
    prompt += `Questions and Answers:\n`;
    questions.forEach(q => {
        prompt += `Q${q.questionNumber}: ${q.question}\n`;
        prompt += `Correct Answer: ${q.correctAnswer}\n`;
        prompt += `User Answer: ${q.userAnswer}\n`;
        prompt += `Is Correct: ${q.isCorrect ? "Yes" : "No"}\n\n`;
    });
    prompt += `Score: ${score.correct} out of ${score.total} (${score.percentage}%)\n\n`;
    prompt += `Please provide a detailed review of the user's performance including:\n`;
    prompt += `- Insights on strengths and weaknesses\n`;
    prompt += `- Pros (what the user did well)\n`;
    prompt += `- Cons (areas for improvement)\n`;
    prompt += `- Focus areas for further study\n`;
    prompt += `- For each incorrect answer, provide the correct answer and a brief explanation\n`;
    prompt += `- A summary paragraph\n`;
    prompt += `- A simple text-based graph showing performance (e.g., bar or pie chart in ASCII)\n`;

    // Add instruction for JSON formatting
    prompt += `\n\nFormat your response as a JSON object with the following keys: "summary", "pros", "cons", "focusAreas", "incorrectDetails" (array of objects with questionNumber, question, correctAnswer, userAnswer, explanation), and "graph". Do not include any text outside the JSON object.`;

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Try to parse the response as JSON, fallback to raw text if parsing fails
        let geminiInsights;
        try {
            geminiInsights = JSON.parse(text);
        } catch (e) {
            geminiInsights = { raw: text };
        }

        res.status(200).json({
            email,
            timestamp,
            score,
            geminiInsights
        });
    } catch (error) {
        console.error("Error generating Gemini review:", error);
        res.status(500).json({ error: "Failed to generate Gemini review." });
    }
};

module.exports = {
    createGoogleForm,
    getGoogleFormResponses,
    saveGoogleFormDetails,
    getAllGoogleFormDetails,
    generateQuizPdf,
    saveQuizPdfUrl,
    getUserQuizPdfs,
    reviewQuiz
};
