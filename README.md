# Saarthi — eLearn Backend (Node.js + Express)

Production-structured backend for the Saarthi — eLearn frontend. Handles file uploads, text extraction (PDF/DOCX/PPTX/TXT), and AI-powered summarization and quiz generation with optional OpenAI integration. Defaults to realistic mock mode when no API key is set.

## Tech Stack
- Node.js (LTS), Express
- Multer for uploads
- pdf-parse for PDFs, mammoth for DOCX
- PPTX best-effort extraction by unzipping and parsing slide XML
- OpenAI (optional) via `openai` package
- CORS, Helmet, dotenv, axios

## Getting Started
1. Install dependencies
```bash
npm install
```
2. Configure environment (optional)
```bash
cp .env.example .env
# edit .env to set OPENAI_API_KEY if you want real AI
```
3. Run the server (dev or prod)
```bash
npm run dev
# or
npm start
```
Server listens on `http://localhost:${PORT || 4000}`.

## Folder Structure
```
/saarthi-backend
  /controllers
    uploadController.js
    summarizeController.js
    quizController.js
  /services
    extractService.js
    aiService.js
    exportService.js
  /uploads
    (uploaded files stored here)
  server.js
  package.json
  .env.example
  README.md
```

## API Endpoints
All responses are JSON unless exporting.

### POST /api/upload
- Multipart form-data: field `file`
- Saves file to `/uploads` and extracts text
- Response:
```json
{
  "fileId": "string",
  "fileName": "notes.pdf",
  "textExtracted": true,
  "extractedTextSnippet": "First 300 chars..."
}
```
- Detection of scanned/image-only PDFs is based on too-short text

Example:
```bash
curl -F "file=@./sample.pdf" http://localhost:4000/api/upload
```

### POST /api/summarize[?mock=true]
Body:
```json
{ "fileId": "string", "options": { "length": "short|detailed", "tone": "concise|student-friendly" } }
```
- If `OPENAI_API_KEY` is set, uses OpenAI; otherwise returns realistic mock
- If `fileId` is omitted, returns a mock summary (compatible with current frontend)

Example:
```bash
curl -X POST http://localhost:4000/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"fileId":"<your-file-id>","options":{"length":"detailed","tone":"student-friendly"}}'
```

### POST /api/quiz[?mock=true]
Body:
```json
{ "fileId": "string", "options": { "numQuestions": 10, "difficulty": "easy|medium|hard" } }
```
- If `OPENAI_API_KEY` is set, uses OpenAI; otherwise returns realistic mock
- If `fileId` is omitted, returns a mock quiz (compatible with current frontend posting {difficulty, count})

Example:
```bash
curl -X POST http://localhost:4000/api/quiz \
  -H "Content-Type: application/json" \
  -d '{"fileId":"<your-file-id>","options":{"numQuestions":8,"difficulty":"medium"}}'
```

### GET /api/quiz/:fileId/export?format=csv|json
- Exports the last generated quiz for that fileId in the requested format

Example:
```bash
curl -L "http://localhost:4000/api/quiz/<your-file-id>/export?format=csv" -o quiz.csv
```

## Frontend Integration
- The existing frontend uses Next.js API routes for mocks. To switch to this backend, set an env var in the frontend:
```
NEXT_PUBLIC_API_BASE=http://localhost:4000
```
- Then point Axios calls to `${process.env.NEXT_PUBLIC_API_BASE}/api/...`.

## Configuration
- `.env.example` contains defaults:
```
PORT=4000
UPLOAD_DIR=./uploads
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```
- Change file size limit in `server.js` (multer limits)

## Deployment
- Run with PM2:
```bash
npm i -g pm2
pm2 start server.js --name saarthi-backend
```
- Works on Railway/Render/Heroku-like platforms. Ensure uploads directory is writable or switch to object storage.

## Notes
- If OpenAI key is missing, mock mode is active automatically.
- In-memory file metadata store is used. Replace with a database in production.
- TODO: Add persistent storage for extracted text and metadata.
