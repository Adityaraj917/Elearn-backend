import dotenv from 'dotenv';
import fs from 'fs';
import { summarize } from './services/aiService.js';

dotenv.config();

async function test() {
    console.log("Testing Gemini Summarization...");
    const key = process.env.GEMINI_API_KEY;
    console.log("Key loaded:", key ? (key.substring(0, 5) + "...") : "NO");

    if (!key) {
        console.error("❌ GEMINI_API_KEY is missing in .env");
        process.exit(1);
    }

    const text = "Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to the natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.";

    try {
        const result = await summarize(text, { length: 'short' });
        console.log("✅ Result received");
        fs.writeFileSync('test_result.json', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("❌ Test Script Error:", error);
        fs.writeFileSync('test_result.json', JSON.stringify({ error: error.message }));
    }
}

test();
