const productRepository = require('../repositories/productRepository');
const notificationService = require('./notificationService');

class InventoryService {
  async getAllProducts(companyId, categoryId, search) {
    return await productRepository.getAll(companyId, categoryId, search);
  }

  async getProductById(id, companyId) {
    const product = await productRepository.getById(id, companyId);
    if (!product) throw new Error('Product not found.');
    return product;
  }

  async createProduct(productData, companyId) {
    // Validate SKU uniqueness
    const existingSku = await productRepository.getBySku(productData.sku, companyId);
    if (existingSku) {
      throw new Error(`Product with SKU '${productData.sku}' already exists.`);
    }

    return await productRepository.create(productData, companyId);
  }

  async updateProduct(id, productData, companyId) {
    // Validate existance
    const existing = await productRepository.getById(id, companyId);
    if (!existing) {
      throw new Error('Product not found.');
    }

    // Check SKU duplicate if modified
    if (existing.SKU !== productData.sku) {
      const duplicateSku = await productRepository.getBySku(productData.sku, companyId);
      if (duplicateSku) {
        throw new Error(`Product with SKU '${productData.sku}' already exists.`);
      }
    }

    return await productRepository.update(id, productData, companyId);
  }

  async deleteProduct(id, companyId) {
    const success = await productRepository.delete(id, companyId);
    if (!success) throw new Error('Product not found or could not be deleted.');
    return success;
  }

  async getCategories(companyId) {
    return await productRepository.getCategories(companyId);
  }

  async createCategory(categoryData, companyId) {
    if (!categoryData.name || categoryData.name.trim() === '') {
      throw new Error('Category name cannot be empty.');
    }
    
    // Check duplication
    const categories = await productRepository.getCategories(companyId);
    const exists = categories.some(c => c.Name.toLowerCase() === categoryData.name.trim().toLowerCase());
    if (exists) {
      throw new Error(`Category '${categoryData.name}' already exists.`);
    }

    return await productRepository.createCategory(categoryData, companyId);
  }

  async deleteCategory(id, companyId) {
    return await productRepository.deleteCategory(id, companyId);
  }

  async getUOMs(companyId) {
    return await productRepository.getUOMs(companyId);
  }

  async createUOM(uomData, companyId) {
    if (!uomData.name || uomData.name.trim() === '') {
      throw new Error('UOM name cannot be empty.');
    }
    
    // Check duplication
    const uoms = await productRepository.getUOMs(companyId);
    const exists = uoms.some(u => u.Name.toLowerCase() === uomData.name.trim().toLowerCase());
    if (exists) {
      throw new Error(`UOM '${uomData.name}' already exists.`);
    }

    return await productRepository.createUOM(uomData, companyId);
  }

  async deleteUOM(id, companyId) {
    return await productRepository.deleteUOM(id, companyId);
  }

  async getBrands(companyId) {
    return await productRepository.getBrands(companyId);
  }

  async createBrand(brandData, companyId) {
    if (!brandData.name || brandData.name.trim() === '') {
      throw new Error('Brand name cannot be empty.');
    }
    
    // Check duplication
    const brands = await productRepository.getBrands(companyId);
    const exists = brands.some(b => b.Name.toLowerCase() === brandData.name.trim().toLowerCase());
    if (exists) {
      throw new Error(`Brand '${brandData.name}' already exists.`);
    }

    return await productRepository.createBrand(brandData, companyId);
  }

  async deleteBrand(id, companyId) {
    return await productRepository.deleteBrand(id, companyId);
  }

  async getBatches(companyId, productId) {
    return await productRepository.getBatches(companyId, productId);
  }

  async createBatch(batchData, companyId) {
    if (!batchData.batchNo || batchData.batchNo.trim() === '') {
      throw new Error('Batch number cannot be empty.');
    }
    if (!batchData.expiryDate) {
      throw new Error('Expiry date is required.');
    }
    if (isNaN(parseFloat(batchData.quantity)) || parseFloat(batchData.quantity) <= 0) {
      throw new Error('Initial batch quantity must be positive.');
    }
    return await productRepository.createBatch(batchData, companyId);
  }

  async deleteBatch(id, companyId) {
    return await productRepository.deleteBatch(id, companyId);
  }

  async getNotifications(companyId) {
    return await notificationService.getNotifications(companyId);
  }

  async markAllAsRead(companyId) {
    return await notificationService.markAllAsRead(companyId);
  }

  // ── Price Variants ────────────────────────────────────────────────────────

  async getVariantsByProduct(productId, companyId) {
    return await productRepository.getVariantsByProduct(productId, companyId);
  }

  async getAllVariantsForCompany(companyId) {
    return await productRepository.getAllVariantsForCompany(companyId);
  }

  async createVariant(productId, data, companyId) {
    if (!data.variantName || data.variantName.trim() === '') {
      throw new Error('Variant name cannot be empty.');
    }
    if (isNaN(parseFloat(data.price)) || parseFloat(data.price) <= 0) {
      throw new Error('Variant price must be greater than zero.');
    }
    // Unique name within the same product
    const existing = await productRepository.getVariantsByProduct(productId, companyId);
    const duplicate = existing.find(v => v.VariantName.toLowerCase() === data.variantName.trim().toLowerCase());
    if (duplicate) {
      throw new Error(`A variant named '${data.variantName.trim()}' already exists for this product.`);
    }
    // Barcode must be unique across the whole company's variants
    if (data.barcode && data.barcode.trim()) {
      const barcodeConflict = await productRepository.getVariantByBarcode(data.barcode.trim(), companyId);
      if (barcodeConflict) {
        throw new Error(`Barcode '${data.barcode.trim()}' is already assigned to variant '${barcodeConflict.VariantName}' of product '${barcodeConflict.ProductName}'.`);
      }
    }
    return await productRepository.createVariant({ ...data, productId, price: parseFloat(data.price) }, companyId);
  }

  async updateVariant(variantId, data, companyId) {
    if (!data.variantName || data.variantName.trim() === '') {
      throw new Error('Variant name cannot be empty.');
    }
    if (isNaN(parseFloat(data.price)) || parseFloat(data.price) <= 0) {
      throw new Error('Variant price must be greater than zero.');
    }
    // Barcode uniqueness — skip self
    if (data.barcode && data.barcode.trim()) {
      const barcodeConflict = await productRepository.getVariantByBarcode(data.barcode.trim(), companyId);
      if (barcodeConflict && barcodeConflict.VariantID !== parseInt(variantId, 10)) {
        throw new Error(`Barcode '${data.barcode.trim()}' is already in use by another variant.`);
      }
    }
    const updated = await productRepository.updateVariant(variantId, { ...data, price: parseFloat(data.price) }, companyId);
    if (!updated) throw new Error('Variant not found.');
    return updated;
  }

  async deleteVariant(variantId, companyId) {
    const success = await productRepository.deleteVariant(variantId, companyId);
    if (!success) throw new Error('Variant not found or could not be deleted.');
    return success;
  }
}

module.exports = new InventoryService();
