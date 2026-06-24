const db = require('../config/db');

const parseLocalDate = (dateStr, endOfDay = false) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return endOfDay ? new Date(year, month, day, 23, 59, 59, 999) : new Date(year, month, day, 0, 0, 0, 0);
};

class ReportsRepository {
  async getDailySalesSummary(companyId, startDate = null, endDate = null) {
    const params = { CompanyID: companyId };
    
    if (startDate) params.StartDate = parseLocalDate(startDate, false);
    if (endDate) params.EndDate = parseLocalDate(endDate, true);

    const result = await db.executeProcedure('dbo.sp_GetDailySalesSummary', params);
    
    // Result Set 1: Overall Metrics
    const metrics = result.recordsets[0][0] || {
      TotalRevenue: 0,
      TotalSubtotal: 0,
      TotalDiscounts: 0,
      TotalTax: 0,
      TransactionCount: 0,
      AverageTicketSize: 0
    };

    // Result Set 2: Payment Methods breakdown
    const paymentMethods = result.recordsets[1] || [];

    return {
      metrics,
      paymentMethods
    };
  }

  async getProductPerformance(companyId, startDate = null, endDate = null, limit = 10) {
    const params = { CompanyID: companyId };
    
    if (startDate) params.StartDate = parseLocalDate(startDate, false);
    if (endDate) params.EndDate = parseLocalDate(endDate, true);
    if (limit) params.Limit = parseInt(limit, 10);

    const result = await db.executeProcedure('dbo.sp_GetProductPerformance', params);
    return result.recordset;
  }

  async getLowStockAlerts(companyId) {
    const result = await db.executeProcedure('dbo.sp_GetLowStockAlerts', { CompanyID: companyId });
    return result.recordset;
  }

  async getCustomerLoyaltyStatement(companyId) {
    const result = await db.executeProcedure('dbo.sp_GetCustomerLoyaltyStatement', { CompanyID: companyId });
    return result.recordset;
  }

  async getExpiryReport(companyId) {
    const sqlQuery = `
      SELECT pb.*, p.Name AS ProductName, p.UOM, p.Stock AS TotalStock,
             DATEDIFF(day, GETDATE(), pb.ExpiryDate) AS DaysRemaining
      FROM dbo.ProductBatches pb
      INNER JOIN dbo.Products p ON pb.ProductID = p.ProductID
      WHERE pb.CompanyID = @CompanyID
      ORDER BY pb.ExpiryDate ASC
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId });
    return result.recordset;
  }

  async getPriceOverridesLog(companyId, startDate = null, endDate = null) {
    let sqlQuery = `
      SELECT po.*, 
             p.Name AS ProductName, p.SKU, p.Barcode,
             u.Username AS CashierName,
             m.Username AS ManagerName
      FROM dbo.PriceOverrides po
      INNER JOIN dbo.Products p ON po.ProductID = p.ProductID
      INNER JOIN dbo.Users u ON po.UserID = u.UserID
      LEFT JOIN dbo.Users m ON po.ApprovedByUserID = m.UserID
      WHERE p.CompanyID = @CompanyID
    `;
    const params = { CompanyID: companyId };

    if (startDate && endDate) {
      sqlQuery += ` AND po.CreatedAt BETWEEN @StartDate AND @EndDate`;
      params.StartDate = parseLocalDate(startDate, false);
      params.EndDate = parseLocalDate(endDate, true);
    }

    sqlQuery += ` ORDER BY po.CreatedAt DESC`;

    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  async getStockMovement(companyId, filters = {}) {
    const params = { CompanyID: companyId };

    if (filters.productId)   params.ProductID  = parseInt(filters.productId, 10);
    if (filters.categoryId)  params.CategoryID = parseInt(filters.categoryId, 10);
    if (filters.supplierId)  params.SupplierID = parseInt(filters.supplierId, 10);
    if (filters.startDate)   params.StartDate  = parseLocalDate(filters.startDate, false);
    if (filters.endDate)     params.EndDate    = parseLocalDate(filters.endDate, true);

    const productCond = [
      filters.productId  ? 'p.ProductID = @ProductID'   : '',
      filters.categoryId ? 'p.CategoryID = @CategoryID' : '',
    ].filter(Boolean).map(c => ' AND ' + c).join('');

    const supplierCond  = filters.supplierId ? ' AND po.SupplierID = @SupplierID'  : '';
    const supplierCondSR = filters.supplierId ? ' AND sr.SupplierID = @SupplierID' : '';

    const dateFilter = (col) => {
      let s = '';
      if (filters.startDate) s += ` AND ${col} >= @StartDate`;
      if (filters.endDate)   s += ` AND ${col} <= @EndDate`;
      return s;
    };

    const tt = filters.transactionType || '';
    const txFilter = (allowed) => (!tt || allowed.includes(tt)) ? '' : ' AND 1=0';

    const sql = `
      -- 1. Sales (stock out) and Sales Returns (stock in)
      SELECT
        so.OrderDate AS TxDate,
        'SM-' + CAST(so.OrderID AS NVARCHAR) AS RefNo,
        CASE WHEN so.Status IN ('Refunded','Exchanged') THEN 'Sales Return' ELSE 'Sale' END AS TxType,
        CASE WHEN so.Status IN ('Refunded','Exchanged') THEN 'Sales Return' ELSE 'Sales' END AS Description,
        ISNULL(c.Name, 'Walk-in Customer') AS Party,
        CASE WHEN so.Status IN ('Refunded','Exchanged') THEN oi.Quantity ELSE 0 END AS StockIn,
        CASE WHEN so.Status IN ('Refunded','Exchanged') THEN 0 ELSE oi.Quantity END AS StockOut,
        p.ProductID, p.Name AS ProductName, p.SKU, p.UOM,
        cat.Name AS CategoryName,
        NULL AS WarehouseName
      FROM dbo.SalesOrders so
      INNER JOIN dbo.OrderItems oi ON so.OrderID = oi.OrderID
      INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
      INNER JOIN dbo.Categories cat ON p.CategoryID = cat.CategoryID
      LEFT  JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
      WHERE so.CompanyID = @CompanyID
        AND so.Status NOT IN ('Held')
        ${productCond}
        ${dateFilter('so.OrderDate')}
        ${filters.supplierId ? 'AND 1=0' : ''}
        ${txFilter(['Sale','Sales Return'])}

      UNION ALL

      -- 2. Purchases / GRN (stock in)
      SELECT
        po.OrderDate AS TxDate,
        ISNULL(NULLIF(po.GRNNumber,''), po.PONumber) AS RefNo,
        'Purchase' AS TxType,
        'Purchase' AS Description,
        ISNULL(s.SupplierName,'—') AS Party,
        poi.ReceivedQty AS StockIn,
        0 AS StockOut,
        p.ProductID, p.Name AS ProductName, p.SKU, p.UOM,
        cat.Name AS CategoryName,
        poi.WarehouseName AS WarehouseName
      FROM dbo.PurchaseOrders po
      INNER JOIN dbo.PurchaseOrderItems poi ON po.PurchaseOrderID = poi.PurchaseOrderID
      INNER JOIN dbo.Products p ON poi.ProductID = p.ProductID
      INNER JOIN dbo.Categories cat ON p.CategoryID = cat.CategoryID
      LEFT  JOIN dbo.Suppliers s ON po.SupplierID = s.SupplierID
      WHERE po.CompanyID = @CompanyID
        AND po.Status IN ('Received','Invoiced','Partially Received')
        AND poi.ReceivedQty > 0
        ${productCond}
        ${supplierCond}
        ${dateFilter('po.OrderDate')}
        ${txFilter(['Purchase'])}

      UNION ALL

      -- 3. Supplier Returns (stock out)
      SELECT
        sr.ReturnDate AS TxDate,
        sr.ReturnNumber AS RefNo,
        'Purchase Return' AS TxType,
        'Purchase Return' AS Description,
        ISNULL(s.SupplierName,'—') AS Party,
        0 AS StockIn,
        sri.Quantity AS StockOut,
        p.ProductID, p.Name AS ProductName, p.SKU, p.UOM,
        cat.Name AS CategoryName,
        NULL AS WarehouseName
      FROM dbo.SupplierReturns sr
      INNER JOIN dbo.SupplierReturnItems sri ON sr.ReturnID = sri.ReturnID
      INNER JOIN dbo.Products p ON sri.ProductID = p.ProductID
      INNER JOIN dbo.Categories cat ON p.CategoryID = cat.CategoryID
      LEFT  JOIN dbo.Suppliers s ON sr.SupplierID = s.SupplierID
      WHERE sr.CompanyID = @CompanyID
        ${productCond}
        ${supplierCondSR}
        ${dateFilter('sr.ReturnDate')}
        ${txFilter(['Purchase Return'])}

      UNION ALL

      -- 4. Inventory Adjustments (approved only)
      SELECT
        adj.AdjustmentDate AS TxDate,
        adj.ReferenceNo AS RefNo,
        'Stock Adjustment' AS TxType,
        ISNULL(iai.Reason, 'Stock Adjustment') AS Description,
        ISNULL(u.Username,'System') AS Party,
        CASE WHEN iai.AdjustedQty > 0 THEN ABS(iai.AdjustedQty) ELSE 0 END AS StockIn,
        CASE WHEN iai.AdjustedQty < 0 THEN ABS(iai.AdjustedQty) ELSE 0 END AS StockOut,
        p.ProductID, p.Name AS ProductName, p.SKU, p.UOM,
        cat.Name AS CategoryName,
        NULL AS WarehouseName
      FROM dbo.InventoryAdjustments adj
      INNER JOIN dbo.InventoryAdjustmentItems iai ON adj.AdjustmentID = iai.AdjustmentID
      INNER JOIN dbo.Products p ON iai.ProductID = p.ProductID
      INNER JOIN dbo.Categories cat ON p.CategoryID = cat.CategoryID
      LEFT  JOIN dbo.Users u ON adj.ApprovedByUserID = u.UserID
      WHERE adj.CompanyID = @CompanyID
        AND adj.Status = 'Approved'
        ${productCond}
        ${dateFilter('adj.AdjustmentDate')}
        ${filters.supplierId ? 'AND 1=0' : ''}
        ${txFilter(['Stock Adjustment'])}

      ORDER BY TxDate ASC, RefNo ASC
    `;

    const result = await db.query(sql, params);
    const rows = result.recordset;

    // Compute running balance per product
    const balances = {};
    return rows.map(r => {
      const pid = r.ProductID;
      if (balances[pid] === undefined) balances[pid] = 0;
      balances[pid] += (parseFloat(r.StockIn || 0) - parseFloat(r.StockOut || 0));
      return { ...r, RunningBalance: parseFloat(balances[pid].toFixed(3)) };
    });
  }

  async getSalesReturnsReport(companyId, filters = {}) {
    let sqlQuery = `
      SELECT so.OrderID AS ReturnOrderID, so.OrderDate AS ReturnDate, so.ParentOrderID AS OriginalOrderID, 
             c.Name AS CustomerName, u.Username AS CashierName,
             ABS(so.Subtotal) AS Subtotal, ABS(so.DiscountAmount) AS DiscountAmount, ABS(so.TaxAmount) AS TaxAmount, ABS(so.TotalAmount) AS TotalAmount,
             CASE WHEN so.Status = 'Exchange-Return' THEN 'Exchange' ELSE 'Refund' END AS ReturnType
      FROM dbo.SalesOrders so
      LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
      LEFT JOIN dbo.Users u ON so.UserID = u.UserID
      WHERE so.CompanyID = @CompanyID AND so.Status IN ('Refunded', 'Exchange-Return')
    `;
    const params = { CompanyID: companyId };

    if (filters.startDate) {
      sqlQuery += ` AND so.OrderDate >= @StartDate`;
      params.StartDate = parseLocalDate(filters.startDate, false);
    }
    if (filters.endDate) {
      sqlQuery += ` AND so.OrderDate <= @EndDate`;
      params.EndDate = parseLocalDate(filters.endDate, true);
    }

    sqlQuery += ` ORDER BY so.OrderDate DESC`;
    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  async getRefundsReport(companyId, filters = {}) {
    let sqlQuery = `
      SELECT so.OrderID AS ReturnOrderID, so.OrderDate AS ReturnDate, so.ParentOrderID AS OriginalOrderID,
             c.Name AS CustomerName, u.Username AS CashierName, ABS(so.TotalAmount) AS RefundedAmount,
             ISNULL((SELECT STRING_AGG(Method, ', ') FROM dbo.OrderPayments WHERE OrderID = so.OrderID), 'Cash') AS RefundMethods
      FROM dbo.SalesOrders so
      LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
      LEFT JOIN dbo.Users u ON so.UserID = u.UserID
      WHERE so.CompanyID = @CompanyID AND so.Status = 'Refunded'
    `;
    const params = { CompanyID: companyId };

    if (filters.startDate) {
      sqlQuery += ` AND so.OrderDate >= @StartDate`;
      params.StartDate = parseLocalDate(filters.startDate, false);
    }
    if (filters.endDate) {
      sqlQuery += ` AND so.OrderDate <= @EndDate`;
      params.EndDate = parseLocalDate(filters.endDate, true);
    }

    sqlQuery += ` ORDER BY so.OrderDate DESC`;
    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  async getExchangesReport(companyId, filters = {}) {
    let sqlQuery = `
      SELECT so.OrderID AS ReturnOrderID, so.OrderDate AS ReturnDate, so.ParentOrderID AS OriginalOrderID,
             new_so.OrderID AS NewOrderID, c.Name AS CustomerName, u.Username AS CashierName,
             ABS(so.TotalAmount) AS ReturnValue
      FROM dbo.SalesOrders so
      LEFT JOIN dbo.SalesOrders new_so ON so.OrderID = new_so.ParentOrderID AND new_so.Status = 'Exchange-Purchase'
      LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
      LEFT JOIN dbo.Users u ON so.UserID = u.UserID
      WHERE so.CompanyID = @CompanyID AND so.Status = 'Exchange-Return'
    `;
    const params = { CompanyID: companyId };

    if (filters.startDate) {
      sqlQuery += ` AND so.OrderDate >= @StartDate`;
      params.StartDate = parseLocalDate(filters.startDate, false);
    }
    if (filters.endDate) {
      sqlQuery += ` AND so.OrderDate <= @EndDate`;
      params.EndDate = parseLocalDate(filters.endDate, true);
    }

    sqlQuery += ` ORDER BY so.OrderDate DESC`;
    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  async getExchangeSettlementsReport(companyId, filters = {}) {
    let sqlQuery = `
      SELECT so.OrderID AS NewOrderID, so.OrderDate AS SaleDate, so.ParentOrderID AS ReturnOrderID,
             c.Name AS CustomerName, u.Username AS CashierName,
             so.TotalAmount AS NewInvoiceTotal,
             ABS(ISNULL((SELECT SUM(Amount) FROM dbo.OrderPayments WHERE OrderID = so.OrderID AND Method = 'Exchange Set-off'), 0)) AS ExchangeOffset,
             (so.TotalAmount - ABS(ISNULL((SELECT SUM(Amount) FROM dbo.OrderPayments WHERE OrderID = so.OrderID AND Method = 'Exchange Set-off'), 0))) AS NetSettlement,
             ISNULL((SELECT STRING_AGG(Method + ': ' + CAST(Amount AS NVARCHAR(20)), ', ') FROM dbo.OrderPayments WHERE OrderID = so.OrderID AND Method <> 'Exchange Set-off'), '—') AS SettlementModes
      FROM dbo.SalesOrders so
      LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
      LEFT JOIN dbo.Users u ON so.UserID = u.UserID
      WHERE so.CompanyID = @CompanyID AND so.Status = 'Exchange-Purchase'
    `;
    const params = { CompanyID: companyId };

    if (filters.startDate) {
      sqlQuery += ` AND so.OrderDate >= @StartDate`;
      params.StartDate = parseLocalDate(filters.startDate, false);
    }
    if (filters.endDate) {
      sqlQuery += ` AND so.OrderDate <= @EndDate`;
      params.EndDate = parseLocalDate(filters.endDate, true);
    }

    sqlQuery += ` ORDER BY so.OrderDate DESC`;
    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }
}

module.exports = new ReportsRepository();
