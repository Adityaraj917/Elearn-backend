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
import chatRoutes from './routes/chatRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ---------- FIXED UPLOAD DIRECTORY ----------
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('./uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ---------- FIXED CORS FOR RENDER + VERCEL ----------
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'https://elearn-frontend-eight.vercel.app',
      'https://elearn-frontend-8j33o70xr-adityas-projects-e8701faa.vercel.app'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  })
);

app.options('*', cors());

// ---------- SECURITY ----------
app.use(helmet());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- LOGGING ----------
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ---------- FILE UPLOAD (multer) ----------
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
});

// ---------- ROUTES ----------
app.post('/api/upload', upload.single('file'), uploadHandlerFactory(UPLOAD_DIR));
app.post('/api/summarize', summarizeHandler);
app.post('/api/quiz', quizHandler);
app.get('/api/quiz/:fileId/export', exportQuizHandler);
app.use('/api/chat', chatRoutes);

// ---------- HEALTH ----------
app.get('/health', (req, res) => res.json({ ok: true }));

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
