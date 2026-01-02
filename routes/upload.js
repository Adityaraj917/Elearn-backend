const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

// POST /api/upload
router.post("/", upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    res.json({
        message: "File uploaded successfully",
        filename: req.file.filename,
        path: req.file.path,
    });
});

module.exports = router;
