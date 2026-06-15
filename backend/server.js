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
