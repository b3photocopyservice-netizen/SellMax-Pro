const db = require('../config/db');
const customerRepository = require('./customerRepository');

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
      params.StartDate = new Date(filters.startDate);
      params.EndDate = new Date(filters.endDate);
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

            await allocationRequest.query(`
              INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, BatchNo)
              VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, @BatchNo)
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

            await fallbackItemReq.query(`
              INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, BatchNo)
              VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, NULL)
            `);
          }

          const syncStockReq = new db.sql.Request(transaction);
          syncStockReq.input('ProductID', db.sql.Int, item.productId);
          syncStockReq.input('CompanyID', db.sql.Int, companyId);
          await syncStockReq.query(`
            UPDATE dbo.Products
            SET Stock = ISNULL((SELECT SUM(CurrentQty) FROM dbo.ProductBatches WHERE ProductID = @ProductID AND CompanyID = @CompanyID), 0)
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

          await itemRequest.query(`
            INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, BatchNo)
            VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, NULL)
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
      orderRequest.input('HeldNote', db.sql.NVarChar(255), saleData.heldNote || 'No description');

      const orderResult = await orderRequest.query(`
        INSERT INTO dbo.SalesOrders (CompanyID, UserID, CustomerID, Subtotal, DiscountAmount, TaxAmount, TotalAmount, Status, HeldNote)
        OUTPUT inserted.OrderID
        VALUES (@CompanyID, @UserID, @CustomerID, @Subtotal, @DiscountAmount, @TaxAmount, @TotalAmount, @Status, @HeldNote)
      `);
      
      const orderId = orderResult.recordset[0].OrderID;

      // 2. Insert Items (Stock is NOT reduced for held sales)
      for (const item of saleData.items) {
        const itemRequest = new db.sql.Request(transaction);
        itemRequest.input('OrderID', db.sql.Int, orderId);
        itemRequest.input('ProductID', db.sql.Int, item.productId);
        itemRequest.input('Price', db.sql.Decimal(18, 2), item.price);
        itemRequest.input('Cost', db.sql.Decimal(18, 2), item.cost);
        itemRequest.input('Quantity', db.sql.Decimal(18, 3), item.quantity);
        itemRequest.input('Subtotal', db.sql.Decimal(18, 2), item.subtotal);

        await itemRequest.query(`
          INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal)
          VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal)
        `);
      }

      await transaction.commit();
      return orderId;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async getHeldSales(companyId) {
    const sqlQuery = `
      SELECT so.*, c.Name AS CustomerName
      FROM dbo.SalesOrders so
      LEFT JOIN dbo.Customers c ON so.CustomerID = c.CustomerID
      WHERE so.CompanyID = @CompanyID AND so.Status = 'Held'
      ORDER BY so.OrderDate DESC
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId });
    return result.recordset;
  }

  async resumeHeldSale(orderId, companyId) {
    const details = await this.getSaleDetails(orderId, companyId);
    if (!details) return null;

    // Delete the held order from database
    const deleteQuery = `DELETE FROM dbo.SalesOrders WHERE OrderID = @OrderID AND CompanyID = @CompanyID AND Status = 'Held'`;
    await db.query(deleteQuery, { OrderID: orderId, CompanyID: companyId });

    return details;
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

        await itemRequest.query(`
          INSERT INTO dbo.OrderItems (OrderID, ProductID, Price, Cost, Quantity, Subtotal, BatchNo)
          VALUES (@OrderID, @ProductID, @Price, @Cost, @Quantity, @Subtotal, @BatchNo)
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
}

module.exports = new SalesRepository();
