const express = require('express');
const router = express.Router();
const reportsService = require('../services/reportsService');
const { authenticateToken, checkPermission } = require('../middlewares/auth');

// GET /api/reports/daily-summary
router.get('/daily-summary', authenticateToken, checkPermission('VIEW_REPORTS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate } = req.query;
    const summary = await reportsService.getDailySalesSummary(companyId, startDate, endDate);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/product-performance
router.get('/product-performance', authenticateToken, checkPermission('VIEW_REPORTS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate, limit } = req.query;
    const performance = await reportsService.getProductPerformance(companyId, startDate, endDate, limit);
    res.json(performance);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/low-stock
router.get('/low-stock', authenticateToken, async (req, res, next) => {
  try {
    // Inventory officers, managers, and admins can view low stock warnings
    if (!req.user || (
      !req.user.permissions.includes('VIEW_REPORTS') && 
      !req.user.permissions.includes('MANAGE_INVENTORY') &&
      req.user.roleName !== 'Super Admin'
    )) {
      return res.status(403).json({ error: 'Permission Denied: Cannot view stock reports.' });
    }

    const companyId = req.user.companyId;
    const alerts = await reportsService.getLowStockAlerts(companyId);
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/customer-statement
router.get('/customer-statement', authenticateToken, async (req, res, next) => {
  try {
    // Accountants, managers, and admins can view customer balance statements
    if (!req.user || (
      !req.user.permissions.includes('VIEW_REPORTS') && 
      !req.user.permissions.includes('MANAGE_CUSTOMERS') &&
      req.user.roleName !== 'Super Admin'
    )) {
      return res.status(403).json({ error: 'Permission Denied: Cannot view customer statements.' });
    }

    const companyId = req.user.companyId;
    const statement = await reportsService.getCustomerLoyaltyStatement(companyId);
    res.json(statement);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/expiry
router.get('/expiry', authenticateToken, async (req, res, next) => {
  try {
    if (!req.user || (
      !req.user.permissions.includes('VIEW_REPORTS') && 
      !req.user.permissions.includes('MANAGE_INVENTORY') &&
      req.user.roleName !== 'Super Admin'
    )) {
      return res.status(403).json({ error: 'Permission Denied: Cannot view expiry reports.' });
    }

    const companyId = req.user.companyId;
    const report = await reportsService.getExpiryReport(companyId);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/price-overrides
router.get('/price-overrides', authenticateToken, checkPermission('VIEW_REPORTS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate } = req.query;
    const overrides = await reportsService.getPriceOverridesLog(companyId, startDate, endDate);
    res.json(overrides);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/stock-movement
router.get('/stock-movement', authenticateToken, checkPermission('VIEW_REPORTS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate, productId, categoryId, supplierId, transactionType } = req.query;
    const data = await reportsService.getStockMovement(companyId, {
      startDate, endDate, productId, categoryId, supplierId, transactionType
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/sales-analysis
router.get('/sales-analysis', authenticateToken, checkPermission('VIEW_REPORTS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { reportType, startDate, endDate, branchName } = req.query;
    const data = await reportsService.getSalesAnalysisReport(companyId, { reportType, startDate, endDate, branchName });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/profit-analysis
router.get('/profit-analysis', authenticateToken, checkPermission('VIEW_REPORTS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { reportType, startDate, endDate, productId, categoryId, brand, customerId, userId, branchName } = req.query;
    const data = await reportsService.getProfitAnalysisReport(companyId, {
      reportType, startDate, endDate, productId, categoryId, brand, customerId, userId, branchName
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/kpi-dashboard
router.get('/kpi-dashboard', authenticateToken, checkPermission('VIEW_REPORTS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate, productId, categoryId, brand, customerId, userId, branchName } = req.query;
    const data = await reportsService.getDashboardKPIs(companyId, {
      startDate, endDate, productId, categoryId, brand, customerId, userId, branchName
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
