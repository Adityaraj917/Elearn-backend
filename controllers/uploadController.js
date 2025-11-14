import path from 'path';
import { extractText } from '../services/extractService.js';

// Simple in-memory store. Replace with DB in production (e.g., Postgres/Mongo/SQLite).
export const fileStore = {
  byId: new Map(),
};

export function getFileMeta(fileId) {
  return fileStore.byId.get(fileId) || null;
}

export function uploadHandlerFactory(UPLOAD_DIR) {
  return async function uploadHandler(req, res) {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file provided' });
      const { originalname, mimetype, filename, path: savedPath } = req.file;

      // Extract text synchronously (fast enough for demo); for large files, consider background job.
      const extraction = await extractText(savedPath, mimetype);

      const fileId = path.parse(filename).name; // unique basename without extension
      const meta = {
        fileId,
        fileName: originalname,
        serverFile: filename,
        mimetype,
        path: savedPath,
        textExtracted: !!extraction.success,
        extractedTextSnippet: extraction.snippet || '',
        // Cache full text in memory for simplicity; consider persistent storage and caching in prod.
        text: extraction.text || '',
        createdAt: Date.now(),
      };
      fileStore.byId.set(fileId, meta);

      return res.json({
        fileId: meta.fileId,
        fileName: meta.fileName,
        textExtracted: meta.textExtracted,
        extractedTextSnippet: meta.extractedTextSnippet,
        message: 'File uploaded successfully',
      });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Upload failed' });
    }
  };
}
