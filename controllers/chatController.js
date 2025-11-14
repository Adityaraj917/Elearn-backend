import { getFileMeta } from './uploadController.js';
import { generateChatReply } from '../services/aiService.js';

export async function handleChat(req, res) {
  try {
    const { fileId, message } = req.body || {};
    const forceMock = req.query.mock === 'true';

    if (!fileId || !message) return res.status(400).json({ error: 'fileId and message are required' });
    const meta = getFileMeta(fileId);
    if (!meta) return res.status(404).json({ error: 'File not found' });
    if (!meta.text) return res.status(400).json({ error: 'No extractable text for this file (likely scanned/image-only).' });

    const data = await generateChatReply(meta.text, message, forceMock);
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Chat failed' });
  }
}

export default { handleChat };
