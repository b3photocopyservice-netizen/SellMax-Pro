const db = require('../config/db');

class CustomerPaymentRepository {
  // Generates receipt number like RCP-20260623-0001
  async generateReceiptNo(companyId, date) {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const prefix = `RCP-${yyyy}${mm}${dd}-`;

    const result = await db.query(
      `SELECT COUNT(*) AS cnt FROM dbo.CustomerPayments
       WHERE CompanyID = @CompanyID AND ReceiptNo LIKE @Prefix`,
      { CompanyID: companyId, Prefix: prefix + '%' }
    );
    const seq = (result.recordset[0].cnt + 1).toString().padStart(4, '0');
    return prefix + seq;
  }

  // Returns unpaid credit invoices for a customer
  async getUnpaidInvoices(customerId, companyId) {
    const sql = `
      SELECT 
          so.OrderID,
          so.OrderID AS InvoiceNo,
          so.OrderDate AS InvoiceDate,
          so.TotalAmount AS InvoiceTotal,
          (ISNULL(op.CreditAmount, 0) + ISNULL(refunds.RefundCreditAmount, 0)) AS OriginalCreditAmount,
          ISNULL(alloc.PaidAmount, 0) AS PaidAmount,
          ((ISNULL(op.CreditAmount, 0) + ISNULL(refunds.RefundCreditAmount, 0)) - ISNULL(alloc.PaidAmount, 0)) AS BalanceAmount
      FROM dbo.SalesOrders so
      INNER JOIN (
          SELECT OrderID, SUM(Amount) AS CreditAmount
          FROM dbo.OrderPayments
          WHERE Method = 'Credit'
          GROUP BY OrderID
      ) op ON so.OrderID = op.OrderID
      LEFT JOIN (
          SELECT so2.ParentOrderID, SUM(op2.Amount) AS RefundCreditAmount
          FROM dbo.SalesOrders so2
          INNER JOIN dbo.OrderPayments op2 ON so2.OrderID = op2.OrderID
          WHERE so2.ParentOrderID IS NOT NULL AND op2.Method = 'Credit' AND so2.Status <> 'Cancelled'
          GROUP BY so2.ParentOrderID
      ) refunds ON so.OrderID = refunds.ParentOrderID
      LEFT JOIN (
          SELECT OrderID, SUM(AllocatedAmount) AS PaidAmount
          FROM dbo.CustomerPaymentAllocations
          GROUP BY OrderID
      ) alloc ON so.OrderID = alloc.OrderID
      WHERE so.CustomerID = @CustomerID 
        AND so.CompanyID = @CompanyID
        AND so.Status <> 'Cancelled'
        AND ((ISNULL(op.CreditAmount, 0) + ISNULL(refunds.RefundCreditAmount, 0)) - ISNULL(alloc.PaidAmount, 0)) > 0.005
      ORDER BY so.OrderDate ASC;
    `;
    const result = await db.query(sql, { CustomerID: customerId, CompanyID: companyId });
    return result.recordset;
  }

  // Processes customer payment, allocations, customer balance, and journal entries in a transaction
  async createPayment(companyId, userId, paymentData) {
    const pool = await db.poolPromise;
    const transaction = new db.sql.Transaction(pool);

    try {
      await transaction.begin();

      // 1. Generate receipt number
      const receiptNo = await this.generateReceiptNo(companyId, paymentData.paymentDate);

      // 2. Insert Payment Header
      const headerReq = new db.sql.Request(transaction);
      headerReq.input('CompanyID', db.sql.Int, companyId);
      headerReq.input('CustomerID', db.sql.Int, paymentData.customerId);
      headerReq.input('UserID', db.sql.Int, userId);
      headerReq.input('ReceiptNo', db.sql.NVarChar(50), receiptNo);
      headerReq.input('PaymentDate', db.sql.Date, new Date(paymentData.paymentDate));
      headerReq.input('ReferenceNo', db.sql.NVarChar(100), paymentData.referenceNo || null);
      headerReq.input('Remarks', db.sql.NVarChar(500), paymentData.remarks || null);
      headerReq.input('TotalAmount', db.sql.Decimal(18, 2), paymentData.totalAmount);

      const headerRes = await headerReq.query(`
        INSERT INTO dbo.CustomerPayments 
          (CompanyID, CustomerID, UserID, ReceiptNo, PaymentDate, ReferenceNo, Remarks, TotalAmount)
        OUTPUT inserted.*
        VALUES 
          (@CompanyID, @CustomerID, @UserID, @ReceiptNo, @PaymentDate, @ReferenceNo, @Remarks, @TotalAmount)
      `);
      const paymentHeader = headerRes.recordset[0];
      const paymentId = paymentHeader.PaymentID;

      // 3. Insert Payment Modes (Split payments)
      for (const mode of paymentData.modes) {
        const modeReq = new db.sql.Request(transaction);
        modeReq.input('PaymentID', db.sql.Int, paymentId);
        modeReq.input('Method', db.sql.NVarChar(50), mode.method);
        modeReq.input('Amount', db.sql.Decimal(18, 2), mode.amount);
        modeReq.input('RefNo', db.sql.NVarChar(100), mode.referenceNumber || null);

        await modeReq.query(`
          INSERT INTO dbo.CustomerPaymentModes (PaymentID, Method, Amount, ReferenceNumber)
          VALUES (@PaymentID, @Method, @Amount, @RefNo)
        `);
      }

      // 4. Insert Allocations (FIFO/Manual)
      for (const alloc of paymentData.allocations) {
        if (alloc.allocatedAmount <= 0) continue;
        const allocReq = new db.sql.Request(transaction);
        allocReq.input('PaymentID', db.sql.Int, paymentId);
        allocReq.input('OrderID', db.sql.Int, alloc.orderId);
        allocReq.input('Amount', db.sql.Decimal(18, 2), alloc.allocatedAmount);

        await allocReq.query(`
          INSERT INTO dbo.CustomerPaymentAllocations (PaymentID, OrderID, AllocatedAmount)
          VALUES (@PaymentID, @OrderID, @Amount)
        `);
      }

      // 5. Update Customer Outstanding Balance (CR)
      const customerReq = new db.sql.Request(transaction);
      customerReq.input('CustomerID', db.sql.Int, paymentData.customerId);
      customerReq.input('CompanyID', db.sql.Int, companyId);
      customerReq.input('PaymentTotal', db.sql.Decimal(18, 2), paymentData.totalAmount);
      await customerReq.query(`
        UPDATE dbo.Customers
        SET CurrentBalance = CurrentBalance - @PaymentTotal
        WHERE CustomerID = @CustomerID AND CompanyID = @CompanyID
      `);

      // 6. Post General Ledger Journal Entries
      // Map payment methods to debit accounts:
      // Cash -> Cash Account
      // Cards -> Card Clearing Account
      // QR/Online/Wire -> Bank Account
      // Cheque -> Cheque in Hand Account
      const getDebitAccount = (method) => {
        const m = method.toLowerCase();
        if (m.includes('cash')) return 'Cash Account';
        if (m.includes('card') || m.includes('visa') || m.includes('master') || m.includes('amex')) {
          return 'Card Clearing Account';
        }
        if (m.includes('cheque')) return 'Cheque in Hand Account';
        return 'Bank Account'; // Fallback for Bank Transfer, QR, Online, etc.
      };

      for (const mode of paymentData.modes) {
        const debitAccount = getDebitAccount(mode.method);
        const description = `Cust Payment ${receiptNo}: ${paymentData.customerName} via ${mode.method}${mode.referenceNumber ? ` (${mode.referenceNumber})` : ''}`;

        // Debit cash/bank/cheque/clearing account
        const journalDr = new db.sql.Request(transaction);
        journalDr.input('CompanyID', db.sql.Int, companyId);
        journalDr.input('SourceID', db.sql.Int, paymentId);
        journalDr.input('EntryDate', db.sql.Date, new Date(paymentData.paymentDate));
        journalDr.input('AccountName', db.sql.NVarChar(100), debitAccount);
        journalDr.input('Debit', db.sql.Decimal(18, 2), mode.amount);
        journalDr.input('Desc', db.sql.NVarChar(500), description);
        await journalDr.query(`
          INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
          VALUES (@CompanyID, 'CustomerPayment', @SourceID, @EntryDate, @AccountName, @Debit, 0.00, @Desc)
        `);

        // Credit Accounts Receivable
        const journalCr = new db.sql.Request(transaction);
        journalCr.input('CompanyID', db.sql.Int, companyId);
        journalCr.input('SourceID', db.sql.Int, paymentId);
        journalCr.input('EntryDate', db.sql.Date, new Date(paymentData.paymentDate));
        journalCr.input('AccountName', db.sql.NVarChar(100), 'Accounts Receivable');
        journalCr.input('Credit', db.sql.Decimal(18, 2), mode.amount);
        journalCr.input('Desc', db.sql.NVarChar(500), description);
        await journalCr.query(`
          INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
          VALUES (@CompanyID, 'CustomerPayment', @SourceID, @EntryDate, @AccountName, 0.00, @Credit, @Desc)
        `);
      }

      await transaction.commit();
      return paymentHeader;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  // Lists historical payments
  async getPaymentsList(companyId, filters = {}) {
    let sql = `
      SELECT 
        cp.PaymentID, cp.ReceiptNo, cp.PaymentDate, cp.ReferenceNo, cp.Remarks, cp.TotalAmount, cp.CreatedAt,
        c.Name AS CustomerName, c.CustomerCode,
        u.Username AS ReceivedBy
      FROM dbo.CustomerPayments cp
      INNER JOIN dbo.Customers c ON cp.CustomerID = c.CustomerID
      INNER JOIN dbo.Users u ON cp.UserID = u.UserID
      WHERE cp.CompanyID = @CompanyID
    `;
    const params = { CompanyID: companyId };

    if (filters.customerId) {
      sql += ` AND cp.CustomerID = @CustomerID`;
      params.CustomerID = filters.customerId;
    }
    if (filters.startDate) {
      sql += ` AND cp.PaymentDate >= @StartDate`;
      params.StartDate = new Date(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND cp.PaymentDate <= @EndDate`;
      params.EndDate = new Date(filters.endDate);
    }
    if (filters.search) {
      sql += ` AND (cp.ReceiptNo LIKE @Search OR c.Name LIKE @Search)`;
      params.Search = `%${filters.search}%`;
    }

    sql += ` ORDER BY cp.PaymentDate DESC, cp.ReceiptNo DESC`;
    const result = await db.query(sql, params);
    return result.recordset;
  }

  // Get single customer payment detail with modes and allocations
  async getPaymentDetails(paymentId, companyId) {
    const paymentRes = await db.query(
      `SELECT cp.*, c.Name AS CustomerName, c.CustomerCode, u.Username AS ReceivedBy
       FROM dbo.CustomerPayments cp
       INNER JOIN dbo.Customers c ON cp.CustomerID = c.CustomerID
       INNER JOIN dbo.Users u ON cp.UserID = u.UserID
       WHERE cp.PaymentID = @ID AND cp.CompanyID = @CompanyID`,
      { ID: paymentId, CompanyID: companyId }
    );
    const payment = paymentRes.recordset[0];
    if (!payment) return null;

    const modes = await db.query(
      `SELECT * FROM dbo.CustomerPaymentModes WHERE PaymentID = @ID`,
      { ID: paymentId }
    );

    const allocations = await db.query(
      `SELECT cpa.*, so.OrderDate, so.TotalAmount AS InvoiceTotal
       FROM dbo.CustomerPaymentAllocations cpa
       INNER JOIN dbo.SalesOrders so ON cpa.OrderID = so.OrderID
       WHERE cpa.PaymentID = @ID`,
      { ID: paymentId }
    );

    payment.Modes = modes.recordset;
    payment.Allocations = allocations.recordset;
    return payment;
  }

  // Gets Outstanding Receivables List
  async getOutstandingReceivables(companyId) {
    const sql = `
      SELECT CustomerID, CustomerCode, Name, Phone, Email, CreditLimit, CurrentBalance
      FROM dbo.Customers
      WHERE CompanyID = @CompanyID AND CurrentBalance > 0
      ORDER BY CurrentBalance DESC
    `;
    const result = await db.query(sql, { CompanyID: companyId });
    return result.recordset;
  }

  // Customer statement (ledger) entries
  async getCustomerStatement(customerId, companyId, startDate = null, endDate = null) {
    // 1. Base query unifying SalesOrders (Debits), Payments (Credits), Returns (Credits), and Adjustments (Debits/Credits)
    const baseSql = `
      SELECT 
        'Invoice' AS Type,
        so.OrderID AS RefID,
        CAST(so.OrderID AS NVARCHAR(50)) AS RefNo,
        so.OrderDate AS Date,
        op.Amount AS Debit,
        0.00 AS Credit,
        'Credit Sale Invoice #SM-' + CAST(so.OrderID AS NVARCHAR(50)) AS Description
      FROM dbo.SalesOrders so
      INNER JOIN dbo.OrderPayments op ON so.OrderID = op.OrderID
      WHERE so.CustomerID = @CustomerID AND so.CompanyID = @CompanyID AND op.Method = 'Credit' AND so.Status <> 'Cancelled'
      
      UNION ALL
      
      SELECT 
        'Payment' AS Type,
        cp.PaymentID AS RefID,
        cp.ReceiptNo AS RefNo,
        cp.PaymentDate AS Date,
        0.00 AS Debit,
        cp.TotalAmount AS Credit,
        ISNULL(cp.Remarks, 'Credit Account Payment') AS Description
      FROM dbo.CustomerPayments cp
      WHERE cp.CustomerID = @CustomerID AND cp.CompanyID = @CompanyID

      UNION ALL

      SELECT 
        'Sales Return' AS Type,
        so.OrderID AS RefID,
        'RET-' + CAST(so.OrderID AS NVARCHAR(50)) AS RefNo,
        so.OrderDate AS Date,
        0.00 AS Debit,
        op.Amount AS Credit,
        'Sales Return refund for #SM-' + CAST(so.ParentOrderID AS NVARCHAR(50)) AS Description
      FROM dbo.SalesOrders so
      INNER JOIN dbo.OrderPayments op ON so.OrderID = op.OrderID
      WHERE so.CustomerID = @CustomerID AND so.CompanyID = @CompanyID AND so.ParentOrderID IS NOT NULL AND op.Method = 'Credit' AND so.Status <> 'Cancelled'

      UNION ALL

      SELECT 
        cla.AdjustmentType AS Type,
        cla.AdjustmentID AS RefID,
        cla.ReferenceNumber AS RefNo,
        cla.AdjustmentDate AS Date,
        CASE WHEN cla.Effect = 'Debit' THEN cla.Amount ELSE 0.00 END AS Debit,
        CASE WHEN cla.Effect = 'Credit' THEN cla.Amount ELSE 0.00 END AS Credit,
        ISNULL(cla.Description, cla.AdjustmentType) AS Description
      FROM dbo.CustomerLedgerAdjustments cla
      WHERE cla.CustomerID = @CustomerID AND cla.CompanyID = @CompanyID
    `;

    // 2. Compute opening balance before startDate
    let openingBalance = 0;
    if (startDate) {
      const opQuery = `
        SELECT ISNULL(SUM(Debit), 0) - ISNULL(SUM(Credit), 0) AS OpBalance
        FROM (${baseSql}) temp
        WHERE Date < @StartDate
      `;
      const opResult = await db.query(opQuery, { 
        CustomerID: customerId, 
        CompanyID: companyId, 
        StartDate: new Date(startDate) 
      });
      openingBalance = parseFloat(opResult.recordset[0]?.OpBalance || 0);
    }

    // 3. Retrieve transactions within date range
    let sql = `SELECT * FROM (${baseSql}) temp WHERE 1 = 1`;
    const params = { CustomerID: customerId, CompanyID: companyId };

    if (startDate) {
      sql += ` AND Date >= @StartDate`;
      params.StartDate = new Date(startDate);
    }
    if (endDate) {
      sql += ` AND Date <= @EndDate`;
      params.EndDate = new Date(endDate);
    }

    sql += ` ORDER BY Date ASC, RefNo ASC`;
    const result = await db.query(sql, params);
    return {
      openingBalance,
      transactions: result.recordset
    };
  }

  // Creates a ledger adjustment and posts journal entries in a transaction
  async createLedgerAdjustment(companyId, userId, data) {
    const pool = await db.poolPromise;
    const transaction = new db.sql.Transaction(pool);

    try {
      await transaction.begin();

      const customerId = parseInt(data.customerId, 10);
      const amount = parseFloat(data.amount);
      const effect = data.effect; // 'Debit' or 'Credit'
      const adjType = data.adjustmentType; // 'Opening Balance', 'Credit Note', 'Debit Note', 'Customer Advance', 'Exchange Adjustment'
      const refNo = data.referenceNumber?.trim() || 
                    (adjType === 'Credit Note' ? 'CN-' : adjType === 'Debit Note' ? 'DN-' : 'ADJ-') + Date.now().toString().slice(-8);
      const description = data.description?.trim() || `${adjType} adjustment`;
      const date = data.date ? new Date(data.date) : new Date();

      // 1. Insert into CustomerLedgerAdjustments
      const adjReq = new db.sql.Request(transaction);
      adjReq.input('CompanyID', db.sql.Int, companyId);
      adjReq.input('CustomerID', db.sql.Int, customerId);
      adjReq.input('UserID', db.sql.Int, userId);
      adjReq.input('AdjustmentType', db.sql.NVarChar(50), adjType);
      adjReq.input('RefNo', db.sql.NVarChar(50), refNo);
      adjReq.input('AdjDate', db.sql.Date, date);
      adjReq.input('Effect', db.sql.NVarChar(10), effect);
      adjReq.input('Amount', db.sql.Decimal(18, 2), amount);
      adjReq.input('Desc', db.sql.NVarChar(500), description);

      const adjRes = await adjReq.query(`
        INSERT INTO dbo.CustomerLedgerAdjustments 
          (CompanyID, CustomerID, UserID, AdjustmentType, ReferenceNumber, AdjustmentDate, Effect, Amount, Description)
        OUTPUT inserted.AdjustmentID
        VALUES 
          (@CompanyID, @CustomerID, @UserID, @AdjustmentType, @RefNo, @AdjDate, @Effect, @Amount, @Desc)
      `);
      const adjustmentId = adjRes.recordset[0].AdjustmentID;

      // 2. Adjust customer balance (Debit increases balance, Credit decreases balance)
      const balanceDelta = effect === 'Debit' ? amount : -amount;
      const custReq = new db.sql.Request(transaction);
      custReq.input('CustomerID', db.sql.Int, customerId);
      custReq.input('CompanyID', db.sql.Int, companyId);
      custReq.input('Delta', db.sql.Decimal(18, 2), balanceDelta);
      await custReq.query(`
        UPDATE dbo.Customers
        SET CurrentBalance = CurrentBalance + @Delta
        WHERE CustomerID = @CustomerID AND CompanyID = @CompanyID
      `);

      // 3. Post General Ledger double-entry Journal Entries
      const getAccountMapping = (type, eff) => {
        const t = type.toLowerCase();
        if (t.includes('opening')) {
          return {
            debit: eff === 'Debit' ? 'Accounts Receivable' : 'Opening Balance Equity',
            credit: eff === 'Debit' ? 'Opening Balance Equity' : 'Accounts Receivable'
          };
        }
        if (t.includes('advance')) {
          return { debit: 'Bank Account', credit: 'Accounts Receivable' };
        }
        if (eff === 'Debit') {
          return { debit: 'Accounts Receivable', credit: 'Exchange/Adjustments Account' };
        } else {
          return { debit: 'Exchange/Adjustments Account', credit: 'Accounts Receivable' };
        }
      };

      const mapping = getAccountMapping(adjType, effect);
      const glDesc = `${adjType} ${refNo}: ${description}`;

      // Journal Line 1: Debit
      const drReq = new db.sql.Request(transaction);
      drReq.input('CompanyID', db.sql.Int, companyId);
      drReq.input('SourceID', db.sql.Int, adjustmentId);
      drReq.input('EntryDate', db.sql.Date, date);
      drReq.input('AccountName', db.sql.NVarChar(100), mapping.debit);
      drReq.input('Amount', db.sql.Decimal(18, 2), amount);
      drReq.input('Desc', db.sql.NVarChar(500), glDesc);
      await drReq.query(`
        INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
        VALUES (@CompanyID, 'CustomerLedgerAdjustment', @SourceID, @EntryDate, @AccountName, @Amount, 0.00, @Desc)
      `);

      // Journal Line 2: Credit
      const crReq = new db.sql.Request(transaction);
      crReq.input('CompanyID', db.sql.Int, companyId);
      crReq.input('SourceID', db.sql.Int, adjustmentId);
      crReq.input('EntryDate', db.sql.Date, date);
      crReq.input('AccountName', db.sql.NVarChar(100), mapping.credit);
      crReq.input('Amount', db.sql.Decimal(18, 2), amount);
      crReq.input('Desc', db.sql.NVarChar(500), glDesc);
      await crReq.query(`
        INSERT INTO dbo.JournalEntries (CompanyID, SourceType, SourceID, EntryDate, AccountName, Debit, Credit, Description)
        VALUES (@CompanyID, 'CustomerLedgerAdjustment', @SourceID, @EntryDate, @AccountName, 0.00, @Amount, @Desc)
      `);

      await transaction.commit();
      return { adjustmentId, referenceNumber: refNo };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  // Grouped payments collected by payment modes
  async getPaymentModeSummary(companyId, startDate = null, endDate = null) {
    let sql = `
      SELECT Method, SUM(Amount) AS TotalAmount
      FROM dbo.CustomerPaymentModes cpm
      INNER JOIN dbo.CustomerPayments cp ON cpm.PaymentID = cp.PaymentID
      WHERE cp.CompanyID = @CompanyID
    `;
    const params = { CompanyID: companyId };

    if (startDate) {
      sql += ` AND cp.PaymentDate >= @StartDate`;
      params.StartDate = new Date(startDate);
    }
    if (endDate) {
      sql += ` AND cp.PaymentDate <= @EndDate`;
      params.EndDate = new Date(endDate);
    }

    sql += ` GROUP BY Method ORDER BY TotalAmount DESC`;
    const result = await db.query(sql, params);
    return result.recordset;
  }
}

module.exports = new CustomerPaymentRepository();
