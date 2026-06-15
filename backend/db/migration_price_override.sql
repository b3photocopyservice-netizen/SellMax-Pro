-- ============================================================================
-- SellMax Pro Migration - POS Price Override Constraints & Audit Log
-- ============================================================================

-- 1. Add OriginalPrice column to OrderItems if not exists
IF COL_LENGTH('dbo.OrderItems', 'OriginalPrice') IS NULL
BEGIN
    ALTER TABLE dbo.OrderItems ADD OriginalPrice DECIMAL(18, 2) NULL;
    PRINT 'Added nullable OriginalPrice column to OrderItems.';
END
GO

-- 2. Backfill OriginalPrice with current Price for historical orders
UPDATE dbo.OrderItems 
SET OriginalPrice = Price 
WHERE OriginalPrice IS NULL;
GO

-- 3. Enforce NOT NULL constraint on OriginalPrice
IF COL_LENGTH('dbo.OrderItems', 'OriginalPrice') IS NOT NULL 
   AND (SELECT is_nullable FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OrderItems') AND name = 'OriginalPrice') = 1
BEGIN
    ALTER TABLE dbo.OrderItems ALTER COLUMN OriginalPrice DECIMAL(18, 2) NOT NULL;
    PRINT 'Altered OriginalPrice column to be NOT NULL.';
END
GO

-- 4. Create PriceOverrides audit log table if not exists
IF OBJECT_ID('dbo.PriceOverrides', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PriceOverrides (
        OverrideID INT IDENTITY(1,1) PRIMARY KEY,
        OrderID INT NULL,
        ProductID INT NOT NULL,
        OriginalPrice DECIMAL(18,2) NOT NULL,
        OverriddenPrice DECIMAL(18,2) NOT NULL,
        UserID INT NOT NULL,
        ApprovedByUserID INT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_PriceOverrides_Order FOREIGN KEY (OrderID) REFERENCES dbo.SalesOrders(OrderID) ON DELETE SET NULL,
        CONSTRAINT FK_PriceOverrides_Product FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID),
        CONSTRAINT FK_PriceOverrides_User FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_PriceOverrides_Approver FOREIGN KEY (ApprovedByUserID) REFERENCES dbo.Users(UserID)
    );
    PRINT 'Created table dbo.PriceOverrides.';
END
GO
