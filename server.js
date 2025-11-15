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

// Correct Render-compatible upload directory
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

console.log("Using upload directory:", UPLOAD_DIR);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log("Created missing upload directory.");
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// LOG every request (important for debugging PDF/quiz issues)
app.use((req, _res, next) => {
  const preview =
    typeof req.body === 'object' && req.body !== null
      ? JSON.stringify(req.body).slice(0, 120)
      : '';
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.path} ${preview ? 'body=' + preview : ''
    }`
  );
  next();
});

// Multer storage with absolute path
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = path.extname(file.originalname);
    cb(null, `${ts}-${rand}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ];
    const ok =
      allowed.includes(file.mimetype) ||
      /\.(pdf|docx|pptx|txt)$/i.test(file.originalname);
    if (!ok) return cb(new Error('Unsupported file type'));
    cb(null, true);
  },
});

// API routes
app.post('/api/upload', upload.single('file'), uploadHandlerFactory(UPLOAD_DIR));
app.post('/api/summarize', summarizeHandler);
app.post('/api/quiz', quizHandler);
app.get('/api/quiz/:fileId/export', exportQuizHandler);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Saarthi backend listening on http://localhost:${PORT}`);
});
