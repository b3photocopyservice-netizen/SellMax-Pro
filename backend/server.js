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
const salesController = require('./controllers/salesController');
const reportsController = require('./controllers/reportsController');
const companyController = require('./controllers/companyController');
const supplierController = require('./controllers/supplierController');

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
app.use('/api/customers', customerController);
app.use('/api/sales', salesController);
app.use('/api/reports', reportsController);
app.use('/api/company', companyController);
app.use('/api/suppliers', supplierController);



// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to SellMax Pro Smart POS API Service.' });
});

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
