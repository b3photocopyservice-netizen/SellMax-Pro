-- ============================================================================
-- SellMax Pro - Stored Procedures for Heavy Reporting (Microsoft SQL Server)
-- ============================================================================

-- USE SellMaxPro;
-- GO

-- Drop Stored Procedures if they exist
IF OBJECT_ID('dbo.sp_GetDailySalesSummary', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetDailySalesSummary;
IF OBJECT_ID('dbo.sp_GetProductPerformance', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetProductPerformance;
IF OBJECT_ID('dbo.sp_GetLowStockAlerts', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetLowStockAlerts;
IF OBJECT_ID('dbo.sp_GetCustomerLoyaltyStatement', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GetCustomerLoyaltyStatement;
GO

-- 1. Daily Sales Summary Stored Procedure
-- Aggregates sales data, transactions count, tax collected, and payment split totals.
CREATE PROCEDURE dbo.sp_GetDailySalesSummary
    @CompanyID INT,
    @StartDate DATETIME = NULL,
    @EndDate DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- If dates are null, default to today's date range (00:00:00 to 23:59:59)
    IF @StartDate IS NULL
        SET @StartDate = DATEADD(dd, DATEDIFF(dd, 0, GETDATE()), 0);
    IF @EndDate IS NULL
        SET @EndDate = DATEADD(ss, -1, DATEADD(dd, 1, DATEADD(dd, DATEDIFF(dd, 0, GETDATE()), 0)));

    -- ResultSet 1: Aggregated Metrics
    SELECT 
        ISNULL(SUM(TotalAmount), 0) AS TotalRevenue,
        ISNULL(SUM(Subtotal), 0) AS TotalSubtotal,
        ISNULL(SUM(DiscountAmount), 0) AS TotalDiscounts,
        ISNULL(SUM(TaxAmount), 0) AS TotalTax,
        COUNT(OrderID) AS TransactionCount,
        CASE 
            WHEN COUNT(OrderID) > 0 THEN ISNULL(SUM(TotalAmount), 0) / COUNT(OrderID)
            ELSE 0 
        END AS AverageTicketSize
    FROM dbo.SalesOrders
    WHERE CompanyID = @CompanyID 
      AND OrderDate BETWEEN @StartDate AND @EndDate
      AND Status IN ('Completed', 'Exchanged');

    -- ResultSet 2: Sales by Payment Method
    SELECT 
        op.Method AS PaymentMethod,
        ISNULL(SUM(op.Amount), 0) AS TotalCollected
    FROM dbo.OrderPayments op
    INNER JOIN dbo.SalesOrders so ON op.OrderID = so.OrderID
    WHERE so.CompanyID = @CompanyID
      AND so.OrderDate BETWEEN @StartDate AND @EndDate
      AND so.Status IN ('Completed', 'Exchanged')
    GROUP BY op.Method
    ORDER BY TotalCollected DESC;
END;
GO

-- 2. Product Sales Performance Stored Procedure
-- Identifies top products by sales volume or total revenue.
CREATE PROCEDURE dbo.sp_GetProductPerformance
    @CompanyID INT,
    @StartDate DATETIME = NULL,
    @EndDate DATETIME = NULL,
    @Limit INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    -- Default dates to last 30 days if null
    IF @StartDate IS NULL
        SET @StartDate = DATEADD(day, -30, GETDATE());
    IF @EndDate IS NULL
        SET @EndDate = GETDATE();

    SELECT TOP (@Limit)
        p.ProductID,
        p.Name AS ProductName,
        p.SKU,
        c.Name AS CategoryName,
        SUM(oi.Quantity) AS UnitsSold,
        SUM(oi.Subtotal) AS GrossRevenue,
        SUM(oi.Subtotal - (oi.Quantity * oi.Cost)) AS EstimatedProfit,
        p.Stock AS CurrentStock
    FROM dbo.OrderItems oi
    INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
    INNER JOIN dbo.Categories c ON p.CategoryID = c.CategoryID
    INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
    WHERE so.CompanyID = @CompanyID
      AND so.OrderDate BETWEEN @StartDate AND @EndDate
      AND so.Status IN ('Completed', 'Exchanged')
    GROUP BY p.ProductID, p.Name, p.SKU, c.Name, p.Stock
    ORDER BY GrossRevenue DESC, UnitsSold DESC;
END;
GO

-- 3. Low Stock Alerts Stored Procedure
-- Returns products whose stock levels are below threshold.
CREATE PROCEDURE dbo.sp_GetLowStockAlerts
    @CompanyID INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        p.ProductID,
        p.Name AS ProductName,
        p.SKU,
        c.Name AS CategoryName,
        p.Stock AS CurrentStock,
        p.LowStockThreshold,
        (p.LowStockThreshold - p.Stock) AS ShortageAmount
    FROM dbo.Products p
    INNER JOIN dbo.Categories c ON p.CategoryID = c.CategoryID
    WHERE p.CompanyID = @CompanyID 
      AND p.Stock <= p.LowStockThreshold
    ORDER BY p.Stock ASC;
END;
GO

-- 4. Customer Loyalty & Credits Statement
-- Details active customer accounts, total items bought, and historical contributions.
CREATE PROCEDURE dbo.sp_GetCustomerLoyaltyStatement
    @CompanyID INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        cust.CustomerID,
        cust.Name AS CustomerName,
        cust.Phone,
        cust.Email,
        cust.CreditLimit,
        cust.CurrentBalance,
        (cust.CreditLimit - cust.CurrentBalance) AS RemainingCredit,
        cust.LoyaltyPoints,
        COUNT(so.OrderID) AS TotalOrdersCount,
        ISNULL(SUM(so.TotalAmount), 0) AS TotalPurchasesValue
    FROM dbo.Customers cust
    LEFT JOIN dbo.SalesOrders so ON cust.CustomerID = so.CustomerID AND so.Status IN ('Completed', 'Exchanged')
    WHERE cust.CompanyID = @CompanyID
    GROUP BY 
        cust.CustomerID, 
        cust.Name, 
        cust.Phone, 
        cust.Email, 
        cust.CreditLimit, 
        cust.CurrentBalance, 
        cust.LoyaltyPoints
    ORDER BY TotalPurchasesValue DESC, cust.LoyaltyPoints DESC;
END;
GO
