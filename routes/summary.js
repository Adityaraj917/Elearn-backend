import express from 'express';
const router = express.Router();

router.post('/', (req, res) => {
    res.json({ success: true, message: "Summary route working" });
});

export default router;
