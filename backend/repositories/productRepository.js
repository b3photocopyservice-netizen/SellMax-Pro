const db = require('../config/db');

class ProductRepository {
  async getAll(companyId, categoryId = null, search = '') {
    let sqlQuery = `
      SELECT p.*, c.Name AS CategoryName 
      FROM dbo.Products p
      INNER JOIN dbo.Categories c ON p.CategoryID = c.CategoryID
      WHERE p.CompanyID = @CompanyID
    `;
    const params = { CompanyID: companyId };

    if (categoryId) {
      sqlQuery += ` AND p.CategoryID = @CategoryID`;
      params.CategoryID = categoryId;
    }

    if (search) {
      sqlQuery += ` AND (p.Name LIKE @Search OR p.SKU LIKE @Search OR p.Barcode LIKE @Search)`;
      params.Search = `%${search}%`;
    }

    sqlQuery += ` ORDER BY p.Name ASC`;
    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  async getById(id, companyId) {
    const sqlQuery = `
      SELECT p.*, c.Name AS CategoryName 
      FROM dbo.Products p
      INNER JOIN dbo.Categories c ON p.CategoryID = c.CategoryID
      WHERE p.ProductID = @ProductID AND p.CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, { ProductID: id, CompanyID: companyId });
    return result.recordset[0] || null;
  }

  async getBySku(sku, companyId) {
    const sqlQuery = `
      SELECT p.*, c.Name AS CategoryName 
      FROM dbo.Products p
      INNER JOIN dbo.Categories c ON p.CategoryID = c.CategoryID
      WHERE p.SKU = @SKU AND p.CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, { SKU: sku, CompanyID: companyId });
    return result.recordset[0] || null;
  }

  async create(productData, companyId) {
    const sqlQuery = `
      INSERT INTO dbo.Products (
        CompanyID, CategoryID, Name, SKU, Barcode, Price, Cost, Stock, LowStockThreshold, ImageURL, UOM, AllowFraction,
        MinDiscountAmt, MinDiscountPct, MaxDiscountAmt, MaxDiscountPct, MinProfitMargin, IsActive, Brand,
        IsBatchTracked, BlockExpiredSales, StockIssuingMethod
      )
      OUTPUT inserted.*
      VALUES (
        @CompanyID, @CategoryID, @Name, @SKU, @Barcode, @Price, @Cost, @Stock, @LowStockThreshold, @ImageURL, @UOM, @AllowFraction,
        @MinDiscountAmt, @MinDiscountPct, @MaxDiscountAmt, @MaxDiscountPct, @MinProfitMargin, @IsActive, @Brand,
        @IsBatchTracked, @BlockExpiredSales, @StockIssuingMethod
      )
    `;
    const result = await db.query(sqlQuery, {
      CompanyID: companyId,
      CategoryID: productData.categoryId,
      Name: productData.name,
      SKU: productData.sku,
      Barcode: productData.barcode || null,
      Price: productData.price,
      Cost: productData.cost,
      Stock: productData.stock || 0,
      LowStockThreshold: productData.lowStockThreshold || 5,
      ImageURL: productData.imageUrl || null,
      UOM: productData.uom || 'pcs',
      AllowFraction: productData.allowFraction ? 1 : 0,
      MinDiscountAmt: productData.minDiscountAmt || 0,
      MinDiscountPct: productData.minDiscountPct || 0,
      MaxDiscountAmt: productData.maxDiscountAmt || 0,
      MaxDiscountPct: productData.maxDiscountPct || 0,
      MinProfitMargin: productData.minProfitMargin || 0,
      IsActive: productData.isActive !== undefined ? (productData.isActive ? 1 : 0) : 1,
      Brand: productData.brand || null,
      IsBatchTracked: productData.isBatchTracked ? 1 : 0,
      BlockExpiredSales: productData.blockExpiredSales !== undefined ? (productData.blockExpiredSales ? 1 : 0) : 1,
      StockIssuingMethod: productData.stockIssuingMethod || 'FEFO'
    });
    return result.recordset[0];
  }

  async update(id, productData, companyId) {
    const sqlQuery = `
      UPDATE dbo.Products
      SET CategoryID = @CategoryID,
          Name = @Name,
          SKU = @SKU,
          Barcode = @Barcode,
          Price = @Price,
          Cost = @Cost,
          Stock = @Stock,
          LowStockThreshold = @LowStockThreshold,
          ImageURL = @ImageURL,
          UOM = @UOM,
          AllowFraction = @AllowFraction,
          MinDiscountAmt = @MinDiscountAmt,
          MinDiscountPct = @MinDiscountPct,
          MaxDiscountAmt = @MaxDiscountAmt,
          MaxDiscountPct = @MaxDiscountPct,
          MinProfitMargin = @MinProfitMargin,
          IsActive = @IsActive,
          Brand = @Brand,
          IsBatchTracked = @IsBatchTracked,
          BlockExpiredSales = @BlockExpiredSales,
          StockIssuingMethod = @StockIssuingMethod
      OUTPUT inserted.*
      WHERE ProductID = @ProductID AND CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, {
      ProductID: id,
      CompanyID: companyId,
      CategoryID: productData.categoryId,
      Name: productData.name,
      SKU: productData.sku,
      Barcode: productData.barcode || null,
      Price: productData.price,
      Cost: productData.cost,
      Stock: productData.stock,
      LowStockThreshold: productData.lowStockThreshold,
      ImageURL: productData.imageUrl || null,
      UOM: productData.uom || 'pcs',
      AllowFraction: productData.allowFraction ? 1 : 0,
      MinDiscountAmt: productData.minDiscountAmt || 0,
      MinDiscountPct: productData.minDiscountPct || 0,
      MaxDiscountAmt: productData.maxDiscountAmt || 0,
      MaxDiscountPct: productData.maxDiscountPct || 0,
      MinProfitMargin: productData.minProfitMargin || 0,
      IsActive: productData.isActive !== undefined ? (productData.isActive ? 1 : 0) : 1,
      Brand: productData.brand || null,
      IsBatchTracked: productData.isBatchTracked ? 1 : 0,
      BlockExpiredSales: productData.blockExpiredSales !== undefined ? (productData.blockExpiredSales ? 1 : 0) : 1,
      StockIssuingMethod: productData.stockIssuingMethod || 'FEFO'
    });
    return result.recordset[0] || null;
  }

  async delete(id, companyId) {
    const sqlQuery = `
      DELETE FROM dbo.Products
      OUTPUT deleted.ProductID
      WHERE ProductID = @ProductID AND CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, { ProductID: id, CompanyID: companyId });
    return result.recordset.length > 0;
  }

  // Categories Operations
  async getCategories(companyId) {
    const sqlQuery = `SELECT * FROM dbo.Categories WHERE CompanyID = @CompanyID ORDER BY Name ASC`;
    const result = await db.query(sqlQuery, { CompanyID: companyId });
    return result.recordset;
  }

  async createCategory(categoryData, companyId) {
    const sqlQuery = `
      INSERT INTO dbo.Categories (CompanyID, Name)
      OUTPUT inserted.*
      VALUES (@CompanyID, @Name)
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId, Name: categoryData.name });
    return result.recordset[0];
  }

  async deleteCategory(id, companyId) {
    const sqlQuery = `
      DELETE FROM dbo.Categories
      OUTPUT deleted.CategoryID
      WHERE CategoryID = @CategoryID AND CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, { CategoryID: id, CompanyID: companyId });
    return result.recordset.length > 0;
  }

  // UOMs Operations
  async getUOMs(companyId) {
    const sqlQuery = `SELECT * FROM dbo.UOMs WHERE CompanyID = @CompanyID ORDER BY Name ASC`;
    const result = await db.query(sqlQuery, { CompanyID: companyId });
    return result.recordset;
  }

  async createUOM(uomData, companyId) {
    const sqlQuery = `
      INSERT INTO dbo.UOMs (CompanyID, Name)
      OUTPUT inserted.*
      VALUES (@CompanyID, @Name)
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId, Name: uomData.name });
    return result.recordset[0];
  }

  async deleteUOM(id, companyId) {
    const sqlQuery = `
      DELETE FROM dbo.UOMs
      OUTPUT deleted.UOMID
      WHERE UOMID = @UOMID AND CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, { UOMID: id, CompanyID: companyId });
    return result.recordset.length > 0;
  }

  // Brands Operations
  async getBrands(companyId) {
    const sqlQuery = `SELECT * FROM dbo.Brands WHERE CompanyID = @CompanyID ORDER BY Name ASC`;
    const result = await db.query(sqlQuery, { CompanyID: companyId });
    return result.recordset;
  }

  async createBrand(brandData, companyId) {
    const sqlQuery = `
      INSERT INTO dbo.Brands (CompanyID, Name)
      OUTPUT inserted.*
      VALUES (@CompanyID, @Name)
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId, Name: brandData.name });
    return result.recordset[0];
  }

  async deleteBrand(id, companyId) {
    const sqlQuery = `
      DELETE FROM dbo.Brands
      OUTPUT deleted.BrandID
      WHERE BrandID = @BrandID AND CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, { BrandID: id, CompanyID: companyId });
    return result.recordset.length > 0;
  }

  // Batches Operations
  async getBatches(companyId, productId = null) {
    let sqlQuery = `SELECT * FROM dbo.ProductBatches WHERE CompanyID = @CompanyID`;
    const params = { CompanyID: companyId };
    if (productId) {
      sqlQuery += ` AND ProductID = @ProductID`;
      params.ProductID = productId;
    }
    sqlQuery += ` ORDER BY ExpiryDate ASC`;
    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  async createBatch(batchData, companyId) {
    const sqlQuery = `
      INSERT INTO dbo.ProductBatches (CompanyID, ProductID, BatchNo, MfgDate, ExpiryDate, InitialQty, CurrentQty, WarehouseName)
      OUTPUT inserted.*
      VALUES (@CompanyID, @ProductID, @BatchNo, @MfgDate, @ExpiryDate, @InitialQty, @CurrentQty, @WarehouseName)
    `;
    const result = await db.query(sqlQuery, {
      CompanyID: companyId,
      ProductID: batchData.productId,
      BatchNo: batchData.batchNo,
      MfgDate: batchData.mfgDate ? new Date(batchData.mfgDate) : null,
      ExpiryDate: new Date(batchData.expiryDate),
      InitialQty: parseFloat(batchData.quantity),
      CurrentQty: parseFloat(batchData.quantity),
      WarehouseName: batchData.warehouseName || null
    });
    const created = result.recordset[0];
    if (created) {
      await this.updateAggregateStock(batchData.productId, companyId);
    }
    return created;
  }

  async deleteBatch(id, companyId) {
    const fetchQuery = `SELECT ProductID FROM dbo.ProductBatches WHERE BatchID = @BatchID AND CompanyID = @CompanyID`;
    const fetchResult = await db.query(fetchQuery, { BatchID: id, CompanyID: companyId });
    if (fetchResult.recordset.length === 0) return false;
    const productId = fetchResult.recordset[0].ProductID;

    const deleteQuery = `
      DELETE FROM dbo.ProductBatches
      OUTPUT deleted.BatchID
      WHERE BatchID = @BatchID AND CompanyID = @CompanyID
    `;
    const result = await db.query(deleteQuery, { BatchID: id, CompanyID: companyId });
    const success = result.recordset.length > 0;
    if (success) {
      await this.updateAggregateStock(productId, companyId);
    }
    return success;
  }

  async updateAggregateStock(productId, companyId) {
    const sqlQuery = `
      UPDATE dbo.Products
      SET Stock = ISNULL((SELECT SUM(CurrentQty) FROM dbo.ProductBatches WHERE ProductID = @ProductID AND CompanyID = @CompanyID), 0)
      WHERE ProductID = @ProductID AND CompanyID = @CompanyID
    `;
    await db.query(sqlQuery, { ProductID: productId, CompanyID: companyId });
  }
}

module.exports = new ProductRepository();
