const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const inventoryService = require('../services/inventoryService');
const { authenticateToken, checkPermission } = require('../middlewares/auth');

// Helper permission check (can access POS OR manage inventory to view lists)
const canViewInventory = (req, res, next) => {
  if (req.user && (req.user.permissions.includes('ACCESS_POS') || req.user.permissions.includes('MANAGE_INVENTORY') || req.user.roleName === 'Super Admin')) {
    return next();
  }
  return res.status(403).json({ error: 'Permission Denied: You cannot view the product list.' });
};

// GET /api/inventory/products
router.get('/products', authenticateToken, canViewInventory, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { categoryId, search } = req.query;
    const products = await inventoryService.getAllProducts(companyId, categoryId, search);
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/products/:id
router.get('/products/:id', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const product = await inventoryService.getProductById(req.params.id, companyId);
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/products
router.post('/products', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const created = await inventoryService.createProduct(req.body, companyId);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/products/:id
router.put('/products/:id', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const updated = await inventoryService.updateProduct(req.params.id, req.body, companyId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inventory/products/:id
router.delete('/products/:id', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    await inventoryService.deleteProduct(req.params.id, companyId);
    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/categories
router.get('/categories', authenticateToken, canViewInventory, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const categories = await inventoryService.getCategories(companyId);
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/categories
router.post('/categories', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const created = await inventoryService.createCategory(req.body, companyId);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inventory/categories/:id
router.delete('/categories/:id', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    await inventoryService.deleteCategory(req.params.id, companyId);
    res.json({ message: 'Category deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/uoms
router.get('/uoms', authenticateToken, canViewInventory, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const uoms = await inventoryService.getUOMs(companyId);
    res.json(uoms);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/uoms
router.post('/uoms', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const created = await inventoryService.createUOM(req.body, companyId);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inventory/uoms/:id
router.delete('/uoms/:id', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    await inventoryService.deleteUOM(req.params.id, companyId);
    res.json({ message: 'UOM deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/brands
router.get('/brands', authenticateToken, canViewInventory, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const brands = await inventoryService.getBrands(companyId);
    res.json(brands);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/brands
router.post('/brands', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const created = await inventoryService.createBrand(req.body, companyId);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inventory/brands/:id
router.delete('/brands/:id', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    await inventoryService.deleteBrand(req.params.id, companyId);
    res.json({ message: 'Brand deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/upload-image
router.post('/upload-image', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
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

// GET /api/inventory/batches/:productId
router.get('/batches/:productId', authenticateToken, canViewInventory, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const batches = await inventoryService.getBatches(companyId, req.params.productId);
    res.json(batches);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/batches
router.post('/batches', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const created = await inventoryService.createBatch(req.body, companyId);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inventory/batches/:id
router.delete('/batches/:id', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    await inventoryService.deleteBatch(req.params.id, companyId);
    res.json({ message: 'Batch deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/notifications
router.get('/notifications', authenticateToken, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const notifications = await inventoryService.getNotifications(companyId);
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/notifications/read
router.post('/notifications/read', authenticateToken, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    await inventoryService.markAllAsRead(companyId);
    res.json({ message: 'Notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

// ── Price Variants ────────────────────────────────────────────────────────────

// GET /api/inventory/products/:id/variants
router.get('/products/:id/variants', authenticateToken, canViewInventory, async (req, res, next) => {
  try {
    const variants = await inventoryService.getVariantsByProduct(req.params.id, req.user.companyId);
    res.json(variants);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/variants  — batch fetch all active variants for POS
router.get('/variants', authenticateToken, canViewInventory, async (req, res, next) => {
  try {
    const variants = await inventoryService.getAllVariantsForCompany(req.user.companyId);
    res.json(variants);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/products/:id/variants
router.post('/products/:id/variants', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const created = await inventoryService.createVariant(req.params.id, req.body, req.user.companyId);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/variants/:variantId
router.put('/variants/:variantId', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const updated = await inventoryService.updateVariant(req.params.variantId, req.body, req.user.companyId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inventory/variants/:variantId
router.delete('/variants/:variantId', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    await inventoryService.deleteVariant(req.params.variantId, req.user.companyId);
    res.json({ message: 'Variant deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
