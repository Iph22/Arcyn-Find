require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.models) {
            console.log("Available Gemini Models:");
            data.models.filter(m => m.name.includes('gemini')).forEach(model => {
                console.log(`- ${model.name}`);
            });
        } else {
            console.log("No models found or error in response:", data);
        }
    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

listModels();
