const express = require('express');
const router = express.Router();
const supplierService = require('../services/supplierService');
const { authenticateToken, checkPermission } = require('../middlewares/auth');

// Helper permission check (can view suppliers OR view reports to view list)
const canViewSuppliers = (req, res, next) => {
  if (req.user && (
    req.user.permissions.includes('VIEW_SUPPLIERS') || 
    req.user.permissions.includes('VIEW_REPORTS') || 
    req.user.roleName === 'Super Admin'
  )) {
    return next();
  }
  return res.status(403).json({ error: 'Permission Denied: You cannot view the supplier list.' });
};

// GET /api/suppliers
router.get('/', authenticateToken, canViewSuppliers, async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const suppliers = await supplierService.getAllSuppliers(companyId, req.query);
    res.json(suppliers);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/widgets
router.get('/widgets', authenticateToken, checkPermission('VIEW_SUPPLIERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const widgets = await supplierService.getWidgets(companyId);
    res.json(widgets);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/audit
router.get('/audit', authenticateToken, checkPermission('VIEW_SUPPLIERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const logs = await supplierService.getAuditTrail(companyId);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/purchases
router.get('/purchases', authenticateToken, checkPermission('VIEW_SUPPLIERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const poList = await require('../repositories/supplierRepository').getPurchaseOrders(companyId, req.query);
    res.json(poList);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/purchases/:id
router.get('/purchases/:id', authenticateToken, checkPermission('VIEW_SUPPLIERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const po = await require('../repositories/supplierRepository').getPurchaseOrderById(req.params.id, companyId);
    if (!po) return res.status(404).json({ error: 'Purchase record not found.' });
    res.json(po);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/returns
router.get('/returns', authenticateToken, checkPermission('VIEW_SUPPLIERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const list = await supplierService.getReturnsList(companyId, req.query);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/company-profile
router.get('/company-profile', authenticateToken, checkPermission('VIEW_SUPPLIERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const companyProfile = await require('../services/companyService').getCompanyProfile(companyId);
    res.json(companyProfile);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/:id
router.get('/:id', authenticateToken, checkPermission('VIEW_SUPPLIERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const supplier = await supplierService.getSupplierProfile(req.params.id, companyId);
    if (!supplier) return res.status(404).json({ error: 'Supplier profile not found.' });
    res.json(supplier);
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers
router.post('/', authenticateToken, checkPermission('MANAGE_SUPPLIERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const created = await supplierService.createSupplierProfile(companyId, userId, req.body);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/suppliers/:id
router.put('/:id', authenticateToken, checkPermission('MANAGE_SUPPLIERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const updated = await supplierService.updateSupplierProfile(req.params.id, companyId, userId, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/suppliers/:id
router.delete('/:id', authenticateToken, checkPermission('MANAGE_SUPPLIERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const deleted = await supplierService.deleteSupplierProfile(req.params.id, companyId, userId);
    res.json({ success: deleted });
  } catch (err) {
    next(err);
  }
});

// --- PURCHASE MANAGEMENT ---

// Routes relocated to top to avoid parameterized route conflict

// POST /api/suppliers/purchases
router.post('/purchases', authenticateToken, checkPermission('MANAGE_PURCHASES'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const po = await supplierService.createPO(companyId, userId, req.body);
    res.status(201).json(po);
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers/direct-purchase
router.post('/direct-purchase', authenticateToken, checkPermission('MANAGE_PURCHASES'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const bill = await supplierService.createDirectCashPurchase(companyId, userId, req.body);
    res.status(201).json(bill);
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers/direct-credit-purchase
router.post('/direct-credit-purchase', authenticateToken, checkPermission('MANAGE_PURCHASES'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const bill = await supplierService.createDirectCreditPurchase(companyId, userId, req.body);
    res.status(201).json(bill);
  } catch (err) {
    next(err);
  }
});

// PUT /api/suppliers/purchases/:id  (edit Draft / Ordered PO)
router.put('/purchases/:id', authenticateToken, checkPermission('MANAGE_PURCHASES'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const updated = await supplierService.updatePO(req.params.id, companyId, userId, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/suppliers/purchases/:id  (delete Draft / Ordered PO)
router.delete('/purchases/:id', authenticateToken, checkPermission('MANAGE_PURCHASES'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    await supplierService.deletePO(req.params.id, companyId, userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PUT /api/suppliers/purchases/:id/grn
router.put('/purchases/:id/grn', authenticateToken, checkPermission('MANAGE_PURCHASES'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const grn = await supplierService.receivePOStock(req.params.id, companyId, userId, req.body);
    res.json(grn);
  } catch (err) {
    next(err);
  }
});

// PUT /api/suppliers/purchases/:id/invoice
router.put('/purchases/:id/invoice', authenticateToken, checkPermission('MANAGE_PURCHASES'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const invoice = await supplierService.invoicePOBill(req.params.id, companyId, userId, req.body);
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

// Route relocated to top to avoid parameterized route conflict

// POST /api/suppliers/returns
router.post('/returns', authenticateToken, checkPermission('MANAGE_PURCHASES'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const ret = await supplierService.makeSupplierReturn(companyId, userId, req.body);
    res.status(201).json(ret);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/returns/:id
router.get('/returns/:id', authenticateToken, checkPermission('MANAGE_PURCHASES'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const detail = await supplierService.getReturnDetail(req.params.id, companyId);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

// PUT /api/suppliers/returns/:id
router.put('/returns/:id', authenticateToken, checkPermission('MANAGE_PURCHASES'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const updated = await supplierService.updateReturn(req.params.id, companyId, userId, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/suppliers/returns/:id
router.delete('/returns/:id', authenticateToken, checkPermission('MANAGE_PURCHASES'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    await supplierService.deleteReturn(req.params.id, companyId, userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});


// --- LEDGER & PAYMENTS ---

// GET /api/suppliers/ledger/:supplierId
router.get('/ledger/:supplierId', authenticateToken, checkPermission('VIEW_SUPPLIER_FINANCIALS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const ledger = await supplierService.getLedgerTransactions(req.params.supplierId, companyId, req.query);
    res.json(ledger);
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers/payments
router.post('/payments', authenticateToken, checkPermission('VIEW_SUPPLIER_FINANCIALS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const payment = await supplierService.makeSupplierSettlement(companyId, userId, req.body);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers/adjustments
router.post('/adjustments', authenticateToken, checkPermission('VIEW_SUPPLIER_FINANCIALS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const adjustment = await supplierService.makeLedgerAdjustment(companyId, userId, req.body);
    res.status(201).json(adjustment);
  } catch (err) {
    next(err);
  }
});
// POST /api/suppliers/ledger/:supplierId/email
router.post('/ledger/:supplierId/email', authenticateToken, checkPermission('VIEW_SUPPLIER_FINANCIALS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.userId;
    const result = await supplierService.sendStatementEmail(companyId, userId, req.params.supplierId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
