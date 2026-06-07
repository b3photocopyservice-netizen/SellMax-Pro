-- Alter Companies table to add Company Profile fields
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Companies') AND name = 'BusinessRegNo')
BEGIN
    ALTER TABLE dbo.Companies ADD
        BusinessRegNo NVARCHAR(100) NULL,
        TaxRegNo NVARCHAR(100) NULL,
        IndustryType NVARCHAR(100) NULL,
        LogoURL NVARCHAR(500) NULL,
        SealURL NVARCHAR(500) NULL,
        ContactPerson NVARCHAR(100) NULL,
        MobileNumber NVARCHAR(50) NULL,
        TelephoneNumber NVARCHAR(50) NULL,
        Email NVARCHAR(100) NULL,
        Website NVARCHAR(200) NULL,
        AddressLine1 NVARCHAR(255) NULL,
        AddressLine2 NVARCHAR(255) NULL,
        City NVARCHAR(100) NULL,
        District NVARCHAR(100) NULL,
        Province NVARCHAR(100) NULL,
        Country NVARCHAR(100) NULL,
        PostalCode NVARCHAR(20) NULL,
        Currency NVARCHAR(20) NULL DEFAULT 'LKR',
        CurrencySymbol NVARCHAR(10) NULL DEFAULT 'Rs.',
        TaxPercentage DECIMAL(5,2) NULL DEFAULT 0.00,
        IsTaxActive BIT NOT NULL DEFAULT 1,
        FinancialYearStart DATE NULL;
END
GO

-- Seed default properties for existing companies (e.g. CompanyID = 1)
UPDATE dbo.Companies
SET Currency = ISNULL(Currency, 'LKR'),
    CurrencySymbol = ISNULL(CurrencySymbol, 'Rs.'),
    TaxPercentage = ISNULL(TaxPercentage, 0.00),
    IsTaxActive = ISNULL(IsTaxActive, 1)
WHERE CompanyID = 1;
GO
