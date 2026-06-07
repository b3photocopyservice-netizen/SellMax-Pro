-- Add PurchaseType to dbo.PurchaseOrders if it does not exist
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'PurchaseOrders' AND COLUMN_NAME = 'PurchaseType'
)
BEGIN
    ALTER TABLE dbo.PurchaseOrders ADD PurchaseType NVARCHAR(20) NOT NULL DEFAULT 'Credit';
    PRINT 'Added PurchaseType column to dbo.PurchaseOrders.';
END
ELSE
BEGIN
    PRINT 'PurchaseType column already exists.';
END
GO

-- Add ReturnType to dbo.SupplierReturns if it does not exist
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'SupplierReturns' AND COLUMN_NAME = 'ReturnType'
)
BEGIN
    ALTER TABLE dbo.SupplierReturns ADD ReturnType NVARCHAR(20) NOT NULL DEFAULT 'Credit';
    PRINT 'Added ReturnType column to dbo.SupplierReturns.';
END
ELSE
BEGIN
    PRINT 'ReturnType column already exists.';
END
GO
