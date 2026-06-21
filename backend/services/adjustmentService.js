const adjustmentRepository = require('../repositories/adjustmentRepository');
const productRepository = require('../repositories/productRepository');

class AdjustmentService {

  // ── Create Draft Adjustment ───────────────────────────────────────────────
  async createAdjustment(data, userId, companyId) {
    if (!data.adjustmentDate) throw new Error('Adjustment date is required.');
    if (!data.items || data.items.length === 0) throw new Error('At least one product item is required.');

    // Validate items
    for (const item of data.items) {
      if (!item.productId) throw new Error('Each item must have a product selected.');
      const product = await productRepository.getById(item.productId, companyId);
      if (!product) throw new Error(`Product ID ${item.productId} not found.`);

      const adjQty = parseFloat(item.adjustedQty);
      if (isNaN(adjQty) || adjQty === 0) {
        throw new Error(`Adjusted quantity for '${product.Name}' must be a non-zero number.`);
      }
      if (!item.reason || item.reason.trim() === '') {
        throw new Error(`Reason is required for product '${product.Name}'.`);
      }

      // Snapshot current stock & cost from product
      item.currentStock = product.Stock;
      item.costPrice = product.Cost;
    }

    return await adjustmentRepository.create(data, userId, companyId);
  }

  // ── Get All Adjustments ───────────────────────────────────────────────────
  async getAdjustments(companyId, filters = {}) {
    return await adjustmentRepository.getAll(companyId, filters);
  }

  // ── Get Adjustment By ID ──────────────────────────────────────────────────
  async getAdjustmentById(id, companyId) {
    const adj = await adjustmentRepository.getById(id, companyId);
    if (!adj) throw new Error('Adjustment not found.');
    return adj;
  }

  // ── Approve Adjustment ────────────────────────────────────────────────────
  async approveAdjustment(id, approverUserId, companyId) {
    const adj = await adjustmentRepository.getById(id, companyId);
    if (!adj) throw new Error('Adjustment not found.');
    if (adj.Status !== 'Draft') {
      throw new Error(`Cannot approve an adjustment with status '${adj.Status}'.`);
    }
    return await adjustmentRepository.approve(id, approverUserId, companyId);
  }

  // ── Cancel Adjustment ─────────────────────────────────────────────────────
  async cancelAdjustment(id, companyId) {
    const adj = await adjustmentRepository.getById(id, companyId);
    if (!adj) throw new Error('Adjustment not found.');
    if (adj.Status !== 'Draft') {
      throw new Error(`Cannot cancel an adjustment with status '${adj.Status}'.`);
    }
    return await adjustmentRepository.cancel(id, companyId);
  }

  // ── Reports ───────────────────────────────────────────────────────────────
  async getReportByProduct(companyId, productId, startDate, endDate) {
    return await adjustmentRepository.getReportByProduct(companyId, productId, startDate, endDate);
  }

  async getSummaryReport(companyId, startDate, endDate) {
    return await adjustmentRepository.getSummaryReport(companyId, startDate, endDate);
  }

  async getUserReport(companyId, startDate, endDate) {
    return await adjustmentRepository.getUserReport(companyId, startDate, endDate);
  }
}

module.exports = new AdjustmentService();
