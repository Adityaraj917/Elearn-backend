import { generateAdaptiveQuestion, analyzeStudentProfile } from '../services/aiService.js';

export async function nextQuestionHandler(req, res) {
  try {
    const { previousAnswers = {}, questionNumber = 1, topicsCovered = [] } = req.body;
    const question = await generateAdaptiveQuestion(previousAnswers, questionNumber, topicsCovered);
    return res.json(question);
  } catch (error) {
    console.error("Next Question Error:", error);
    return res.status(500).json({ error: "Failed to generate question" });
  }
}

export async function analyzeProfileHandler(req, res) {
  try {
    const { answers = {} } = req.body;
    const profile = await analyzeStudentProfile(answers);
    return res.json(profile);
  } catch (error) {
    console.error("Profile Analysis Error:", error);
    return res.status(500).json({ error: "Failed to analyze profile" });
  }
}
