import express from 'express';
const router = express.Router();

router.post('/', (req, res) => {
    res.json({ success: true, message: "Chat route working" });
});

export default router;
