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
      text = cleanExtractedText(data.text || '');
      if (!text || text.replace(/\s/g, '').length < 80) {
        return { success: false, text: '', snippet: '', quality: 'none', reason: 'Likely scanned or image-only PDF. Please use a text-based PDF.' };
      }
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.docx'
    ) {
      const buff = await fs.readFile(filePath);
      const { value } = await mammoth.extractRawText({ buffer: buff });
      text = cleanExtractedText(value || '');
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      ext === '.pptx'
    ) {
      text = await extractFromPPTX(filePath);
      text = cleanExtractedText(text);
    } else if (mimeType === 'text/plain' || ext === '.txt') {
      text = cleanExtractedText((await fs.readFile(filePath, 'utf-8')).toString());
    } else {
      return { success: false, text: '', snippet: '', quality: 'none', reason: 'Unsupported file type. Supports: PDF, DOCX, PPTX, TXT.' };
    }

    const snippet = text.slice(0, 300);
    const success = text.length > 0;
    const quality = text.length > 2000 ? 'high' : text.length > 500 ? 'medium' : text.length > 100 ? 'low' : 'very_low';

    return { success, text, snippet, quality, charCount: text.length };
  } catch (err) {
    return { success: false, text: '', snippet: '', quality: 'none', reason: err.message };
  }
}

/** Clean extracted text: normalize whitespace, remove artifacts */
function cleanExtractedText(raw) {
  if (!raw) return '';
  let text = raw;
  // Remove null bytes
  text = text.replace(/\u0000/g, '');
  // Normalize unicode quotes and dashes
  text = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-');
  // Remove page number patterns (e.g., "Page 1 of 10", "- 3 -", standalone numbers on lines)
  text = text.replace(/^Page\s+\d+\s*(of\s+\d+)?\s*$/gim, '');
  text = text.replace(/^-\s*\d+\s*-\s*$/gm, '');
  text = text.replace(/^\s*\d+\s*$/gm, '');
  // Remove excessive whitespace but preserve paragraph breaks
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  // Trim each line
  text = text.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
  return text.trim();
}

async function extractFromPPTX(filePath) {
  try {
    const zipStream = fsSync.createReadStream(filePath).pipe(unzipper.Parse({ forceStream: true }));
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: 't', ignoreDeclaration: true });
    let texts = [];
    for await (const entry of zipStream) {
      const fileName = entry.path;
      if (/ppt\/slides\/slide\d+\.xml$/.test(fileName)) {
        const content = await entry.buffer();
        const xml = parser.parse(content.toString());
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
