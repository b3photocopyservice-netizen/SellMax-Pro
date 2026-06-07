-- ============================================================================
-- SellMax Pro Migration - Unit of Measurement & Fractional Quantities
-- ============================================================================

-- 1. Add UOM column to Products if not exists
IF COL_LENGTH('dbo.Products', 'UOM') IS NULL
BEGIN
    ALTER TABLE dbo.Products ADD UOM NVARCHAR(20) NOT NULL DEFAULT 'pcs';
    PRINT 'Added column UOM to dbo.Products table.';
END
ELSE
BEGIN
    PRINT 'Column UOM already exists in dbo.Products table.';
END
GO

-- 2. Add AllowFraction column to Products if not exists
IF COL_LENGTH('dbo.Products', 'AllowFraction') IS NULL
BEGIN
    ALTER TABLE dbo.Products ADD AllowFraction BIT NOT NULL DEFAULT 0;
    PRINT 'Added column AllowFraction to dbo.Products table.';
END
ELSE
BEGIN
    PRINT 'Column AllowFraction already exists in dbo.Products table.';
END
GO

-- 3. Dynamically find and drop default constraints on Stock, LowStockThreshold, and Quantity columns
DECLARE @ConstraintName NVARCHAR(256)

-- Drop Stock default constraint
SELECT @ConstraintName = name
FROM sys.default_constraints
WHERE parent_object_id = OBJECT_ID('dbo.Products')
  AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.Products'), 'Stock', 'ColumnId')

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.Products DROP CONSTRAINT ' + @ConstraintName)
    PRINT 'Dropped default constraint ' + @ConstraintName + ' on Products.Stock'
END

-- Drop LowStockThreshold default constraint
SELECT @ConstraintName = name
FROM sys.default_constraints
WHERE parent_object_id = OBJECT_ID('dbo.Products')
  AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.Products'), 'LowStockThreshold', 'ColumnId')

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.Products DROP CONSTRAINT ' + @ConstraintName)
    PRINT 'Dropped default constraint ' + @ConstraintName + ' on Products.LowStockThreshold'
END

-- Drop Quantity default constraint
SELECT @ConstraintName = name
FROM sys.default_constraints
WHERE parent_object_id = OBJECT_ID('dbo.OrderItems')
  AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.OrderItems'), 'Quantity', 'ColumnId')

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.OrderItems DROP CONSTRAINT ' + @ConstraintName)
    PRINT 'Dropped default constraint ' + @ConstraintName + ' on OrderItems.Quantity'
END
GO

-- 4. Alter Stock and LowStockThreshold columns in Products to DECIMAL(18, 3)
ALTER TABLE dbo.Products ALTER COLUMN Stock DECIMAL(18, 3) NOT NULL;
ALTER TABLE dbo.Products ALTER COLUMN LowStockThreshold DECIMAL(18, 3) NOT NULL;
PRINT 'Altered Stock and LowStockThreshold to DECIMAL(18, 3) in dbo.Products.';
GO

-- 5. Alter Quantity column in OrderItems to DECIMAL(18, 3)
ALTER TABLE dbo.OrderItems ALTER COLUMN Quantity DECIMAL(18, 3) NOT NULL;
PRINT 'Altered Quantity to DECIMAL(18, 3) in dbo.OrderItems.';
GO

-- 6. Recreate default constraints
ALTER TABLE dbo.Products ADD CONSTRAINT DF_Products_Stock DEFAULT 0 FOR Stock;
ALTER TABLE dbo.Products ADD CONSTRAINT DF_Products_LowStockThreshold DEFAULT 5 FOR LowStockThreshold;
ALTER TABLE dbo.OrderItems ADD CONSTRAINT DF_OrderItems_Quantity DEFAULT 1 FOR Quantity;
PRINT 'Recreated default constraints on altered columns.';
GO
