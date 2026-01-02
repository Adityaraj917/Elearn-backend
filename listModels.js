import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.log("No key");
        return;
    }

    let url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    let allModels = [];

    try {
        while (url) {
            const response = await fetch(url);
            const data = await response.json();
            if (data.models) allModels.push(...data.models);

            if (data.nextPageToken) {
                url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageToken=${data.nextPageToken}`;
            } else {
                url = null;
            }
        }
        console.log("Total models:", allModels.length);
        fs.writeFileSync('models.json', JSON.stringify({ models: allModels }, null, 2));
    } catch (err) {
        console.error("Error listing models:", err);
        fs.writeFileSync('models.json', JSON.stringify({ error: err.message }));
    }
}

listModels();
