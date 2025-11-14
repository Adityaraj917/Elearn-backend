import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const hasKey = !!process.env.OPENAI_API_KEY;
let client = null;
if (hasKey) {
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateChatReply(text, message, forceMock = false) {
  return chatWithDoc(text, message, forceMock);
}

export async function chatWithDoc(text, message, forceMock = false) {
  const baseText = (text || '').slice(0, 8000) || 'Generic study document.';
  const userMsg = message || '';

  if (!hasKey || forceMock) {
    await sleep(700);
    const snippet = baseText.slice(0, 220);
    return { reply: `Mock AI: Based on the document, here's a helpful pointer related to your question "${userMsg}": ${snippet}...` };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const sys = `You are an educational AI assistant. Use ONLY the provided document context to answer. If unsure, say you are unsure. Reply concisely.`;
  const ctx = `Document context (truncated):\n${baseText}`;

  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: ctx },
      { role: 'user', content: `Question: ${userMsg}` },
    ],
    temperature: 0.3,
  });
  const content = resp.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a response.';
  return { reply: content };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function summarize(text, options = {}, forceMock = false) {
  const { length = 'short', tone = 'student-friendly' } = options;
  if (!hasKey || forceMock) {
    await sleep(800);
    const base = (text || '').slice(0, 600) || 'This document contains educational content.';
    return {
      summaryShort: `${base.slice(0, 180)}...`,
      summaryLong: `${base}\n\nThis extended summary elaborates on key themes, definitions, and relationships to support deeper understanding and revision. It is intentionally ${tone} and ${length === 'detailed' ? 'comprehensive' : 'concise'}.`,
      keyPoints: [
        'Identifies the main thesis and supporting evidence.',
        'Clarifies essential definitions and terminology.',
        'Highlights relationships and cause-effect chains.',
      ],
    };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const sys = `You are an assistant that summarizes study notes for students. Output strictly in JSON with fields: summaryShort (3-4 sentences), summaryLong (multi-paragraph), keyPoints (3-6 items array).`;
  const prompt = `Summarize the following text. Options: length=${length}, tone=${tone}. Text:\n\n${text.slice(0, 8000)}`;

  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  });
  const content = resp.choices?.[0]?.message?.content || '{}';
  try {
    const parsed = JSON.parse(content);
    if (!parsed.summaryShort || !parsed.summaryLong || !Array.isArray(parsed.keyPoints)) throw new Error('Bad schema');
    return parsed;
  } catch (e) {
    // Fallback mock if parsing fails
    return {
      summaryShort: 'This is a short summary generated as a fallback.',
      summaryLong: 'This is a detailed summary generated as a fallback due to parsing issues.',
      keyPoints: ['Key point 1', 'Key point 2', 'Key point 3'],
    };
  }
}

export async function generateQuiz(text, options = {}, forceMock = false) {
  const { numQuestions = 10, difficulty = 'medium' } = options;
  const n = Math.max(5, Math.min(20, Number(numQuestions) || 10));

  if (!hasKey || forceMock) {
    await sleep(800);
    const baseSentences = (text || '')
      .replace(/\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean);
    const verbs = {
      easy: ['identify', 'recall', 'define'],
      medium: ['interpret', 'analyze', 'compare'],
      hard: ['evaluate', 'synthesize', 'critique'],
    }[difficulty] || ['understand'];

    const questions = Array.from({ length: n }, (_, i) => {
      const sentence = baseSentences[i % Math.max(1, baseSentences.length)] || 'This section discusses a core concept relevant to the topic.';
      const q = `Q${i + 1}: ${verbs[i % verbs.length]} the idea: ${sentence.slice(0, 80)}?`;
      const correctIndex = i % 4;
      const options = ['Option A', 'Option B', 'Option C', 'Option D'];
      return {
        id: `q${i + 1}`,
        question: q,
        options,
        correctIndex,
        explanation: 'Because this aligns best with the statement in the text.',
      };
    });
    return { questions };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const sys = `You generate multiple-choice quizzes. Output strictly JSON: {"questions":[{"id":"q1","question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}, ...]}`;
  const prompt = `Create ${n} MCQs from the provided text at difficulty=${difficulty}. Ensure 4 options each, one correct answer, and a brief explanation. Text:\n\n${text.slice(0, 8000)}`;

  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
  });
  const content = resp.choices?.[0]?.message?.content || '{}';
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.questions)) throw new Error('Bad schema');
    return parsed;
  } catch (e) {
    // Fallback simple mock
    const questions = Array.from({ length: n }, (_, i) => ({
      id: `q${i + 1}`,
      question: `Fallback question ${i + 1}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 0,
      explanation: 'Fallback explanation.',
    }));
    return { questions };
  }
}
