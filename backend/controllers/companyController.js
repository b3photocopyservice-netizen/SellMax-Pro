const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const companyService = require('../services/companyService');
const { authenticateToken, checkPermission } = require('../middlewares/auth');

// GET /api/company
router.get('/', authenticateToken, checkPermission('MANAGE_SETTINGS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const profile = await companyService.getCompanyProfile(companyId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// PUT /api/company
router.put('/', authenticateToken, checkPermission('MANAGE_SETTINGS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const updated = await companyService.updateCompanyProfile(companyId, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/company/upload
router.post('/upload', authenticateToken, checkPermission('MANAGE_SETTINGS'), async (req, res, next) => {
  try {
    const { image, name } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image data provided.' });
    }

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 image data format.' });
    }

    const ext = matches[1].split('/')[1] || 'png';
    const buffer = Buffer.from(matches[2], 'base64');
    
    const sanitizedName = (name || 'image').replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    const filename = `${Date.now()}-${sanitizedName}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, buffer);

    const imageUrl = `/uploads/${filename}`;
    res.json({ imageUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
