// ---------------------------
// Saarthi Backend (FIXED VERSION)
// ---------------------------

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

import { uploadHandlerFactory } from './controllers/uploadController.js';
import { summarizeHandler } from './controllers/summarizeController.js';
import { quizHandler, exportQuizHandler } from './controllers/quizController.js';
import chatRoutes from './routes/chatRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('./uploads');

// Ensure Uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ---------------------------
// FIXED CORS CONFIG (VERY IMPORTANT)
// ---------------------------
app.use(
  cors({
    origin: "*",  // allow frontend from anywhere
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false
  })
);

// Allow OPTIONS for ALL routes
app.options("*", cors());

// ---------------------------
// Security + Body Parsers
// ---------------------------
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple log
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ---------------------------
// Multer Setup
// ---------------------------
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
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const ok =
      [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
      ].includes(file.mimetype) ||
      /\.(pdf|docx|pptx|txt)$/i.test(file.originalname);

    if (!ok) return cb(new Error('Unsupported file type'));
    cb(null, true);
  },
});

// ---------------------------
// API Routes
// ---------------------------
app.post('/api/upload', upload.single('file'), uploadHandlerFactory(UPLOAD_DIR));
app.post('/api/summarize', summarizeHandler);
app.post('/api/quiz', quizHandler);
app.get('/api/quiz/:fileId/export', exportQuizHandler);
app.use('/api/chat', chatRoutes);

// ---------------------------
// Health Check
// ---------------------------
app.get('/health', (req, res) => res.json({ ok: true }));

// ---------------------------
// Start Server
// ---------------------------
app.listen(PORT, () => {
  console.log(`Saarthi backend running on http://localhost:${PORT}`);
});
