import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildAgentPrompt } from './agentOrchestrator.js';

dotenv.config();

const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : undefined;
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

// ══════════════════════════════════════════════════════
// MODEL FALLBACK CHAIN — each model has separate quota
// ══════════════════════════════════════════════════════
const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
  'gemini-flash-latest'
];

function getModel(name) {
  if (!genAI) return null;
  try { return genAI.getGenerativeModel({ model: name }); }
  catch { return null; }
}

// ══════════════════════════════════════════════════════
// RESPONSE CACHE — avoid repeated identical calls
// ══════════════════════════════════════════════════════
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = responseCache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
  if (entry) responseCache.delete(key);
  return null;
}
function setCache(key, data) {
  responseCache.set(key, { data, time: Date.now() });
  // Prune old entries
  if (responseCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of responseCache) {
      if (now - v.time > CACHE_TTL) responseCache.delete(k);
    }
  }
}

// ══════════════════════════════════════════════════════
// REQUEST QUEUE — serialize API calls to prevent bursts
// ══════════════════════════════════════════════════════
class RequestQueue {
  constructor() { this.queue = []; this.running = false; this.lastCall = 0; }
  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      if (!this.running) this._run();
    });
  }
  async _run() {
    this.running = true;
    while (this.queue.length) {
      const { fn, resolve, reject } = this.queue.shift();
      const wait = 1200 - (Date.now() - this.lastCall);
      if (wait > 0) await sleep(wait);
      try { resolve(await fn()); }
      catch (e) { reject(e); }
      this.lastCall = Date.now();
    }
    this.running = false;
  }
}
const queue = new RequestQueue();

// ══════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanJsonString(str) {
  if (!str) return "{}";
  let c = str.trim();
  c = c.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '');
  const fb = c.indexOf('{'), bb = c.indexOf('[');
  let s = fb === -1 ? bb : bb === -1 ? fb : Math.min(fb, bb);
  if (s > 0) c = c.slice(s);
  const lb = c.lastIndexOf('}'), rb = c.lastIndexOf(']');
  const e = Math.max(lb, rb);
  if (e > 0 && e < c.length - 1) c = c.slice(0, e + 1);
  c = c.replace(/,\s*([}\]])/g, '$1');
  return c.trim();
}

function safeJsonParse(text, fallback = {}) {
  if (!text) return fallback;
  try { return JSON.parse(cleanJsonString(text)); }
  catch {
    try { return JSON.parse(cleanJsonString(text).replace(/'/g, '"')); }
    catch { return fallback; }
  }
}

// ══════════════════════════════════════════════════════
// CORE: Call Gemini with model fallback chain
// ══════════════════════════════════════════════════════
async function callGeminiRaw(prompt) {
  if (!genAI) return null;
  let lastError = null;

  for (const modelName of MODEL_CHAIN) {
    const m = getModel(modelName);
    if (!m) continue;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`[Gemini] Trying ${modelName} (attempt ${attempt + 1})...`);
        const result = await m.generateContent(prompt);
        const text = result.response.text();
        console.log(`[Gemini] ✅ ${modelName} success (${text?.length || 0} chars)`);
        return text;
      } catch (error) {
        lastError = error;
        const msg = error.message || '';
        const isQuota = error.status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
        console.warn(`[Gemini] ❌ ${modelName} attempt ${attempt + 1}: ${isQuota ? 'QUOTA' : 'ERROR'} - ${msg.slice(0, 100)}`);

        if (isQuota) {
          if (attempt === 0) await sleep(3000); // brief wait then retry same model
          else break; // move to next model in chain
        } else {
          if (attempt === 0) await sleep(1000);
          else break;
        }
      }
    }
    console.log(`[Gemini] Moving to next model in fallback chain...`);
  }

  console.error('[Gemini] All models exhausted. Last error:', lastError?.message);
  throw new Error(`Gemini API Error: ${lastError?.message || 'All models failed'}`);
}

/** Queued + cached call */
async function callGemini(prompt, cacheKey) {
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached) { console.log('[Gemini] Cache hit'); return cached; }
  }
  const result = await queue.add(() => callGeminiRaw(prompt));
  if (result && cacheKey) setCache(cacheKey, result);
  return result;
}

// ══════════════════════════════════════════════════════
// QUIZ
// ══════════════════════════════════════════════════════
function sanitizeQuestion(q, index) {
  if (!q || typeof q !== 'object') return null;
  const question = q.question || q.text || q.q;
  if (!question || typeof question !== 'string') return null;
  let options = q.options || q.choices || [];
  if (!Array.isArray(options) || options.length < 2) return null;
  while (options.length < 4) options.push(`Option ${String.fromCharCode(65 + options.length)}`);
  if (options.length > 4) options = options.slice(0, 4);
  options = options.map(o => String(o));
  let ci = q.correctIndex ?? q.correct ?? q.answer ?? 0;
  if (typeof ci === 'string') ci = { a: 0, b: 1, c: 2, d: 3 }[ci.toLowerCase()] ?? 0;
  ci = Math.max(0, Math.min(3, Number(ci) || 0));
  return { id: q.id || `q${index + 1}`, question: String(question), options, correctIndex: ci, explanation: q.explanation || 'Review the document for this concept.' };
}

function sanitizeQuizResponse(parsed) {
  let qs = parsed?.questions || parsed?.quiz || [];
  if (!Array.isArray(qs)) { if (Array.isArray(parsed)) qs = parsed; else return null; }
  const s = qs.map((q, i) => sanitizeQuestion(q, i)).filter(Boolean);
  return s.length > 0 ? { questions: s } : null;
}

export async function generateQuiz(text, options = {}) {
  const { numQuestions = 10, difficulty = 'medium' } = options;
  const n = Math.max(3, Math.min(20, Number(numQuestions) || 10));

  if (!genAI) {
    return { questions: [{ id: 'q1', question: 'API key missing', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'Set GEMINI_API_KEY' }] };
  }

  const clean = (text || '').replace(/\s+/g, ' ').trim();
  const src = clean.length > 200 ? clean.slice(0, 10000) : `Short text — generate questions from: ${clean}`;
  const ck = `quiz_${n}_${difficulty}_${src.slice(0, 100)}`;

  const prompt = `Generate ${n} MCQs (difficulty: ${difficulty}) from this text. Output ONLY valid JSON.
{"questions":[{"id":"q1","question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]}
Rules: correctIndex 0-3, exactly 4 options, test understanding.
Text: ${src}`;

  const out = await callGemini(prompt, ck);
  if (out) {
    const v = sanitizeQuizResponse(safeJsonParse(out, null));
    if (v?.questions?.length > 0) return v;
  }

  // Retry simpler
  const out2 = await callGemini(`Create ${Math.min(n, 5)} MCQs. JSON only: {"questions":[{"id":"q1","question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]}\nText: ${clean.slice(0, 4000)}`);
  if (out2) {
    const v2 = sanitizeQuizResponse(safeJsonParse(out2, null));
    if (v2?.questions?.length > 0) return v2;
  }

  return { questions: [{ id: 'q1', question: 'AI temporarily unavailable. Please try again in a minute.', options: ['Retry', '-', '-', '-'], correctIndex: 0, explanation: 'The AI quota may be exhausted. Wait a moment and retry.' }] };
}

// ══════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════
export async function generateChatReply(text, message, forceMock = false, studentMemory = '') {
  return chatWithDoc(text, message, forceMock, studentMemory);
}

export async function chatWithDoc(text, message, forceMock = false, studentMemory = '') {
  if (!genAI) return { reply: 'AI unavailable — check GEMINI_API_KEY.' };
  const prompt = buildAgentPrompt('tutor', message || '', {
    documentContext: (text || '').slice(0, 8000) || 'General study document.',
    studentMemory: studentMemory || undefined,
  });
  const out = await callGemini(prompt);
  return { reply: out || "I'm temporarily unable to respond. Please try again in a moment." };
}

// ══════════════════════════════════════════════════════
// AGENT
// ══════════════════════════════════════════════════════
export async function callAgent(agentType, userInput, options = {}) {
  if (!genAI) return { reply: 'AI unavailable — check GEMINI_API_KEY.' };
  const prompt = buildAgentPrompt(agentType, userInput, options);
  const out = await callGemini(prompt);
  if (!out) return { reply: 'AI temporarily unavailable. Please try again.' };
  if (agentType === 'insight') {
    const p = safeJsonParse(out, null);
    if (p) return { reply: out, data: p };
  }
  return { reply: out };
}

// ══════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════
export async function summarize(text, options = {}) {
  if (!genAI) return { summaryShort: 'AI unavailable.', summaryLong: '', keyPoints: [] };
  const { length = 'short', tone = 'student-friendly' } = options;
  const ck = `sum_${(text || '').slice(0, 80)}_${length}`;

  const prompt = `Summarize these notes (tone: ${tone}, length: ${length}). Output ONLY valid JSON:
{"summaryShort":"3-4 sentences","summaryLong":"detailed summary","keyPoints":["p1","p2","p3","p4","p5"]}
Text: ${(text || '').slice(0, 10000)}`;

  const out = await callGemini(prompt, ck);
  if (!out) return { summaryShort: 'AI temporarily unavailable. Please retry.', summaryLong: 'Click Regenerate to try again.', keyPoints: ['Service will be back shortly'] };
  return safeJsonParse(out, { summaryShort: 'Could not parse summary.', summaryLong: '', keyPoints: [] });
}

// ══════════════════════════════════════════════════════
// ONBOARDING — ADAPTIVE QUESTION
// ══════════════════════════════════════════════════════
export async function generateAdaptiveQuestion(previousAnswers, questionNumber, topicsCovered = []) {
  const fallback = { question: "What kind of challenges excite you most?", options: ["Logical puzzles", "Creative projects", "Physical challenges", "Helping others"], id: `adaptive_${questionNumber}`, insight: "Reveals problem-solving preference" };
  if (!genAI) return fallback;

  const prompt = `You are an educational psychologist. Create ONE personalized question for a Class ${previousAnswers.class || 'unknown'} student who likes ${previousAnswers.favorite_subject || 'unknown'}.
Already covered topics: ${topicsCovered.join(', ')}. Ask about: problem-solving, teamwork, reaction to failure, or creativity.
Output ONLY JSON: {"question":"...","options":["A","B","C","D"],"id":"adaptive_${questionNumber}","insight":"what this reveals"}`;

  const out = await callGemini(prompt);
  if (!out) return fallback;
  return safeJsonParse(out, fallback);
}

// ══════════════════════════════════════════════════════
// PROFILE ANALYSIS
// ══════════════════════════════════════════════════════
export async function analyzeStudentProfile(allAnswers) {
  const fallback = { summary: "An enthusiastic learner with diverse interests.", strengths: ["Curiosity", "Dedication"], areasToExplore: ["Science", "Mathematics"], learningStyle: "Mixed", careerHints: ["Engineering", "Science", "Teaching"], personalityType: "Explorer" };
  if (!genAI) return fallback;

  const prompt = `Analyze this student's onboarding responses and create a profile. Output ONLY JSON:
{"summary":"2-3 sentences","strengths":["s1","s2","s3"],"areasToExplore":["a1","a2"],"learningStyle":"desc","careerHints":["c1","c2","c3"],"personalityType":"Analytical|Creative|Leader|Helper|Explorer|Builder"}
Responses: ${JSON.stringify(allAnswers)}`;

  const out = await callGemini(prompt, `profile_${JSON.stringify(allAnswers).slice(0, 60)}`);
  if (!out) return fallback;
  return safeJsonParse(out, fallback);
}

// ══════════════════════════════════════════════════════
// SKILL TEST
// ══════════════════════════════════════════════════════
export async function generateSkillTest(studentClass, subject, difficulty, pastPerformance) {
  const fallbackTest = {
    testTitle: `${subject} Skill Assessment`,
    questions: Array.from({ length: 10 }, (_, i) => ({
      id: `st_q${i + 1}`, question: `Sample ${subject} question ${i + 1}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: Math.floor(Math.random() * 4), topic: subject,
      difficulty, explanation: `Tests ${subject} concept ${i + 1}.`
    }))
  };
  if (!genAI) return fallbackTest;

  const weak = pastPerformance?.weakTopics || [];
  const ck = `test_${studentClass}_${subject}_${difficulty}`;

  const prompt = `Create 10 MCQs for Class ${studentClass} ${subject} (${difficulty}, CBSE/NCERT).${weak.length ? ` Weak areas: ${weak.join(', ')}.` : ''}
Output ONLY JSON: {"testTitle":"${subject} Assessment","questions":[{"id":"st_q1","question":"...","options":["A","B","C","D"],"correctIndex":0,"topic":"Topic","difficulty":"${difficulty}","explanation":"..."}]}`;

  const out = await callGemini(prompt, ck);
  if (!out) return fallbackTest;
  const p = safeJsonParse(out, null);
  if (p?.questions?.length > 0) {
    const san = p.questions.map((q, i) => {
      const s = sanitizeQuestion(q, i);
      return s ? { ...s, topic: q.topic || subject, difficulty: q.difficulty || difficulty } : null;
    }).filter(Boolean);
    if (san.length > 0) return { testTitle: p.testTitle || `${subject} Assessment`, questions: san };
  }
  return fallbackTest;
}

// ══════════════════════════════════════════════════════
// SKILL TEST EVALUATION
// ══════════════════════════════════════════════════════
export async function evaluateSkillTest(questions, answers, studentProfile) {
  let score = 0;
  const topicResults = {};
  questions.forEach((q) => {
    const ok = answers[q.id] === q.correctIndex;
    if (ok) score++;
    if (!topicResults[q.topic]) topicResults[q.topic] = { correct: 0, total: 0 };
    topicResults[q.topic].total++;
    if (ok) topicResults[q.topic].correct++;
  });
  const pct = Math.round((score / questions.length) * 100);
  const basic = {
    score, total: questions.length, percentage: pct,
    strengths: Object.entries(topicResults).filter(([, v]) => v.correct === v.total).map(([k]) => k).slice(0, 3),
    weaknesses: Object.entries(topicResults).filter(([, v]) => v.correct < v.total).map(([k]) => k).slice(0, 3),
    topicBreakdown: topicResults,
    recommendations: ['Review weak topics', 'Practice more problems', 'Focus on concepts'],
    overallAssessment: `You scored ${score}/${questions.length}. ${score >= questions.length * 0.7 ? 'Good job!' : 'Keep practising!'}`,
    roadmap: [], adaptiveSuggestions: []
  };
  if (!genAI) return basic;

  const prompt = `Analyze test: ${score}/${questions.length} (${pct}%), Class ${studentProfile?.class || '?'}.
Topics: ${Object.entries(topicResults).map(([t, r]) => `${t}:${r.correct}/${r.total}`).join(', ')}
Output ONLY JSON: {"score":${score},"total":${questions.length},"percentage":${pct},"overallAssessment":"2-3 sentences","strengths":["s1"],"weaknesses":["w1"],"topicBreakdown":${JSON.stringify(topicResults)},"recommendations":["r1","r2","r3"],"roadmap":[{"week":1,"focus":"T","tasks":["t1"],"goal":"G"},{"week":2,"focus":"T","tasks":["t1"],"goal":"G"}],"adaptiveSuggestions":["s1"],"nextTestStrategy":"..."}`;

  const out = await callGemini(prompt);
  if (!out) return basic;
  const r = safeJsonParse(out, basic);
  r.score = score; r.total = questions.length; r.percentage = pct;
  return r;
}

// ══════════════════════════════════════════════════════
// CAREER FIT
// ══════════════════════════════════════════════════════
export async function calculateCareerFit(studentProfile, testHistory, careerPath) {
  const fb = { fitScore: 65, alignment: 'Moderate', matchingStrengths: ['Curiosity'], gaps: ['Need more practice'], advice: 'Keep exploring!', nextSteps: ['Take more tests'] };
  if (!genAI) return fb;

  const prompt = `Career alignment for Indian student. Profile: ${JSON.stringify(studentProfile || {})}. Career: ${careerPath}.
Output ONLY JSON: {"fitScore":0,"alignment":"Strong|Moderate|Developing","matchingStrengths":["s"],"gaps":["g"],"advice":"2 sentences","nextSteps":["step"]}`;

  const out = await callGemini(prompt);
  if (!out) return fb;
  return safeJsonParse(out, fb);
}

// ══════════════════════════════════════════════════════
// CAREER SUGGESTIONS
// ══════════════════════════════════════════════════════
export async function generateCareerSuggestions(subject, studentProfile = {}) {
  const fb = { careers: [
    { title: `${subject} Researcher`, shortDesc: `Research in ${subject}.`, icon: '🔬', category: 'Research' },
    { title: `${subject} Teacher`, shortDesc: `Teach ${subject}.`, icon: '📚', category: 'Education' },
    { title: `${subject} Professional`, shortDesc: `Apply ${subject} professionally.`, icon: '💼', category: 'Industry' },
  ]};
  if (!genAI) return fb;
  const ck = `careers_${subject}`;

  const prompt = `Generate 6 realistic Indian career paths for a student interested in ${subject}.
Output ONLY JSON: {"careers":[{"title":"Career","shortDesc":"1 sentence","icon":"emoji","category":"Category"}]}`;

  const out = await callGemini(prompt, ck);
  if (!out) return fb;
  const r = safeJsonParse(out, fb);
  return r.careers?.length > 0 ? r : fb;
}
