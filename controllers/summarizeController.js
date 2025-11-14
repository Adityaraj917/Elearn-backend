import { getFileMeta } from './uploadController.js';
import { summarize } from '../services/aiService.js';

export async function summarizeHandler(req, res) {
  try {
    const { fileId, options = {} } = req.body || {};
    const forceMock = req.query.mock === 'true';

    // Backward compatibility: if fileId is not provided (frontend mock mode), still return a mock summary
    let text = '';
    if (fileId) {
      const meta = getFileMeta(fileId);
      if (!meta) return res.status(404).json({ error: 'File not found' });
      text = meta.text || '';
      if (!text) {
        // If uploaded file had no text (likely scanned), return helpful error
        return res.status(400).json({ error: 'No extractable text for this file (likely scanned/image-only). Try another file.' });
      }
    } else {
      text = 'This is a generic study text used for mock summarization because no fileId was provided.';
    }

    const data = await summarize(text, options, forceMock || !fileId);
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Summarization failed' });
  }
}
