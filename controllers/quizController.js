import { getFileMeta } from './uploadController.js';
import { generateQuiz } from '../services/aiService.js';
import { questionsToCSV, questionsToJSON } from '../services/exportService.js';

// In-memory cache of last generated quizzes per file
const quizCache = new Map();

export async function quizHandler(req, res) {
  try {
    const { fileId, options = {}, difficulty, count, numQuestions } = req.body || {};
    const forceMock = req.query.mock === 'true';

    const opts = {
      difficulty: options.difficulty || difficulty || 'medium',
      numQuestions: options.numQuestions || count || numQuestions || 10,
    };

    let text = '';
    if (fileId) {
      const meta = getFileMeta(fileId);
      if (!meta) return res.status(404).json({ error: 'File not found. Please re-upload your document.' });
      text = meta.text || '';
      if (!text || text.trim().length < 50) {
        return res.status(400).json({
          error: 'Not enough text could be extracted from this file. Please try a different document (text-based PDF, DOCX, or TXT).'
        });
      }
    } else {
      // No fileId — still allow real AI quiz on a general topic
      text = 'Generate general knowledge questions suitable for school students.';
    }

    // Always use real Gemini — never force mock
    const data = await generateQuiz(text, opts, false);

    // Validate we got usable questions
    if (!data?.questions || data.questions.length === 0) {
      return res.status(500).json({
        error: 'Quiz generation failed. The AI could not generate valid questions. Please try again.'
      });
    }

    if (fileId) quizCache.set(fileId, data);
    return res.json(data);
  } catch (e) {
    console.error('Quiz handler error:', e);
    return res.status(500).json({ error: 'Quiz generation failed. Please try again.' });
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
