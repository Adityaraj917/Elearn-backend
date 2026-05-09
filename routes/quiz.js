import express from 'express';
const router = express.Router();

router.post('/', (req, res) => {
    res.json({ success: true, message: "Quiz route working" });
});

export default router;
