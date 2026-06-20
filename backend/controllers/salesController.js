const express = require('express');
const router = express.Router();
const salesService = require('../services/salesService');
const { authenticateToken, checkPermission } = require('../middlewares/auth');

// Flexible check: POS access, Reports access, or Return permission allows history view
const canViewHistory = (req, res, next) => {
  if (req.user && (
    req.user.permissions.includes('ACCESS_POS') || 
    req.user.permissions.includes('VIEW_REPORTS') || 
    req.user.permissions.includes('RETURN_EXCHANGE_SALE') ||
    req.user.roleName === 'Super Admin'
  )) {
    return next();
  }
  return res.status(403).json({ error: 'Permission Denied: You cannot view transaction history.' });
};

// POST /api/sales/checkout
router.post('/checkout', authenticateToken, checkPermission('ACCESS_POS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const orderId = await salesService.createSale(req.body, companyId, userId);
    res.status(201).json({ orderId, message: 'Transaction processed successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/sales/hold
router.post('/hold', authenticateToken, checkPermission('HOLD_RESUME_SALE'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const result = await salesService.holdSale(req.body, companyId, userId);
    res.status(201).json({ 
      orderId: result.orderId, 
      heldBillNumber: result.heldBillNumber, 
      message: 'Sale suspended successfully.' 
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sales/held/:id
router.delete('/held/:id', authenticateToken, checkPermission('HOLD_RESUME_SALE'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const orderId = parseInt(req.params.id, 10);
    await salesService.cancelHeldSale(orderId, companyId);
    res.json({ message: 'Suspended sale cancelled successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/sales/held
router.get('/held', authenticateToken, checkPermission('HOLD_RESUME_SALE'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const heldOrders = await salesService.getHeldSales(companyId);
    res.json(heldOrders);
  } catch (err) {
    next(err);
  }
});

// POST /api/sales/resume/:id
router.post('/resume/:id', authenticateToken, checkPermission('HOLD_RESUME_SALE'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const details = await salesService.resumeHeldSale(req.params.id, companyId);
    if (!details) return res.status(404).json({ error: 'Held sale not found.' });
    res.json(details);
  } catch (err) {
    next(err);
  }
});

// GET /api/sales/history
router.get('/history', authenticateToken, canViewHistory, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { status, startDate, endDate, customerId } = req.query;
    const history = await salesService.getSalesHistory(companyId, { status, startDate, endDate, customerId });
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// GET /api/sales/history/:id
router.get('/history/:id', authenticateToken, canViewHistory, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const details = await salesService.getSaleDetails(req.params.id, companyId);
    res.json(details);
  } catch (err) {
    next(err);
  }
});

// POST /api/sales/return
router.post('/return', authenticateToken, checkPermission('RETURN_EXCHANGE_SALE'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const refundOrderId = await salesService.processReturn(req.body, companyId, userId);
    res.status(201).json({ refundOrderId, message: 'Return transaction processed successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/sales/cash-drawer/status
router.get('/cash-drawer/status', authenticateToken, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const session = await salesService.getCashDrawerSessionToday(companyId, userId);
    res.json({ hasSession: !!session, session });
  } catch (err) {
    next(err);
  }
});

// POST /api/sales/cash-drawer/start
router.post('/cash-drawer/start', authenticateToken, checkPermission('ACCESS_POS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const newSession = await salesService.createCashDrawerSession(companyId, userId, req.body);
    res.status(201).json({ session: newSession, message: 'Cash drawer session started successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
