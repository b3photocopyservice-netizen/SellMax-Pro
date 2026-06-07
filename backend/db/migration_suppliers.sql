-- 1. Suppliers Master Table
IF OBJECT_ID('dbo.Suppliers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Suppliers (
        SupplierID INT IDENTITY(1,1) PRIMARY KEY,
        CompanyID INT NOT NULL,
        SupplierCode NVARCHAR(50) NOT NULL,
        SupplierName NVARCHAR(150) NOT NULL,
        CompanyName NVARCHAR(150) NULL,
        ContactPerson NVARCHAR(100) NULL,
        MobileNumber NVARCHAR(50) NULL,
        TelephoneNumber NVARCHAR(50) NULL,
        EmailAddress NVARCHAR(100) NULL,
        Website NVARCHAR(200) NULL,
        Address NVARCHAR(255) NULL,
        City NVARCHAR(100) NULL,
        Country NVARCHAR(100) NULL,
        TaxVATNumber NVARCHAR(100) NULL,
        BusinessRegNo NVARCHAR(100) NULL,
        SupplierCategory NVARCHAR(100) NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'Active', -- 'Active', 'Inactive'
        Notes NVARCHAR(MAX) NULL,
        BranchName NVARCHAR(100) NULL,
        
        -- Financial Settings
        CreditLimit DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        CreditPeriodDays INT NOT NULL DEFAULT 0,
        OpeningBalance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        CurrentBalance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        PaymentTerms NVARCHAR(100) NULL,
        
        -- Banking Settings
        BankName NVARCHAR(100) NULL,
        AccountName NVARCHAR(150) NULL,
        AccountNumber NVARCHAR(50) NULL,
        BankBranch NVARCHAR(100) NULL,
        SWIFTCode NVARCHAR(20) NULL,
        
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Suppliers_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE,
        CONSTRAINT UQ_Suppliers_Code_Company UNIQUE (SupplierCode, CompanyID)
    );
    PRINT 'Created table dbo.Suppliers.';
END
GO

-- 2. Purchase Orders Table
IF OBJECT_ID('dbo.PurchaseOrders', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PurchaseOrders (
        PurchaseOrderID INT IDENTITY(1,1) PRIMARY KEY,
        CompanyID INT NOT NULL,
        SupplierID INT NOT NULL,
        UserID INT NOT NULL,
        PONumber NVARCHAR(50) NOT NULL,
        OrderDate DATETIME NOT NULL DEFAULT GETDATE(),
        Subtotal DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        TaxAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Draft', -- 'Draft', 'Ordered', 'GRN Received', 'Invoiced', 'Cancelled'
        
        GRNNumber NVARCHAR(50) NULL,
        GRNDate DATETIME NULL,
        
        InvoiceNumber NVARCHAR(50) NULL,
        InvoiceDate DATETIME NULL,
        
        PaymentStatus NVARCHAR(20) NOT NULL DEFAULT 'Unpaid', -- 'Unpaid', 'Partially Paid', 'Paid'
        AmountPaid DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        BranchName NVARCHAR(100) NULL,
        Notes NVARCHAR(MAX) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_PurchaseOrders_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE,
        CONSTRAINT FK_PurchaseOrders_Supplier FOREIGN KEY (SupplierID) REFERENCES dbo.Suppliers(SupplierID),
        CONSTRAINT FK_PurchaseOrders_User FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
    );
    PRINT 'Created table dbo.PurchaseOrders.';
END
GO

-- 3. Purchase Order Items Table
IF OBJECT_ID('dbo.PurchaseOrderItems', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PurchaseOrderItems (
        PurchaseOrderItemID INT IDENTITY(1,1) PRIMARY KEY,
        PurchaseOrderID INT NOT NULL,
        ProductID INT NOT NULL,
        Quantity DECIMAL(18,3) NOT NULL DEFAULT 1.000,
        ReceivedQty DECIMAL(18,3) NOT NULL DEFAULT 0.000,
        UnitCost DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        Subtotal DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        
        -- Batch info
        BatchNo NVARCHAR(50) NULL,
        MfgDate DATE NULL,
        ExpiryDate DATE NULL,
        WarehouseName NVARCHAR(100) NULL,
        
        CONSTRAINT FK_PurchaseOrderItems_Order FOREIGN KEY (PurchaseOrderID) REFERENCES dbo.PurchaseOrders(PurchaseOrderID) ON DELETE CASCADE,
        CONSTRAINT FK_PurchaseOrderItems_Product FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID)
    );
    PRINT 'Created table dbo.PurchaseOrderItems.';
END
GO

-- 4. Supplier Returns Table
IF OBJECT_ID('dbo.SupplierReturns', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SupplierReturns (
        ReturnID INT IDENTITY(1,1) PRIMARY KEY,
        CompanyID INT NOT NULL,
        SupplierID INT NOT NULL,
        UserID INT NOT NULL,
        ReturnNumber NVARCHAR(50) NOT NULL,
        ReturnDate DATETIME NOT NULL DEFAULT GETDATE(),
        TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        Reason NVARCHAR(255) NULL,
        BranchName NVARCHAR(100) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_SupplierReturns_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE,
        CONSTRAINT FK_SupplierReturns_Supplier FOREIGN KEY (SupplierID) REFERENCES dbo.Suppliers(SupplierID),
        CONSTRAINT FK_SupplierReturns_User FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
    );
    PRINT 'Created table dbo.SupplierReturns.';
END
GO

-- 5. Supplier Return Items Table
IF OBJECT_ID('dbo.SupplierReturnItems', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SupplierReturnItems (
        ReturnItemID INT IDENTITY(1,1) PRIMARY KEY,
        ReturnID INT NOT NULL,
        ProductID INT NOT NULL,
        Quantity DECIMAL(18,3) NOT NULL DEFAULT 1.000,
        UnitCost DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        Subtotal DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        CONSTRAINT FK_SupplierReturnItems_Return FOREIGN KEY (ReturnID) REFERENCES dbo.SupplierReturns(ReturnID) ON DELETE CASCADE,
        CONSTRAINT FK_SupplierReturnItems_Product FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID)
    );
    PRINT 'Created table dbo.SupplierReturnItems.';
END
GO

-- 6. Supplier Accounting Ledger Table
IF OBJECT_ID('dbo.SupplierLedger', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SupplierLedger (
        LedgerID INT IDENTITY(1,1) PRIMARY KEY,
        CompanyID INT NOT NULL,
        SupplierID INT NOT NULL,
        TransactionType NVARCHAR(20) NOT NULL, -- 'Credit' (we owe them), 'Debit' (we paid/returned)
        ReferenceType NVARCHAR(50) NOT NULL, -- 'Opening Balance', 'Purchase Invoice', 'Payment Made', 'Supplier Return'
        ReferenceNumber NVARCHAR(100) NULL,
        TransactionDate DATETIME NOT NULL DEFAULT GETDATE(),
        Amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        RunningBalance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        Description NVARCHAR(500) NULL,
        BranchName NVARCHAR(100) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_SupplierLedger_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE,
        CONSTRAINT FK_SupplierLedger_Supplier FOREIGN KEY (SupplierID) REFERENCES dbo.Suppliers(SupplierID) ON DELETE NO ACTION
    );
    PRINT 'Created table dbo.SupplierLedger.';
END
GO

-- 7. Supplier Payments Table
IF OBJECT_ID('dbo.SupplierPayments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SupplierPayments (
        PaymentID INT IDENTITY(1,1) PRIMARY KEY,
        CompanyID INT NOT NULL,
        SupplierID INT NOT NULL,
        UserID INT NOT NULL,
        PaymentNumber NVARCHAR(50) NOT NULL,
        PaymentDate DATETIME NOT NULL DEFAULT GETDATE(),
        Amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        PaymentMethod NVARCHAR(50) NOT NULL, -- 'Cash', 'Bank Transfer', 'Cheque'
        ReferenceNumber NVARCHAR(100) NULL,
        Notes NVARCHAR(500) NULL,
        BranchName NVARCHAR(100) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_SupplierPayments_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE,
        CONSTRAINT FK_SupplierPayments_Supplier FOREIGN KEY (SupplierID) REFERENCES dbo.Suppliers(SupplierID),
        CONSTRAINT FK_SupplierPayments_User FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
    );
    PRINT 'Created table dbo.SupplierPayments.';
END
GO

-- 8. Supplier Audit Logs Table
IF OBJECT_ID('dbo.SupplierAuditLogs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SupplierAuditLogs (
        AuditLogID INT IDENTITY(1,1) PRIMARY KEY,
        CompanyID INT NOT NULL,
        UserID INT NOT NULL,
        Action NVARCHAR(100) NOT NULL, -- 'Supplier Created', 'PO Generated', 'GRN Received', 'Invoice Finalized', 'Payment Logged'
        Details NVARCHAR(MAX) NULL,
        Timestamp DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_SupplierAuditLogs_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE,
        CONSTRAINT FK_SupplierAuditLogs_User FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
    );
    PRINT 'Created table dbo.SupplierAuditLogs.';
END
GO

-- 9. Insert new Permission Nodes for Supplier Management
IF NOT EXISTS (SELECT * FROM dbo.Permissions WHERE PermissionName = 'VIEW_SUPPLIERS')
BEGIN
    INSERT INTO dbo.Permissions (PermissionName, Description) VALUES
    ('VIEW_SUPPLIERS', 'View supplier directories, ledger summaries, and basic profiles'),
    ('MANAGE_SUPPLIERS', 'Create, update, toggle active status, and remove supplier profiles'),
    ('MANAGE_PURCHASES', 'Raise purchase orders, record goods receipts (GRN), and invoice stocks'),
    ('VIEW_SUPPLIER_FINANCIALS', 'Access supplier ledgers, outstanding balances, and bank settings'),
    ('APPROVE_SUPPLIERS', 'Approve supplier accounts or GRN receipt transactions');
    
    -- Assign permissions to roles
    -- Roles: 1=Super Admin, 2=Company Admin, 3=Manager, 6=Accountant
    INSERT INTO dbo.RolePermissions (RoleID, PermissionID)
    SELECT 1, PermissionID FROM dbo.Permissions WHERE PermissionName LIKE '%SUPPLIER%' OR PermissionName = 'MANAGE_PURCHASES';
    
    INSERT INTO dbo.RolePermissions (RoleID, PermissionID)
    SELECT 2, PermissionID FROM dbo.Permissions WHERE PermissionName LIKE '%SUPPLIER%' OR PermissionName = 'MANAGE_PURCHASES';
    
    INSERT INTO dbo.RolePermissions (RoleID, PermissionID)
    SELECT 3, PermissionID FROM dbo.Permissions WHERE PermissionName IN ('VIEW_SUPPLIERS', 'MANAGE_PURCHASES', 'VIEW_SUPPLIER_FINANCIALS');
    
    INSERT INTO dbo.RolePermissions (RoleID, PermissionID)
    SELECT 6, PermissionID FROM dbo.Permissions WHERE PermissionName IN ('VIEW_SUPPLIERS', 'VIEW_SUPPLIER_FINANCIALS');
    
    PRINT 'Seeded Supplier permissions and mapped to default roles.';
END
GO
