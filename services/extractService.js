import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import unzipper from 'unzipper';
import { XMLParser } from 'fast-xml-parser';

export async function extractText(filePath, mimeType) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    let text = '';

    if (mimeType === 'application/pdf' || ext === '.pdf') {
      const buff = await fs.readFile(filePath);
      const data = await pdfParse(buff).catch(() => ({ text: '' }));
      text = (data.text || '').replace(/\s+$/g, '').trim();
      if (!text || text.replace(/\s/g, '').length < 50) {
        return { success: false, text: '', snippet: '', reason: 'Likely scanned or image-only PDF' };
      }
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.docx'
    ) {
      const buff = await fs.readFile(filePath);
      const { value } = await mammoth.extractRawText({ buffer: buff });
      text = (value || '').trim();
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      ext === '.pptx'
    ) {
      text = await extractFromPPTX(filePath);
    } else if (mimeType === 'text/plain' || ext === '.txt') {
      text = (await fs.readFile(filePath, 'utf-8')).toString().trim();
    } else {
      return { success: false, text: '', snippet: '', reason: 'Unsupported type' };
    }

    const cleaned = (text || '').replace(/\u0000/g, '').trim();
    const snippet = cleaned.slice(0, 300);
    const success = cleaned.length > 0;
    return { success, text: cleaned, snippet };
  } catch (err) {
    return { success: false, text: '', snippet: '', reason: err.message };
  }
}

async function extractFromPPTX(filePath) {
  // Best-effort: unzip pptx and read slides XML texts
  try {
    const zipStream = fsSync.createReadStream(filePath).pipe(unzipper.Parse({ forceStream: true }));
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: 't', ignoreDeclaration: true });
    let texts = [];
    for await (const entry of zipStream) {
      const fileName = entry.path;
      if (/ppt\/slides\/slide\d+\.xml$/.test(fileName)) {
        const content = await entry.buffer();
        const xml = parser.parse(content.toString());
        // Traverse a:t text nodes (PowerPoint stores text in a:t)
        const t = collectText(xml);
        if (t) texts.push(t);
      } else {
        entry.autodrain();
      }
    }
    return texts.join('\n').trim();
  } catch (e) {
    return '';
  }
}

function collectText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  let acc = '';
  for (const k of Object.keys(node)) {
    const val = node[k];
    if (k === 'a:t' || k === 't') {
      if (Array.isArray(val)) acc += val.map(v => (typeof v === 'string' ? v : '')).join(' ');
      else if (typeof val === 'string') acc += val + ' ';
    } else if (typeof val === 'object') {
      acc += ' ' + collectText(val);
    }
  }
  return acc.replace(/\s+/g, ' ').trim();
}
