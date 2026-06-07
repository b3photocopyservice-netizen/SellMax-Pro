-- ============================================================================
-- SellMax Pro Migration - Expiry & Batch Management System
-- ============================================================================

-- 1. Add Batch configuration columns to dbo.Products if not exists
IF COL_LENGTH('dbo.Products', 'IsBatchTracked') IS NULL
BEGIN
    ALTER TABLE dbo.Products ADD IsBatchTracked BIT NOT NULL DEFAULT 0;
    PRINT 'Added column IsBatchTracked to dbo.Products table.';
END
GO

IF COL_LENGTH('dbo.Products', 'BlockExpiredSales') IS NULL
BEGIN
    ALTER TABLE dbo.Products ADD BlockExpiredSales BIT NOT NULL DEFAULT 1;
    PRINT 'Added column BlockExpiredSales to dbo.Products table.';
END
GO

IF COL_LENGTH('dbo.Products', 'StockIssuingMethod') IS NULL
BEGIN
    ALTER TABLE dbo.Products ADD StockIssuingMethod NVARCHAR(10) NOT NULL DEFAULT 'FEFO';
    PRINT 'Added column StockIssuingMethod to dbo.Products table.';
END
GO

-- 2. Create dbo.ProductBatches Table
IF OBJECT_ID('dbo.ProductBatches', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductBatches (
        BatchID INT IDENTITY(1,1) PRIMARY KEY,
        ProductID INT NOT NULL,
        CompanyID INT NOT NULL,
        BatchNo NVARCHAR(50) NOT NULL,
        MfgDate DATE NULL,
        ExpiryDate DATE NOT NULL,
        InitialQty DECIMAL(18,3) NOT NULL,
        CurrentQty DECIMAL(18,3) NOT NULL,
        WarehouseName NVARCHAR(100) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_ProductBatches_Product FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID) ON DELETE CASCADE,
        CONSTRAINT FK_ProductBatches_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE NO ACTION,
        CONSTRAINT UQ_ProductBatches_No_Product_Company UNIQUE (BatchNo, ProductID, CompanyID)
    );
    PRINT 'Created table dbo.ProductBatches.';
END
GO

-- 3. Add BatchNo to dbo.OrderItems if not exists
IF COL_LENGTH('dbo.OrderItems', 'BatchNo') IS NULL
BEGIN
    ALTER TABLE dbo.OrderItems ADD BatchNo NVARCHAR(50) NULL;
    PRINT 'Added column BatchNo to dbo.OrderItems table.';
END
GO

-- 4. Create dbo.SystemNotifications Table
IF OBJECT_ID('dbo.SystemNotifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SystemNotifications (
        NotificationID INT IDENTITY(1,1) PRIMARY KEY,
        CompanyID INT NOT NULL,
        Type NVARCHAR(50) NOT NULL, -- 'Expiry', 'LowStock'
        Message NVARCHAR(500) NOT NULL,
        IsRead BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_SystemNotifications_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE
    );
    PRINT 'Created table dbo.SystemNotifications.';
END
GO
