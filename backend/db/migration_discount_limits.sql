-- ============================================================================
-- SellMax Pro Migration - Discount Constraints & Margin Protections
-- ============================================================================

-- 1. Add MinDiscountAmt column to Products if not exists
IF COL_LENGTH('dbo.Products', 'MinDiscountAmt') IS NULL
BEGIN
    ALTER TABLE dbo.Products ADD MinDiscountAmt DECIMAL(18, 2) NOT NULL DEFAULT 0.00;
    PRINT 'Added column MinDiscountAmt to dbo.Products table.';
END
GO

-- 2. Add MinDiscountPct column to Products if not exists
IF COL_LENGTH('dbo.Products', 'MinDiscountPct') IS NULL
BEGIN
    ALTER TABLE dbo.Products ADD MinDiscountPct DECIMAL(18, 2) NOT NULL DEFAULT 0.00;
    PRINT 'Added column MinDiscountPct to dbo.Products table.';
END
GO

-- 3. Add MaxDiscountAmt column to Products if not exists
IF COL_LENGTH('dbo.Products', 'MaxDiscountAmt') IS NULL
BEGIN
    ALTER TABLE dbo.Products ADD MaxDiscountAmt DECIMAL(18, 2) NOT NULL DEFAULT 0.00;
    PRINT 'Added column MaxDiscountAmt to dbo.Products table.';
END
GO

-- 4. Add MaxDiscountPct column to Products if not exists
IF COL_LENGTH('dbo.Products', 'MaxDiscountPct') IS NULL
BEGIN
    ALTER TABLE dbo.Products ADD MaxDiscountPct DECIMAL(18, 2) NOT NULL DEFAULT 0.00;
    PRINT 'Added column MaxDiscountPct to dbo.Products table.';
END
GO

-- 5. Add MinProfitMargin column to Products if not exists
IF COL_LENGTH('dbo.Products', 'MinProfitMargin') IS NULL
BEGIN
    ALTER TABLE dbo.Products ADD MinProfitMargin DECIMAL(18, 2) NOT NULL DEFAULT 0.00;
    PRINT 'Added column MinProfitMargin to dbo.Products table.';
END
GO
