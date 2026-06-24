const express = require('express');
const router = express.Router();
const salesService = require('../services/salesService');
const reportsService = require('../services/reportsService');
const { authenticateToken, checkPermission } = require('../middlewares/auth');

// POST /api/sales/exchange
router.post('/sales/exchange', authenticateToken, checkPermission('RETURN_EXCHANGE_SALE'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const result = await salesService.processExchange(req.body, companyId, userId);
    res.status(201).json({
      message: 'Exchange transaction processed successfully.',
      ...result
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/exchange-reports/returns
router.get('/reports/exchange-reports/returns', authenticateToken, checkPermission('VIEW_REPORTS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate } = req.query;
    const data = await reportsService.getSalesReturnsReport(companyId, { startDate, endDate });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/exchange-reports/refunds
router.get('/reports/exchange-reports/refunds', authenticateToken, checkPermission('VIEW_REPORTS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate } = req.query;
    const data = await reportsService.getRefundsReport(companyId, { startDate, endDate });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/exchange-reports/exchanges
router.get('/reports/exchange-reports/exchanges', authenticateToken, checkPermission('VIEW_REPORTS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate } = req.query;
    const data = await reportsService.getExchangesReport(companyId, { startDate, endDate });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/exchange-reports/settlements
router.get('/reports/exchange-reports/settlements', authenticateToken, checkPermission('VIEW_REPORTS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate } = req.query;
    const data = await reportsService.getExchangeSettlementsReport(companyId, { startDate, endDate });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
