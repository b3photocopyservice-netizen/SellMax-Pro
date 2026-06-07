-- 1. Alter dbo.PurchaseOrders to add new columns
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PurchaseOrders') AND name = 'ExpectedDeliveryDate')
BEGIN
    ALTER TABLE dbo.PurchaseOrders ADD ExpectedDeliveryDate DATETIME NULL;
    PRINT 'Added ExpectedDeliveryDate column to dbo.PurchaseOrders.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PurchaseOrders') AND name = 'DiscountAmount')
BEGIN
    ALTER TABLE dbo.PurchaseOrders ADD DiscountAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00;
    PRINT 'Added DiscountAmount column to dbo.PurchaseOrders.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PurchaseOrders') AND name = 'DueDate')
BEGIN
    ALTER TABLE dbo.PurchaseOrders ADD DueDate DATETIME NULL;
    PRINT 'Added DueDate column to dbo.PurchaseOrders.';
END
GO

-- 2. Alter dbo.PurchaseOrderItems to add new columns
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PurchaseOrderItems') AND name = 'Discount')
BEGIN
    ALTER TABLE dbo.PurchaseOrderItems ADD Discount DECIMAL(18,2) NOT NULL DEFAULT 0.00;
    PRINT 'Added Discount column to dbo.PurchaseOrderItems.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PurchaseOrderItems') AND name = 'Tax')
BEGIN
    ALTER TABLE dbo.PurchaseOrderItems ADD Tax DECIMAL(18,2) NOT NULL DEFAULT 0.00;
    PRINT 'Added Tax column to dbo.PurchaseOrderItems.';
END
GO
