import { getFileMeta } from './uploadController.js';
import { generateQuiz } from '../services/aiService.js';
import { questionsToCSV, questionsToJSON } from '../services/exportService.js';

// In-memory cache of last generated quizzes per file
const quizCache = new Map(); // key: fileId, value: { questions }

export async function quizHandler(req, res) {
  try {
    const { fileId, options = {}, difficulty, count, numQuestions } = req.body || {};
    const forceMock = req.query.mock === 'true';

    // Backward compatibility with current frontend which posts { difficulty, count }
    const opts = {
      difficulty: options.difficulty || difficulty || 'medium',
      numQuestions: options.numQuestions || count || numQuestions || 10,
    };

    let text = '';
    if (fileId) {
      const meta = getFileMeta(fileId);
      if (!meta) return res.status(404).json({ error: 'File not found' });
      text = meta.text || '';
      if (!text) return res.status(400).json({ error: 'No extractable text for this file (likely scanned/image-only). Try another file.' });
    } else {
      text = 'This is a generic study text used for mock quiz generation because no fileId was provided.';
    }

    const data = await generateQuiz(text, opts, forceMock || !fileId);

    // cache by fileId if present
    if (fileId) quizCache.set(fileId, data);

    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Quiz generation failed' });
  }
}

export async function exportQuizHandler(req, res) {
  try {
    const { fileId } = req.params;
    const format = (req.query.format || 'json').toLowerCase();
    const cached = quizCache.get(fileId);
    if (!cached) return res.status(404).json({ error: 'No quiz available for this fileId. Generate a quiz first.' });

    if (format === 'csv') {
      const csv = questionsToCSV(cached.questions || []);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="quiz-${fileId}.csv"`);
      return res.send(csv);
    } else {
      const json = questionsToJSON(cached.questions || []);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="quiz-${fileId}.json"`);
      return res.send(json);
    }
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Export failed' });
  }
}
