const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function testQuota() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"];

    for (const modelName of models) {
        try {
            console.log(`Testing ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("ping");
            console.log(`${modelName} is available and working.`);
        } catch (e) {
            console.log(`${modelName} failed: ${e.message}`);
        }
    }
}

testQuota();
