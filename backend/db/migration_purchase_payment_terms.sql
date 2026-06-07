IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PurchaseOrders') AND name = 'PaymentTerms')
BEGIN
    ALTER TABLE dbo.PurchaseOrders ADD PaymentTerms NVARCHAR(100) NULL;
    PRINT 'Added PaymentTerms column to dbo.PurchaseOrders.';
END
GO
