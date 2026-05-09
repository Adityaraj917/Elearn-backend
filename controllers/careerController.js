import { calculateCareerFit } from '../services/aiService.js';

export async function careerFitHandler(req, res) {
  try {
    const { studentProfile = {}, testHistory = [], careerPath = '' } = req.body;
    const fit = await calculateCareerFit(studentProfile, testHistory, careerPath);
    return res.json(fit);
  } catch (error) {
    console.error("Career Fit Error:", error);
    return res.status(500).json({ error: "Failed to calculate career fit" });
  }
}
