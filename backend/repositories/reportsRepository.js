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

  async getSalesAnalysisReport(companyId, filters = {}) {
    const params = {
      CompanyID: companyId,
      StartDate: filters.startDate ? parseLocalDate(filters.startDate, false) : null,
      EndDate: filters.endDate ? parseLocalDate(filters.endDate, true) : null,
      BranchName: filters.branchName || null
    };

    let sqlQuery = '';

    switch (filters.reportType) {
      case 'sales-reports':
        sqlQuery = `
          SELECT so.OrderID, so.OrderDate, c.Name AS CustomerName, u.Username AS CashierName,
                 so.Subtotal, so.DiscountAmount, so.TaxAmount, so.TotalAmount, so.Status
          FROM dbo.SalesOrders so
          LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
          LEFT JOIN dbo.Users u ON so.UserID = u.UserID
          WHERE so.CompanyID = @CompanyID
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          ORDER BY so.OrderDate DESC
        `;
        break;

      case 'daily-sales-summary':
        sqlQuery = `
          SELECT CONVERT(varchar, so.OrderDate, 23) AS DateStr,
                 COUNT(so.OrderID) AS InvoiceCount,
                 SUM(so.Subtotal) AS Subtotal,
                 SUM(so.DiscountAmount) AS DiscountAmount,
                 SUM(so.TaxAmount) AS TaxAmount,
                 SUM(so.TotalAmount) AS TotalAmount
          FROM dbo.SalesOrders so
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          GROUP BY CONVERT(varchar, so.OrderDate, 23)
          ORDER BY DateStr DESC
        `;
        break;

      case 'monthly-sales-summary':
        sqlQuery = `
          SELECT FORMAT(so.OrderDate, 'yyyy-MM') AS MonthStr,
                 COUNT(so.OrderID) AS InvoiceCount,
                 SUM(so.Subtotal) AS Subtotal,
                 SUM(so.DiscountAmount) AS DiscountAmount,
                 SUM(so.TaxAmount) AS TaxAmount,
                 SUM(so.TotalAmount) AS TotalAmount
          FROM dbo.SalesOrders so
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          GROUP BY FORMAT(so.OrderDate, 'yyyy-MM')
          ORDER BY MonthStr DESC
        `;
        break;

      case 'sales-by-item':
        sqlQuery = `
          SELECT p.ProductID, p.Name AS ProductName, p.SKU,
                 SUM(oi.Quantity) AS QuantitySold,
                 SUM(oi.Subtotal) AS TotalAmount
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          GROUP BY p.ProductID, p.Name, p.SKU
          ORDER BY TotalAmount DESC
        `;
        break;

      case 'sales-by-category':
        sqlQuery = `
          SELECT cat.CategoryID, cat.Name AS CategoryName,
                 SUM(oi.Quantity) AS QuantitySold,
                 SUM(oi.Subtotal) AS TotalAmount
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          INNER JOIN dbo.Categories cat ON p.CategoryID = cat.CategoryID
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          GROUP BY cat.CategoryID, cat.Name
          ORDER BY TotalAmount DESC
        `;
        break;

      case 'sales-by-brand':
        sqlQuery = `
          SELECT ISNULL(NULLIF(p.Brand, ''), 'No Brand') AS Brand,
                 SUM(oi.Quantity) AS QuantitySold,
                 SUM(oi.Subtotal) AS TotalAmount
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          GROUP BY ISNULL(NULLIF(p.Brand, ''), 'No Brand')
          ORDER BY TotalAmount DESC
        `;
        break;

      case 'sales-by-customer':
        sqlQuery = `
          SELECT c.CustomerID, ISNULL(c.Name, 'Walk-in Customer') AS CustomerName, c.Phone,
                 COUNT(DISTINCT so.OrderID) AS InvoiceCount,
                 SUM(so.Subtotal) AS Subtotal,
                 SUM(so.DiscountAmount) AS DiscountAmount,
                 SUM(so.TaxAmount) AS TaxAmount,
                 SUM(so.TotalAmount) AS TotalAmount
          FROM dbo.SalesOrders so
          LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          GROUP BY c.CustomerID, ISNULL(c.Name, 'Walk-in Customer'), c.Phone
          ORDER BY TotalAmount DESC
        `;
        break;

      case 'sales-by-salesperson':
        sqlQuery = `
          SELECT u.UserID, u.Username AS SalespersonName,
                 COUNT(so.OrderID) AS InvoiceCount,
                 SUM(so.Subtotal) AS Subtotal,
                 SUM(so.DiscountAmount) AS DiscountAmount,
                 SUM(so.TaxAmount) AS TaxAmount,
                 SUM(so.TotalAmount) AS TotalAmount
          FROM dbo.SalesOrders so
          INNER JOIN dbo.Users u ON so.UserID = u.UserID
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          GROUP BY u.UserID, u.Username
          ORDER BY TotalAmount DESC
        `;
        break;

      case 'sales-by-payment-method':
        sqlQuery = `
          SELECT op.Method AS PaymentMethod,
                 COUNT(DISTINCT so.OrderID) AS InvoiceCount,
                 SUM(op.Amount) AS TotalAmount
          FROM dbo.OrderPayments op
          INNER JOIN dbo.SalesOrders so ON op.OrderID = so.OrderID
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          GROUP BY op.Method
          ORDER BY TotalAmount DESC
        `;
        break;

      case 'sales-by-branch-warehouse':
        sqlQuery = `
          SELECT ISNULL(NULLIF(pb.WarehouseName, ''), 'Main Store') AS BranchWarehouse,
                 SUM(oi.Quantity) AS QuantitySold,
                 SUM(oi.Subtotal) AS TotalAmount
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
            AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
          GROUP BY ISNULL(NULLIF(pb.WarehouseName, ''), 'Main Store')
          ORDER BY TotalAmount DESC
        `;
        break;

      case 'sales-by-hour':
        sqlQuery = `
          SELECT DATEPART(hour, so.OrderDate) AS Hour,
                 COUNT(so.OrderID) AS InvoiceCount,
                 SUM(so.TotalAmount) AS TotalAmount
          FROM dbo.SalesOrders so
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          GROUP BY DATEPART(hour, so.OrderDate)
          ORDER BY Hour ASC
        `;
        break;

      case 'top-selling':
        sqlQuery = `
          SELECT TOP 20 p.ProductID, p.Name AS ProductName, p.SKU,
                 SUM(oi.Quantity) AS QuantitySold,
                 SUM(oi.Subtotal) AS TotalAmount
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          GROUP BY p.ProductID, p.Name, p.SKU
          ORDER BY QuantitySold DESC
        `;
        break;

      case 'slow-moving':
        sqlQuery = `
          SELECT TOP 20 p.ProductID, p.Name AS ProductName, p.SKU,
                 ISNULL(SUM(oi.Quantity), 0) AS QuantitySold,
                 ISNULL(SUM(oi.Subtotal), 0) AS TotalAmount
          FROM dbo.Products p
          LEFT JOIN dbo.OrderItems oi ON p.ProductID = oi.ProductID
          LEFT JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          WHERE p.CompanyID = @CompanyID AND p.IsActive = 1
          GROUP BY p.ProductID, p.Name, p.SKU
          ORDER BY QuantitySold ASC, p.Name ASC
        `;
        break;

      case 'sales-return':
        sqlQuery = `
          SELECT so.OrderID AS ReturnOrderID, so.OrderDate AS ReturnDate, so.ParentOrderID AS OriginalOrderID, 
                 c.Name AS CustomerName, u.Username AS CashierName,
                 ABS(so.Subtotal) AS Subtotal, ABS(so.DiscountAmount) AS DiscountAmount, ABS(so.TaxAmount) AS TaxAmount, ABS(so.TotalAmount) AS TotalAmount,
                 CASE WHEN so.Status = 'Exchange-Return' THEN 'Exchange' ELSE 'Refund' END AS ReturnType
          FROM dbo.SalesOrders so
          LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
          LEFT JOIN dbo.Users u ON so.UserID = u.UserID
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Refunded', 'Exchange-Return')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          ORDER BY so.OrderDate DESC
        `;
        break;

      case 'discount-report':
        sqlQuery = `
          SELECT so.OrderID, so.OrderDate, c.Name AS CustomerName,
                 so.Subtotal AS OriginalSubtotal,
                 so.DiscountAmount AS DiscountGiven,
                 so.TotalAmount AS NetTotal,
                 CASE WHEN so.Subtotal > 0 THEN (so.DiscountAmount / so.Subtotal) * 100 ELSE 0 END AS DiscountPercentage
          FROM dbo.SalesOrders so
          LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND so.DiscountAmount > 0
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          ORDER BY so.DiscountAmount DESC
        `;
        break;

      case 'tax-vat-report':
        sqlQuery = `
          SELECT so.OrderID, so.OrderDate,
                 so.Subtotal AS NetSales,
                 so.TaxAmount AS TaxVAT,
                 so.TotalAmount AS GrossSales
          FROM dbo.SalesOrders so
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          ORDER BY so.OrderDate DESC
        `;
        break;

      case 'credit-sales-report':
        sqlQuery = `
          SELECT so.OrderID, so.OrderDate, c.Name AS CustomerName, c.Phone,
                 so.TotalAmount AS InvoiceTotal,
                 (ISNULL(op.CreditAmount, 0) + ISNULL(refunds.RefundCreditAmount, 0)) AS OriginalCreditAmount,
                 ISNULL(alloc.PaidAmount, 0) AS PaidAmount,
                 ((ISNULL(op.CreditAmount, 0) + ISNULL(refunds.RefundCreditAmount, 0)) - ISNULL(alloc.PaidAmount, 0)) AS BalanceAmount
          FROM dbo.SalesOrders so
          INNER JOIN (
              SELECT OrderID, SUM(Amount) AS CreditAmount
              FROM dbo.OrderPayments
              WHERE Method = 'Credit'
              GROUP BY OrderID
          ) op ON so.OrderID = op.OrderID
          LEFT JOIN (
              SELECT so2.ParentOrderID, SUM(op2.Amount) AS RefundCreditAmount
              FROM dbo.SalesOrders so2
              INNER JOIN dbo.OrderPayments op2 ON so2.OrderID = op2.OrderID
              WHERE so2.ParentOrderID IS NOT NULL AND op2.Method = 'Credit' AND so2.Status <> 'Cancelled'
              GROUP BY so2.ParentOrderID
          ) refunds ON so.OrderID = refunds.ParentOrderID
          LEFT JOIN (
              SELECT OrderID, SUM(AllocatedAmount) AS PaidAmount
              FROM dbo.CustomerPaymentAllocations
              GROUP BY OrderID
          ) alloc ON so.OrderID = alloc.OrderID
          LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
          ORDER BY so.OrderDate DESC
        `;
        break;

      default:
        throw new Error('Unsupported sales analysis report type.');
    }

    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  async getProfitAnalysisReport(companyId, filters = {}) {
    const params = {
      CompanyID: companyId,
      StartDate: filters.startDate ? parseLocalDate(filters.startDate, false) : null,
      EndDate: filters.endDate ? parseLocalDate(filters.endDate, true) : null,
      ProductID: filters.productId ? parseInt(filters.productId, 10) : null,
      CategoryID: filters.categoryId ? parseInt(filters.categoryId, 10) : null,
      Brand: filters.brand || null,
      CustomerID: filters.customerId ? parseInt(filters.customerId, 10) : null,
      UserID: filters.userId ? parseInt(filters.userId, 10) : null,
      BranchName: filters.branchName || null
    };

    let sqlQuery = '';

    switch (filters.reportType) {
      case 'gross-profit-summary':
        sqlQuery = `
          SELECT CONVERT(varchar, so.OrderDate, 23) AS DateStr,
                 SUM(oi.Subtotal) AS TotalSales,
                 SUM(CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) AS DiscountAmount,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) AS NetSales,
                 SUM(oi.Quantity * oi.Cost) AS CostOfSales,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit,
                 CASE WHEN SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) > 0
                      THEN (SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) /
                            SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END))) * 100
                      ELSE 0 END AS GrossProfitPercent
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
            AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
            AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
            AND (@Brand IS NULL OR p.Brand = @Brand)
            AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
            AND (@UserID IS NULL OR so.UserID = @UserID)
            AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
          GROUP BY CONVERT(varchar, so.OrderDate, 23)
          ORDER BY DateStr DESC
        `;
        break;

      case 'profit-by-item':
        sqlQuery = `
          SELECT p.ProductID, p.Name AS ProductName, p.SKU, cat.Name AS CategoryName, p.Brand,
                 SUM(oi.Quantity) AS QuantitySold,
                 SUM(oi.Subtotal) AS TotalRevenue,
                 SUM(oi.Quantity * oi.Cost) AS CostOfSales,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit,
                 CASE WHEN SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) > 0 
                      THEN (SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) / 
                            SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END))) * 100 
                      ELSE 0 END AS GrossProfitPercent
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          LEFT JOIN dbo.Categories cat ON p.CategoryID = cat.CategoryID
          LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
            AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
            AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
            AND (@Brand IS NULL OR p.Brand = @Brand)
            AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
            AND (@UserID IS NULL OR so.UserID = @UserID)
            AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
          GROUP BY p.ProductID, p.Name, p.SKU, cat.Name, p.Brand
          ORDER BY GrossProfit DESC
        `;
        break;

      case 'profit-by-category':
        sqlQuery = `
          SELECT cat.CategoryID, cat.Name AS CategoryName,
                 SUM(oi.Quantity) AS QuantitySold,
                 SUM(oi.Subtotal) AS TotalRevenue,
                 SUM(oi.Quantity * oi.Cost) AS CostOfSales,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit,
                 CASE WHEN SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) > 0 
                      THEN (SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) / 
                            SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END))) * 100 
                      ELSE 0 END AS GrossProfitPercent
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          INNER JOIN dbo.Categories cat ON p.CategoryID = cat.CategoryID
          LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
            AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
            AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
            AND (@Brand IS NULL OR p.Brand = @Brand)
            AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
            AND (@UserID IS NULL OR so.UserID = @UserID)
            AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
          GROUP BY cat.CategoryID, cat.Name
          ORDER BY GrossProfit DESC
        `;
        break;

      case 'profit-by-brand':
        sqlQuery = `
          SELECT ISNULL(NULLIF(p.Brand, ''), 'No Brand') AS Brand,
                 SUM(oi.Quantity) AS QuantitySold,
                 SUM(oi.Subtotal) AS TotalRevenue,
                 SUM(oi.Quantity * oi.Cost) AS CostOfSales,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit,
                 CASE WHEN SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) > 0 
                      THEN (SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) / 
                            SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END))) * 100 
                      ELSE 0 END AS GrossProfitPercent
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
            AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
            AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
            AND (@Brand IS NULL OR p.Brand = @Brand)
            AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
            AND (@UserID IS NULL OR so.UserID = @UserID)
            AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
          GROUP BY ISNULL(NULLIF(p.Brand, ''), 'No Brand')
          ORDER BY GrossProfit DESC
        `;
        break;

      case 'profit-by-customer':
        sqlQuery = `
          SELECT c.CustomerID, ISNULL(c.Name, 'Walk-in Customer') AS CustomerName, c.Phone,
                 COUNT(DISTINCT so.OrderID) AS InvoiceCount,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) AS NetSales,
                 SUM(oi.Quantity * oi.Cost) AS CostOfSales,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit,
                 CASE WHEN SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) > 0 
                      THEN (SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) / 
                            SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END))) * 100 
                      ELSE 0 END AS GrossProfitPercent
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
            AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
            AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
            AND (@Brand IS NULL OR p.Brand = @Brand)
            AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
            AND (@UserID IS NULL OR so.UserID = @UserID)
            AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
          GROUP BY c.CustomerID, ISNULL(c.Name, 'Walk-in Customer'), c.Phone
          ORDER BY GrossProfit DESC
        `;
        break;

      case 'profit-by-salesperson':
        sqlQuery = `
          SELECT u.UserID, u.Username AS SalespersonName,
                 COUNT(DISTINCT so.OrderID) AS InvoiceCount,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) AS NetSales,
                 SUM(oi.Quantity * oi.Cost) AS CostOfSales,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit,
                 CASE WHEN SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) > 0 
                      THEN (SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) / 
                            SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END))) * 100 
                      ELSE 0 END AS GrossProfitPercent
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          INNER JOIN dbo.Users u ON so.UserID = u.UserID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
            AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
            AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
            AND (@Brand IS NULL OR p.Brand = @Brand)
            AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
            AND (@UserID IS NULL OR so.UserID = @UserID)
            AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
          GROUP BY u.UserID, u.Username
          ORDER BY GrossProfit DESC
        `;
        break;

      case 'profit-by-invoice':
        sqlQuery = `
          SELECT so.OrderID, so.OrderDate, ISNULL(c.Name, 'Walk-in Customer') AS CustomerName,
                 SUM(oi.Subtotal) AS TotalSales,
                 SUM(CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) AS DiscountAmount,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) AS NetSales,
                 SUM(oi.Quantity * oi.Cost) AS CostOfSales,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit,
                 CASE WHEN SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) > 0 
                      THEN (SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) / 
                            SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END))) * 100 
                      ELSE 0 END AS GrossProfitPercent
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
            AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
            AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
            AND (@Brand IS NULL OR p.Brand = @Brand)
            AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
            AND (@UserID IS NULL OR so.UserID = @UserID)
            AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
          GROUP BY so.OrderID, so.OrderDate, ISNULL(c.Name, 'Walk-in Customer')
          ORDER BY so.OrderDate DESC
        `;
        break;

      case 'top-profitable-items':
        sqlQuery = `
          SELECT TOP 20 p.ProductID, p.Name AS ProductName, p.SKU, cat.Name AS CategoryName, p.Brand,
                 SUM(oi.Quantity) AS QuantitySold,
                 SUM(oi.Subtotal) AS TotalRevenue,
                 SUM(oi.Quantity * oi.Cost) AS CostOfSales,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit,
                 CASE WHEN SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) > 0 
                      THEN (SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) / 
                            SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END))) * 100 
                      ELSE 0 END AS GrossProfitPercent
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          LEFT JOIN dbo.Categories cat ON p.CategoryID = cat.CategoryID
          LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
            AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
            AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
            AND (@Brand IS NULL OR p.Brand = @Brand)
            AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
            AND (@UserID IS NULL OR so.UserID = @UserID)
            AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
          GROUP BY p.ProductID, p.Name, p.SKU, cat.Name, p.Brand
          ORDER BY GrossProfit DESC
        `;
        break;

      case 'lowest-profitable-items':
        sqlQuery = `
          SELECT TOP 20 p.ProductID, p.Name AS ProductName, p.SKU, cat.Name AS CategoryName, p.Brand,
                 SUM(oi.Quantity) AS QuantitySold,
                 SUM(oi.Subtotal) AS TotalRevenue,
                 SUM(oi.Quantity * oi.Cost) AS CostOfSales,
                 SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit,
                 CASE WHEN SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) > 0 
                      THEN (SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) / 
                            SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END))) * 100 
                      ELSE 0 END AS GrossProfitPercent
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          LEFT JOIN dbo.Categories cat ON p.CategoryID = cat.CategoryID
          LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
            AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
            AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
            AND (@Brand IS NULL OR p.Brand = @Brand)
            AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
            AND (@UserID IS NULL OR so.UserID = @UserID)
            AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
          GROUP BY p.ProductID, p.Name, p.SKU, cat.Name, p.Brand
          ORDER BY GrossProfit ASC
        `;
        break;

      case 'negative-profit-report':
        sqlQuery = `
          SELECT so.OrderID, so.OrderDate, p.Name AS ProductName, oi.Quantity, oi.Price, oi.Cost,
                 (oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) AS NetRevenue,
                 (oi.Quantity * oi.Cost) AS TotalCost,
                 (oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit,
                 u.Username AS CashierName
          FROM dbo.OrderItems oi
          INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
          INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
          INNER JOIN dbo.Users u ON so.UserID = u.UserID
          LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
          WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
            AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
            AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
            AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
            AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
            AND (@Brand IS NULL OR p.Brand = @Brand)
            AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
            AND (@UserID IS NULL OR so.UserID = @UserID)
            AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
            AND (oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) < 0
          ORDER BY GrossProfit ASC
        `;
        break;

      default:
        throw new Error('Unsupported profit analysis report type.');
    }

    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  async getDashboardKPIs(companyId, filters = {}) {
    const params = {
      CompanyID: companyId,
      StartDate: filters.startDate ? parseLocalDate(filters.startDate, false) : null,
      EndDate: filters.endDate ? parseLocalDate(filters.endDate, true) : null,
      ProductID: filters.productId ? parseInt(filters.productId, 10) : null,
      CategoryID: filters.categoryId ? parseInt(filters.categoryId, 10) : null,
      Brand: filters.brand || null,
      CustomerID: filters.customerId ? parseInt(filters.customerId, 10) : null,
      UserID: filters.userId ? parseInt(filters.userId, 10) : null,
      BranchName: filters.branchName || null
    };

    const metricsSql = `
      SELECT 
        SUM(oi.Subtotal) AS TotalSales,
        SUM(CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) AS DiscountAmount,
        SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) AS NetSales,
        SUM(oi.Quantity * oi.Cost) AS CostOfSales,
        SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit,
        CASE WHEN SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) > 0
             THEN (SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) /
                   SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END))) * 100
             ELSE 0 END AS GrossProfitPercent,
        SUM(oi.Quantity) AS TotalQuantitySold,
        COUNT(DISTINCT so.OrderID) AS NumberOfInvoices,
        CASE WHEN COUNT(DISTINCT so.OrderID) > 0 
             THEN SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) / COUNT(DISTINCT so.OrderID)
             ELSE 0 END AS AverageInvoiceValue,
        CASE WHEN COUNT(DISTINCT so.OrderID) > 0
             THEN SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) / COUNT(DISTINCT so.OrderID)
             ELSE 0 END AS AverageProfitPerInvoice
      FROM dbo.OrderItems oi
      INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
      INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
      LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
      WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
        AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
        AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
        AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
        AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
        AND (@Brand IS NULL OR p.Brand = @Brand)
        AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
        AND (@UserID IS NULL OR so.UserID = @UserID)
        AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
    `;

    const trendsSql = `
      SELECT CONVERT(varchar, so.OrderDate, 23) AS DateStr,
             SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) AS NetSales,
             SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit
      FROM dbo.OrderItems oi
      INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
      INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
      LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
      WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
        AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
        AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
        AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
        AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
        AND (@Brand IS NULL OR p.Brand = @Brand)
        AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
        AND (@UserID IS NULL OR so.UserID = @UserID)
        AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
      GROUP BY CONVERT(varchar, so.OrderDate, 23)
      ORDER BY DateStr ASC
    `;

    const topCustomersSql = `
      SELECT TOP 10 c.CustomerID, ISNULL(c.Name, 'Walk-in Customer') AS CustomerName,
             COUNT(DISTINCT so.OrderID) AS InvoiceCount,
             SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) AS NetSales,
             SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit
      FROM dbo.OrderItems oi
      INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
      LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
      INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
      LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
      WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
        AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
        and (@EndDate IS NULL OR so.OrderDate <= @EndDate)
        AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
        AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
        AND (@Brand IS NULL OR p.Brand = @Brand)
        AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
        AND (@UserID IS NULL OR so.UserID = @UserID)
        AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
      GROUP BY c.CustomerID, ISNULL(c.Name, 'Walk-in Customer')
      ORDER BY NetSales DESC
    `;

    const topProductsSql = `
      SELECT TOP 10 p.ProductID, p.Name AS ProductName, p.SKU,
             SUM(oi.Quantity) AS QuantitySold,
             SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) AS NetSales,
             SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit
      FROM dbo.OrderItems oi
      INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
      INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
      LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
      WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
        AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
        AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
        AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
        AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
        AND (@Brand IS NULL OR p.Brand = @Brand)
        AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
        AND (@UserID IS NULL OR so.UserID = @UserID)
        AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
      GROUP BY p.ProductID, p.Name, p.SKU
      ORDER BY QuantitySold DESC
    `;

    const topCategoriesSql = `
      SELECT cat.CategoryID, cat.Name AS CategoryName,
             SUM(oi.Quantity) AS QuantitySold,
             SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) AS NetSales,
             SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit
      FROM dbo.OrderItems oi
      INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
      INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
      INNER JOIN dbo.Categories cat ON p.CategoryID = cat.CategoryID
      LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
      WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
        AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
        AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
        AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
        AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
        AND (@Brand IS NULL OR p.Brand = @Brand)
        AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
        AND (@UserID IS NULL OR so.UserID = @UserID)
        AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
      GROUP BY cat.CategoryID, cat.Name
      ORDER BY NetSales DESC
    `;

    const topSalespersonsSql = `
      SELECT u.UserID, u.Username AS SalespersonName,
             COUNT(DISTINCT so.OrderID) AS InvoiceCount,
             SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END)) AS NetSales,
             SUM(oi.Subtotal - (CASE WHEN so.Subtotal > 0 THEN (oi.Subtotal / so.Subtotal) * so.DiscountAmount ELSE 0 END) - (oi.Quantity * oi.Cost)) AS GrossProfit
      FROM dbo.OrderItems oi
      INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
      INNER JOIN dbo.Users u ON so.UserID = u.UserID
      INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
      LEFT JOIN dbo.ProductBatches pb ON oi.ProductID = pb.ProductID AND oi.BatchNo = pb.BatchNo
      WHERE so.CompanyID = @CompanyID AND so.Status IN ('Completed', 'Exchanged', 'Exchange-Purchase')
        AND (@StartDate IS NULL OR so.OrderDate >= @StartDate)
        AND (@EndDate IS NULL OR so.OrderDate <= @EndDate)
        AND (@ProductID IS NULL OR oi.ProductID = @ProductID)
        AND (@CategoryID IS NULL OR p.CategoryID = @CategoryID)
        AND (@Brand IS NULL OR p.Brand = @Brand)
        AND (@CustomerID IS NULL OR so.CustomerID = @CustomerID)
        AND (@UserID IS NULL OR so.UserID = @UserID)
        AND (@BranchName IS NULL OR pb.WarehouseName = @BranchName)
      GROUP BY u.UserID, u.Username
      ORDER BY NetSales DESC
    `;

    const metricsResult = await db.query(metricsSql, params);
    const trendsResult = await db.query(trendsSql, params);
    const topCustomersResult = await db.query(topCustomersSql, params);
    const topProductsResult = await db.query(topProductsSql, params);
    const topCategoriesResult = await db.query(topCategoriesSql, params);
    const topSalespersonsResult = await db.query(topSalespersonsSql, params);

    return {
      metrics: metricsResult.recordset[0] || {
        TotalSales: 0,
        DiscountAmount: 0,
        NetSales: 0,
        CostOfSales: 0,
        GrossProfit: 0,
        GrossProfitPercent: 0,
        TotalQuantitySold: 0,
        NumberOfInvoices: 0,
        AverageInvoiceValue: 0,
        AverageProfitPerInvoice: 0
      },
      trends: trendsResult.recordset,
      topCustomers: topCustomersResult.recordset,
      topProducts: topProductsResult.recordset,
      topCategories: topCategoriesResult.recordset,
      topSalespersons: topSalespersonsResult.recordset
    };
  }
}

module.exports = new ReportsRepository();
