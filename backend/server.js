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
poolPromise.then(() => {
  app.listen(PORT, () => {
    console.log(`SellMax Pro API Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start SellMax Pro API Server due to DB connection issues:', err);
});
