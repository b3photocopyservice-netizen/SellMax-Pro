const db = require('../config/db');

class AdjustmentRepository {

  // ── Reference Number Generation ────────────────────────────────────────────
  async generateReferenceNo(companyId, date) {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const prefix = `ADJ-${yyyy}${mm}${dd}-`;

    const result = await db.query(
      `SELECT COUNT(*) AS cnt FROM dbo.InventoryAdjustments
       WHERE CompanyID = @CompanyID AND ReferenceNo LIKE @Prefix`,
      { CompanyID: companyId, Prefix: prefix + '%' }
    );
    const seq = (result.recordset[0].cnt + 1).toString().padStart(4, '0');
    return prefix + seq;
  }

  // ── Create Adjustment (header + items) ────────────────────────────────────
  async create(data, userId, companyId) {
    const refNo = await this.generateReferenceNo(companyId, data.adjustmentDate);

    // Insert header
    const headerResult = await db.query(
      `INSERT INTO dbo.InventoryAdjustments
         (CompanyID, ReferenceNo, AdjustmentDate, Status, Remarks, CreatedByUserID)
       OUTPUT inserted.*
       VALUES (@CompanyID, @RefNo, @AdjDate, 'Draft', @Remarks, @UserID)`,
      {
        CompanyID: companyId,
        RefNo: refNo,
        AdjDate: new Date(data.adjustmentDate),
        Remarks: data.remarks || null,
        UserID: userId
      }
    );
    const header = headerResult.recordset[0];

    // Insert items
    for (const item of data.items) {
      await db.query(
        `INSERT INTO dbo.InventoryAdjustmentItems
           (AdjustmentID, ProductID, CurrentStock, AdjustedQty, CostPrice, Reason)
         VALUES (@AdjID, @ProductID, @CurrentStock, @AdjQty, @Cost, @Reason)`,
        {
          AdjID: header.AdjustmentID,
          ProductID: item.productId,
          CurrentStock: parseFloat(item.currentStock),
          AdjQty: parseFloat(item.adjustedQty),
          Cost: parseFloat(item.costPrice),
          Reason: item.reason
        }
      );
    }

    return this.getById(header.AdjustmentID, companyId);
  }

  // ── Get All (with joins) ───────────────────────────────────────────────────
  async getAll(companyId, filters = {}) {
    let sql = `
      SELECT
        a.AdjustmentID, a.ReferenceNo, a.AdjustmentDate, a.Status, a.Remarks, a.CreatedAt,
        a.ApprovedAt,
        uc.Username AS CreatedByName,
        ua.Username AS ApprovedByName,
        COUNT(ai.ItemID) AS ItemCount,
        SUM(ABS(ai.AdjustedQty * ai.CostPrice)) AS TotalValue
      FROM dbo.InventoryAdjustments a
      INNER JOIN dbo.Users uc ON a.CreatedByUserID = uc.UserID
      LEFT  JOIN dbo.Users ua ON a.ApprovedByUserID = ua.UserID
      LEFT  JOIN dbo.InventoryAdjustmentItems ai ON ai.AdjustmentID = a.AdjustmentID
      WHERE a.CompanyID = @CompanyID
    `;
    const params = { CompanyID: companyId };

    if (filters.status && filters.status !== 'all') {
      sql += ` AND a.Status = @Status`;
      params.Status = filters.status;
    }
    if (filters.startDate) {
      sql += ` AND a.AdjustmentDate >= @StartDate`;
      params.StartDate = new Date(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND a.AdjustmentDate <= @EndDate`;
      params.EndDate = new Date(filters.endDate);
    }
    if (filters.search) {
      sql += ` AND (a.ReferenceNo LIKE @Search OR uc.Username LIKE @Search)`;
      params.Search = `%${filters.search}%`;
    }

    sql += ` GROUP BY a.AdjustmentID, a.ReferenceNo, a.AdjustmentDate, a.Status, a.Remarks,
               a.CreatedAt, a.ApprovedAt, uc.Username, ua.Username
             ORDER BY a.CreatedAt DESC`;

    const result = await db.query(sql, params);
    return result.recordset;
  }

  // ── Get Single Adjustment with Items ──────────────────────────────────────
  async getById(id, companyId) {
    const headerResult = await db.query(
      `SELECT
         a.*,
         uc.Username AS CreatedByName,
         ua.Username AS ApprovedByName
       FROM dbo.InventoryAdjustments a
       INNER JOIN dbo.Users uc ON a.CreatedByUserID = uc.UserID
       LEFT  JOIN dbo.Users ua ON a.ApprovedByUserID = ua.UserID
       WHERE a.AdjustmentID = @ID AND a.CompanyID = @CompanyID`,
      { ID: id, CompanyID: companyId }
    );
    const header = headerResult.recordset[0];
    if (!header) return null;

    const itemsResult = await db.query(
      `SELECT
         ai.*,
         p.Name AS ProductName,
         p.SKU,
         p.UOM,
         p.Stock AS CurrentProductStock
       FROM dbo.InventoryAdjustmentItems ai
       INNER JOIN dbo.Products p ON ai.ProductID = p.ProductID
       WHERE ai.AdjustmentID = @ID
       ORDER BY ai.ItemID ASC`,
      { ID: id }
    );
    header.Items = itemsResult.recordset;
    return header;
  }

  // ── Approve: update status, apply stock, post journal ────────────────────
  async approve(id, approverUserId, companyId) {
    // Fetch items
    const adj = await this.getById(id, companyId);
    if (!adj) throw new Error('Adjustment not found.');
    if (adj.Status !== 'Draft') throw new Error('Only Draft adjustments can be approved.');

    for (const item of adj.Items) {
      // Apply stock change
      await db.query(
        `UPDATE dbo.Products
         SET Stock = Stock + @AdjQty
         WHERE ProductID = @ProductID AND CompanyID = @CompanyID`,
        { AdjQty: item.AdjustedQty, ProductID: item.ProductID, CompanyID: companyId }
      );

      // Also update batch stock if product is batch-tracked (aggregate recalc is fine)
      // For non-batch products this is the sole stock source.

      // Post journal entries
      const value = Math.abs(item.AdjustedQty * item.CostPrice);
      const isNegative = item.AdjustedQty < 0;
      const description = `Inv Adj ${adj.ReferenceNo}: ${item.ProductName} (${item.AdjustedQty > 0 ? '+' : ''}${item.AdjustedQty} ${item.UOM}) — ${item.Reason}`;

      if (isNegative) {
        // Debit Cost of Sales / Credit Inventory Asset
        await db.query(
          `INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
           VALUES (@CompanyID, 'InventoryAdjustment', @SourceID, @EntryDate, 'Cost of Sales', @Value, 0, @Desc)`,
          { CompanyID: companyId, SourceID: id, EntryDate: new Date(adj.AdjustmentDate), Value: value, Desc: description }
        );
        await db.query(
          `INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
           VALUES (@CompanyID, 'InventoryAdjustment', @SourceID, @EntryDate, 'Inventory Asset', 0, @Value, @Desc)`,
          { CompanyID: companyId, SourceID: id, EntryDate: new Date(adj.AdjustmentDate), Value: value, Desc: description }
        );
      } else {
        // Debit Inventory Asset / Credit Cost of Sales
        await db.query(
          `INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
           VALUES (@CompanyID, 'InventoryAdjustment', @SourceID, @EntryDate, 'Inventory Asset', @Value, 0, @Desc)`,
          { CompanyID: companyId, SourceID: id, EntryDate: new Date(adj.AdjustmentDate), Value: value, Desc: description }
        );
        await db.query(
          `INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
           VALUES (@CompanyID, 'InventoryAdjustment', @SourceID, @EntryDate, 'Cost of Sales', 0, @Value, @Desc)`,
          { CompanyID: companyId, SourceID: id, EntryDate: new Date(adj.AdjustmentDate), Value: value, Desc: description }
        );
      }
    }

    // Mark as Approved
    await db.query(
      `UPDATE dbo.InventoryAdjustments
       SET Status = 'Approved', ApprovedByUserID = @UserID, ApprovedAt = GETDATE()
       WHERE AdjustmentID = @ID AND CompanyID = @CompanyID`,
      { ID: id, UserID: approverUserId, CompanyID: companyId }
    );

    return this.getById(id, companyId);
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  async cancel(id, companyId) {
    await db.query(
      `UPDATE dbo.InventoryAdjustments
       SET Status = 'Cancelled'
       WHERE AdjustmentID = @ID AND CompanyID = @CompanyID AND Status = 'Draft'`,
      { ID: id, CompanyID: companyId }
    );
    return this.getById(id, companyId);
  }

  // ── Report: by product ────────────────────────────────────────────────────
  async getReportByProduct(companyId, productId = null, startDate = null, endDate = null) {
    let sql = `
      SELECT
        p.Name AS ProductName, p.SKU, p.UOM,
        ai.AdjustedQty, ai.CostPrice,
        (ai.AdjustedQty * ai.CostPrice) AS AdjustmentValue,
        ai.Reason,
        a.ReferenceNo, a.AdjustmentDate, a.Status,
        uc.Username AS CreatedByName,
        ua.Username AS ApprovedByName
      FROM dbo.InventoryAdjustmentItems ai
      INNER JOIN dbo.InventoryAdjustments a ON ai.AdjustmentID = a.AdjustmentID
      INNER JOIN dbo.Products p ON ai.ProductID = p.ProductID
      INNER JOIN dbo.Users uc ON a.CreatedByUserID = uc.UserID
      LEFT  JOIN dbo.Users ua ON a.ApprovedByUserID = ua.UserID
      WHERE a.CompanyID = @CompanyID AND a.Status = 'Approved'
    `;
    const params = { CompanyID: companyId };

    if (productId) {
      sql += ` AND ai.ProductID = @ProductID`;
      params.ProductID = productId;
    }
    if (startDate) {
      sql += ` AND a.AdjustmentDate >= @StartDate`;
      params.StartDate = new Date(startDate);
    }
    if (endDate) {
      sql += ` AND a.AdjustmentDate <= @EndDate`;
      params.EndDate = new Date(endDate);
    }
    sql += ` ORDER BY a.AdjustmentDate DESC, a.ReferenceNo`;
    const result = await db.query(sql, params);
    return result.recordset;
  }

  // ── Report: summary by date range (grouped by date) ──────────────────────
  async getSummaryReport(companyId, startDate = null, endDate = null) {
    let sql = `
      SELECT
        a.AdjustmentDate,
        COUNT(DISTINCT a.AdjustmentID) AS AdjustmentCount,
        SUM(CASE WHEN ai.AdjustedQty > 0 THEN ai.AdjustedQty * ai.CostPrice ELSE 0 END) AS PositiveValue,
        SUM(CASE WHEN ai.AdjustedQty < 0 THEN ABS(ai.AdjustedQty * ai.CostPrice) ELSE 0 END) AS NegativeValue,
        SUM(ai.AdjustedQty * ai.CostPrice) AS NetValue
      FROM dbo.InventoryAdjustments a
      INNER JOIN dbo.InventoryAdjustmentItems ai ON ai.AdjustmentID = a.AdjustmentID
      WHERE a.CompanyID = @CompanyID AND a.Status = 'Approved'
    `;
    const params = { CompanyID: companyId };

    if (startDate) { sql += ` AND a.AdjustmentDate >= @StartDate`; params.StartDate = new Date(startDate); }
    if (endDate)   { sql += ` AND a.AdjustmentDate <= @EndDate`;   params.EndDate = new Date(endDate); }

    sql += ` GROUP BY a.AdjustmentDate ORDER BY a.AdjustmentDate DESC`;
    const result = await db.query(sql, params);
    return result.recordset;
  }

  // ── Report: user-wise ─────────────────────────────────────────────────────
  async getUserReport(companyId, startDate = null, endDate = null) {
    let sql = `
      SELECT
        uc.Username AS UserName,
        COUNT(DISTINCT a.AdjustmentID) AS AdjustmentCount,
        SUM(ABS(ai.AdjustedQty * ai.CostPrice)) AS TotalValue
      FROM dbo.InventoryAdjustments a
      INNER JOIN dbo.Users uc ON a.CreatedByUserID = uc.UserID
      INNER JOIN dbo.InventoryAdjustmentItems ai ON ai.AdjustmentID = a.AdjustmentID
      WHERE a.CompanyID = @CompanyID AND a.Status = 'Approved'
    `;
    const params = { CompanyID: companyId };

    if (startDate) { sql += ` AND a.AdjustmentDate >= @StartDate`; params.StartDate = new Date(startDate); }
    if (endDate)   { sql += ` AND a.AdjustmentDate <= @EndDate`;   params.EndDate = new Date(endDate); }

    sql += ` GROUP BY uc.Username ORDER BY TotalValue DESC`;
    const result = await db.query(sql, params);
    return result.recordset;
  }
}

module.exports = new AdjustmentRepository();
