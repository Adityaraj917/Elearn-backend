export function questionsToJSON(questions) {
  return JSON.stringify({ questions }, null, 2);
}

export function questionsToCSV(questions) {
  const rows = [
    ['id', 'question', 'optionA', 'optionB', 'optionC', 'optionD', 'correctIndex', 'explanation'],
    ...questions.map(q => [q.id, q.question, ...(q.options || []).slice(0,4), q.correctIndex, q.explanation])
  ];
  const escape = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  return rows.map(r => r.map(escape).join(',')).join('\n');
}
