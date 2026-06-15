const db = require('../config/db');

class ReportsRepository {
  async getDailySalesSummary(companyId, startDate = null, endDate = null) {
    const params = { CompanyID: companyId };
    
    if (startDate) params.StartDate = new Date(startDate);
    if (endDate) params.EndDate = new Date(endDate);

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
    
    if (startDate) params.StartDate = new Date(startDate);
    if (endDate) params.EndDate = new Date(endDate);
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
      params.StartDate = new Date(startDate);
      params.EndDate = new Date(endDate);
    }

    sqlQuery += ` ORDER BY po.CreatedAt DESC`;

    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }
}

module.exports = new ReportsRepository();
