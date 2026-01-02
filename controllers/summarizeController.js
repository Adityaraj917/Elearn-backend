import { getFileMeta } from './uploadController.js';
import { summarize } from '../services/aiService.js';

export async function summarizeHandler(req, res) {
  try {
    const { fileId, options = {} } = req.body || {};

    if (!fileId) {
      return res.status(400).json({ error: "fileId is required" });
    }

    const meta = getFileMeta(fileId);
    if (!meta) {
      return res.status(404).json({ error: "File not found" });
    }

    let text = meta.text?.trim();

    // 🚨 HARD STOP if text extraction failed
    if (!text) {
      return res.status(400).json({
        error: "No text extracted from file. Use text-based PDF (not scanned)."
      });
    }

    // ✅ ALWAYS call REAL Gemini now
    const data = await summarize(text, options, false);

    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: e.message || "Summarization failed"
    });
  }
}
