const express = require('express');
const router = express.Router();
const customerPaymentService = require('../services/customerPaymentService');
const { authenticateToken } = require('../middlewares/auth');

// Access helpers
const canManagePayments = (req, res, next) => {
  if (req.user && (
    req.user.permissions.includes('ACCESS_POS') || 
    req.user.permissions.includes('MANAGE_CUSTOMERS') || 
    req.user.roleName === 'Super Admin'
  )) {
    return next();
  }
  return res.status(403).json({ error: 'Permission Denied: You cannot manage customer payments.' });
};

const canViewReports = (req, res, next) => {
  if (req.user && (
    req.user.permissions.includes('VIEW_REPORTS') || 
    req.user.permissions.includes('MANAGE_CUSTOMERS') || 
    req.user.roleName === 'Super Admin'
  )) {
    return next();
  }
  return res.status(403).json({ error: 'Permission Denied: You cannot view reports.' });
};

// GET /api/customers/payments/history - List history of customer payments
router.get('/history', authenticateToken, canManagePayments, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { customerId, startDate, endDate, search } = req.query;
    const list = await customerPaymentService.getPaymentsList(companyId, { customerId, startDate, endDate, search });
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/payments/receivables - Outstanding customer receivables list
router.get('/receivables', authenticateToken, canViewReports, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const list = await customerPaymentService.getOutstandingReceivables(companyId);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/payments/mode-summary - Payment mode summary
router.get('/mode-summary', authenticateToken, canViewReports, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate } = req.query;
    const summary = await customerPaymentService.getPaymentModeSummary(companyId, startDate, endDate);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/payments/statement/:id - Customer statement ledger
router.get('/statement/:customerId', authenticateToken, canViewReports, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const customerId = req.params.customerId;
    const { startDate, endDate } = req.query;
    const ledger = await customerPaymentService.getStatementLedger(customerId, companyId, startDate, endDate);
    res.json(ledger);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/payments/:id - Get specific customer payment with breakdowns
router.get('/:id', authenticateToken, canManagePayments, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const payment = await customerPaymentService.getPaymentDetails(req.params.id, companyId);
    res.json(payment);
  } catch (err) {
    next(err);
  }
});

// POST /api/customers/payments - Record customer payment (header, modes, allocations, ledger entries)
router.post('/', authenticateToken, canManagePayments, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const result = await customerPaymentService.processCustomerPayment(req.body, companyId, userId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/customers/payments/adjustments - Record customer ledger adjustment (Credit Note / Debit Note / etc)
router.post('/adjustments', authenticateToken, canManagePayments, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const result = await customerPaymentService.recordCustomerAdjustment(companyId, userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
