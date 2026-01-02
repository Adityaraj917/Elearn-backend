import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const geminiKey = process.env.GEMINI_API_KEY;
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-flash-latest" }) : null;

// Utility
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Helper to clean JSON string from Markdown backticks
function cleanJsonString(str) {
  if (!str) return "{}";
  // Remove ```json ... ``` or just ``` ... ```
  return str.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
}

// ---------------- CHAT ----------------
export async function generateChatReply(text, message, forceMock = false) {
  return chatWithDoc(text, message, forceMock);
}

export async function chatWithDoc(text, message, forceMock = false) {
  const baseText = (text || '').slice(0, 8000) || 'Generic study document.';
  const userMsg = message || '';

  if (!model || forceMock) {
    await sleep(700);
    const snippet = baseText.slice(0, 220);
    return { reply: `Mock AI: Based on the document, here is something: ${snippet}...` };
  }

  try {
    const prompt = `
      You are an intelligent educational AI assistant named Saarthi. 
      Your goal is to help students understand the provided document.
      
      Instructions:
      1. Answer based ONLY on the provided document context.
      2. If the answer is not in the document, politely say so (in the user's language).
      3. **IMPORTANT**: Detect the language of the user's question (e.g., Hindi, Hinglish, Spanish, etc.) and reply in the SAME language and style.
      4. Be helpful, encouraging, and concise.
      
      Document Context:
      ${baseText}
      
      User Question: ${userMsg}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    return { reply: content };
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return { reply: "Sorry, I encountered an error processing your request." };
  }
}

// ---------------- SUMMARY ----------------
export async function summarize(text, options = {}, forceMock = false) {
  const { length = 'short', tone = 'student-friendly' } = options;

  if (!model || forceMock) {
    await sleep(500);
    return {
      summaryShort: 'This is a short summary generated as fallback.',
      summaryLong: 'Fallback long summary.',
      keyPoints: ['A', 'B', 'C'],
    };
  }

  try {
    const prompt = `
      You are an expert summarizer. 
      Summarize the following notes.
      Tone: ${tone}
      Length: ${length}
      
      Input Text:
      ${text.slice(0, 10000)}

      Output ONLY valid JSON in the following format:
      {
        "summaryShort": "3-4 sentence summary",
        "summaryLong": "detailed summary",
        "keyPoints": ["point1", "point2", "point3"]
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textOutput = response.text();
    const cleanJson = cleanJsonString(textOutput);

    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Gemini Summarize Error:", error);
    return {
      summaryShort: `Error generating summary: ${error.message}`,
      summaryLong: "Please try again later.",
      keyPoints: []
    };
  }
}

// ---------------- QUIZ ----------------
export async function generateQuiz(text, options = {}, forceMock = false) {
  const { numQuestions = 10, difficulty = 'medium' } = options;
  const n = Math.max(5, Math.min(20, Number(numQuestions) || 10));

  if (!model || forceMock) {
    await sleep(500);
    return {
      questions: Array.from({ length: n }, (_, i) => ({
        id: `q${i + 1}`,
        question: `Fallback question ${i + 1}`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctIndex: 0,
        explanation: "Fallback explanation."
      }))
    };
  }

  try {
    const prompt = `
      Generate a multiple choice quiz based on the provided text.
      Number of questions: ${n}
      Difficulty: ${difficulty}
      
      Input Text:
      ${text.slice(0, 10000)}

      Output ONLY valid JSON in the following format:
      {
        "questions": [
          {
            "id": "q1",
            "question": "Question text here",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctIndex": 0, (index of correct option, 0-3)
            "explanation": "Brief explanation of why this answer is correct"
          }
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textOutput = response.text();
    const cleanJson = cleanJsonString(textOutput);

    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Gemini Quiz Error:", error);
    return { questions: [] };
  }
}
