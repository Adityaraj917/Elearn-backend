import { generateSkillTest, evaluateSkillTest } from '../services/aiService.js';

export async function generateTestHandler(req, res) {
  try {
    const { studentClass = '10', subject = 'Physics', difficulty = 'medium', pastPerformance = {} } = req.body;
    const test = await generateSkillTest(studentClass, subject, difficulty, pastPerformance);
    return res.json(test);
  } catch (error) {
    console.error("Generate Test Error:", error);
    return res.status(500).json({ error: "Failed to generate skill test" });
  }
}

export async function evaluateTestHandler(req, res) {
  try {
    const { questions = [], answers = {}, studentProfile = {} } = req.body;
    const evaluation = await evaluateSkillTest(questions, answers, studentProfile);
    return res.json(evaluation);
  } catch (error) {
    console.error("Evaluate Test Error:", error);
    return res.status(500).json({ error: "Failed to evaluate test" });
  }
}
