const db = require('../config/db');
const customerRepository = require('./customerRepository');

const getOriginalPrice = (item) => {
  if (!item) return 0.00;
  const orig = item.originalPrice !== undefined ? item.originalPrice : item.OriginalPrice;
  const current = item.price !== undefined ? item.price : item.Price;
  const val = (orig !== undefined && orig !== null) ? orig : current;
  const num = parseFloat(val);
  return isNaN(num) ? 0.00 : num;
};

class SalesRepository {
  async getSalesHistory(companyId, filters = {}) {
    let sqlQuery = `
      SELECT so.*, u.Username, c.Name AS CustomerName
      FROM dbo.SalesOrders so
      INNER JOIN dbo.Users u ON so.UserID = u.UserID
      LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
      WHERE so.CompanyID = @CompanyID
    `;
    const params = { CompanyID: companyId };

    if (filters.status) {
      sqlQuery += ` AND so.Status = @Status`;
      params.Status = filters.status;
    } else {
      sqlQuery += ` AND so.Status IN ('Completed', 'Refunded', 'Exchanged')`;
    }

    if (filters.startDate && filters.endDate) {
      sqlQuery += ` AND so.OrderDate BETWEEN @StartDate AND @EndDate`;
      const parseLocalDate = (dateStr, endOfDay = false) => {
        const parts = dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return endOfDay ? new Date(year, month, day, 23, 59, 59, 999) : new Date(year, month, day, 0, 0, 0, 0);
      };
      params.StartDate = parseLocalDate(filters.startDate, false);
      params.EndDate = parseLocalDate(filters.endDate, true);
    }

    if (filters.customerId) {
      sqlQuery += ` AND so.CustomerID = @CustomerID`;
      params.CustomerID = filters.customerId;
    }

    sqlQuery += ` ORDER BY so.OrderDate DESC`;
    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  async getSaleDetails(orderId, companyId) {
    const orderQuery = `
      SELECT so.*, u.Username, c.Name AS CustomerName, c.Phone AS CustomerPhone, c.Email AS CustomerEmail
      FROM dbo.SalesOrders so
      INNER JOIN dbo.Users u ON so.UserID = u.UserID
      LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
      WHERE so.OrderID = @OrderID AND so.CompanyID = @CompanyID
    `;
    
    const itemsQuery = `
      SELECT oi.*, p.Name AS ProductName, p.SKU, p.Barcode, p.UOM
      FROM dbo.OrderItems oi
      INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
      WHERE oi.OrderID = @OrderID
    `;

    const paymentsQuery = `
      SELECT * FROM dbo.OrderPayments
      WHERE OrderID = @OrderID
    `;

    const orderResult = await db.query(orderQuery, { OrderID: orderId, CompanyID: companyId });
    if (orderResult.recordset.length === 0) return null;

    const itemsResult = await db.query(itemsQuery, { OrderID: orderId });
    const paymentsResult = await db.query(paymentsQuery, { OrderID: orderId });

    return {
      order: orderResult.recordset[0],
      items: itemsResult.recordset,
      payments: paymentsResult.recordset
    };
  }

  async createSale(saleData, companyId, userId) {
    const pool = await db.poolPromise;
    const transaction = new db.sql.Transaction(pool);

    try {
      await transaction.begin();

      // 1. Insert SalesOrder
      const orderRequest = new db.sql.Request(transaction);
      orderRequest.input('CompanyID', db.sql.Int, companyId);
      orderRequest.input('UserID', db.sql.Int, userId);
      orderRequest.input('CustomerID', db.sql.Int, saleData.customerId || null);
      orderRequest.input('Subtotal', db.sql.Decimal(18, 2), saleData.subtotal);
      orderRequest.input('DiscountAmount', db.sql.Decimal(18, 2), saleData.discountAmount || 0.00);
      orderRequest.input('TaxAmount', db.sql.Decimal(18, 2), saleData.taxAmount || 0.00);
      orderRequest.input('TotalAmount', db.sql.Decimal(18, 2), saleData.totalAmount);
      orderRequest.input('Status', db.sql.NVarChar(20), 'Completed');

      const orderResult = await orderRequest.query(`
        INSERT INTO dbo.SalesOrders (CompanyID, UserID, CustomerID, Subtotal, DiscountAmount, TaxAmount, TotalAmount, Status)
        OUTPUT inserted.OrderID
        VALUES (@CompanyID, @UserID, @CustomerID, @Subtotal, @DiscountAmount, @TaxAmount, @TotalAmount, @Status)
      `);
      
      const orderId = orderResult.recordset[0].OrderID;

      // 2. Insert OrderItems and update Stock
      for (const item of saleData.items) {
        const prodDetailsQuery = `SELECT IsBatchTracked, StockIssuingMethod FROM dbo.Products WHERE ProductID = @ProductID AND CompanyID = @CompanyID`;
        const prodDetailsReq = new db.sql.Request(transaction);
        prodDetailsReq.input('ProductID', db.sql.Int, item.productId);
        prodDetailsReq.input('CompanyID', db.sql.Int, companyId);
        const prodDetailsRes = await prodDetailsReq.query(prodDetailsQuery);
        const product = prodDetailsRes.recordset[0];

        if (product && product.IsBatchTracked) {
          const issuingSort = product.StockIssuingMethod === 'FIFO' ? 'MfgDate ASC, BatchID ASC' : 'ExpiryDate ASC';
          const batchesQuery = `
            SELECT * FROM dbo.ProductBatches
            WHERE ProductID = @ProductID AND CompanyID = @CompanyID AND CurrentQty > 0
            ORDER BY ${issuingSort}
          `;
          const batchesReq = new db.sql.Request(transaction);
          batchesReq.input('ProductID', db.sql.Int, item.productId);
          batchesReq.input('CompanyID', db.sql.Int, companyId);
          const batchesRes = await batchesReq.query(batchesQuery);
          const activeBatches = batchesRes.recordset;

          let remainingQty = item.quantity;
          for (const batch of activeBatches) {
            if (remainingQty <= 0) break;
            const deduction = Math.min(remainingQty, batch.CurrentQty);

            const updateBatchReq = new db.sql.Request(transaction);
            updateBatchReq.input('BatchID', db.sql.Int, batch.BatchID);
            updateBatchReq.input('Deduction', db.sql.Decimal(18, 3), deduction);
            await updateBatchReq.query(`
              UPDATE dbo.ProductBatches
              SET CurrentQty = CurrentQty - @Deduction
              WHERE BatchID = @BatchID
            `);

            const allocationRequest = new db.sql.Request(transaction);
            allocationRequest.input('OrderID', db.sql.Int, orderId);
            allocationRequest.input('ProductID', db.sql.Int, item.productId);
            allocationRequest.input('Price', db.sql.Decimal(18, 2), item.price);
            allocationRequest.input('Cost', db.sql.Decimal(18, 2), item.cost);
            allocationRequest.input('Quantity', db.sql.Decimal(18, 3), deduction);
            allocationRequest.input('Subtotal', db.sql.Decimal(18, 2), Number((item.price * deduction).toFixed(2)));
            allocationRequest.input('BatchNo', db.sql.NVarChar(50), batch.BatchNo);
            allocationRequest.input('OriginalPrice', db.sql.Decimal(18, 2), getOriginalPrice(item));
            allocationRequest.input('VariantID', db.sql.Int, item.variantId || null);
            allocationRequest.input('VariantName', db.sql.NVarChar(100), item.variantName || null);

            await allocationRequest.query(`
              INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, BatchNo, OriginalPrice, VariantID, VariantName)
              VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, @BatchNo, @OriginalPrice, @VariantID, @VariantName)
            `);

            remainingQty -= deduction;
          }

          // In case we sell beyond batch stock (e.g. negative stock allowed or discrepancy)
          if (remainingQty > 0) {
            const fallbackItemReq = new db.sql.Request(transaction);
            fallbackItemReq.input('OrderID', db.sql.Int, orderId);
            fallbackItemReq.input('ProductID', db.sql.Int, item.productId);
            fallbackItemReq.input('Price', db.sql.Decimal(18, 2), item.price);
            fallbackItemReq.input('Cost', db.sql.Decimal(18, 2), item.cost);
            fallbackItemReq.input('Quantity', db.sql.Decimal(18, 3), remainingQty);
            fallbackItemReq.input('Subtotal', db.sql.Decimal(18, 2), Number((item.price * remainingQty).toFixed(2)));
            fallbackItemReq.input('OriginalPrice', db.sql.Decimal(18, 2), getOriginalPrice(item));
            fallbackItemReq.input('VariantID', db.sql.Int, item.variantId || null);
            fallbackItemReq.input('VariantName', db.sql.NVarChar(100), item.variantName || null);

            await fallbackItemReq.query(`
              INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, BatchNo, OriginalPrice, VariantID, VariantName)
              VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, NULL, @OriginalPrice, @VariantID, @VariantName)
            `);
          }

          const syncStockReq = new db.sql.Request(transaction);
          syncStockReq.input('ProductID', db.sql.Int, item.productId);
          syncStockReq.input('CompanyID', db.sql.Int, companyId);
          syncStockReq.input('Overshoot', db.sql.Decimal(18, 3), remainingQty);
          await syncStockReq.query(`
            UPDATE dbo.Products
            SET Stock = ISNULL((SELECT SUM(CurrentQty) FROM dbo.ProductBatches WHERE ProductID = @ProductID AND CompanyID = @CompanyID), 0) - @Overshoot
            WHERE ProductID = @ProductID AND CompanyID = @CompanyID
          `);
        } else {
          const itemRequest = new db.sql.Request(transaction);
          itemRequest.input('OrderID', db.sql.Int, orderId);
          itemRequest.input('ProductID', db.sql.Int, item.productId);
          itemRequest.input('Price', db.sql.Decimal(18, 2), item.price);
          itemRequest.input('Cost', db.sql.Decimal(18, 2), item.cost);
          itemRequest.input('Quantity', db.sql.Decimal(18, 3), item.quantity);
          itemRequest.input('Subtotal', db.sql.Decimal(18, 2), item.subtotal);
          itemRequest.input('OriginalPrice', db.sql.Decimal(18, 2), getOriginalPrice(item));
          itemRequest.input('VariantID', db.sql.Int, item.variantId || null);
          itemRequest.input('VariantName', db.sql.NVarChar(100), item.variantName || null);

          await itemRequest.query(`
            INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, BatchNo, OriginalPrice, VariantID, VariantName)
            VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, NULL, @OriginalPrice, @VariantID, @VariantName)
          `);

          const stockRequest = new db.sql.Request(transaction);
          stockRequest.input('ProductID', db.sql.Int, item.productId);
          stockRequest.input('Quantity', db.sql.Decimal(18, 3), item.quantity);
          await stockRequest.query(`
            UPDATE dbo.Products
            SET Stock = Stock - @Quantity
            WHERE ProductID = @ProductID
          `);
        }
      }

      // 2b. Insert Price Overrides Log
      for (const item of saleData.items) {
        if (item.isOverridden) {
          const overrideRequest = new db.sql.Request(transaction);
          overrideRequest.input('OrderID', db.sql.Int, orderId);
          overrideRequest.input('ProductID', db.sql.Int, item.productId);
          overrideRequest.input('OriginalPrice', db.sql.Decimal(18, 2), item.originalPrice !== undefined ? item.originalPrice : item.price);
          overrideRequest.input('OverriddenPrice', db.sql.Decimal(18, 2), item.price);
          overrideRequest.input('UserID', db.sql.Int, userId);
          overrideRequest.input('ApprovedByUserID', db.sql.Int, item.approvedByUserId || null);

          await overrideRequest.query(`
            INSERT INTO dbo.PriceOverrides (OrderID, ProductID, OriginalPrice, OverriddenPrice, UserID, ApprovedByUserID)
            VALUES (@OrderID, @ProductID, @OriginalPrice, @OverriddenPrice, @UserID, @ApprovedByUserID)
          `);
        }
      }

      // 3. Process Payments
      let totalCreditAmount = 0;
      for (const payment of saleData.payments) {
        const paymentRequest = new db.sql.Request(transaction);
        paymentRequest.input('OrderID', db.sql.Int, orderId);
        paymentRequest.input('Method', db.sql.NVarChar(50), payment.method);
        paymentRequest.input('Amount', db.sql.Decimal(18, 2), payment.amount);
        paymentRequest.input('ReferenceNumber', db.sql.NVarChar(100), payment.referenceNumber || null);

        await paymentRequest.query(`
          INSERT INTO dbo.OrderPayments (OrderID, Method, Amount, ReferenceNumber)
          VALUES (@OrderID, @Method, @Amount, @ReferenceNumber)
        `);

        if (payment.method === 'Credit') {
          totalCreditAmount += payment.amount;
        }
      }

      // 4. Update Customer Balance & Loyalty Points
      if (saleData.customerId) {
        // Loyalty calculation: 1 point per $10 spent
        const loyaltyPointsEarned = Math.floor(saleData.totalAmount / 10);
        
        const customerRequest = new db.sql.Request(transaction);
        await customerRepository.adjustBalanceAndPoints(
          saleData.customerId,
          companyId,
          totalCreditAmount, // Add credit amount as debt balance
          loyaltyPointsEarned,
          customerRequest
        );
      }

      await transaction.commit();
      return orderId;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async holdSale(saleData, companyId, userId) {
    const pool = await db.poolPromise;
    const transaction = new db.sql.Transaction(pool);

    try {
      await transaction.begin();

      // 1. Insert SalesOrder as Held
      const orderRequest = new db.sql.Request(transaction);
      orderRequest.input('CompanyID', db.sql.Int, companyId);
      orderRequest.input('UserID', db.sql.Int, userId);
      orderRequest.input('CustomerID', db.sql.Int, saleData.customerId || null);
      orderRequest.input('Subtotal', db.sql.Decimal(18, 2), saleData.subtotal);
      orderRequest.input('DiscountAmount', db.sql.Decimal(18, 2), saleData.discountAmount || 0.00);
      orderRequest.input('TaxAmount', db.sql.Decimal(18, 2), saleData.taxAmount || 0.00);
      orderRequest.input('TotalAmount', db.sql.Decimal(18, 2), saleData.totalAmount);
      orderRequest.input('Status', db.sql.NVarChar(20), 'Held');
      orderRequest.input('HeldNote', db.sql.NVarChar(255), saleData.heldNote || null);

      const orderResult = await orderRequest.query(`
        INSERT INTO dbo.SalesOrders (CompanyID, UserID, CustomerID, Subtotal, DiscountAmount, TaxAmount, TotalAmount, Status, HeldNote)
        OUTPUT inserted.OrderID
        VALUES (@CompanyID, @UserID, @CustomerID, @Subtotal, @DiscountAmount, @TaxAmount, @TotalAmount, @Status, @HeldNote)
      `);
      
      const orderId = orderResult.recordset[0].OrderID;

      // Determine the HeldBillNumber (re-use if passed, otherwise auto-generate sequential number)
      const billNumber = saleData.heldBillNumber || `HB-${1000 + orderId}`;

      // Update the HeldBillNumber column
      const updateRequest = new db.sql.Request(transaction);
      updateRequest.input('OrderID', db.sql.Int, orderId);
      updateRequest.input('HeldBillNumber', db.sql.NVarChar(50), billNumber);
      await updateRequest.query(`
        UPDATE dbo.SalesOrders
        SET HeldBillNumber = @HeldBillNumber
        WHERE OrderID = @OrderID
      `);

      // 2. Insert Items (Stock is NOT reduced for held sales)
      for (const item of saleData.items) {
        const itemRequest = new db.sql.Request(transaction);
        itemRequest.input('OrderID', db.sql.Int, orderId);
        itemRequest.input('ProductID', db.sql.Int, item.productId);
        itemRequest.input('Price', db.sql.Decimal(18, 2), item.price);
        itemRequest.input('Cost', db.sql.Decimal(18, 2), item.cost);
        itemRequest.input('Quantity', db.sql.Decimal(18, 3), item.quantity);
        itemRequest.input('Subtotal', db.sql.Decimal(18, 2), item.subtotal);
        itemRequest.input('OriginalPrice', db.sql.Decimal(18, 2), getOriginalPrice(item));

        await itemRequest.query(`
          INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, OriginalPrice)
          VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, @OriginalPrice)
        `);
      }

      await transaction.commit();
      return { orderId, heldBillNumber: billNumber };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async getHeldSales(companyId) {
    const sqlQuery = `
      SELECT so.*, u.Username AS CashierName
      FROM dbo.SalesOrders so
      INNER JOIN dbo.Users u ON so.UserID = u.UserID
      WHERE so.CompanyID = @CompanyID AND so.Status = 'Held'
      ORDER BY so.OrderDate DESC
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId });
    return result.recordset;
  }

  async resumeHeldSale(orderId, companyId) {
    const details = await this.getSaleDetails(orderId, companyId);
    if (!details) return null;

    // Delete items first to prevent FK orphaned records
    const deleteItemsQuery = `DELETE FROM dbo.OrderItems WHERE OrderID = @OrderID`;
    await db.query(deleteItemsQuery, { OrderID: orderId });

    // Then delete the held order
    const deleteOrderQuery = `DELETE FROM dbo.SalesOrders WHERE OrderID = @OrderID AND CompanyID = @CompanyID AND Status = 'Held'`;
    await db.query(deleteOrderQuery, { OrderID: orderId, CompanyID: companyId });

    return details;
  }

  async deleteHeldSale(orderId, companyId) {
    // Delete the items first to prevent constraint violations
    const deleteItemsQuery = `DELETE FROM dbo.OrderItems WHERE OrderID = @OrderID`;
    await db.query(deleteItemsQuery, { OrderID: orderId });

    // Then delete the order row
    const deleteOrderQuery = `DELETE FROM dbo.SalesOrders WHERE OrderID = @OrderID AND CompanyID = @CompanyID AND Status = 'Held'`;
    const result = await db.query(deleteOrderQuery, { OrderID: orderId, CompanyID: companyId });

    return result.rowsAffected[0] > 0;
  }

  async processReturn(returnRequest, companyId, userId) {
    const pool = await db.poolPromise;
    const transaction = new db.sql.Transaction(pool);

    try {
      await transaction.begin();

      // 1. Insert SalesOrder as Refunded
      const orderRequest = new db.sql.Request(transaction);
      orderRequest.input('CompanyID', db.sql.Int, companyId);
      orderRequest.input('UserID', db.sql.Int, userId);
      orderRequest.input('CustomerID', db.sql.Int, returnRequest.customerId || null);
      orderRequest.input('Subtotal', db.sql.Decimal(18, 2), -returnRequest.subtotal);
      orderRequest.input('DiscountAmount', db.sql.Decimal(18, 2), -returnRequest.discountAmount || 0.00);
      orderRequest.input('TaxAmount', db.sql.Decimal(18, 2), -returnRequest.taxAmount || 0.00);
      orderRequest.input('TotalAmount', db.sql.Decimal(18, 2), -returnRequest.totalAmount);
      orderRequest.input('Status', db.sql.NVarChar(20), 'Refunded');
      orderRequest.input('ParentOrderID', db.sql.Int, returnRequest.originalOrderId);

      const orderResult = await orderRequest.query(`
        INSERT INTO dbo.SalesOrders (CompanyID, UserID, CustomerID, Subtotal, DiscountAmount, TaxAmount, TotalAmount, Status, ParentOrderID)
        OUTPUT inserted.OrderID
        VALUES (@CompanyID, @UserID, @CustomerID, @Subtotal, @DiscountAmount, @TaxAmount, @TotalAmount, @Status, @ParentOrderID)
      `);
      
      const refundOrderId = orderResult.recordset[0].OrderID;

      // 2. Insert negative OrderItems and update Stock (return back to inventory)
      for (const item of returnRequest.items) {
        const itemRequest = new db.sql.Request(transaction);
        itemRequest.input('OrderID', db.sql.Int, refundOrderId);
        itemRequest.input('ProductID', db.sql.Int, item.productId);
        itemRequest.input('Price', db.sql.Decimal(18, 2), item.price);
        itemRequest.input('Cost', db.sql.Decimal(18, 2), item.cost);
        itemRequest.input('Quantity', db.sql.Decimal(18, 3), -item.quantity);
        itemRequest.input('Subtotal', db.sql.Decimal(18, 2), -item.subtotal);
        itemRequest.input('BatchNo', db.sql.NVarChar(50), item.batchNo || null);
        itemRequest.input('OriginalPrice', db.sql.Decimal(18, 2), getOriginalPrice(item));

        await itemRequest.query(`
          INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, BatchNo, OriginalPrice)
          VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, @BatchNo, @OriginalPrice)
        `);

        if (item.batchNo) {
          const batchStockReq = new db.sql.Request(transaction);
          batchStockReq.input('ProductID', db.sql.Int, item.productId);
          batchStockReq.input('CompanyID', db.sql.Int, companyId);
          batchStockReq.input('BatchNo', db.sql.NVarChar(50), item.batchNo);
          batchStockReq.input('Quantity', db.sql.Decimal(18, 3), item.quantity);
          await batchStockReq.query(`
            UPDATE dbo.ProductBatches
            SET CurrentQty = CurrentQty + @Quantity
            WHERE ProductID = @ProductID AND CompanyID = @CompanyID AND BatchNo = @BatchNo
          `);

          const syncStockReq = new db.sql.Request(transaction);
          syncStockReq.input('ProductID', db.sql.Int, item.productId);
          syncStockReq.input('CompanyID', db.sql.Int, companyId);
          await syncStockReq.query(`
            UPDATE dbo.Products
            SET Stock = ISNULL((SELECT SUM(CurrentQty) FROM dbo.ProductBatches WHERE ProductID = @ProductID AND CompanyID = @CompanyID), 0)
            WHERE ProductID = @ProductID AND CompanyID = @CompanyID
          `);
        } else {
          // Re-stock inventory
          const stockRequest = new db.sql.Request(transaction);
          stockRequest.input('ProductID', db.sql.Int, item.productId);
          stockRequest.input('Quantity', db.sql.Decimal(18, 3), item.quantity);
          await stockRequest.query(`
            UPDATE dbo.Products
            SET Stock = Stock + @Quantity
            WHERE ProductID = @ProductID
          `);
        }
      }

      // 3. Process Payments (negative amounts)
      let totalCreditRefunded = 0;
      for (const payment of returnRequest.payments) {
        const paymentRequest = new db.sql.Request(transaction);
        paymentRequest.input('OrderID', db.sql.Int, refundOrderId);
        paymentRequest.input('Method', db.sql.NVarChar(50), payment.method);
        paymentRequest.input('Amount', db.sql.Decimal(18, 2), -payment.amount);
        paymentRequest.input('ReferenceNumber', db.sql.NVarChar(100), payment.referenceNumber || null);

        await paymentRequest.query(`
          INSERT INTO dbo.OrderPayments (OrderID, Method, Amount, ReferenceNumber)
          VALUES (@OrderID, @Method, @Amount, @ReferenceNumber)
        `);

        if (payment.method === 'Credit') {
          totalCreditRefunded += payment.amount;
        }
      }

      // 4. Update Customer Balance & Deduct Loyalty Points
      if (returnRequest.customerId) {
        // Loyalty calculation: 1 point per $10 spent (deduct)
        const loyaltyPointsDeducted = -Math.floor(returnRequest.totalAmount / 10);
        
        const customerRequest = new db.sql.Request(transaction);
        await customerRepository.adjustBalanceAndPoints(
          returnRequest.customerId,
          companyId,
          -totalCreditRefunded, // Reduce customer's outstanding balance
          loyaltyPointsDeducted,
          customerRequest
        );
      }

      // 5. Update original order status to show refunded/exchanged if fully refunded
      // (For now, standard auditing is just to link them; we leave original order as 'Completed' or mark as 'Refunded' if needed)
      const updateOriginalRequest = new db.sql.Request(transaction);
      updateOriginalRequest.input('OriginalOrderID', db.sql.Int, returnRequest.originalOrderId);
      await updateOriginalRequest.query(`
        UPDATE dbo.SalesOrders 
        SET Status = 'Refunded'
        WHERE OrderID = @OriginalOrderID
      `);

      await transaction.commit();
      return refundOrderId;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async getCashDrawerSessionToday(companyId, userId) {
    const sqlQuery = `
      SELECT TOP 1 * FROM dbo.CashDrawerSessions
      WHERE CompanyID = @CompanyID AND UserID = @UserID
        AND CAST(OpeningTime AS DATE) = CAST(GETDATE() AS DATE)
      ORDER BY SessionID DESC
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId, UserID: userId });
    return result.recordset[0] || null;
  }

  async createCashDrawerSession(companyId, userId, data) {
    const sqlQuery = `
      INSERT INTO dbo.CashDrawerSessions (CompanyID, UserID, OpeningBalance, OpeningDenominations, Status, TerminalID)
      OUTPUT inserted.*
      VALUES (@CompanyID, @UserID, @OpeningBalance, @OpeningDenominations, 'Open', @TerminalID)
    `;
    const result = await db.query(sqlQuery, {
      CompanyID: companyId,
      UserID: userId,
      OpeningBalance: data.openingBalance || 0.00,
      OpeningDenominations: data.openingDenominations ? JSON.stringify(data.openingDenominations) : null,
      TerminalID: data.terminalId || 'Terminal-01'
    });
    return result.recordset[0];
  }

  async getReconciliationSummaryData(companyId, openingTime) {
    const params = { CompanyID: companyId, OpeningTime: openingTime };

    // 1. Sales payments by method
    const salesPaymentsQuery = `
      SELECT Method, SUM(Amount) AS TotalAmount
      FROM dbo.OrderPayments op
      INNER JOIN dbo.SalesOrders so ON op.OrderID = so.OrderID
      WHERE so.CompanyID = @CompanyID AND so.OrderDate >= @OpeningTime AND so.Status <> 'Cancelled' AND op.Amount > 0
      GROUP BY Method
    `;
    const salesPayments = await db.query(salesPaymentsQuery, params);

    // 2. Refund payments by method
    const refundPaymentsQuery = `
      SELECT Method, ABS(SUM(Amount)) AS TotalAmount
      FROM dbo.OrderPayments op
      INNER JOIN dbo.SalesOrders so ON op.OrderID = so.OrderID
      WHERE so.CompanyID = @CompanyID AND so.OrderDate >= @OpeningTime AND so.Status <> 'Cancelled' AND op.Amount < 0
      GROUP BY Method
    `;
    const refundPayments = await db.query(refundPaymentsQuery, params);

    // 3. Supplier cash payments
    const supplierPaymentsQuery = `
      SELECT SUM(Amount) AS Total
      FROM dbo.SupplierPayments
      WHERE CompanyID = @CompanyID AND PaymentDate >= @OpeningTime AND PaymentMethod = 'Cash'
    `;
    const supplierPayments = await db.query(supplierPaymentsQuery, params);

    // 4. Inventory summary
    const salesQtyQuery = `
      SELECT SUM(oi.Quantity) AS TotalSalesQty
      FROM dbo.OrderItems oi
      INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
      WHERE so.CompanyID = @CompanyID AND so.OrderDate >= @OpeningTime AND so.Status <> 'Cancelled' AND so.TotalAmount >= 0
    `;
    const salesQtyRes = await db.query(salesQtyQuery, params);

    const returnQtyQuery = `
      SELECT SUM(oi.Quantity) AS TotalReturnQty
      FROM dbo.OrderItems oi
      INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
      WHERE so.CompanyID = @CompanyID AND so.OrderDate >= @OpeningTime AND so.Status <> 'Cancelled' AND so.TotalAmount < 0
    `;
    const returnQtyRes = await db.query(returnQtyQuery, params);

    const adjustmentsQuery = `
      SELECT COUNT(DISTINCT ia.AdjustmentID) AS AdjustmentsCount, SUM(ABS(iai.AdjustedQty)) AS TotalAdjustedQty
      FROM dbo.InventoryAdjustments ia
      INNER JOIN dbo.InventoryAdjustmentItems iai ON ia.AdjustmentID = iai.AdjustmentID
      WHERE ia.CompanyID = @CompanyID AND ia.CreatedAt >= @OpeningTime AND ia.Status = 'Approved'
    `;
    const adjustmentsRes = await db.query(adjustmentsQuery, params);

    // 5. Exception report metrics
    const priceOverridesQuery = `
      SELECT COUNT(*) AS OverrideCount, SUM(OriginalPrice - OverriddenPrice) AS OverrideReduction
      FROM dbo.PriceOverrides po
      INNER JOIN dbo.SalesOrders so ON po.OrderID = so.OrderID
      WHERE so.CompanyID = @CompanyID AND po.CreatedAt >= @OpeningTime AND so.Status <> 'Cancelled'
    `;
    const overridesRes = await db.query(priceOverridesQuery, params);

    const discountsQuery = `
      SELECT COUNT(OrderID) AS DiscountCount, SUM(DiscountAmount) AS TotalDiscounts
      FROM dbo.SalesOrders
      WHERE CompanyID = @CompanyID AND OrderDate >= @OpeningTime AND Status <> 'Cancelled' AND DiscountAmount > 0
    `;
    const discountsRes = await db.query(discountsQuery, params);

    const negativeStockQuery = `
      SELECT COUNT(DISTINCT oi.OrderID) AS NegativeStockSalesCount
      FROM dbo.OrderItems oi
      INNER JOIN dbo.SalesOrders so ON oi.OrderID = so.OrderID
      INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
      WHERE so.CompanyID = @CompanyID AND so.OrderDate >= @OpeningTime AND so.Status <> 'Cancelled' AND p.Stock < 0
    `;
    const negativeStockRes = await db.query(negativeStockQuery, params);

    const backdatedQuery = `
      SELECT COUNT(*) AS BackdatedCount
      FROM dbo.PurchaseOrders
      WHERE CompanyID = @CompanyID AND CreatedAt >= @OpeningTime AND CAST(OrderDate AS DATE) < CAST(CreatedAt AS DATE)
    `;
    const backdatedRes = await db.query(backdatedQuery, params);

    const cancelledQuery = `
      SELECT COUNT(OrderID) AS CancelledCount, SUM(TotalAmount) AS CancelledTotal
      FROM dbo.SalesOrders
      WHERE CompanyID = @CompanyID AND OrderDate >= @OpeningTime AND Status = 'Cancelled'
    `;
    const cancelledRes = await db.query(cancelledQuery, params);

    const refundedQuery = `
      SELECT COUNT(OrderID) AS RefundCount, SUM(ABS(TotalAmount)) AS RefundTotal
      FROM dbo.SalesOrders
      WHERE CompanyID = @CompanyID AND OrderDate >= @OpeningTime AND Status = 'Refunded'
    `;
    const refundedRes = await db.query(refundedQuery, params);

    return {
      salesPayments: salesPayments.recordset,
      refundPayments: refundPayments.recordset,
      supplierCashPayments: supplierPayments.recordset[0]?.Total || 0,
      inventorySummary: {
        totalSalesQty: salesQtyRes.recordset[0]?.TotalSalesQty || 0,
        totalReturnQty: returnQtyRes.recordset[0]?.TotalReturnQty || 0,
        adjustmentsCount: adjustmentsRes.recordset[0]?.AdjustmentsCount || 0,
        totalAdjustedQty: adjustmentsRes.recordset[0]?.TotalAdjustedQty || 0
      },
      exceptions: {
        overrideCount: overridesRes.recordset[0]?.OverrideCount || 0,
        overrideReduction: overridesRes.recordset[0]?.OverrideReduction || 0,
        discountCount: discountsRes.recordset[0]?.DiscountCount || 0,
        totalDiscounts: discountsRes.recordset[0]?.TotalDiscounts || 0,
        negativeStockSalesCount: negativeStockRes.recordset[0]?.NegativeStockSalesCount || 0,
        backdatedCount: backdatedRes.recordset[0]?.BackdatedCount || 0,
        cancelledCount: cancelledRes.recordset[0]?.CancelledCount || 0,
        cancelledTotal: cancelledRes.recordset[0]?.CancelledTotal || 0,
        refundCount: refundedRes.recordset[0]?.RefundCount || 0,
        refundTotal: refundedRes.recordset[0]?.RefundTotal || 0
      }
    };
  }

  async closeCashDrawerSession(sessionId, closingData) {
    const sqlQuery = `
      UPDATE dbo.CashDrawerSessions
      SET Status = 'Closed',
          ClosingBalance = @ClosingBalance,
          ClosingTime = GETDATE(),
          ClosingDenominations = @ClosingDenominations,
          ExpectedCash = @ExpectedCash,
          ActualCash = @ActualCash,
          DifferenceAmount = @DifferenceAmount,
          ReconciliationData = @ReconciliationData
      OUTPUT inserted.*
      WHERE SessionID = @SessionID
    `;
    const result = await db.query(sqlQuery, {
      SessionID: sessionId,
      ClosingBalance: closingData.actualCash || 0,
      ClosingDenominations: closingData.denominations ? JSON.stringify(closingData.denominations) : null,
      ExpectedCash: closingData.expectedCash || 0,
      ActualCash: closingData.actualCash || 0,
      DifferenceAmount: closingData.differenceAmount || 0,
      ReconciliationData: closingData.reconciliationData ? JSON.stringify(closingData.reconciliationData) : null
    });
    return result.recordset[0];
  }

  async getClosedDrawerHistory(companyId) {
    const sqlQuery = `
      SELECT cds.*, u.Username AS CashierName
      FROM dbo.CashDrawerSessions cds
      INNER JOIN dbo.Users u ON cds.UserID = u.UserID
      WHERE cds.CompanyID = @CompanyID AND cds.Status = 'Closed'
      ORDER BY cds.ClosingTime DESC
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId });
    return result.recordset;
  }

  async voidOrderInTransaction(orderId, companyId) {
    const pool = await db.poolPromise;
    const transaction = new db.sql.Transaction(pool);

    try {
      await transaction.begin();

      // 1. Get Order details & items
      const itemsQuery = `
        SELECT oi.*, p.IsBatchTracked
        FROM dbo.OrderItems oi
        INNER JOIN dbo.Products p ON oi.ProductID = p.ProductID
        WHERE oi.OrderID = @OrderID
      `;
      const itemsReq = new db.sql.Request(transaction);
      itemsReq.input('OrderID', db.sql.Int, orderId);
      const itemsRes = await itemsReq.query(itemsQuery);
      const items = itemsRes.recordset;

      // 2. Loop through items to reverse stock
      for (const item of items) {
        // Revert product main stock
        const revertStockReq = new db.sql.Request(transaction);
        revertStockReq.input('ProductID', db.sql.Int, item.ProductID);
        revertStockReq.input('Quantity', db.sql.Decimal(18, 3), item.Quantity);
        await revertStockReq.query(`
          UPDATE dbo.Products
          SET Stock = Stock + @Quantity
          WHERE ProductID = @ProductID
        `);

        // Revert batch stock if batch-tracked
        if (item.IsBatchTracked && item.BatchNo) {
          const revertBatchReq = new db.sql.Request(transaction);
          revertBatchReq.input('ProductID', db.sql.Int, item.ProductID);
          revertBatchReq.input('BatchNo', db.sql.NVarChar(50), item.BatchNo);
          revertBatchReq.input('Quantity', db.sql.Decimal(18, 3), item.Quantity);
          revertBatchReq.input('CompanyID', db.sql.Int, companyId);
          await revertBatchReq.query(`
            UPDATE dbo.ProductBatches
            SET CurrentQty = CurrentQty + @Quantity
            WHERE ProductID = @ProductID AND BatchNo = @BatchNo AND CompanyID = @CompanyID
          `);
        }
      }

      // 3. Update order status to Cancelled
      const voidOrderReq = new db.sql.Request(transaction);
      voidOrderReq.input('OrderID', db.sql.Int, orderId);
      await voidOrderReq.query(`
        UPDATE dbo.SalesOrders
        SET Status = 'Cancelled'
        WHERE OrderID = @OrderID
      `);

      await transaction.commit();
      return true;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async processExchange(exchangeData, companyId, userId) {
    const pool = await db.poolPromise;
    const transaction = new db.sql.Transaction(pool);

    try {
      await transaction.begin();

      // -------------------------------------------------------------
      // PART 1: PROCESS THE RETURN
      // -------------------------------------------------------------
      
      // Calculate return amounts
      const returnSubtotal = exchangeData.returnItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const returnDiscount = exchangeData.returnDiscountAmount || 0;
      const returnTax = exchangeData.returnTaxAmount || 0;
      const returnTotal = exchangeData.returnTotalAmount || 0;

      // 1. Insert SalesOrder as Exchange-Return (or Refunded if no newOrder)
      const isPureRefund = !exchangeData.newOrder;
      const returnStatus = isPureRefund ? 'Refunded' : 'Exchange-Return';

      const returnOrderReq = new db.sql.Request(transaction);
      returnOrderReq.input('CompanyID', db.sql.Int, companyId);
      returnOrderReq.input('UserID', db.sql.Int, userId);
      returnOrderReq.input('CustomerID', db.sql.Int, exchangeData.customerId || null);
      returnOrderReq.input('Subtotal', db.sql.Decimal(18, 2), -returnSubtotal);
      returnOrderReq.input('DiscountAmount', db.sql.Decimal(18, 2), -returnDiscount);
      returnOrderReq.input('TaxAmount', db.sql.Decimal(18, 2), -returnTax);
      returnOrderReq.input('TotalAmount', db.sql.Decimal(18, 2), -returnTotal);
      returnOrderReq.input('Status', db.sql.NVarChar(20), returnStatus);
      returnOrderReq.input('ParentOrderID', db.sql.Int, exchangeData.originalOrderId);

      const returnOrderResult = await returnOrderReq.query(`
        INSERT INTO dbo.SalesOrders (CompanyID, UserID, CustomerID, Subtotal, DiscountAmount, TaxAmount, TotalAmount, Status, ParentOrderID)
        OUTPUT inserted.OrderID
        VALUES (@CompanyID, @UserID, @CustomerID, @Subtotal, @DiscountAmount, @TaxAmount, @TotalAmount, @Status, @ParentOrderID)
      `);
      const returnOrderId = returnOrderResult.recordset[0].OrderID;

      // 2. Insert negative OrderItems and update Stock (re-stock return items)
      for (const item of exchangeData.returnItems) {
        const itemRequest = new db.sql.Request(transaction);
        itemRequest.input('OrderID', db.sql.Int, returnOrderId);
        itemRequest.input('ProductID', db.sql.Int, item.productId);
        itemRequest.input('Price', db.sql.Decimal(18, 2), item.price);
        itemRequest.input('Cost', db.sql.Decimal(18, 2), item.cost);
        itemRequest.input('Quantity', db.sql.Decimal(18, 3), -item.quantity);
        itemRequest.input('Subtotal', db.sql.Decimal(18, 2), -Number((item.price * item.quantity).toFixed(2)));
        itemRequest.input('BatchNo', db.sql.NVarChar(50), item.batchNo || null);
        itemRequest.input('OriginalPrice', db.sql.Decimal(18, 2), getOriginalPrice(item));

        await itemRequest.query(`
          INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, BatchNo, OriginalPrice)
          VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, @BatchNo, @OriginalPrice)
        `);

        if (item.batchNo) {
          const batchStockReq = new db.sql.Request(transaction);
          batchStockReq.input('ProductID', db.sql.Int, item.productId);
          batchStockReq.input('CompanyID', db.sql.Int, companyId);
          batchStockReq.input('BatchNo', db.sql.NVarChar(50), item.batchNo);
          batchStockReq.input('Quantity', db.sql.Decimal(18, 3), item.quantity);
          await batchStockReq.query(`
            UPDATE dbo.ProductBatches
            SET CurrentQty = CurrentQty + @Quantity
            WHERE ProductID = @ProductID AND CompanyID = @CompanyID AND BatchNo = @BatchNo
          `);

          const syncStockReq = new db.sql.Request(transaction);
          syncStockReq.input('ProductID', db.sql.Int, item.productId);
          syncStockReq.input('CompanyID', db.sql.Int, companyId);
          await syncStockReq.query(`
            UPDATE dbo.Products
            SET Stock = ISNULL((SELECT SUM(CurrentQty) FROM dbo.ProductBatches WHERE ProductID = @ProductID AND CompanyID = @CompanyID), 0)
            WHERE ProductID = @ProductID AND CompanyID = @CompanyID
          `);
        } else {
          const stockRequest = new db.sql.Request(transaction);
          stockRequest.input('ProductID', db.sql.Int, item.productId);
          stockRequest.input('Quantity', db.sql.Decimal(18, 3), item.quantity);
          await stockRequest.query(`
            UPDATE dbo.Products
            SET Stock = Stock + @Quantity
            WHERE ProductID = @ProductID
          `);
        }
      }

      // 3. Process return payments (negative amounts)
      let returnCreditSetoff = 0;
      for (const payment of exchangeData.returnPayments) {
        const paymentRequest = new db.sql.Request(transaction);
        paymentRequest.input('OrderID', db.sql.Int, returnOrderId);
        paymentRequest.input('Method', db.sql.NVarChar(50), payment.method);
        paymentRequest.input('Amount', db.sql.Decimal(18, 2), -payment.amount);
        paymentRequest.input('ReferenceNumber', db.sql.NVarChar(100), payment.referenceNumber || null);

        await paymentRequest.query(`
          INSERT INTO dbo.OrderPayments (OrderID, Method, Amount, ReferenceNumber)
          VALUES (@OrderID, @Method, @Amount, @ReferenceNumber)
        `);

        if (payment.method === 'Exchange Set-off') {
          returnCreditSetoff += payment.amount;
        }
      }

      // Post Journal Entries for Return
      const returnDesc = `Sales Return Note #${returnOrderId} linked to original invoice #${exchangeData.originalOrderId}`;
      // Debit Sales Returns & Allowances (subtotal)
      const returnJE1 = new db.sql.Request(transaction);
      returnJE1.input('CompanyID', db.sql.Int, companyId);
      returnJE1.input('SourceID', db.sql.Int, returnOrderId);
      returnJE1.input('EntryDate', db.sql.Date, new Date());
      returnJE1.input('Account', db.sql.NVarChar(100), 'Sales Returns & Allowances');
      returnJE1.input('Debit', db.sql.Decimal(18, 2), returnSubtotal - returnDiscount);
      returnJE1.input('Desc', db.sql.NVarChar(500), returnDesc);
      await returnJE1.query(`
        INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
        VALUES (@CompanyID, 'SalesReturn', @SourceID, @EntryDate, @Account, @Debit, 0.00, @Desc)
      `);

      // Debit VAT Output (tax)
      if (returnTax > 0) {
        const returnJE2 = new db.sql.Request(transaction);
        returnJE2.input('CompanyID', db.sql.Int, companyId);
        returnJE2.input('SourceID', db.sql.Int, returnOrderId);
        returnJE2.input('EntryDate', db.sql.Date, new Date());
        returnJE2.input('Account', db.sql.NVarChar(100), 'VAT Output');
        returnJE2.input('Debit', db.sql.Decimal(18, 2), returnTax);
        returnJE2.input('Desc', db.sql.NVarChar(500), returnDesc);
        await returnJE2.query(`
          INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
          VALUES (@CompanyID, 'SalesReturn', @SourceID, @EntryDate, @Account, @Debit, 0.00, @Desc)
        `);
      }

      // Credit Cash / Bank / Exchange Set-off (total)
      for (const payment of exchangeData.returnPayments) {
        let creditAccount = 'Cash Account';
        if (payment.method === 'Exchange Set-off') creditAccount = 'Exchange Clearing Account';
        else if (payment.method.toLowerCase().includes('card') || /^(Visa|Master|Amex)$/i.test(payment.method)) creditAccount = 'Card Clearing Account';
        else if (payment.method.toLowerCase().includes('bank') || payment.method.toLowerCase().includes('online')) creditAccount = 'Bank Account';
        else if (payment.method === 'Credit') creditAccount = 'Accounts Receivable';

        const returnJE3 = new db.sql.Request(transaction);
        returnJE3.input('CompanyID', db.sql.Int, companyId);
        returnJE3.input('SourceID', db.sql.Int, returnOrderId);
        returnJE3.input('EntryDate', db.sql.Date, new Date());
        returnJE3.input('Account', db.sql.NVarChar(100), creditAccount);
        returnJE3.input('Credit', db.sql.Decimal(18, 2), payment.amount);
        returnJE3.input('Desc', db.sql.NVarChar(500), returnDesc);
        await returnJE3.query(`
          INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
          VALUES (@CompanyID, 'SalesReturn', @SourceID, @EntryDate, @Account, 0.00, @Credit, @Desc)
        `);
      }

      // Cost of Sales Reversal
      const returnCostSum = exchangeData.returnItems.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
      if (returnCostSum > 0) {
        // Debit Inventory Asset
        const costJE1 = new db.sql.Request(transaction);
        costJE1.input('CompanyID', db.sql.Int, companyId);
        costJE1.input('SourceID', db.sql.Int, returnOrderId);
        costJE1.input('EntryDate', db.sql.Date, new Date());
        costJE1.input('Account', db.sql.NVarChar(100), 'Inventory Asset');
        costJE1.input('Debit', db.sql.Decimal(18, 2), returnCostSum);
        costJE1.input('Desc', db.sql.NVarChar(500), returnDesc + ' (Cost Reversal)');
        await costJE1.query(`
          INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
          VALUES (@CompanyID, 'SalesReturn', @SourceID, @EntryDate, @Account, @Debit, 0.00, @Desc)
        `);

        // Credit Cost of Sales
        const costJE2 = new db.sql.Request(transaction);
        costJE2.input('CompanyID', db.sql.Int, companyId);
        costJE2.input('SourceID', db.sql.Int, returnOrderId);
        costJE2.input('EntryDate', db.sql.Date, new Date());
        costJE2.input('Account', db.sql.NVarChar(100), 'Cost of Sales');
        costJE2.input('Credit', db.sql.Decimal(18, 2), returnCostSum);
        costJE2.input('Desc', db.sql.NVarChar(500), returnDesc + ' (Cost Reversal)');
        await costJE2.query(`
          INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
          VALUES (@CompanyID, 'SalesReturn', @SourceID, @EntryDate, @Account, 0.00, @Credit, @Desc)
        `);
      }

      // Deduct Customer Outstanding Debt Balance & loyalty points if return was on credit (or customer was linked)
      if (exchangeData.customerId) {
        let returnOnCredit = 0;
        for (const payment of exchangeData.returnPayments) {
          if (payment.method === 'Credit') {
            returnOnCredit += payment.amount;
          }
        }
        const loyaltyPointsDeducted = -Math.floor(returnTotal / 10);
        const customerRequest = new db.sql.Request(transaction);
        await customerRepository.adjustBalanceAndPoints(
          exchangeData.customerId,
          companyId,
          -returnOnCredit, // reduces outstanding debt
          loyaltyPointsDeducted,
          customerRequest
        );
      }

      // -------------------------------------------------------------
      // PART 2: PROCESS THE NEW BILL (IF EXCHANGE)
      // -------------------------------------------------------------
      let newOrderId = null;
      if (exchangeData.newOrder) {
        const newOrder = exchangeData.newOrder;

        // 1. Insert SalesOrder as Exchange-Purchase
        const newOrderReq = new db.sql.Request(transaction);
        newOrderReq.input('CompanyID', db.sql.Int, companyId);
        newOrderReq.input('UserID', db.sql.Int, userId);
        newOrderReq.input('CustomerID', db.sql.Int, exchangeData.customerId || null);
        newOrderReq.input('Subtotal', db.sql.Decimal(18, 2), newOrder.subtotal);
        newOrderReq.input('DiscountAmount', db.sql.Decimal(18, 2), newOrder.discountAmount || 0.00);
        newOrderReq.input('TaxAmount', db.sql.Decimal(18, 2), newOrder.taxAmount || 0.00);
        newOrderReq.input('TotalAmount', db.sql.Decimal(18, 2), newOrder.totalAmount);
        newOrderReq.input('Status', db.sql.NVarChar(20), 'Exchange-Purchase');
        newOrderReq.input('ParentOrderID', db.sql.Int, returnOrderId);

        const newOrderResult = await newOrderReq.query(`
          INSERT INTO dbo.SalesOrders (CompanyID, UserID, CustomerID, Subtotal, DiscountAmount, TaxAmount, TotalAmount, Status, ParentOrderID)
          OUTPUT inserted.OrderID
          VALUES (@CompanyID, @UserID, @CustomerID, @Subtotal, @DiscountAmount, @TaxAmount, @TotalAmount, @Status, @ParentOrderID)
        `);
        newOrderId = newOrderResult.recordset[0].OrderID;

        // 2. Insert OrderItems and deduct Stock (just like createSale)
        for (const item of newOrder.items) {
          const prodDetailsQuery = `SELECT IsBatchTracked, StockIssuingMethod FROM dbo.Products WHERE ProductID = @ProductID AND CompanyID = @CompanyID`;
          const prodDetailsReq = new db.sql.Request(transaction);
          prodDetailsReq.input('ProductID', db.sql.Int, item.productId);
          prodDetailsReq.input('CompanyID', db.sql.Int, companyId);
          const prodDetailsRes = await prodDetailsReq.query(prodDetailsQuery);
          const product = prodDetailsRes.recordset[0];

          if (product && product.IsBatchTracked) {
            const issuingSort = product.StockIssuingMethod === 'FIFO' ? 'MfgDate ASC, BatchID ASC' : 'ExpiryDate ASC';
            const batchesQuery = `
              SELECT * FROM dbo.ProductBatches
              WHERE ProductID = @ProductID AND CompanyID = @CompanyID AND CurrentQty > 0
              ORDER BY ${issuingSort}
            `;
            const batchesReq = new db.sql.Request(transaction);
            batchesReq.input('ProductID', db.sql.Int, item.productId);
            batchesReq.input('CompanyID', db.sql.Int, companyId);
            const batchesRes = await batchesReq.query(batchesQuery);
            const activeBatches = batchesRes.recordset;

            let remainingQty = item.quantity;
            for (const batch of activeBatches) {
              if (remainingQty <= 0) break;
              const deduction = Math.min(remainingQty, batch.CurrentQty);

              const updateBatchReq = new db.sql.Request(transaction);
              updateBatchReq.input('BatchID', db.sql.Int, batch.BatchID);
              updateBatchReq.input('Deduction', db.sql.Decimal(18, 3), deduction);
              await updateBatchReq.query(`
                UPDATE dbo.ProductBatches
                SET CurrentQty = CurrentQty - @Deduction
                WHERE BatchID = @BatchID
              `);

              const allocationRequest = new db.sql.Request(transaction);
              allocationRequest.input('OrderID', db.sql.Int, newOrderId);
              allocationRequest.input('ProductID', db.sql.Int, item.productId);
              allocationRequest.input('Price', db.sql.Decimal(18, 2), item.price);
              allocationRequest.input('Cost', db.sql.Decimal(18, 2), item.cost);
              allocationRequest.input('Quantity', db.sql.Decimal(18, 3), deduction);
              allocationRequest.input('Subtotal', db.sql.Decimal(18, 2), Number((item.price * deduction).toFixed(2)));
              allocationRequest.input('BatchNo', db.sql.NVarChar(50), batch.BatchNo);
              allocationRequest.input('OriginalPrice', db.sql.Decimal(18, 2), getOriginalPrice(item));

              await allocationRequest.query(`
                INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, BatchNo, OriginalPrice)
                VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, @BatchNo, @OriginalPrice)
              `);

              remainingQty -= deduction;
            }

            if (remainingQty > 0) {
              const fallbackItemReq = new db.sql.Request(transaction);
              fallbackItemReq.input('OrderID', db.sql.Int, newOrderId);
              fallbackItemReq.input('ProductID', db.sql.Int, item.productId);
              fallbackItemReq.input('Price', db.sql.Decimal(18, 2), item.price);
              fallbackItemReq.input('Cost', db.sql.Decimal(18, 2), item.cost);
              fallbackItemReq.input('Quantity', db.sql.Decimal(18, 3), remainingQty);
              fallbackItemReq.input('Subtotal', db.sql.Decimal(18, 2), Number((item.price * remainingQty).toFixed(2)));
              fallbackItemReq.input('OriginalPrice', db.sql.Decimal(18, 2), getOriginalPrice(item));

              await fallbackItemReq.query(`
                INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, BatchNo, OriginalPrice)
                VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, NULL, @OriginalPrice)
              `);
            }

            const syncStockReq = new db.sql.Request(transaction);
            syncStockReq.input('ProductID', db.sql.Int, item.productId);
            syncStockReq.input('CompanyID', db.sql.Int, companyId);
            syncStockReq.input('Overshoot', db.sql.Decimal(18, 3), remainingQty);
            await syncStockReq.query(`
              UPDATE dbo.Products
              SET Stock = ISNULL((SELECT SUM(CurrentQty) FROM dbo.ProductBatches WHERE ProductID = @ProductID AND CompanyID = @CompanyID), 0) - @Overshoot
              WHERE ProductID = @ProductID AND CompanyID = @CompanyID
            `);
          } else {
            const itemRequest = new db.sql.Request(transaction);
            itemRequest.input('OrderID', db.sql.Int, newOrderId);
            itemRequest.input('ProductID', db.sql.Int, item.productId);
            itemRequest.input('Price', db.sql.Decimal(18, 2), item.price);
            itemRequest.input('Cost', db.sql.Decimal(18, 2), item.cost);
            itemRequest.input('Quantity', db.sql.Decimal(18, 3), item.quantity);
            itemRequest.input('Subtotal', db.sql.Decimal(18, 2), item.subtotal);
            itemRequest.input('OriginalPrice', db.sql.Decimal(18, 2), getOriginalPrice(item));

            await itemRequest.query(`
              INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, BatchNo, OriginalPrice)
              VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, NULL, @OriginalPrice)
            `);

            const stockRequest = new db.sql.Request(transaction);
            stockRequest.input('ProductID', db.sql.Int, item.productId);
            stockRequest.input('Quantity', db.sql.Decimal(18, 3), item.quantity);
            await stockRequest.query(`
              UPDATE dbo.Products
              SET Stock = Stock - @Quantity
              WHERE ProductID = @ProductID
            `);
          }
        }

        // 3. Process Payments for New Bill
        let newCreditAmount = 0;
        for (const payment of newOrder.payments) {
          const paymentRequest = new db.sql.Request(transaction);
          paymentRequest.input('OrderID', db.sql.Int, newOrderId);
          paymentRequest.input('Method', db.sql.NVarChar(50), payment.method);
          paymentRequest.input('Amount', db.sql.Decimal(18, 2), payment.amount);
          paymentRequest.input('ReferenceNumber', db.sql.NVarChar(100), payment.referenceNumber || null);

          await paymentRequest.query(`
            INSERT INTO dbo.OrderPayments (OrderID, Method, Amount, ReferenceNumber)
            VALUES (@OrderID, @Method, @Amount, @ReferenceNumber)
          `);

          if (payment.method === 'Credit') {
            newCreditAmount += payment.amount;
          }
        }

        // Post Journal Entries for New Invoice
        const purchaseDesc = `Exchange Bill #${newOrderId} offsetting return credit from note #${returnOrderId}`;
        
        // Debit Cash / Bank / Exchange Set-off (total)
        for (const payment of newOrder.payments) {
          let debitAccount = 'Cash Account';
          if (payment.method === 'Exchange Set-off') debitAccount = 'Exchange Clearing Account';
          else if (payment.method.toLowerCase().includes('card') || /^(Visa|Master|Amex)$/i.test(payment.method)) debitAccount = 'Card Clearing Account';
          else if (payment.method.toLowerCase().includes('bank') || payment.method.toLowerCase().includes('online')) debitAccount = 'Bank Account';
          else if (payment.method === 'Credit') debitAccount = 'Accounts Receivable';

          const purchaseJE1 = new db.sql.Request(transaction);
          purchaseJE1.input('CompanyID', db.sql.Int, companyId);
          purchaseJE1.input('SourceID', db.sql.Int, newOrderId);
          purchaseJE1.input('EntryDate', db.sql.Date, new Date());
          purchaseJE1.input('Account', db.sql.NVarChar(100), debitAccount);
          purchaseJE1.input('Debit', db.sql.Decimal(18, 2), payment.amount);
          purchaseJE1.input('Desc', db.sql.NVarChar(500), purchaseDesc);
          await purchaseJE1.query(`
            INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
            VALUES (@CompanyID, 'SalesExchange', @SourceID, @EntryDate, @Account, @Debit, 0.00, @Desc)
          `);
        }

        // Credit Sales Revenue (subtotal)
        const purchaseJE2 = new db.sql.Request(transaction);
        purchaseJE2.input('CompanyID', db.sql.Int, companyId);
        purchaseJE2.input('SourceID', db.sql.Int, newOrderId);
        purchaseJE2.input('EntryDate', db.sql.Date, new Date());
        purchaseJE2.input('Account', db.sql.NVarChar(100), 'Sales Revenue');
        purchaseJE2.input('Credit', db.sql.Decimal(18, 2), newOrder.subtotal - newOrder.discountAmount);
        purchaseJE2.input('Desc', db.sql.NVarChar(500), purchaseDesc);
        await purchaseJE2.query(`
          INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
          VALUES (@CompanyID, 'SalesExchange', @SourceID, @EntryDate, @Account, 0.00, @Credit, @Desc)
        `);

        // Credit VAT Output (tax)
        if (newOrder.taxAmount > 0) {
          const purchaseJE3 = new db.sql.Request(transaction);
          purchaseJE3.input('CompanyID', db.sql.Int, companyId);
          purchaseJE3.input('SourceID', db.sql.Int, newOrderId);
          purchaseJE3.input('EntryDate', db.sql.Date, new Date());
          purchaseJE3.input('Account', db.sql.NVarChar(100), 'VAT Output');
          purchaseJE3.input('Credit', db.sql.Decimal(18, 2), newOrder.taxAmount);
          purchaseJE3.input('Desc', db.sql.NVarChar(500), purchaseDesc);
          await purchaseJE3.query(`
            INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
            VALUES (@CompanyID, 'SalesExchange', @SourceID, @EntryDate, @Account, 0.00, @Credit, @Desc)
          `);
        }

        // Cost of Goods Sold
        const purchaseCostSum = newOrder.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
        if (purchaseCostSum > 0) {
          // Debit Cost of Sales
          const costJE1 = new db.sql.Request(transaction);
          costJE1.input('CompanyID', db.sql.Int, companyId);
          costJE1.input('SourceID', db.sql.Int, newOrderId);
          costJE1.input('EntryDate', db.sql.Date, new Date());
          costJE1.input('Account', db.sql.NVarChar(100), 'Cost of Sales');
          costJE1.input('Debit', db.sql.Decimal(18, 2), purchaseCostSum);
          costJE1.input('Desc', db.sql.NVarChar(500), purchaseDesc + ' (COGS)');
          await costJE1.query(`
            INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
            VALUES (@CompanyID, 'SalesExchange', @SourceID, @EntryDate, @Account, @Debit, 0.00, @Desc)
          `);

          // Credit Inventory Asset
          const costJE2 = new db.sql.Request(transaction);
          costJE2.input('CompanyID', db.sql.Int, companyId);
          costJE2.input('SourceID', db.sql.Int, newOrderId);
          costJE2.input('EntryDate', db.sql.Date, new Date());
          costJE2.input('Account', db.sql.NVarChar(100), 'Inventory Asset');
          costJE2.input('Credit', db.sql.Decimal(18, 2), purchaseCostSum);
          costJE2.input('Desc', db.sql.NVarChar(500), purchaseDesc + ' (COGS)');
          await costJE2.query(`
            INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
            VALUES (@CompanyID, 'SalesExchange', @SourceID, @EntryDate, @Account, 0.00, @Credit, @Desc)
          `);
        }

        // Customer Balance & Loyalty (add loyalty for new sale)
        if (exchangeData.customerId) {
          const loyaltyPointsEarned = Math.floor(newOrder.totalAmount / 10);
          const customerRequest = new db.sql.Request(transaction);
          await customerRepository.adjustBalanceAndPoints(
            exchangeData.customerId,
            companyId,
            newCreditAmount, // adds outstanding debt
            loyaltyPointsEarned,
            customerRequest
          );
        }
      }

      // Update original order status to show refunded/exchanged if fully refunded/exchanged
      const updateOriginalRequest = new db.sql.Request(transaction);
      updateOriginalRequest.input('OriginalOrderID', db.sql.Int, exchangeData.originalOrderId);
      updateOriginalRequest.input('Status', db.sql.NVarChar(20), isPureRefund ? 'Refunded' : 'Exchanged');
      await updateOriginalRequest.query(`
        UPDATE dbo.SalesOrders 
        SET Status = @Status
        WHERE OrderID = @OriginalOrderID
      `);

      await transaction.commit();
      return { returnOrderId, newOrderId };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
}

module.exports = new SalesRepository();
