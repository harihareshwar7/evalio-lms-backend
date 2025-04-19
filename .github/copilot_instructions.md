# GitHub Copilot Instructions for evalio-lms Backend

This document provides instructions and context for GitHub Copilot to assist effectively with the development of the evalio-lms backend.

## General Guidelines

*   **Language:** JavaScript (Node.js with Express)
*   **Database:** Firebase (Firestore, Authentication, Storage)
*   **Style:** Follow existing code style. Use semicolons. Prefer `const` over `let` where possible.
*   **Error Handling:** Implement basic error handling for routes and asynchronous operations.
*   **Comments:** Add comments to explain complex logic.

## Project Structure

*   `index.js`: Main application entry point, server setup, Firebase initialization, middleware, basic routes.
*   `routes/`: Directory for route handlers (to be created).
*   `controllers/`: Directory for business logic controllers (to be created).
*   `models/`: Directory for data models (if needed).
*   `middleware/`: Directory for custom middleware (e.g., authentication).

## Key Technologies

*   **Express.js:** Web framework for Node.js.
*   **Firebase SDK (v9+ modular):** Used for authentication, Firestore database, and potentially storage.
    *   `firebase/app`: `initializeApp`
    *   `firebase/auth`: `getAuth`, `createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, etc.
    *   `firebase/firestore`: `getFirestore`, `collection`, `doc`, `getDoc`, `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `query`, `where`, `getDocs`.
*   **Nodemon:** Used for development to automatically restart the server on file changes.

## Specific Instructions

*   When creating new routes, place them in the `routes/` directory and import them into `index.js`.
*   Separate business logic from route handlers by using controllers in the `controllers/` directory.
*   Use async/await for asynchronous operations, especially Firebase calls.
*   Validate request bodies for POST/PUT requests.
*   Ensure Firebase API keys and sensitive configuration are handled securely (e.g., environment variables), although they are currently hardcoded for initial setup.
