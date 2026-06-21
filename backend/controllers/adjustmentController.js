const express = require('express');
const router = express.Router();
const adjustmentService = require('../services/adjustmentService');
const { authenticateToken, checkPermission } = require('../middlewares/auth');

// Helper: Manager-or-above can approve
const canApprove = (req, res, next) => {
  const approverRoles = ['Super Admin', 'Company Admin', 'Manager'];
  if (req.user && (approverRoles.includes(req.user.roleName) || req.user.permissions.includes('MANAGE_INVENTORY'))) {
    return next();
  }
  return res.status(403).json({ error: 'Permission Denied: You cannot approve adjustments.' });
};

// GET /api/inventory/adjustments
router.get('/', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const { status, startDate, endDate, search } = req.query;
    const adjustments = await adjustmentService.getAdjustments(req.user.companyId, { status, startDate, endDate, search });
    res.json(adjustments);
  } catch (err) { next(err); }
});

// GET /api/inventory/adjustments/report/product
router.get('/report/product', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const { productId, startDate, endDate } = req.query;
    const data = await adjustmentService.getReportByProduct(req.user.companyId, productId, startDate, endDate);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/inventory/adjustments/report/summary
router.get('/report/summary', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await adjustmentService.getSummaryReport(req.user.companyId, startDate, endDate);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/inventory/adjustments/report/users
router.get('/report/users', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await adjustmentService.getUserReport(req.user.companyId, startDate, endDate);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/inventory/adjustments/:id
router.get('/:id', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const adj = await adjustmentService.getAdjustmentById(req.params.id, req.user.companyId);
    res.json(adj);
  } catch (err) { next(err); }
});

// POST /api/inventory/adjustments
router.post('/', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const adj = await adjustmentService.createAdjustment(req.body, req.user.userId, req.user.companyId);
    res.status(201).json(adj);
  } catch (err) { next(err); }
});

// PUT /api/inventory/adjustments/:id/approve
router.put('/:id/approve', authenticateToken, canApprove, async (req, res, next) => {
  try {
    const adj = await adjustmentService.approveAdjustment(req.params.id, req.user.userId, req.user.companyId);
    res.json(adj);
  } catch (err) { next(err); }
});

// PUT /api/inventory/adjustments/:id/cancel
router.put('/:id/cancel', authenticateToken, checkPermission('MANAGE_INVENTORY'), async (req, res, next) => {
  try {
    const adj = await adjustmentService.cancelAdjustment(req.params.id, req.user.companyId);
    res.json(adj);
  } catch (err) { next(err); }
});

module.exports = router;
