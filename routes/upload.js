const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique name keeping original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

// File filter (Optional security: omit restrictions to support custom documents, images, PDFs, etc.)
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// 1. Upload a file (Protected)
// POST /api/upload
router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { roomId } = req.body;
    if (!roomId) {
      // Remove uploaded file if roomId is missing to keep folder clean
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Room ID is required to share files.' });
    }

    // Build absolute/relative URL path for the file download
    const fileUrl = `/uploads/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: 'File uploaded and shared successfully.',
      file: {
        name: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl,
        sender: req.user.name,
        uploadedAt: new Date()
      }
    });
  } catch (error) {
    console.error('File upload error:', error.message);
    res.status(500).json({ success: false, message: 'Server file uploading error.' });
  }
});

module.exports = router;
