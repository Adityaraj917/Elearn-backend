import dotenv from 'dotenv';
import fs from 'fs';
import { generateChatReply } from './services/aiService.js';

dotenv.config();

async function testChat() {
    console.log("Testing AI Chat (Hinglish)...");

    const text = "Artificial intelligence (AI) is intelligence demonstrated by machines. It is different from natural intelligence.";
    const question = "AI kya hota hai? Short mein batao."; // Hinglish question

    try {
        const result = await generateChatReply(text, question);
        console.log("Response received.");
        fs.writeFileSync('chat_test_result.txt', result.reply);
    } catch (error) {
        console.error("Error:", error);
    }
}

testChat();
