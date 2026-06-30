const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { poolPromise } = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');

// Import Controllers
const authController = require('./controllers/authController');
const inventoryController = require('./controllers/inventoryController');
const customerController = require('./controllers/customerController');
const customerPaymentController = require('./controllers/customerPaymentController');
const salesController = require('./controllers/salesController');
const reportsController = require('./controllers/reportsController');
const companyController = require('./controllers/companyController');
const supplierController = require('./controllers/supplierController');
const adjustmentController = require('./controllers/adjustmentController');
const exchangeController = require('./controllers/exchangeController');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*', // Customize to React server domain in production (e.g., http://localhost:5173)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser with size limits for base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Bind controllers
app.use('/api/auth', authController);
app.use('/api/inventory', inventoryController);
app.use('/api/customers/payments', customerPaymentController);
app.use('/api/customers', customerController);
app.use('/api/sales', salesController);
app.use('/api/reports', reportsController);
app.use('/api/company', companyController);
app.use('/api/suppliers', supplierController);
app.use('/api/inventory/adjustments', adjustmentController);
app.use('/api', exchangeController);



// Serve React frontend (production build)
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'dist');
const fs = require('fs');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  // Catch-all: serve React's index.html for any non-API route (Express 5 syntax)
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
  console.log('Serving React frontend from:', frontendBuildPath);
} else {
  // Fallback base route for development
  app.get('/', (req, res) => {
    res.json({ message: 'Welcome to SellMax Pro Smart POS API Service.' });
  });
}

// Error handling middleware (MUST be last)
app.use(errorHandler);

// Wait for database connection then start listening
poolPromise.then(async (pool) => {
  try {
    console.log('Running database migrations...');
    
    // Add OriginalPrice to OrderItems if not exists
    await pool.request().query(`
      IF COL_LENGTH('dbo.OrderItems', 'OriginalPrice') IS NULL
      BEGIN
          ALTER TABLE dbo.OrderItems ADD OriginalPrice DECIMAL(18, 2) NULL;
          EXEC('UPDATE dbo.OrderItems SET OriginalPrice = Price WHERE OriginalPrice IS NULL');
          EXEC('ALTER TABLE dbo.OrderItems ALTER COLUMN OriginalPrice DECIMAL(18, 2) NOT NULL');
          PRINT 'Added OriginalPrice column to OrderItems.';
      END
    `);

    // Add HeldBillNumber to SalesOrders if not exists
    await pool.request().query(`
      IF COL_LENGTH('dbo.SalesOrders', 'HeldBillNumber') IS NULL
      BEGIN
          ALTER TABLE dbo.SalesOrders ADD HeldBillNumber NVARCHAR(50) NULL;
          PRINT 'Added HeldBillNumber column to SalesOrders.';
      END
    `);

    // Create PriceOverrides table if not exists
    await pool.request().query(`
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
    `);

    // Create CashDrawerSessions table if not exists
    await pool.request().query(`
      IF OBJECT_ID('dbo.CashDrawerSessions', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.CashDrawerSessions (
              SessionID INT IDENTITY(1,1) PRIMARY KEY,
              CompanyID INT NOT NULL,
              UserID INT NOT NULL,
              OpeningBalance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
              OpeningTime DATETIME NOT NULL DEFAULT GETDATE(),
              OpeningDenominations NVARCHAR(MAX) NULL,
              ClosingBalance DECIMAL(18,2) NULL,
              ClosingTime DATETIME NULL,
              ClosingDenominations NVARCHAR(MAX) NULL,
              ExpectedCash DECIMAL(18,2) NULL,
              ActualCash DECIMAL(18,2) NULL,
              DifferenceAmount DECIMAL(18,2) NULL,
              Status NVARCHAR(20) NOT NULL DEFAULT 'Open',
              TerminalID NVARCHAR(50) NOT NULL DEFAULT 'Terminal-01',
              CONSTRAINT FK_CashDrawerSessions_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID),
              CONSTRAINT FK_CashDrawerSessions_User FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
          );
          PRINT 'Created table dbo.CashDrawerSessions.';
      END
    `);

    // Add ReconciliationData column to CashDrawerSessions if not exists
    await pool.request().query(`
      IF COL_LENGTH('dbo.CashDrawerSessions', 'ReconciliationData') IS NULL
      BEGIN
          ALTER TABLE dbo.CashDrawerSessions ADD ReconciliationData NVARCHAR(MAX) NULL;
          PRINT 'Added ReconciliationData column to CashDrawerSessions.';
      END
    `);

    // Create ProductVariants table if not exists
    await pool.request().query(`
      IF OBJECT_ID('dbo.ProductVariants', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.ProductVariants (
              VariantID   INT IDENTITY(1,1) PRIMARY KEY,
              ProductID   INT NOT NULL,
              CompanyID   INT NOT NULL,
              VariantName NVARCHAR(100) NOT NULL,
              Price       DECIMAL(18,2) NOT NULL,
              Barcode     NVARCHAR(50)  NULL,
              IsActive    BIT NOT NULL DEFAULT 1,
              CreatedAt   DATETIME NOT NULL DEFAULT GETDATE(),
              CONSTRAINT FK_ProductVariants_Product FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID) ON DELETE CASCADE,
              CONSTRAINT FK_ProductVariants_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID),
              CONSTRAINT UQ_Variant_Name_Product UNIQUE (ProductID, CompanyID, VariantName)
          );
          PRINT 'Created table dbo.ProductVariants.';
      END
    `);

    // Add VariantID column to OrderItems if not exists
    await pool.request().query(`
      IF COL_LENGTH('dbo.OrderItems', 'VariantID') IS NULL
      BEGIN
          ALTER TABLE dbo.OrderItems ADD VariantID INT NULL;
          ALTER TABLE dbo.OrderItems ADD VariantName NVARCHAR(100) NULL;
          PRINT 'Added VariantID and VariantName columns to OrderItems.';
      END
    `);

    // Add AllowNegativeStock to Companies if not exists
    await pool.request().query(`
      IF COL_LENGTH('dbo.Companies', 'AllowNegativeStock') IS NULL
      BEGIN
          ALTER TABLE dbo.Companies ADD AllowNegativeStock BIT NOT NULL DEFAULT 0;
          PRINT 'Added AllowNegativeStock column to Companies.';
      END
    `);
    
    // Create InventoryAdjustments table if not exists
    await pool.request().query(`
      IF OBJECT_ID('dbo.InventoryAdjustments', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.InventoryAdjustments (
              AdjustmentID      INT IDENTITY(1,1) PRIMARY KEY,
              CompanyID         INT NOT NULL,
              ReferenceNo       NVARCHAR(50) NOT NULL,
              AdjustmentDate    DATE NOT NULL,
              Status            NVARCHAR(20) NOT NULL DEFAULT 'Draft',
              Remarks           NVARCHAR(500) NULL,
              CreatedByUserID   INT NOT NULL,
              ApprovedByUserID  INT NULL,
              ApprovedAt        DATETIME NULL,
              CreatedAt         DATETIME NOT NULL DEFAULT GETDATE(),
              CONSTRAINT FK_InvAdj_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE,
              CONSTRAINT FK_InvAdj_CreatedBy FOREIGN KEY (CreatedByUserID) REFERENCES dbo.Users(UserID),
              CONSTRAINT FK_InvAdj_ApprovedBy FOREIGN KEY (ApprovedByUserID) REFERENCES dbo.Users(UserID),
              CONSTRAINT UQ_InvAdj_RefNo_Company UNIQUE (ReferenceNo, CompanyID)
          );
          PRINT 'Created table dbo.InventoryAdjustments.';
      END
    `);

    // Create InventoryAdjustmentItems table if not exists
    await pool.request().query(`
      IF OBJECT_ID('dbo.InventoryAdjustmentItems', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.InventoryAdjustmentItems (
              ItemID            INT IDENTITY(1,1) PRIMARY KEY,
              AdjustmentID      INT NOT NULL,
              ProductID         INT NOT NULL,
              CurrentStock      DECIMAL(18,3) NOT NULL,
              AdjustedQty       DECIMAL(18,3) NOT NULL,
              CostPrice         DECIMAL(18,2) NOT NULL,
              Reason            NVARCHAR(100) NOT NULL,
              CONSTRAINT FK_InvAdjItem_Adj  FOREIGN KEY (AdjustmentID) REFERENCES dbo.InventoryAdjustments(AdjustmentID) ON DELETE CASCADE,
              CONSTRAINT FK_InvAdjItem_Prod FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID)
          );
          PRINT 'Created table dbo.InventoryAdjustmentItems.';
      END
    `);

    // Create JournalEntries table if not exists
    await pool.request().query(`
      IF OBJECT_ID('dbo.JournalEntries', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.JournalEntries (
              EntryID      INT IDENTITY(1,1) PRIMARY KEY,
              CompanyID    INT NOT NULL,
              SourceType   NVARCHAR(50) NOT NULL,
              SourceID     INT NOT NULL,
              EntryDate    DATE NOT NULL,
              AccountName  NVARCHAR(100) NOT NULL,
              Debit        DECIMAL(18,2) NOT NULL DEFAULT 0.00,
              Credit       DECIMAL(18,2) NOT NULL DEFAULT 0.00,
              Description  NVARCHAR(500) NULL,
              CreatedAt    DATETIME NOT NULL DEFAULT GETDATE(),
              CONSTRAINT FK_JournalEntries_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE
          );
          PRINT 'Created table dbo.JournalEntries.';
      END
    `);

    // Add CustomerCode column to Customers if not exists
    await pool.request().query(`
      IF COL_LENGTH('dbo.Customers', 'CustomerCode') IS NULL
      BEGIN
          ALTER TABLE dbo.Customers ADD CustomerCode NVARCHAR(50) NULL;
          PRINT 'Added CustomerCode column to Customers.';
      END
    `);

    // Auto-populate CustomerCode for existing records
    await pool.request().query(`
      UPDATE dbo.Customers 
      SET CustomerCode = 'CUST-' + CAST(CustomerID AS NVARCHAR(10))
      WHERE CustomerCode IS NULL;
    `);

    // Create CustomerPayments table if not exists
    await pool.request().query(`
      IF OBJECT_ID('dbo.CustomerPayments', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.CustomerPayments (
              PaymentID    INT IDENTITY(1,1) PRIMARY KEY,
              CompanyID    INT NOT NULL,
              CustomerID   INT NOT NULL,
              UserID       INT NOT NULL,
              ReceiptNo    NVARCHAR(50) NOT NULL UNIQUE,
              PaymentDate  DATE NOT NULL,
              ReferenceNo  NVARCHAR(100) NULL,
              Remarks      NVARCHAR(500) NULL,
              TotalAmount  DECIMAL(18,2) NOT NULL,
              CreatedAt    DATETIME NOT NULL DEFAULT GETDATE(),
              CONSTRAINT FK_CustomerPayments_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE,
              CONSTRAINT FK_CustomerPayments_Customer FOREIGN KEY (CustomerID) REFERENCES dbo.Customers(CustomerID),
              CONSTRAINT FK_CustomerPayments_User FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
          );
          PRINT 'Created table dbo.CustomerPayments.';
      END
    `);

    // Create CustomerPaymentModes table if not exists
    await pool.request().query(`
      IF OBJECT_ID('dbo.CustomerPaymentModes', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.CustomerPaymentModes (
              PaymentModeID  INT IDENTITY(1,1) PRIMARY KEY,
              PaymentID      INT NOT NULL,
              Method         NVARCHAR(50) NOT NULL,
              Amount         DECIMAL(18,2) NOT NULL,
              ReferenceNumber NVARCHAR(100) NULL,
              CONSTRAINT FK_CustomerPaymentModes_Payment FOREIGN KEY (PaymentID) REFERENCES dbo.CustomerPayments(PaymentID) ON DELETE CASCADE
          );
          PRINT 'Created table dbo.CustomerPaymentModes.';
      END
    `);

    // Create CustomerPaymentAllocations table if not exists
    await pool.request().query(`
      IF OBJECT_ID('dbo.CustomerPaymentAllocations', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.CustomerPaymentAllocations (
              AllocationID     INT IDENTITY(1,1) PRIMARY KEY,
              PaymentID        INT NOT NULL,
              OrderID          INT NOT NULL,
              AllocatedAmount  DECIMAL(18,2) NOT NULL,
              CONSTRAINT FK_CustomerPaymentAllocations_Payment FOREIGN KEY (PaymentID) REFERENCES dbo.CustomerPayments(PaymentID) ON DELETE CASCADE,
              CONSTRAINT FK_CustomerPaymentAllocations_Order FOREIGN KEY (OrderID) REFERENCES dbo.SalesOrders(OrderID)
          );
          PRINT 'Created table dbo.CustomerPaymentAllocations.';
      END
    `);

    // Create CustomerLedgerAdjustments table if not exists
    await pool.request().query(`
      IF OBJECT_ID('dbo.CustomerLedgerAdjustments', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.CustomerLedgerAdjustments (
              AdjustmentID     INT IDENTITY(1,1) PRIMARY KEY,
              CompanyID        INT NOT NULL,
              CustomerID       INT NOT NULL,
              UserID           INT NOT NULL,
              AdjustmentType   NVARCHAR(50) NOT NULL,
              ReferenceNumber  NVARCHAR(50) NOT NULL UNIQUE,
              AdjustmentDate   DATE NOT NULL,
              Effect           NVARCHAR(10) NOT NULL,
              Amount           DECIMAL(18,2) NOT NULL,
              Description      NVARCHAR(500) NULL,
              CreatedAt        DATETIME NOT NULL DEFAULT GETDATE(),
              CONSTRAINT FK_CustAdj_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE,
              CONSTRAINT FK_CustAdj_Customer FOREIGN KEY (CustomerID) REFERENCES dbo.Customers(CustomerID) ON DELETE NO ACTION,
              CONSTRAINT FK_CustAdj_User FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
          );
          PRINT 'Created table dbo.CustomerLedgerAdjustments.';
      END
    `);

    // Add POS Printer Settings columns to Companies table if not exists
    await pool.request().query(`
      IF COL_LENGTH('dbo.Companies', 'PrintHeader') IS NULL
      BEGIN
          ALTER TABLE dbo.Companies ADD 
              PrintHeader BIT NOT NULL DEFAULT 1,
              HeaderMessage NVARCHAR(MAX) NULL,
              PrintLogo BIT NOT NULL DEFAULT 1,
              PrintDateTime BIT NOT NULL DEFAULT 1,
              PrintCashier BIT NOT NULL DEFAULT 1,
              PrintBranch BIT NOT NULL DEFAULT 1,
              PrintFooter BIT NOT NULL DEFAULT 1,
              FooterMessage NVARCHAR(MAX) NULL,
              PaperSize NVARCHAR(20) NOT NULL DEFAULT '80mm',
              AutoCut BIT NOT NULL DEFAULT 1,
              OpenDrawer BIT NOT NULL DEFAULT 1,
              ReceiptCopies INT NOT NULL DEFAULT 1,
              DefaultPrinter NVARCHAR(255) NULL;
          PRINT 'Added POS Printer Settings columns to Companies.';
      END
    `);

    console.log('Database migrations completed successfully.');
  } catch (migErr) {
    console.error('Migration failed, but starting server anyway:', migErr);
  }

  app.listen(PORT, () => {
    console.log(`SellMax Pro API Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start SellMax Pro API Server due to DB connection issues:', err);
});
