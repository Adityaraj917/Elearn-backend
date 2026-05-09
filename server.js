import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

// Controllers
import { uploadHandlerFactory } from './controllers/uploadController.js';
import { summarizeHandler } from './controllers/summarizeController.js';
import { quizHandler, exportQuizHandler } from './controllers/quizController.js';
import { handleChat, handleAgentChat } from './controllers/chatController.js';
import { nextQuestionHandler, analyzeProfileHandler } from './controllers/onboardingController.js';
import { generateTestHandler, evaluateTestHandler } from './controllers/skillTestController.js';
import { careerFitHandler } from './controllers/careerController.js';
import { generateCareerSuggestions } from './services/aiService.js';

dotenv.config();

console.log("Gemini Key Loaded:", !!process.env.GEMINI_API_KEY);

const app = express();
const PORT = process.env.PORT || 4000;

// ---------- UPLOAD DIRECTORY ----------
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('./uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ---------- CORS FIX ----------
app.use(cors({
  origin: [
    'http://localhost:3000',
    /^https:\/\/.*\.vercel\.app$/,
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.options('*', cors());

// ---------- SECURITY ----------
app.use(helmet());

// ---------- BODY PARSER ----------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- REQUEST LOGGING ----------
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ---------- ROOT ROUTES FOR DEBUG ----------
app.get('/', (req, res) => {
  res.send('Saarthi Backend Running');
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Backend Healthy',
  });
});

app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Test Route Working',
  });
});

// ---------- FILE UPLOAD ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),

  filename: (req, file, cb) => {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = path.extname(file.originalname);

    cb(null, `${ts}-${rand}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

// ---------- API ROUTES ----------

// Upload
app.post('/api/upload', upload.single('file'), uploadHandlerFactory(UPLOAD_DIR));

// AI Routes
app.post('/api/summarize', summarizeHandler);

app.post('/api/quiz', quizHandler);

app.get('/api/quiz/:fileId/export', exportQuizHandler);

app.post('/api/chat', (req, res) => handleChat(req, res));

app.post('/api/agent', (req, res) => handleAgentChat(req, res));

// Onboarding
app.post('/api/onboarding/next-question', nextQuestionHandler);

app.post('/api/onboarding/analyze-profile', analyzeProfileHandler);

// Skill Test
app.post('/api/skill-test/generate', generateTestHandler);

app.post('/api/skill-test/evaluate', evaluateTestHandler);

// Career
app.post('/api/career/fit-score', careerFitHandler);

app.post('/api/career/suggestions', async (req, res) => {
  try {
    const { subject, studentProfile } = req.body || {};

    const data = await generateCareerSuggestions(
      subject || 'General',
      studentProfile
    );

    return res.json(data);

  } catch (e) {

    console.error('Career Suggestions Error:', e);

    return res.status(500).json({
      error: e.message || 'Career suggestions failed',
    });
  }
});

// ---------- GLOBAL ERROR HANDLER ----------
app.use((err, req, res, next) => {
  console.error('Global Error:', err);

  return res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});