const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        // The SDK doesn't have a direct listModels but we can use the fetch API or just try common names
        console.log("Checking for available models...");

        // Attempting to use a known working model to verify key
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("gemini-1.5-flash is available.");

        // Testing gemini-2.0-flash-exp (very likely to exist)
        try {
            const model2 = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
            await model2.generateContent("Hello");
            console.log("gemini-2.0-flash-exp is available.");
        } catch (e) {
            console.log("gemini-2.0-flash-exp is NOT available.");
        }

        // Testing gemini-2.0-flash
        try {
            const model2 = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            await model2.generateContent("Hello");
            console.log("gemini-2.0-flash is available.");
        } catch (e) {
            console.log("gemini-2.0-flash is NOT available.");
        }

        // Testing gemini-3-pro-preview (from the search)
        try {
            const model3 = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });
            await model3.generateContent("Hello");
            console.log("gemini-3-pro-preview is available.");
        } catch (e) {
            console.log("gemini-3-pro-preview is NOT available.");
        }

    } catch (error) {
        console.error("General Error:", error.message);
    }
}

listModels();
