const express = require('express');
const router = express.Router();
const customerService = require('../services/customerService');
const { authenticateToken, checkPermission } = require('../middlewares/auth');

// Custom access helper: cashiers need customer access to attach customers during sales
const canAccessCustomers = (req, res, next) => {
  if (req.user && (req.user.permissions.includes('ACCESS_POS') || req.user.permissions.includes('MANAGE_CUSTOMERS') || req.user.roleName === 'Super Admin')) {
    return next();
  }
  return res.status(403).json({ error: 'Permission Denied: You cannot view customer data.' });
};

// GET /api/customers
router.get('/', authenticateToken, canAccessCustomers, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { search } = req.query;
    const customers = await customerService.getAllCustomers(companyId, search);
    res.json(customers);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/:id
router.get('/:id', authenticateToken, checkPermission('MANAGE_CUSTOMERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const customer = await customerService.getCustomerById(req.params.id, companyId);
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

// POST /api/customers
router.post('/', authenticateToken, checkPermission('MANAGE_CUSTOMERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const created = await customerService.createCustomer(req.body, companyId);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/customers/:id
router.put('/:id', authenticateToken, checkPermission('MANAGE_CUSTOMERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const updated = await customerService.updateCustomer(req.params.id, req.body, companyId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
