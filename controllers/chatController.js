import { getFileMeta } from './uploadController.js';
import { generateChatReply, callAgent } from '../services/aiService.js';
import { detectAgent } from '../services/agentOrchestrator.js';

export async function handleChat(req, res) {
  try {
    const { fileId, message, studentMemory = '' } = req.body || {};

    if (!fileId || !message) return res.status(400).json({ error: 'fileId and message are required' });
    const meta = getFileMeta(fileId);
    if (!meta) return res.status(404).json({ error: 'File not found' });
    if (!meta.text) return res.status(400).json({ error: 'No extractable text for this file (likely scanned/image-only).' });

    // Always use real Gemini — never mock
    const data = await generateChatReply(meta.text, message, false, studentMemory);
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Chat failed' });
  }
}

// Unified agent endpoint — routes to the right agent based on intent
export async function handleAgentChat(req, res) {
  try {
    const { message, agentType, studentMemory = '', fileId } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message is required' });

    const agent = agentType || detectAgent('', message);
    const options = { studentMemory: studentMemory || undefined };

    // If fileId provided, attach document context
    if (fileId) {
      const meta = getFileMeta(fileId);
      if (meta?.text) options.documentContext = meta.text.slice(0, 8000);
    }

    const data = await callAgent(agent, message, options);
    return res.json({ ...data, agent });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Agent chat failed' });
  }
}

export default { handleChat, handleAgentChat };
