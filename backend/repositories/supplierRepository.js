const db = require('../config/db');

class SupplierRepository {
  // --- SUPPLIERS MASTER ---

  async getNextSupplierCode(companyId) {
    const currentYear = new Date().getFullYear().toString();
    const sqlQuery = `
      SELECT TOP 1 SupplierCode
      FROM dbo.Suppliers
      WHERE CompanyID = @CompanyID AND SupplierCode LIKE 'SUP-' + @Year + '-%'
      ORDER BY SupplierCode DESC
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId, Year: currentYear });
    
    let nextNum = 1;
    if (result.recordset.length > 0) {
      const lastCode = result.recordset[0].SupplierCode;
      const parts = lastCode.split('-');
      if (parts.length === 3) {
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) {
          nextNum = lastNum + 1;
        }
      }
    }
    
    const padded = nextNum.toString().padStart(4, '0');
    return `SUP-${currentYear}-${padded}`;
  }

  async createSupplier(companyId, data) {
    const code = await this.getNextSupplierCode(companyId);
    const sqlQuery = `
      INSERT INTO dbo.Suppliers (
        CompanyID, SupplierCode, SupplierName, CompanyName, ContactPerson, 
        MobileNumber, TelephoneNumber, EmailAddress, Website, Address, 
        City, Country, TaxVATNumber, BusinessRegNo, SupplierCategory, 
        Status, Notes, BranchName, CreditLimit, CreditPeriodDays, 
        OpeningBalance, CurrentBalance, PaymentTerms, BankName, 
        AccountName, AccountNumber, BankBranch, SWIFTCode
      )
      OUTPUT inserted.*
      VALUES (
        @CompanyID, @SupplierCode, @SupplierName, @CompanyName, @ContactPerson, 
        @MobileNumber, @TelephoneNumber, @EmailAddress, @Website, @Address, 
        @City, @Country, @TaxVATNumber, @BusinessRegNo, @SupplierCategory, 
        @Status, @Notes, @BranchName, @CreditLimit, @CreditPeriodDays, 
        @OpeningBalance, @OpeningBalance, @PaymentTerms, @BankName, 
        @AccountName, @AccountNumber, @BankBranch, @SWIFTCode
      )
    `;

    const result = await db.query(sqlQuery, {
      CompanyID: companyId,
      SupplierCode: code,
      SupplierName: data.supplierName,
      CompanyName: data.companyName || null,
      ContactPerson: data.contactPerson || null,
      MobileNumber: data.mobileNumber || null,
      TelephoneNumber: data.telephoneNumber || null,
      EmailAddress: data.emailAddress || null,
      Website: data.website || null,
      Address: data.address || null,
      City: data.city || null,
      Country: data.country || null,
      TaxVATNumber: data.taxVatNumber || null,
      BusinessRegNo: data.businessRegNo || null,
      SupplierCategory: data.supplierCategory || null,
      Status: data.status || 'Active',
      Notes: data.notes || null,
      BranchName: data.branchName || null,
      CreditLimit: data.creditLimit !== undefined ? parseFloat(data.creditLimit) : 0.00,
      CreditPeriodDays: data.creditPeriodDays !== undefined ? parseInt(data.creditPeriodDays, 10) : 0,
      OpeningBalance: data.openingBalance !== undefined ? parseFloat(data.openingBalance) : 0.00,
      PaymentTerms: data.paymentTerms || null,
      BankName: data.bankName || null,
      AccountName: data.accountName || null,
      AccountNumber: data.accountNumber || null,
      BankBranch: data.bankBranch || null,
      SWIFTCode: data.swiftCode || null
    });

    const supplier = result.recordset[0];
    
    // Create opening balance entry in Ledger if balance > 0
    if (supplier && parseFloat(supplier.OpeningBalance) !== 0) {
      const isCredit = parseFloat(supplier.OpeningBalance) > 0;
      await db.query(`
        INSERT INTO dbo.SupplierLedger (
          CompanyID, SupplierID, TransactionType, ReferenceType, ReferenceNumber, 
          Amount, RunningBalance, Description, BranchName
        ) VALUES (
          @CompanyID, @SupplierID, @TxType, 'Opening Balance', 'OPENING', 
          @Amount, @Amount, 'Supplier Opening Balance Settled', @BranchName
        )
      `, {
        CompanyID: companyId,
        SupplierID: supplier.SupplierID,
        TxType: isCredit ? 'Credit' : 'Debit',
        Amount: Math.abs(parseFloat(supplier.OpeningBalance)),
        BranchName: supplier.BranchName || null
      });
    }

    return supplier;
  }

  async updateSupplier(supplierId, companyId, data) {
    // Current balance update can be driven by transactions, but manual profiles updates here.
    const sqlQuery = `
      UPDATE dbo.Suppliers
      SET SupplierName = @SupplierName,
          CompanyName = @CompanyName,
          ContactPerson = @ContactPerson,
          MobileNumber = @MobileNumber,
          TelephoneNumber = @TelephoneNumber,
          EmailAddress = @EmailAddress,
          Website = @Website,
          Address = @Address,
          City = @City,
          Country = @Country,
          TaxVATNumber = @TaxVATNumber,
          BusinessRegNo = @BusinessRegNo,
          SupplierCategory = @SupplierCategory,
          Status = @Status,
          Notes = @Notes,
          BranchName = @BranchName,
          CreditLimit = @CreditLimit,
          CreditPeriodDays = @CreditPeriodDays,
          PaymentTerms = @PaymentTerms,
          BankName = @BankName,
          AccountName = @AccountName,
          AccountNumber = @AccountNumber,
          BankBranch = @BankBranch,
          SWIFTCode = @SWIFTCode
      OUTPUT inserted.*
      WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID
    `;

    const result = await db.query(sqlQuery, {
      SupplierID: supplierId,
      CompanyID: companyId,
      SupplierName: data.supplierName,
      CompanyName: data.companyName || null,
      ContactPerson: data.contactPerson || null,
      MobileNumber: data.mobileNumber || null,
      TelephoneNumber: data.telephoneNumber || null,
      EmailAddress: data.emailAddress || null,
      Website: data.website || null,
      Address: data.address || null,
      City: data.city || null,
      Country: data.country || null,
      TaxVATNumber: data.taxVatNumber || null,
      BusinessRegNo: data.businessRegNo || null,
      SupplierCategory: data.supplierCategory || null,
      Status: data.status || 'Active',
      Notes: data.notes || null,
      BranchName: data.branchName || null,
      CreditLimit: data.creditLimit !== undefined ? parseFloat(data.creditLimit) : 0.00,
      CreditPeriodDays: data.creditPeriodDays !== undefined ? parseInt(data.creditPeriodDays, 10) : 0,
      PaymentTerms: data.paymentTerms || null,
      BankName: data.bankName || null,
      AccountName: data.accountName || null,
      AccountNumber: data.accountNumber || null,
      BankBranch: data.bankBranch || null,
      SWIFTCode: data.swiftCode || null
    });

    return result.recordset[0] || null;
  }

  async getSupplierById(supplierId, companyId) {
    const sqlQuery = `
      SELECT * FROM dbo.Suppliers
      WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, { SupplierID: supplierId, CompanyID: companyId });
    return result.recordset[0] || null;
  }

  async getAllSuppliers(companyId, filters = {}) {
    let sqlQuery = `
      SELECT * FROM dbo.Suppliers
      WHERE CompanyID = @CompanyID
    `;
    const params = { CompanyID: companyId };

    if (filters.search) {
      sqlQuery += ` AND (SupplierName LIKE @Search OR CompanyName LIKE @Search OR SupplierCode LIKE @Search)`;
      params.Search = `%${filters.search}%`;
    }
    if (filters.category) {
      sqlQuery += ` AND SupplierCategory = @Category`;
      params.Category = filters.category;
    }
    if (filters.status) {
      sqlQuery += ` AND Status = @Status`;
      params.Status = filters.status;
    }
    if (filters.branchName) {
      sqlQuery += ` AND (BranchName = @BranchName OR BranchName IS NULL)`;
      params.BranchName = filters.branchName;
    }

    sqlQuery += ` ORDER BY SupplierName ASC`;
    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  async deleteSupplier(supplierId, companyId) {
    const sqlQuery = `
      IF EXISTS (SELECT 1 FROM dbo.PurchaseOrders WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID) OR
         EXISTS (SELECT 1 FROM dbo.SupplierReturns WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID) OR
         EXISTS (SELECT 1 FROM dbo.SupplierPayments WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID)
      BEGIN
          SELECT 'HAS_TRANSACTIONS' AS Result;
      END
      ELSE
      BEGIN
          DELETE FROM dbo.SupplierLedger WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID;
          DELETE FROM dbo.Suppliers WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID;
          SELECT 'DELETED' AS Result;
      END
    `;
    const result = await db.query(sqlQuery, { SupplierID: supplierId, CompanyID: companyId });
    return result.recordset[0]?.Result || 'FAILED';
  }

  // --- PURCHASE ORDERS ---

  async getNextPONumber(companyId) {
    const prefix = 'PO-' + new Date().getFullYear();
    const result = await db.query(`
      SELECT TOP 1 PONumber 
      FROM dbo.PurchaseOrders 
      WHERE CompanyID = @CompanyID AND PONumber LIKE @Prefix + '%'
      ORDER BY PONumber DESC
    `, { CompanyID: companyId, Prefix: prefix });

    let count = 1;
    if (result.recordset.length > 0) {
      const last = result.recordset[0].PONumber;
      const numStr = last.replace(prefix + '-', '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num)) {
        count = num + 1;
      }
    }
    return `${prefix}-${count.toString().padStart(4, '0')}`;
  }

  async createPurchaseOrder(companyId, userId, data) {
    const poNumber = await this.getNextPONumber(companyId);
    
    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unitCost)), 0);
    const itemDiscounts = data.items.reduce((sum, item) => sum + parseFloat(item.discount || 0), 0);
    const itemTaxes = data.items.reduce((sum, item) => sum + parseFloat(item.tax || 0), 0);
    
    const discountAmount = parseFloat(data.discountAmount || itemDiscounts || 0);
    const taxAmount = parseFloat(data.taxAmount || itemTaxes || 0);
    const totalAmount = subtotal - discountAmount + taxAmount;

    // Start database query execution
    // 1. Insert header
    const poResult = await db.query(`
      INSERT INTO dbo.PurchaseOrders (
        CompanyID, SupplierID, UserID, PONumber, Subtotal, DiscountAmount, TaxAmount, 
        TotalAmount, Status, BranchName, Notes, ExpectedDeliveryDate, PurchaseType
      )
      OUTPUT inserted.PurchaseOrderID, inserted.PONumber
      VALUES (
        @CompanyID, @SupplierID, @UserID, @PONumber, @Subtotal, @DiscountAmount, @TaxAmount, 
        @TotalAmount, @Status, @BranchName, @Notes, @ExpectedDeliveryDate, 'Credit'
      )
    `, {
      CompanyID: companyId,
      SupplierID: data.supplierId,
      UserID: userId,
      PONumber: poNumber,
      Subtotal: subtotal,
      DiscountAmount: discountAmount,
      TaxAmount: taxAmount,
      TotalAmount: totalAmount,
      Status: data.status || 'Ordered',
      BranchName: data.branchName || null,
      Notes: data.notes || null,
      ExpectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null
    });

    const poId = poResult.recordset[0].PurchaseOrderID;

    // 2. Insert items
    for (const item of data.items) {
      const itemSubtotal = parseFloat(item.quantity) * parseFloat(item.unitCost);
      await db.query(`
        INSERT INTO dbo.PurchaseOrderItems (
          PurchaseOrderID, ProductID, Quantity, ReceivedQty, UnitCost, Subtotal, Discount, Tax
        ) VALUES (
          @PurchaseOrderID, @ProductID, @Quantity, 0.000, @UnitCost, @Subtotal, @Discount, @Tax
        )
      `, {
        PurchaseOrderID: poId,
        ProductID: item.productId,
        Quantity: parseFloat(item.quantity),
        UnitCost: parseFloat(item.unitCost),
        Subtotal: itemSubtotal,
        Discount: parseFloat(item.discount || 0),
        Tax: parseFloat(item.tax || 0)
      });
    }

    return poResult.recordset[0];
  }

  async createDirectCashPurchase(companyId, userId, data) {
    const prefix = 'BILL-' + new Date().getFullYear();
    const result = await db.query(`
      SELECT TOP 1 PONumber 
      FROM dbo.PurchaseOrders 
      WHERE CompanyID = @CompanyID AND PONumber LIKE @Prefix + '%'
      ORDER BY PONumber DESC
    `, { CompanyID: companyId, Prefix: prefix });

    let count = 1;
    if (result.recordset.length > 0) {
      const last = result.recordset[0].PONumber;
      const numStr = last.replace(prefix + '-', '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num)) {
        count = num + 1;
      }
    }
    const billNumber = `${prefix}-${count.toString().padStart(4, '0')}`;
    
    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unitCost)), 0);
    const itemDiscounts = data.items.reduce((sum, item) => sum + parseFloat(item.discount || 0), 0);
    const itemTaxes = data.items.reduce((sum, item) => sum + parseFloat(item.tax || 0), 0);
    
    const discountAmount = parseFloat(data.discountAmount || itemDiscounts || 0);
    const taxAmount = parseFloat(data.taxAmount || itemTaxes || 0);
    const totalAmount = subtotal - discountAmount + taxAmount;

    const invoiceNumber = data.invoiceNumber || 'CSH-' + Date.now().toString().slice(-8);
    const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();

    // 1. Insert header into PurchaseOrders
    const poResult = await db.query(`
      INSERT INTO dbo.PurchaseOrders (
        CompanyID, SupplierID, UserID, PONumber, Subtotal, DiscountAmount, TaxAmount, 
        TotalAmount, Status, PurchaseType, PaymentStatus, AmountPaid, BranchName, Notes, 
        InvoiceNumber, InvoiceDate, GRNNumber, GRNDate
      )
      OUTPUT inserted.PurchaseOrderID, inserted.PONumber, inserted.TotalAmount, inserted.Status, inserted.PurchaseType
      VALUES (
        @CompanyID, @SupplierID, @UserID, @PONumber, @Subtotal, @DiscountAmount, @TaxAmount, 
        @TotalAmount, 'Invoiced', 'Cash', 'Paid', @TotalAmount, @BranchName, @Notes,
        @InvoiceNumber, @InvoiceDate, @GRNNumber, @GRNDate
      )
    `, {
      CompanyID: companyId,
      SupplierID: data.supplierId,
      UserID: userId,
      PONumber: billNumber,
      Subtotal: subtotal,
      DiscountAmount: discountAmount,
      TaxAmount: taxAmount,
      TotalAmount: totalAmount,
      BranchName: data.branchName || null,
      Notes: data.notes || null,
      InvoiceNumber: invoiceNumber,
      InvoiceDate: invoiceDate,
      GRNNumber: 'GRN-' + billNumber,
      GRNDate: invoiceDate
    });

    const poId = poResult.recordset[0].PurchaseOrderID;

    // 2. Insert items and update stock
    for (const item of data.items) {
      const itemSubtotal = parseFloat(item.quantity) * parseFloat(item.unitCost);
      await db.query(`
        INSERT INTO dbo.PurchaseOrderItems (
          PurchaseOrderID, ProductID, Quantity, ReceivedQty, UnitCost, Subtotal, Discount, Tax,
          BatchNo, MfgDate, ExpiryDate, WarehouseName
        ) VALUES (
          @PurchaseOrderID, @ProductID, @Quantity, @Quantity, @UnitCost, @Subtotal, @Discount, @Tax,
          @BatchNo, @MfgDate, @ExpiryDate, @WarehouseName
        )
      `, {
        PurchaseOrderID: poId,
        ProductID: item.productId,
        Quantity: parseFloat(item.quantity),
        UnitCost: parseFloat(item.unitCost),
        Subtotal: itemSubtotal,
        Discount: parseFloat(item.discount || 0),
        Tax: parseFloat(item.tax || 0),
        BatchNo: item.batchNo || null,
        MfgDate: item.mfgDate || null,
        ExpiryDate: item.expiryDate || null,
        WarehouseName: item.warehouseName || null
      });

      // Update Stock counts in Products
      await db.query(`
        UPDATE dbo.Products
        SET Stock = Stock + @Qty
        WHERE ProductID = @ProductID AND CompanyID = @CompanyID
      `, {
        Qty: parseFloat(item.quantity),
        ProductID: item.productId,
        CompanyID: companyId
      });

      // Update product batches if applicable
      const productResult = await db.query(`
        SELECT IsBatchTracked FROM dbo.Products WHERE ProductID = @ProductID
      `, { ProductID: item.productId });

      if (productResult.recordset[0]?.IsBatchTracked && item.batchNo && item.expiryDate) {
        const existingBatch = await db.query(`
          SELECT BatchID FROM dbo.ProductBatches
          WHERE BatchNo = @BatchNo AND ProductID = @ProductID AND CompanyID = @CompanyID
        `, { BatchNo: item.batchNo, ProductID: item.productId, CompanyID: companyId });

        if (existingBatch.recordset.length > 0) {
          await db.query(`
            UPDATE dbo.ProductBatches
            SET CurrentQty = CurrentQty + @Qty
            WHERE BatchID = @BatchID
          `, { Qty: parseFloat(item.quantity), BatchID: existingBatch.recordset[0].BatchID });
        } else {
          await db.query(`
            INSERT INTO dbo.ProductBatches (
              ProductID, CompanyID, BatchNo, MfgDate, ExpiryDate, 
              InitialQty, CurrentQty, WarehouseName
            ) VALUES (
              @ProductID, @CompanyID, @BatchNo, @MfgDate, @ExpiryDate, 
              @Qty, @Qty, @WarehouseName
            )
          `, {
            ProductID: item.productId,
            CompanyID: companyId,
            BatchNo: item.batchNo,
            MfgDate: item.mfgDate || null,
            ExpiryDate: item.expiryDate,
            Qty: parseFloat(item.quantity),
            WarehouseName: item.warehouseName || null
          });
        }
      }
    }

    // 3. Post offsetting entries to SupplierLedger for audit transparency
    const latestBalanceResult = await db.query(`
      SELECT CurrentBalance FROM dbo.Suppliers WHERE SupplierID = @SupplierID
    `, { SupplierID: data.supplierId });
    const runningBalance = parseFloat(latestBalanceResult.recordset[0]?.CurrentBalance || 0);

    // First, Credit (Purchase Invoice)
    await db.query(`
      INSERT INTO dbo.SupplierLedger (
        CompanyID, SupplierID, TransactionType, ReferenceType, ReferenceNumber, 
        Amount, RunningBalance, Description, BranchName
      ) VALUES (
        @CompanyID, @SupplierID, 'Credit', 'Purchase Invoice', @InvoiceNumber, 
        @Amount, @RunningBalance, @Description, @BranchName
      )
    `, {
      CompanyID: companyId,
      SupplierID: data.supplierId,
      InvoiceNumber: invoiceNumber,
      Amount: totalAmount,
      RunningBalance: runningBalance,
      Description: `Direct Cash Purchase Bill ${billNumber}`,
      BranchName: data.branchName || null
    });

    // Then, Debit (Payment Made)
    await db.query(`
      INSERT INTO dbo.SupplierLedger (
        CompanyID, SupplierID, TransactionType, ReferenceType, ReferenceNumber, 
        Amount, RunningBalance, Description, BranchName
      ) VALUES (
        @CompanyID, @SupplierID, 'Debit', 'Payment Made', @InvoiceNumber, 
        @Amount, @RunningBalance, @Description, @BranchName
      )
    `, {
      CompanyID: companyId,
      SupplierID: data.supplierId,
      InvoiceNumber: invoiceNumber,
      Amount: totalAmount,
      RunningBalance: runningBalance,
      Description: `Direct cash purchase payment settlement`,
      BranchName: data.branchName || null
    });

    return poResult.recordset[0];
  }

  async createDirectCreditPurchase(companyId, userId, data) {
    const prefix = 'BILL-' + new Date().getFullYear();
    const result = await db.query(`
      SELECT TOP 1 PONumber 
      FROM dbo.PurchaseOrders 
      WHERE CompanyID = @CompanyID AND PONumber LIKE @Prefix + '%'
      ORDER BY PONumber DESC
    `, { CompanyID: companyId, Prefix: prefix });

    let count = 1;
    if (result.recordset.length > 0) {
      const last = result.recordset[0].PONumber;
      const numStr = last.replace(prefix + '-', '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num)) {
        count = num + 1;
      }
    }
    const billNumber = `${prefix}-${count.toString().padStart(4, '0')}`;
    
    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unitCost)), 0);
    const itemDiscounts = data.items.reduce((sum, item) => sum + parseFloat(item.discount || 0), 0);
    const itemTaxes = data.items.reduce((sum, item) => sum + parseFloat(item.tax || 0), 0);
    
    const discountAmount = parseFloat(data.discountAmount || itemDiscounts || 0);
    const taxAmount = parseFloat(data.taxAmount || itemTaxes || 0);
    const totalAmount = subtotal - discountAmount + taxAmount;

    const paidAmount = parseFloat(data.paidAmount || 0);
    const balanceDue = totalAmount - paidAmount;

    let paymentStatus = 'Unpaid';
    if (paidAmount >= totalAmount) {
      paymentStatus = 'Paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'Partially Paid';
    }

    const invoiceNumber = data.invoiceNumber || 'INV-' + Date.now().toString().slice(-8);
    const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();
    const dueDate = data.dueDate ? new Date(data.dueDate) : null;

    // 1. Insert header into PurchaseOrders
    const poResult = await db.query(`
      INSERT INTO dbo.PurchaseOrders (
        CompanyID, SupplierID, UserID, PONumber, Subtotal, DiscountAmount, TaxAmount, 
        TotalAmount, Status, PurchaseType, PaymentStatus, AmountPaid, BranchName, Notes, 
        InvoiceNumber, InvoiceDate, DueDate, GRNNumber, GRNDate
      )
      OUTPUT inserted.PurchaseOrderID, inserted.PONumber, inserted.TotalAmount, inserted.Status, inserted.PurchaseType
      VALUES (
        @CompanyID, @SupplierID, @UserID, @PONumber, @Subtotal, @DiscountAmount, @TaxAmount, 
        @TotalAmount, 'Invoiced', 'Credit', @PaymentStatus, @AmountPaid, @BranchName, @Notes,
        @InvoiceNumber, @InvoiceDate, @DueDate, @GRNNumber, @GRNDate
      )
    `, {
      CompanyID: companyId,
      SupplierID: data.supplierId,
      UserID: userId,
      PONumber: billNumber,
      Subtotal: subtotal,
      DiscountAmount: discountAmount,
      TaxAmount: taxAmount,
      TotalAmount: totalAmount,
      PaymentStatus: paymentStatus,
      AmountPaid: paidAmount,
      BranchName: data.branchName || null,
      Notes: data.notes || null,
      InvoiceNumber: invoiceNumber,
      InvoiceDate: invoiceDate,
      DueDate: dueDate,
      GRNNumber: 'GRN-' + billNumber,
      GRNDate: invoiceDate
    });

    const poId = poResult.recordset[0].PurchaseOrderID;

    // 2. Insert items and update stock
    for (const item of data.items) {
      const itemSubtotal = parseFloat(item.quantity) * parseFloat(item.unitCost);
      await db.query(`
        INSERT INTO dbo.PurchaseOrderItems (
          PurchaseOrderID, ProductID, Quantity, ReceivedQty, UnitCost, Subtotal, Discount, Tax,
          BatchNo, MfgDate, ExpiryDate, WarehouseName
        ) VALUES (
          @PurchaseOrderID, @ProductID, @Quantity, @Quantity, @UnitCost, @Subtotal, @Discount, @Tax,
          @BatchNo, @MfgDate, @ExpiryDate, @WarehouseName
        )
      `, {
        PurchaseOrderID: poId,
        ProductID: item.productId,
        Quantity: parseFloat(item.quantity),
        UnitCost: parseFloat(item.unitCost),
        Subtotal: itemSubtotal,
        Discount: parseFloat(item.discount || 0),
        Tax: parseFloat(item.tax || 0),
        BatchNo: item.batchNo || null,
        MfgDate: item.mfgDate || null,
        ExpiryDate: item.expiryDate || null,
        WarehouseName: item.warehouseName || null
      });

      // Update Stock counts in Products
      await db.query(`
        UPDATE dbo.Products
        SET Stock = Stock + @Qty
        WHERE ProductID = @ProductID AND CompanyID = @CompanyID
      `, {
        Qty: parseFloat(item.quantity),
        ProductID: item.productId,
        CompanyID: companyId
      });

      // Update product batches if applicable
      const productResult = await db.query(`
        SELECT IsBatchTracked FROM dbo.Products WHERE ProductID = @ProductID
      `, { ProductID: item.productId });

      if (productResult.recordset[0]?.IsBatchTracked && item.batchNo && item.expiryDate) {
        const existingBatch = await db.query(`
          SELECT BatchID FROM dbo.ProductBatches
          WHERE BatchNo = @BatchNo AND ProductID = @ProductID AND CompanyID = @CompanyID
        `, { BatchNo: item.batchNo, ProductID: item.productId, CompanyID: companyId });

        if (existingBatch.recordset.length > 0) {
          await db.query(`
            UPDATE dbo.ProductBatches
            SET CurrentQty = CurrentQty + @Qty
            WHERE BatchID = @BatchID
          `, { Qty: parseFloat(item.quantity), BatchID: existingBatch.recordset[0].BatchID });
        } else {
          await db.query(`
            INSERT INTO dbo.ProductBatches (
              ProductID, CompanyID, BatchNo, MfgDate, ExpiryDate, 
              InitialQty, CurrentQty, WarehouseName
            ) VALUES (
              @ProductID, @CompanyID, @BatchNo, @MfgDate, @ExpiryDate, 
              @Qty, @Qty, @WarehouseName
            )
          `, {
            ProductID: item.productId,
            CompanyID: companyId,
            BatchNo: item.batchNo,
            MfgDate: item.mfgDate || null,
            ExpiryDate: item.expiryDate,
            Qty: parseFloat(item.quantity),
            WarehouseName: item.warehouseName || null
          });
        }
      }
    }

    // 3. Increment supplier outstanding balance by the unpaid net amount
    const netBalanceIncrease = totalAmount - paidAmount;
    await db.query(`
      UPDATE dbo.Suppliers
      SET CurrentBalance = CurrentBalance + @Amount
      WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID
    `, { Amount: netBalanceIncrease, SupplierID: data.supplierId, CompanyID: companyId });

    // 4. Ledger Entries:
    let latestBalanceResult = await db.query(`
      SELECT CurrentBalance FROM dbo.Suppliers WHERE SupplierID = @SupplierID
    `, { SupplierID: data.supplierId });
    let runningBalance = parseFloat(latestBalanceResult.recordset[0]?.CurrentBalance || 0);
    const balanceAfterInvoice = runningBalance + paidAmount;

    await db.query(`
      INSERT INTO dbo.SupplierLedger (
        CompanyID, SupplierID, TransactionType, ReferenceType, ReferenceNumber, 
        Amount, RunningBalance, Description, BranchName
      ) VALUES (
        @CompanyID, @SupplierID, 'Credit', 'Purchase Invoice', @InvoiceNumber, 
        @Amount, @RunningBalanceAfterInvoice, @Description, @BranchName
      )
    `, {
      CompanyID: companyId,
      SupplierID: data.supplierId,
      InvoiceNumber: invoiceNumber,
      Amount: totalAmount,
      RunningBalanceAfterInvoice: balanceAfterInvoice,
      Description: `Direct Credit Purchase Bill ${billNumber}`,
      BranchName: data.branchName || null
    });

    // If immediate payment was made, log the Debit entry
    if (paidAmount > 0) {
      const paymentNumber = 'PV-' + Date.now().toString().slice(-8);

      await db.query(`
        INSERT INTO dbo.SupplierPayments (
          CompanyID, SupplierID, UserID, PaymentNumber, PaymentDate, 
          Amount, PaymentMethod, ReferenceNumber, Notes, BranchName
        ) VALUES (
          @CompanyID, @SupplierID, @UserID, @PaymentNumber, @PaymentDate, 
          @Amount, @PaymentMethod, @ReferenceNumber, @Notes, @BranchName
        )
      `, {
        CompanyID: companyId,
        SupplierID: data.supplierId,
        UserID: userId,
        PaymentNumber: paymentNumber,
        PaymentDate: invoiceDate,
        Amount: paidAmount,
        PaymentMethod: data.paymentMethod || 'Cash',
        ReferenceNumber: data.paymentReference || null,
        Notes: `Immediate payment against direct bill ${billNumber}`,
        BranchName: data.branchName || null
      });

      await db.query(`
        INSERT INTO dbo.SupplierLedger (
          CompanyID, SupplierID, TransactionType, ReferenceType, ReferenceNumber, 
          Amount, RunningBalance, Description, BranchName
        ) VALUES (
          @CompanyID, @SupplierID, 'Debit', 'Payment Made', @PaymentNumber, 
          @Amount, @RunningBalance, @Description, @BranchName
        )
      `, {
        CompanyID: companyId,
        SupplierID: data.supplierId,
        PaymentNumber: paymentNumber,
        Amount: paidAmount,
        RunningBalance: runningBalance,
        Description: `Immediate payment settlement for direct bill ${billNumber}`,
        BranchName: data.branchName || null
      });
    }

    return poResult.recordset[0];
  }

  async getPurchaseOrders(companyId, filters = {}) {
    let sqlQuery = `
      SELECT po.*, s.SupplierName, s.SupplierCode, u.Username
      FROM dbo.PurchaseOrders po
      INNER JOIN dbo.Suppliers s ON po.SupplierID = s.SupplierID
      INNER JOIN dbo.Users u ON po.UserID = u.UserID
      WHERE po.CompanyID = @CompanyID
    `;
    const params = { CompanyID: companyId };

    if (filters.status) {
      sqlQuery += ` AND po.Status = @Status`;
      params.Status = filters.status;
    }
    if (filters.supplierId) {
      sqlQuery += ` AND po.SupplierID = @SupplierID`;
      params.SupplierID = filters.supplierId;
    }
    if (filters.branchName) {
      sqlQuery += ` AND (po.BranchName = @BranchName OR po.BranchName IS NULL)`;
      params.BranchName = filters.branchName;
    }
    if (filters.search) {
      sqlQuery += ` AND po.PONumber LIKE @Search`;
      params.Search = `%${filters.search}%`;
    }

    sqlQuery += ` ORDER BY po.OrderDate DESC`;
    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  async getPurchaseOrderById(purchaseOrderId, companyId) {
    const poResult = await db.query(`
      SELECT po.*, s.SupplierName, s.SupplierCode, s.EmailAddress, s.MobileNumber, s.Address, s.City, s.Country
      FROM dbo.PurchaseOrders po
      INNER JOIN dbo.Suppliers s ON po.SupplierID = s.SupplierID
      WHERE po.PurchaseOrderID = @PurchaseOrderID AND po.CompanyID = @CompanyID
    `, { PurchaseOrderID: purchaseOrderId, CompanyID: companyId });

    if (poResult.recordset.length === 0) return null;

    const itemsResult = await db.query(`
      SELECT poi.*, p.Name AS ProductName, p.SKU, p.Barcode, p.UOM
      FROM dbo.PurchaseOrderItems poi
      INNER JOIN dbo.Products p ON poi.ProductID = p.ProductID
      WHERE poi.PurchaseOrderID = @PurchaseOrderID
    `, { PurchaseOrderID: purchaseOrderId });

    return {
      ...poResult.recordset[0],
      items: itemsResult.recordset
    };
  }

  async updatePurchaseOrder(purchaseOrderId, companyId, data) {
    // Only allow editing Draft or Ordered (not yet GRN received) POs
    const check = await db.query(
      `SELECT Status FROM dbo.PurchaseOrders WHERE PurchaseOrderID = @PurchaseOrderID AND CompanyID = @CompanyID`,
      { PurchaseOrderID: purchaseOrderId, CompanyID: companyId }
    );
    if (check.recordset.length === 0) throw new Error('Purchase Order not found.');
    const status = check.recordset[0].Status;
    if (status !== 'Draft' && status !== 'Ordered') {
      throw new Error(`Cannot edit a PO with status "${status}". Only Draft or Ordered POs can be modified.`);
    }

    const subtotal = data.items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unitCost)), 0);
    const itemDiscounts = data.items.reduce((sum, item) => sum + parseFloat(item.discount || 0), 0);
    const itemTaxes    = data.items.reduce((sum, item) => sum + parseFloat(item.tax || 0), 0);
    const discountAmount = parseFloat(data.discountAmount || itemDiscounts || 0);
    const taxAmount      = parseFloat(data.taxAmount || itemTaxes || 0);
    const totalAmount    = subtotal - discountAmount + taxAmount;

    // Update header
    await db.query(`
      UPDATE dbo.PurchaseOrders
      SET SupplierID           = @SupplierID,
          Subtotal             = @Subtotal,
          DiscountAmount       = @DiscountAmount,
          TaxAmount            = @TaxAmount,
          TotalAmount          = @TotalAmount,
          Status               = @Status,
          BranchName           = @BranchName,
          Notes                = @Notes,
          ExpectedDeliveryDate = @ExpectedDeliveryDate
      WHERE PurchaseOrderID = @PurchaseOrderID AND CompanyID = @CompanyID
    `, {
      SupplierID: data.supplierId,
      Subtotal: subtotal,
      DiscountAmount: discountAmount,
      TaxAmount: taxAmount,
      TotalAmount: totalAmount,
      Status: data.status || status,
      BranchName: data.branchName || null,
      Notes: data.notes || null,
      ExpectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
      PurchaseOrderID: purchaseOrderId,
      CompanyID: companyId
    });

    // Replace items: delete old, insert new
    await db.query(`DELETE FROM dbo.PurchaseOrderItems WHERE PurchaseOrderID = @PurchaseOrderID`, { PurchaseOrderID: purchaseOrderId });
    for (const item of data.items) {
      const itemSubtotal = parseFloat(item.quantity) * parseFloat(item.unitCost);
      await db.query(`
        INSERT INTO dbo.PurchaseOrderItems (PurchaseOrderID, ProductID, Quantity, ReceivedQty, UnitCost, Subtotal, Discount, Tax)
        VALUES (@PurchaseOrderID, @ProductID, @Quantity, 0.000, @UnitCost, @Subtotal, @Discount, @Tax)
      `, {
        PurchaseOrderID: purchaseOrderId,
        ProductID: item.productId,
        Quantity: parseFloat(item.quantity),
        UnitCost: parseFloat(item.unitCost),
        Subtotal: itemSubtotal,
        Discount: parseFloat(item.discount || 0),
        Tax: parseFloat(item.tax || 0)
      });
    }

    return await this.getPurchaseOrderById(purchaseOrderId, companyId);
  }

  async deletePurchaseOrder(purchaseOrderId, companyId) {
    const check = await db.query(
      `SELECT Status FROM dbo.PurchaseOrders WHERE PurchaseOrderID = @PurchaseOrderID AND CompanyID = @CompanyID`,
      { PurchaseOrderID: purchaseOrderId, CompanyID: companyId }
    );
    if (check.recordset.length === 0) throw new Error('Purchase Order not found.');
    const status = check.recordset[0].Status;
    if (status !== 'Draft' && status !== 'Ordered') {
      throw new Error(`Cannot delete a PO with status "${status}". Only Draft or Ordered POs can be deleted.`);
    }
    await db.query(`DELETE FROM dbo.PurchaseOrderItems WHERE PurchaseOrderID = @PurchaseOrderID`, { PurchaseOrderID: purchaseOrderId });
    await db.query(`DELETE FROM dbo.PurchaseOrders WHERE PurchaseOrderID = @PurchaseOrderID AND CompanyID = @CompanyID`, { PurchaseOrderID: purchaseOrderId, CompanyID: companyId });
    return true;
  }

  // --- GOODS RECEIVED NOTE (GRN) ---


  async receiveGRN(purchaseOrderId, companyId, data) {
    const grnNumber = 'GRN-' + Date.now().toString().slice(-8);
    const grnDate = new Date();

    // Update PO status & header info
    await db.query(`
      UPDATE dbo.PurchaseOrders
      SET Status = 'GRN Received',
          GRNNumber = @GRNNumber,
          GRNDate = @GRNDate
      WHERE PurchaseOrderID = @PurchaseOrderID AND CompanyID = @CompanyID
    `, {
      GRNNumber: grnNumber,
      GRNDate: grnDate,
      PurchaseOrderID: purchaseOrderId,
      CompanyID: companyId
    });

    // Process each item received
    for (const item of data.items) {
      // 1. Update received qty in PO items
      await db.query(`
        UPDATE dbo.PurchaseOrderItems
        SET ReceivedQty = @ReceivedQty,
            BatchNo = @BatchNo,
            MfgDate = @MfgDate,
            ExpiryDate = @ExpiryDate,
            WarehouseName = @WarehouseName
        WHERE PurchaseOrderID = @PurchaseOrderID AND ProductID = @ProductID
      `, {
        ReceivedQty: parseFloat(item.receivedQty),
        BatchNo: item.batchNo || null,
        MfgDate: item.mfgDate || null,
        ExpiryDate: item.expiryDate || null,
        WarehouseName: item.warehouseName || null,
        PurchaseOrderID: purchaseOrderId,
        ProductID: item.productId
      });

      // 2. Increment stock counts in Products
      await db.query(`
        UPDATE dbo.Products
        SET Stock = Stock + @Qty
        WHERE ProductID = @ProductID AND CompanyID = @CompanyID
      `, {
        Qty: parseFloat(item.receivedQty),
        ProductID: item.productId,
        CompanyID: companyId
      });

      // 3. For batch-tracked products, register batch in ProductBatches
      const productResult = await db.query(`
        SELECT IsBatchTracked FROM dbo.Products WHERE ProductID = @ProductID
      `, { ProductID: item.productId });

      if (productResult.recordset[0]?.IsBatchTracked && item.batchNo && item.expiryDate) {
        // Check if batch exists already
        const existingBatch = await db.query(`
          SELECT BatchID FROM dbo.ProductBatches
          WHERE BatchNo = @BatchNo AND ProductID = @ProductID AND CompanyID = @CompanyID
        `, { BatchNo: item.batchNo, ProductID: item.productId, CompanyID: companyId });

        if (existingBatch.recordset.length > 0) {
          // Add to existing batch
          await db.query(`
            UPDATE dbo.ProductBatches
            SET CurrentQty = CurrentQty + @Qty
            WHERE BatchID = @BatchID
          `, { Qty: parseFloat(item.receivedQty), BatchID: existingBatch.recordset[0].BatchID });
        } else {
          // Create new batch record
          await db.query(`
            INSERT INTO dbo.ProductBatches (
              ProductID, CompanyID, BatchNo, MfgDate, ExpiryDate, 
              InitialQty, CurrentQty, WarehouseName
            ) VALUES (
              @ProductID, @CompanyID, @BatchNo, @MfgDate, @ExpiryDate, 
              @Qty, @Qty, @WarehouseName
            )
          `, {
            ProductID: item.productId,
            CompanyID: companyId,
            BatchNo: item.batchNo,
            MfgDate: item.mfgDate || null,
            ExpiryDate: item.expiryDate,
            Qty: parseFloat(item.receivedQty),
            WarehouseName: item.warehouseName || null
          });
        }
      }
    }

    return { grnNumber, grnDate };
  }

  // --- PURCHASE INVOICING & DEBT LEDGER ---

  async invoicePurchaseOrder(purchaseOrderId, companyId, data) {
    const invoiceNumber = data.invoiceNumber || 'INV-' + Date.now().toString().slice(-8);
    const invoiceDate = data.invoiceDate || new Date();
    const dueDate = data.dueDate ? new Date(data.dueDate) : null;
    const paymentTerms = data.paymentTerms || null;

    // 1. Fetch the Purchase Order to get totals and supplier info
    const poResult = await db.query(`
      SELECT po.TotalAmount, po.SupplierID, po.PONumber, po.BranchName, s.CurrentBalance
      FROM dbo.PurchaseOrders po
      INNER JOIN dbo.Suppliers s ON po.SupplierID = s.SupplierID
      WHERE po.PurchaseOrderID = @PurchaseOrderID AND po.CompanyID = @CompanyID
    `, { PurchaseOrderID: purchaseOrderId, CompanyID: companyId });

    if (poResult.recordset.length === 0) throw new Error('Purchase Order not found.');

    const po = poResult.recordset[0];
    const totalAmount = parseFloat(po.TotalAmount);
    const supplierId = po.SupplierID;
    const branchName = po.BranchName;

    // 2. Set Status to 'Invoiced' and store invoice number, due date, payment terms
    await db.query(`
      UPDATE dbo.PurchaseOrders
      SET Status = 'Invoiced',
          InvoiceNumber = @InvoiceNumber,
          InvoiceDate = @InvoiceDate,
          DueDate = @DueDate,
          PaymentTerms = @PaymentTerms
      WHERE PurchaseOrderID = @PurchaseOrderID AND CompanyID = @CompanyID
    `, {
      InvoiceNumber: invoiceNumber,
      InvoiceDate: invoiceDate,
      DueDate: dueDate,
      PaymentTerms: paymentTerms,
      PurchaseOrderID: purchaseOrderId,
      CompanyID: companyId
    });

    // 3. Increment supplier outstanding balance
    await db.query(`
      UPDATE dbo.Suppliers
      SET CurrentBalance = CurrentBalance + @Amount
      WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID
    `, { Amount: totalAmount, SupplierID: supplierId, CompanyID: companyId });

    // 4. Record Credit entry in SupplierLedger
    const latestBalanceResult = await db.query(`
      SELECT CurrentBalance FROM dbo.Suppliers WHERE SupplierID = @SupplierID
    `, { SupplierID: supplierId });
    const runningBalance = parseFloat(latestBalanceResult.recordset[0].CurrentBalance);

    await db.query(`
      INSERT INTO dbo.SupplierLedger (
        CompanyID, SupplierID, TransactionType, ReferenceType, ReferenceNumber, 
        Amount, RunningBalance, Description, BranchName
      ) VALUES (
        @CompanyID, @SupplierID, 'Credit', 'Purchase Invoice', @InvoiceNumber, 
        @Amount, @RunningBalance, @Description, @BranchName
      )
    `, {
      CompanyID: companyId,
      SupplierID: supplierId,
      InvoiceNumber: invoiceNumber,
      Amount: totalAmount,
      RunningBalance: runningBalance,
      Description: `Inventory stock invoiced via PO ${po.PONumber}`,
      BranchName: branchName || null
    });

    return { invoiceNumber, invoiceDate };
  }

  // --- SUPPLIER SETTLEMENTS (PAYMENTS) ---

  async createSupplierPayment(companyId, userId, data) {
    const paymentNumber = 'PV-' + Date.now().toString().slice(-8); // Payment Voucher
    const paymentDate = data.paymentDate || new Date();
    const amount = parseFloat(data.amount);
    const supplierId = data.supplierId;

    // 1. Log Payment Voucher record
    await db.query(`
      INSERT INTO dbo.SupplierPayments (
        CompanyID, SupplierID, UserID, PaymentNumber, PaymentDate, 
        Amount, PaymentMethod, ReferenceNumber, Notes, BranchName
      ) VALUES (
        @CompanyID, @SupplierID, @UserID, @PaymentNumber, @PaymentDate, 
        @Amount, @PaymentMethod, @ReferenceNumber, @Notes, @BranchName
      )
    `, {
      CompanyID: companyId,
      SupplierID: supplierId,
      UserID: userId,
      PaymentNumber: paymentNumber,
      PaymentDate: paymentDate,
      Amount: amount,
      PaymentMethod: data.paymentMethod,
      ReferenceNumber: data.referenceNumber || null,
      Notes: data.notes || null,
      BranchName: data.branchName || null
    });

    // 2. Decrement outstanding balance in Suppliers
    await db.query(`
      UPDATE dbo.Suppliers
      SET CurrentBalance = CurrentBalance - @Amount
      WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID
    `, { Amount: amount, SupplierID: supplierId, CompanyID: companyId });

    // 3. Log Debit entry in Ledger
    const latestBalanceResult = await db.query(`
      SELECT CurrentBalance FROM dbo.Suppliers WHERE SupplierID = @SupplierID
    `, { SupplierID: supplierId });
    const runningBalance = parseFloat(latestBalanceResult.recordset[0].CurrentBalance);

    await db.query(`
      INSERT INTO dbo.SupplierLedger (
        CompanyID, SupplierID, TransactionType, ReferenceType, ReferenceNumber, 
        Amount, RunningBalance, Description, BranchName
      ) VALUES (
        @CompanyID, @SupplierID, 'Debit', 'Payment Made', @PaymentNumber, 
        @Amount, @RunningBalance, @Description, @BranchName
      )
    `, {
      CompanyID: companyId,
      SupplierID: supplierId,
      PaymentNumber: paymentNumber,
      Amount: amount,
      RunningBalance: runningBalance,
      Description: data.notes || `Cash checkout settlement to supplier via ${data.paymentMethod}`,
      BranchName: data.branchName || null
    });

    return { paymentNumber, paymentDate };
  }

  // --- SUPPLIER RETURNS ---

  async createSupplierReturn(companyId, userId, data) {
    const returnNumber = 'RET-' + Date.now().toString().slice(-8);
    const returnDate = new Date();
    const totalAmount = data.items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unitCost)), 0);
    const returnType = data.returnType || 'Credit';

    // 1. Insert return header
    const returnResult = await db.query(`
      INSERT INTO dbo.SupplierReturns (
        CompanyID, SupplierID, UserID, ReturnNumber, ReturnDate, TotalAmount, Reason, BranchName, ReturnType
      )
      OUTPUT inserted.ReturnID, inserted.ReturnNumber, inserted.ReturnType
      VALUES (
        @CompanyID, @SupplierID, @UserID, @ReturnNumber, @ReturnDate, @TotalAmount, @Reason, @BranchName, @ReturnType
      )
    `, {
      CompanyID: companyId,
      SupplierID: data.supplierId,
      UserID: userId,
      ReturnNumber: returnNumber,
      ReturnDate: returnDate,
      TotalAmount: totalAmount,
      Reason: data.reason || null,
      BranchName: data.branchName || null,
      ReturnType: returnType
    });

    const returnId = returnResult.recordset[0].ReturnID;

    // 2. Insert return items and adjust stock levels downward
    for (const item of data.items) {
      await db.query(`
        INSERT INTO dbo.SupplierReturnItems (ReturnID, ProductID, Quantity, UnitCost, Subtotal, BatchNo)
        VALUES (@ReturnID, @ProductID, @Quantity, @UnitCost, @Subtotal, @BatchNo)
      `, {
        ReturnID: returnId,
        ProductID: item.productId,
        Quantity: parseFloat(item.quantity),
        UnitCost: parseFloat(item.unitCost),
        Subtotal: parseFloat(item.quantity) * parseFloat(item.unitCost),
        BatchNo: item.batchNo || null
      });

      // Adjust product stock
      await db.query(`
        UPDATE dbo.Products
        SET Stock = Stock - @Qty
        WHERE ProductID = @ProductID AND CompanyID = @CompanyID
      `, {
        Qty: parseFloat(item.quantity),
        ProductID: item.productId,
        CompanyID: companyId
      });

      // Adjust batch quantities if batch specified
      if (item.batchNo) {
        await db.query(`
          UPDATE dbo.ProductBatches
          SET CurrentQty = CurrentQty - @Qty
          WHERE BatchNo = @BatchNo AND ProductID = @ProductID AND CompanyID = @CompanyID
        `, { Qty: parseFloat(item.quantity), BatchNo: item.batchNo, ProductID: item.productId, CompanyID: companyId });
      }
    }

    // 3. Subtract from outstanding balance in Suppliers (for both Cash and Credit returns)
    await db.query(`
      UPDATE dbo.Suppliers
      SET CurrentBalance = CurrentBalance - @Amount
      WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID
    `, { Amount: totalAmount, SupplierID: data.supplierId, CompanyID: companyId });

    // 4. Log Debit entry in Ledger
    const latestBalanceResult = await db.query(`
      SELECT CurrentBalance FROM dbo.Suppliers WHERE SupplierID = @SupplierID
    `, { SupplierID: data.supplierId });
    const runningBalance = parseFloat(latestBalanceResult.recordset[0]?.CurrentBalance || 0);

    await db.query(`
      INSERT INTO dbo.SupplierLedger (
        CompanyID, SupplierID, TransactionType, ReferenceType, ReferenceNumber, 
        Amount, RunningBalance, Description, BranchName
      ) VALUES (
        @CompanyID, @SupplierID, 'Debit', 'Supplier Return', @ReturnNumber, 
        @Amount, @RunningBalance, @Description, @BranchName
      )
    `, {
      CompanyID: companyId,
      SupplierID: data.supplierId,
      ReturnNumber: returnNumber,
      Amount: totalAmount,
      RunningBalance: runningBalance,
      Description: data.reason || `Stock returned to supplier (${returnType} return)`,
      BranchName: data.branchName || null
    });

    return returnResult.recordset[0];
  }

  async getSupplierReturnById(returnId, companyId) {
    const returnResult = await db.query(`
      SELECT r.*, s.SupplierName, s.SupplierCode, u.Username
      FROM dbo.SupplierReturns r
      INNER JOIN dbo.Suppliers s ON r.SupplierID = s.SupplierID
      INNER JOIN dbo.Users u ON r.UserID = u.UserID
      WHERE r.ReturnID = @ReturnID AND r.CompanyID = @CompanyID
    `, { ReturnID: returnId, CompanyID: companyId });

    if (returnResult.recordset.length === 0) return null;

    const itemsResult = await db.query(`
      SELECT ri.*, p.Name AS ProductName, p.SKU, p.Barcode, p.UOM
      FROM dbo.SupplierReturnItems ri
      INNER JOIN dbo.Products p ON ri.ProductID = p.ProductID
      WHERE ri.ReturnID = @ReturnID
    `, { ReturnID: returnId });

    return {
      ...returnResult.recordset[0],
      items: itemsResult.recordset
    };
  }

  async deleteSupplierReturn(returnId, companyId) {
    const ret = await this.getSupplierReturnById(returnId, companyId);
    if (!ret) throw new Error('Return log not found.');

    // 1. Revert product stock levels (add back returned quantities)
    for (const item of ret.items) {
      await db.query(`
        UPDATE dbo.Products
        SET Stock = Stock + @Qty
        WHERE ProductID = @ProductID AND CompanyID = @CompanyID
      `, { Qty: parseFloat(item.Quantity), ProductID: item.ProductID, CompanyID: companyId });

      if (item.BatchNo) {
        await db.query(`
          UPDATE dbo.ProductBatches
          SET CurrentQty = CurrentQty + @Qty
          WHERE BatchNo = @BatchNo AND ProductID = @ProductID AND CompanyID = @CompanyID
        `, { Qty: parseFloat(item.Quantity), BatchNo: item.BatchNo, ProductID: item.ProductID, CompanyID: companyId });
      }
    }

    // 2. Revert supplier outstanding balance (add back return amount)
    await db.query(`
      UPDATE dbo.Suppliers
      SET CurrentBalance = CurrentBalance + @Amount
      WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID
    `, { Amount: parseFloat(ret.TotalAmount), SupplierID: ret.SupplierID, CompanyID: companyId });

    // 3. Delete debit entry in ledger
    await db.query(`
      DELETE FROM dbo.SupplierLedger
      WHERE CompanyID = @CompanyID AND SupplierID = @SupplierID AND ReferenceType = 'Supplier Return' AND ReferenceNumber = @ReturnNumber
    `, { CompanyID: companyId, SupplierID: ret.SupplierID, ReturnNumber: ret.ReturnNumber });

    // 4. Delete return records
    await db.query(`DELETE FROM dbo.SupplierReturnItems WHERE ReturnID = @ReturnID`, { ReturnID: returnId });
    await db.query(`DELETE FROM dbo.SupplierReturns WHERE ReturnID = @ReturnID AND CompanyID = @CompanyID`, { ReturnID: returnId, CompanyID: companyId });

    return true;
  }

  async updateSupplierReturn(returnId, companyId, userId, data) {
    // 1. Revert old return's stock levels & ledger
    const oldRet = await this.getSupplierReturnById(returnId, companyId);
    if (!oldRet) throw new Error('Return log not found.');

    for (const item of oldRet.items) {
      await db.query(`
        UPDATE dbo.Products SET Stock = Stock + @Qty WHERE ProductID = @ProductID AND CompanyID = @CompanyID
      `, { Qty: parseFloat(item.Quantity), ProductID: item.ProductID, CompanyID: companyId });

      if (item.BatchNo) {
        await db.query(`
          UPDATE dbo.ProductBatches SET CurrentQty = CurrentQty + @Qty WHERE BatchNo = @BatchNo AND ProductID = @ProductID AND CompanyID = @CompanyID
        `, { Qty: parseFloat(item.Quantity), BatchNo: item.BatchNo, ProductID: item.ProductID, CompanyID: companyId });
      }
    }

    // Revert old return's outstanding balance adjustment
    await db.query(`
      UPDATE dbo.Suppliers SET CurrentBalance = CurrentBalance + @Amount WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID
    `, { Amount: parseFloat(oldRet.TotalAmount), SupplierID: oldRet.SupplierID, CompanyID: companyId });

    // Delete old ledger entries & items
    await db.query(`DELETE FROM dbo.SupplierLedger WHERE CompanyID = @CompanyID AND ReferenceType = 'Supplier Return' AND ReferenceNumber = @ReturnNumber`, { CompanyID: companyId, ReturnNumber: oldRet.ReturnNumber });
    await db.query(`DELETE FROM dbo.SupplierReturnItems WHERE ReturnID = @ReturnID`, { ReturnID: returnId });

    // 2. Insert new details and apply stock & balance updates
    const totalAmount = data.items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unitCost)), 0);
    const returnType = data.returnType || 'Credit';

    // Apply new return's outstanding balance adjustment
    await db.query(`
      UPDATE dbo.Suppliers SET CurrentBalance = CurrentBalance - @Amount WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID
    `, { Amount: totalAmount, SupplierID: data.supplierId, CompanyID: companyId });

    // Update Return header (including ReturnType)
    await db.query(`
      UPDATE dbo.SupplierReturns
      SET SupplierID = @SupplierID, TotalAmount = @TotalAmount, Reason = @Reason, BranchName = @BranchName, ReturnType = @ReturnType
      WHERE ReturnID = @ReturnID AND CompanyID = @CompanyID
    `, {
      SupplierID: data.supplierId,
      TotalAmount: totalAmount,
      Reason: data.reason || null,
      BranchName: data.branchName || null,
      ReturnType: returnType,
      ReturnID: returnId,
      CompanyID: companyId
    });

    // Insert new items & adjust stock levels
    for (const item of data.items) {
      await db.query(`
        INSERT INTO dbo.SupplierReturnItems (ReturnID, ProductID, Quantity, UnitCost, Subtotal, BatchNo)
        VALUES (@ReturnID, @ProductID, @Quantity, @UnitCost, @Subtotal, @BatchNo)
      `, {
        ReturnID: returnId,
        ProductID: item.productId,
        Quantity: parseFloat(item.quantity),
        UnitCost: parseFloat(item.unitCost),
        Subtotal: parseFloat(item.quantity) * parseFloat(item.unitCost),
        BatchNo: item.batchNo || null
      });

      // Adjust product stock
      await db.query(`
        UPDATE dbo.Products SET Stock = Stock - @Qty WHERE ProductID = @ProductID AND CompanyID = @CompanyID
      `, { Qty: parseFloat(item.quantity), ProductID: item.productId, CompanyID: companyId });

      if (item.batchNo) {
        await db.query(`
          UPDATE dbo.ProductBatches SET CurrentQty = CurrentQty - @Qty WHERE BatchNo = @BatchNo AND ProductID = @ProductID AND CompanyID = @CompanyID
        `, { Qty: parseFloat(item.quantity), BatchNo: item.batchNo, ProductID: item.productId, CompanyID: companyId });
      }
    }

    // Log Debit entry in Ledger
    const latestBalanceResult = await db.query(`SELECT CurrentBalance FROM dbo.Suppliers WHERE SupplierID = @SupplierID`, { SupplierID: data.supplierId });
    const runningBalance = parseFloat(latestBalanceResult.recordset[0]?.CurrentBalance || 0);

    await db.query(`
      INSERT INTO dbo.SupplierLedger (
        CompanyID, SupplierID, TransactionType, ReferenceType, ReferenceNumber, 
        Amount, RunningBalance, Description, BranchName
      ) VALUES (
        @CompanyID, @SupplierID, 'Debit', 'Supplier Return', @ReturnNumber, 
        @Amount, @RunningBalance, @Description, @BranchName
      )
    `, {
      CompanyID: companyId,
      SupplierID: data.supplierId,
      ReturnNumber: oldRet.ReturnNumber,
      Amount: totalAmount,
      RunningBalance: runningBalance,
      Description: data.reason || `Updated stock returned to supplier (${returnType} return)`,
      BranchName: data.branchName || null
    });

    return await this.getSupplierReturnById(returnId, companyId);
  }

  async getSupplierReturns(companyId, filters = {}) {
    let sqlQuery = `
      SELECT r.*, s.SupplierName, s.SupplierCode, u.Username
      FROM dbo.SupplierReturns r
      INNER JOIN dbo.Suppliers s ON r.SupplierID = s.SupplierID
      INNER JOIN dbo.Users u ON r.UserID = u.UserID
      WHERE r.CompanyID = @CompanyID
    `;
    const params = { CompanyID: companyId };

    if (filters.supplierId) {
      sqlQuery += ` AND r.SupplierID = @SupplierID`;
      params.SupplierID = filters.supplierId;
    }
    if (filters.branchName) {
      sqlQuery += ` AND (r.BranchName = @BranchName OR r.BranchName IS NULL)`;
      params.BranchName = filters.branchName;
    }

    sqlQuery += ` ORDER BY r.ReturnDate DESC`;
    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  // --- LEDGER STATS ---

  // --- LEDGER STATS ---

  async getSupplierLedger(supplierId, companyId, filters = {}) {
    const { startDate, endDate, branchName } = filters;

    // 1. Calculate Opening Balance before startDate (if startDate provided)
    let openingBalance = 0;
    if (startDate) {
      let opQuery = `
        SELECT SUM(CASE WHEN TransactionType = 'Credit' THEN Amount ELSE -Amount END) AS OpBalance
        FROM dbo.SupplierLedger
        WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID AND TransactionDate < @StartDate
      `;
      const opParams = { SupplierID: supplierId, CompanyID: companyId, StartDate: startDate };
      if (branchName) {
        opQuery += ` AND (BranchName = @BranchName OR BranchName IS NULL)`;
        opParams.BranchName = branchName;
      }
      const opResult = await db.query(opQuery, opParams);
      openingBalance = parseFloat(opResult.recordset[0]?.OpBalance || 0);
    }

    // 2. Fetch the transactions in the date range
    let sqlQuery = `
      SELECT * FROM dbo.SupplierLedger
      WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID
    `;
    const params = { SupplierID: supplierId, CompanyID: companyId };

    if (branchName) {
      sqlQuery += ` AND (BranchName = @BranchName OR BranchName IS NULL)`;
      params.BranchName = branchName;
    }
    if (startDate) {
      sqlQuery += ` AND TransactionDate >= @StartDate`;
      params.StartDate = startDate;
    }
    if (endDate) {
      // Set EndDate to end of day to include all transactions on that day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      sqlQuery += ` AND TransactionDate <= @EndDate`;
      params.EndDate = end;
    }

    sqlQuery += ` ORDER BY TransactionDate ASC, LedgerID ASC`;
    const result = await db.query(sqlQuery, params);
    const rawTx = result.recordset;

    // 3. Calculate Running Balances starting from openingBalance
    let currentRunning = openingBalance;
    const transactions = rawTx.map(tx => {
      const amt = parseFloat(tx.Amount);
      if (tx.TransactionType === 'Credit') {
        currentRunning += amt;
      } else {
        currentRunning -= amt;
      }
      return {
        ...tx,
        RunningBalance: currentRunning
      };
    });

    const closingBalance = currentRunning;

    return {
      openingBalance,
      transactions,
      closingBalance
    };
  }

  async createLedgerAdjustment(companyId, userId, data) {
    const amount = parseFloat(data.amount);
    const supplierId = parseInt(data.supplierId, 10);
    const txType = data.effect; // 'Debit' or 'Credit'
    const refType = data.adjustmentType; // 'Debit Note' or 'Credit Note'
    const refNum = data.referenceNumber?.trim() || (refType === 'Debit Note' ? 'DN-' : 'CN-') + Date.now().toString().slice(-8);
    const notes = data.notes?.trim() || `${refType} adjustment`;
    const branchName = data.branchName || null;
    const transactionDate = data.date ? new Date(data.date) : new Date();

    // 1. Update outstanding balance in Suppliers
    if (txType === 'Debit') {
      await db.query(`
        UPDATE dbo.Suppliers
        SET CurrentBalance = CurrentBalance - @Amount
        WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID
      `, { Amount: amount, SupplierID: supplierId, CompanyID: companyId });
    } else {
      await db.query(`
        UPDATE dbo.Suppliers
        SET CurrentBalance = CurrentBalance + @Amount
        WHERE SupplierID = @SupplierID AND CompanyID = @CompanyID
      `, { Amount: amount, SupplierID: supplierId, CompanyID: companyId });
    }

    // 2. Fetch latest balance for ledger entry
    const latestBalanceResult = await db.query(`
      SELECT CurrentBalance FROM dbo.Suppliers WHERE SupplierID = @SupplierID
    `, { SupplierID: supplierId });
    const runningBalance = parseFloat(latestBalanceResult.recordset[0].CurrentBalance);

    // 3. Log ledger entry
    await db.query(`
      INSERT INTO dbo.SupplierLedger (
        CompanyID, SupplierID, TransactionType, ReferenceType, ReferenceNumber, 
        Amount, RunningBalance, Description, BranchName, TransactionDate
      ) VALUES (
        @CompanyID, @SupplierID, @TxType, @RefType, @RefNum, 
        @Amount, @RunningBalance, @Description, @BranchName, @TransactionDate
      )
    `, {
      CompanyID: companyId,
      SupplierID: supplierId,
      TxType: txType,
      RefType: refType,
      RefNum: refNum,
      Amount: amount,
      RunningBalance: runningBalance,
      Description: notes,
      BranchName: branchName,
      TransactionDate: transactionDate
    });

    return { referenceNumber: refNum, transactionDate };
  }

  // --- WIDGET STATS ---

  async getSupplierWidgets(companyId) {
    const totalResult = await db.query(`
      SELECT COUNT(*) AS Total FROM dbo.Suppliers WHERE CompanyID = @CompanyID
    `, { CompanyID: companyId });

    const activeResult = await db.query(`
      SELECT COUNT(*) AS Active FROM dbo.Suppliers WHERE CompanyID = @CompanyID AND Status = 'Active'
    `, { CompanyID: companyId });

    const payablesResult = await db.query(`
      SELECT SUM(CurrentBalance) AS Outstanding FROM dbo.Suppliers WHERE CompanyID = @CompanyID
    `, { CompanyID: companyId });

    const recentPurchases = await db.query(`
      SELECT TOP 5 po.*, s.SupplierName
      FROM dbo.PurchaseOrders po
      INNER JOIN dbo.Suppliers s ON po.SupplierID = s.SupplierID
      WHERE po.CompanyID = @CompanyID
      ORDER BY po.OrderDate DESC
    `, { CompanyID: companyId });

    const creditAlerts = await db.query(`
      SELECT COUNT(*) AS Alerts
      FROM dbo.Suppliers
      WHERE CompanyID = @CompanyID AND CurrentBalance >= (CreditLimit * 0.9) AND CreditLimit > 0
    `, { CompanyID: companyId });

    return {
      totalSuppliers: totalResult.recordset[0]?.Total || 0,
      activeSuppliers: activeResult.recordset[0]?.Active || 0,
      outstandingPayables: payablesResult.recordset[0]?.Outstanding || 0.00,
      creditAlerts: creditAlerts.recordset[0]?.Alerts || 0,
      recentPurchases: recentPurchases.recordset
    };
  }

  // --- AUDITING ---

  async createAuditLog(companyId, userId, action, details) {
    await db.query(`
      INSERT INTO dbo.SupplierAuditLogs (CompanyID, UserID, Action, Details)
      VALUES (@CompanyID, @UserID, @Action, @Details)
    `, {
      CompanyID: companyId,
      UserID: userId,
      Action: action,
      Details: typeof details === 'object' ? JSON.stringify(details) : details
    });
  }

  async getAuditLogs(companyId) {
    const result = await db.query(`
      SELECT al.*, u.Username
      FROM dbo.SupplierAuditLogs al
      INNER JOIN dbo.Users u ON al.UserID = u.UserID
      WHERE al.CompanyID = @CompanyID
      ORDER BY al.Timestamp DESC
    `, { CompanyID: companyId });
    return result.recordset;
  }
}

module.exports = new SupplierRepository();
