-- ============================================================================
-- SellMax Pro - Database Schema Definition (Microsoft SQL Server)
-- ============================================================================

-- Create Database if not exists (Note: Run this manually if needed, or target your DB)
-- CREATE DATABASE SellMaxPro;
-- GO
-- USE SellMaxPro;
-- GO

-- Drop Tables if they exist (FK dependency order)
IF OBJECT_ID('dbo.OrderPayments', 'U') IS NOT NULL DROP TABLE dbo.OrderPayments;
IF OBJECT_ID('dbo.OrderItems', 'U') IS NOT NULL DROP TABLE dbo.OrderItems;
IF OBJECT_ID('dbo.SalesOrders', 'U') IS NOT NULL DROP TABLE dbo.SalesOrders;
IF OBJECT_ID('dbo.Customers', 'U') IS NOT NULL DROP TABLE dbo.Customers;
IF OBJECT_ID('dbo.Products', 'U') IS NOT NULL DROP TABLE dbo.Products;
IF OBJECT_ID('dbo.Categories', 'U') IS NOT NULL DROP TABLE dbo.Categories;
IF OBJECT_ID('dbo.LoginHistory', 'U') IS NOT NULL DROP TABLE dbo.LoginHistory;
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;
IF OBJECT_ID('dbo.RolePermissions', 'U') IS NOT NULL DROP TABLE dbo.RolePermissions;
IF OBJECT_ID('dbo.Permissions', 'U') IS NOT NULL DROP TABLE dbo.Permissions;
IF OBJECT_ID('dbo.Roles', 'U') IS NOT NULL DROP TABLE dbo.Roles;
IF OBJECT_ID('dbo.Companies', 'U') IS NOT NULL DROP TABLE dbo.Companies;
GO

-- 1. Companies Table (Supports multi-company/tenant structure)
CREATE TABLE dbo.Companies (
    CompanyID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Active', -- 'Active', 'Suspended'
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
);

-- 2. Roles Table
CREATE TABLE dbo.Roles (
    RoleID INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(50) NOT NULL UNIQUE
);

-- 3. Permissions Table
CREATE TABLE dbo.Permissions (
    PermissionID INT IDENTITY(1,1) PRIMARY KEY,
    PermissionName NVARCHAR(50) NOT NULL UNIQUE,
    Description NVARCHAR(255) NULL
);

-- 4. RolePermissions (Permission Matrix Junction Table)
CREATE TABLE dbo.RolePermissions (
    RoleID INT NOT NULL,
    PermissionID INT NOT NULL,
    PRIMARY KEY (RoleID, PermissionID),
    CONSTRAINT FK_RolePermissions_Role FOREIGN KEY (RoleID) REFERENCES dbo.Roles(RoleID) ON DELETE CASCADE,
    CONSTRAINT FK_RolePermissions_Permission FOREIGN KEY (PermissionID) REFERENCES dbo.Permissions(PermissionID) ON DELETE CASCADE
);

-- 5. Users Table
CREATE TABLE dbo.Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NULL, -- NULL for Super Admin (global scope)
    Username NVARCHAR(50) NOT NULL UNIQUE,
    Email NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    PINHash NVARCHAR(255) NULL,
    RoleID INT NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Users_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE SET NULL,
    CONSTRAINT FK_Users_Role FOREIGN KEY (RoleID) REFERENCES dbo.Roles(RoleID)
);

-- 6. Login History (Audit Trail)
CREATE TABLE dbo.LoginHistory (
    HistoryID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    LoginTime DATETIME NOT NULL DEFAULT GETDATE(),
    IPAddress NVARCHAR(50) NULL,
    UserAgent NVARCHAR(255) NULL,
    Status NVARCHAR(20) NOT NULL, -- 'Success', 'Failed'
    CONSTRAINT FK_LoginHistory_User FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID) ON DELETE CASCADE
);

-- 7. Categories Table
CREATE TABLE dbo.Categories (
    CategoryID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    Name NVARCHAR(50) NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Categories_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT UQ_Category_Name_Company UNIQUE (Name, CompanyID)
);

-- 8. Products Table
CREATE TABLE dbo.Products (
    ProductID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    CategoryID INT NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    SKU NVARCHAR(50) NOT NULL,
    Barcode NVARCHAR(50) NULL,
    Price DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    Cost DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    Stock DECIMAL(18,3) NOT NULL DEFAULT 0.000,
    LowStockThreshold DECIMAL(18,3) NOT NULL DEFAULT 5.000,
    ImageURL NVARCHAR(500) NULL,
    UOM NVARCHAR(20) NOT NULL DEFAULT 'pcs',
    AllowFraction BIT NOT NULL DEFAULT 0,
    MinDiscountAmt DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    MinDiscountPct DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    MaxDiscountAmt DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    MaxDiscountPct DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    MinProfitMargin DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Products_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_Products_Category FOREIGN KEY (CategoryID) REFERENCES dbo.Categories(CategoryID),
    CONSTRAINT UQ_Products_SKU_Company UNIQUE (SKU, CompanyID),
    CONSTRAINT UQ_Products_Barcode_Company UNIQUE (Barcode, CompanyID)
);

-- 9. Customers Table (Supports Store Credit and Loyalty Program)
CREATE TABLE dbo.Customers (
    CustomerID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Phone NVARCHAR(20) NULL,
    Email NVARCHAR(100) NULL,
    CreditLimit DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    CurrentBalance DECIMAL(18,2) NOT NULL DEFAULT 0.00, -- Outstanding balance owed
    LoyaltyPoints INT NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Customers_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE
);

-- 10. Sales Orders Table
CREATE TABLE dbo.SalesOrders (
    OrderID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyID INT NOT NULL,
    UserID INT NOT NULL,
    CustomerID INT NULL, -- NULL for Anonymous customer
    OrderDate DATETIME NOT NULL DEFAULT GETDATE(),
    Subtotal DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    DiscountAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    TaxAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Completed', -- 'Completed', 'Held', 'Refunded', 'Exchanged'
    HeldNote NVARCHAR(255) NULL,
    ParentOrderID INT NULL, -- Maps to original order in case of return/exchange
    CONSTRAINT FK_SalesOrders_Company FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID) ON DELETE CASCADE,
    CONSTRAINT FK_SalesOrders_User FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
    CONSTRAINT FK_SalesOrders_Customer FOREIGN KEY (CustomerID) REFERENCES dbo.Customers(CustomerID) ON DELETE NO ACTION,
    CONSTRAINT FK_SalesOrders_Parent FOREIGN KEY (ParentOrderID) REFERENCES dbo.SalesOrders(OrderID)
);

-- 11. Order Items Table
CREATE TABLE dbo.OrderItems (
    OrderItemID INT IDENTITY(1,1) PRIMARY KEY,
    OrderID INT NOT NULL,
    ProductID INT NOT NULL,
    Price DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    Cost DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    Quantity DECIMAL(18,3) NOT NULL DEFAULT 1.000,
    Subtotal DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT FK_OrderItems_Order FOREIGN KEY (OrderID) REFERENCES dbo.SalesOrders(OrderID) ON DELETE CASCADE,
    CONSTRAINT FK_OrderItems_Product FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID)
);

-- 12. Order Payments Table (Supports Split Payments)
CREATE TABLE dbo.OrderPayments (
    PaymentID INT IDENTITY(1,1) PRIMARY KEY,
    OrderID INT NOT NULL,
    Method NVARCHAR(50) NOT NULL, -- 'Cash', 'Card', 'Bank Transfer', 'Credit'
    Amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    ReferenceNumber NVARCHAR(100) NULL,
    TransactionDate DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_OrderPayments_Order FOREIGN KEY (OrderID) REFERENCES dbo.SalesOrders(OrderID) ON DELETE CASCADE
);
GO

-- ============================================================================
-- Default Seeding Data
-- ============================================================================

-- Insert Roles
INSERT INTO dbo.Roles (RoleName) VALUES 
('Super Admin'),
('Company Admin'),
('Manager'),
('Cashier'),
('Inventory Officer'),
('Accountant');
GO

-- Insert Permissions
INSERT INTO dbo.Permissions (PermissionName, Description) VALUES
('ACCESS_POS', 'Access the POS terminal and perform sales'),
('HOLD_RESUME_SALE', 'Suspend and resume active sales transactions'),
('RETURN_EXCHANGE_SALE', 'Process returns and exchange purchases'),
('MANAGE_INVENTORY', 'Add, edit, delete, and view product catalog and categories'),
('MANAGE_CUSTOMERS', 'Manage customer accounts, credit limits, and loyalty points'),
('VIEW_REPORTS', 'Access executive dashboards, sales histories, and heavy analytics'),
('MANAGE_USERS', 'Create, update, disable users and run password resets'),
('MANAGE_SETTINGS', 'Edit system configurations, store details, and DB backups'),
('EDIT_PERMISSIONS', 'Modify role-to-permission mapping matrices');
GO

-- Set up Default Permission Matrix (RolePermissions)
-- 1. Super Admin: All Permissions
INSERT INTO dbo.RolePermissions (RoleID, PermissionID)
SELECT 1, PermissionID FROM dbo.Permissions;

-- 2. Company Admin: All Permissions (except global configurations if we want, but typically all)
INSERT INTO dbo.RolePermissions (RoleID, PermissionID)
SELECT 2, PermissionID FROM dbo.Permissions;

-- 3. Manager: POS, Holds, Returns, Inventory, Customers, Reports
INSERT INTO dbo.RolePermissions (RoleID, PermissionID)
SELECT 3, PermissionID FROM dbo.Permissions WHERE PermissionName IN 
('ACCESS_POS', 'HOLD_RESUME_SALE', 'RETURN_EXCHANGE_SALE', 'MANAGE_INVENTORY', 'MANAGE_CUSTOMERS', 'VIEW_REPORTS');

-- 4. Cashier: POS, Holds, Customers
INSERT INTO dbo.RolePermissions (RoleID, PermissionID)
SELECT 4, PermissionID FROM dbo.Permissions WHERE PermissionName IN 
('ACCESS_POS', 'HOLD_RESUME_SALE', 'MANAGE_CUSTOMERS');

-- 5. Inventory Officer: Inventory, View Reports (limited)
INSERT INTO dbo.RolePermissions (RoleID, PermissionID)
SELECT 5, PermissionID FROM dbo.Permissions WHERE PermissionName IN 
('MANAGE_INVENTORY', 'VIEW_REPORTS');

-- 6. Accountant: View Reports
INSERT INTO dbo.RolePermissions (RoleID, PermissionID)
SELECT 6, PermissionID FROM dbo.Permissions WHERE PermissionName IN 
('VIEW_REPORTS');
GO

-- Seed Default Company
INSERT INTO dbo.Companies (Name, Status) VALUES ('SellMax Retail Ltd', 'Active');
GO

-- Seed Default Admin Users
-- Default Passwords: Passwordhash is set to a bcrypt hash of 'admin123'
-- ($2b$10$kwifnrlLdIBLB0C7OYW85e4mXUcmEQhh5Elk.K6Mmtr3PlmVwPEDq is 'admin123')
INSERT INTO dbo.Users (CompanyID, Username, Email, PasswordHash, PINHash, RoleID, IsActive) VALUES
(1, 'superadmin', 'super@sellmax.com', '$2b$10$kwifnrlLdIBLB0C7OYW85e4mXUcmEQhh5Elk.K6Mmtr3PlmVwPEDq', '$2b$10$iGKpJm8XrRxpqqJVCwnskuoYkw0zY2AcBKgRQJGLiz8olGS0ctk/C', 1, 1),
(1, 'admin', 'admin@sellmax.com', '$2b$10$kwifnrlLdIBLB0C7OYW85e4mXUcmEQhh5Elk.K6Mmtr3PlmVwPEDq', '$2b$10$.EAhFT65ZmNt1En8WbDtI.msyG/9J0rJIjyhrfAfGuKgbTp9Mz60C', 2, 1),
(1, 'manager', 'manager@sellmax.com', '$2b$10$kwifnrlLdIBLB0C7OYW85e4mXUcmEQhh5Elk.K6Mmtr3PlmVwPEDq', '$2b$10$D8eT3V2uXooTNZsIP6DYOuEmXbnkL.QZHb8gnyzoNQCxiWu7fu/6q', 3, 1),
(1, 'cashier', 'cashier@sellmax.com', '$2b$10$kwifnrlLdIBLB0C7OYW85e4mXUcmEQhh5Elk.K6Mmtr3PlmVwPEDq', '$2b$10$OB9ryi7RkFexIv6AmMWjT.YM8bPztKidce31RTYR1oLRLRV.Pnh86', 4, 1),
(1, 'inventory', 'inventory@sellmax.com', '$2b$10$kwifnrlLdIBLB0C7OYW85e4mXUcmEQhh5Elk.K6Mmtr3PlmVwPEDq', '$2b$10$fX24drxd.l.gdp5ChQcW/uTlw8x7kw1qgyepvM9LG2md0tdSYoQVC', 5, 1),
(1, 'accountant', 'accountant@sellmax.com', '$2b$10$kwifnrlLdIBLB0C7OYW85e4mXUcmEQhh5Elk.K6Mmtr3PlmVwPEDq', '$2b$10$VvVLotYtjEJ10HiNrYhdOOl1PqEOTce1P9TtjutuII5v6FG2FONH2', 6, 1);
GO

-- Seed Default Categories
INSERT INTO dbo.Categories (CompanyID, Name) VALUES
(1, 'Beverages'),
(1, 'Bakery & Snacks'),
(1, 'Apparel'),
(1, 'Electronics'),
(1, 'General');
GO

-- Seed Default Products
INSERT INTO dbo.Products (CompanyID, CategoryID, Name, SKU, Barcode, Price, Cost, Stock, LowStockThreshold, ImageURL) VALUES
(1, 1, 'Organic Espresso Coffee Bean (500g)', 'COFFEE-BEANS', '000000010001', 25.00, 10.00, 45, 5, 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'),
(1, 1, 'Matcha Green Tea Latte Powder (250g)', 'MATCHA-POWDER', '000000010002', 18.50, 7.50, 20, 5, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'),
(1, 2, 'Fresh Butter Croissant (Pack of 4)', 'CROISSANT-PACK', '000000010003', 12.00, 4.00, 12, 3, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'),
(1, 2, 'Chocolate Chip Muffin', 'CHOCO-MUFFIN', '000000010004', 3.50, 1.20, 2, 8, 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'), -- Low Stock!
(1, 3, 'Classic Black Cotton T-Shirt (M)', 'TEE-BLK-M', '000000010005', 29.99, 9.00, 80, 10, 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'),
(1, 3, 'Slim Fit Denim Jeans (32/32)', 'JEANS-32', '000000010006', 59.99, 22.00, 30, 5, 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'),
(1, 4, 'Ergonomic Wireless Mouse', 'WIRELESS-MOUSE', '000000010007', 45.00, 18.00, 25, 4, 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'),
(1, 4, 'SellMax Ultra-Fast USB-C Cable (2m)', 'USBC-CABLE-2M', '000000010008', 15.00, 4.50, 120, 15, 'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=300&auto=format&fit=crop&q=60&ixlib=rb-4.0.3');
GO

-- Seed Default Customers
INSERT INTO dbo.Customers (CompanyID, Name, Phone, Email, CreditLimit, CurrentBalance, LoyaltyPoints) VALUES
(1, 'General Customer', '0000000000', 'general@sellmax.com', 0.00, 0.00, 0),
(1, 'John Doe (Gold Loyalty Member)', '+15550199', 'john.doe@gmail.com', 1000.00, 150.00, 450),
(1, 'Jane Smith (Silver Loyalty Member)', '+15550198', 'jane.smith@yahoo.com', 500.00, 0.00, 180),
(1, 'Acme Retail Partners', '+15550100', 'billing@acme.com', 5000.00, 2450.00, 120);
GO
