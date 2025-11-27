import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const openaiKey = process.env.OPENAI_API_KEY;
const client = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;
const hasKey = !!openaiKey;

// Utility
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------- CHAT ----------------
export async function generateChatReply(text, message, forceMock = false) {
  return chatWithDoc(text, message, forceMock);
}

export async function chatWithDoc(text, message, forceMock = false) {
  const baseText = (text || '').slice(0, 8000) || 'Generic study document.';
  const userMsg = message || '';

  if (!hasKey || forceMock) {
    await sleep(700);
    const snippet = baseText.slice(0, 220);
    return { reply: `Mock AI: Based on the document, here is something: ${snippet}...` };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: `You are an educational AI. Use only the document context.` },
      { role: 'user', content: `Document:\n${baseText}` },
      { role: 'user', content: `Question: ${userMsg}` },
    ],
    temperature: 0.3,
  });

  const content = resp.choices?.[0]?.message?.content?.trim() || 'Could not reply.';
  return { reply: content };
}

// ---------------- SUMMARY ----------------
export async function summarize(text, options = {}, forceMock = false) {
  const { length = 'short', tone = 'student-friendly' } = options;

  if (!hasKey || forceMock) {
    await sleep(500);
    return {
      summaryShort: 'This is a short summary generated as fallback.',
      summaryLong: 'Fallback long summary.',
      keyPoints: ['A', 'B', 'C'],
    };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const resp = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },   // 🔥 FORCE JSON
    messages: [
      {
        role: 'system',
        content: `
You summarize notes. Output ONLY valid JSON:
{
  "summaryShort": "3-4 sentence summary",
  "summaryLong": "detailed summary",
  "keyPoints": ["point1","point2","point3"]
}
`
      },
      {
        role: 'user',
        content: `Summarize this text (tone=${tone}, length=${length}):\n${text.slice(0, 8000)}`
      }
    ],
    temperature: 0.3
  });

  const content = resp.choices?.[0]?.message?.content || '{}';
  return JSON.parse(content);
}

// ---------------- QUIZ ----------------
export async function generateQuiz(text, options = {}, forceMock = false) {
  const { numQuestions = 10, difficulty = 'medium' } = options;
  const n = Math.max(5, Math.min(20, Number(numQuestions) || 10));

  if (!hasKey || forceMock) {
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

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const resp = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },   // 🔥 FORCE JSON
    messages: [
      {
        role: 'system',
        content: `
Generate MCQ quizzes. Output ONLY valid JSON:
{
  "questions": [
    {
      "id": "q1",
      "question": "text",
      "options": ["A","B","C","D"],
      "correctIndex": 0,
      "explanation": "..."
    }
  ]
}
`
      },
      {
        role: 'user',
        content: `Create ${n} MCQs at difficulty=${difficulty}. Text:\n${text.slice(0, 8000)}`
      }
    ],
    temperature: 0.5
  });

  const content = resp.choices?.[0]?.message?.content || '{}';
  return JSON.parse(content);
}
