const supplierRepository = require('../repositories/supplierRepository');
const db = require('../config/db');

class SupplierService {
  async getSupplierProfile(supplierId, companyId) {
    return await supplierRepository.getSupplierById(supplierId, companyId);
  }

  async getAllSuppliers(companyId, filters) {
    return await supplierRepository.getAllSuppliers(companyId, filters);
  }

  async createSupplierProfile(companyId, userId, data) {
    if (!data.supplierName || !data.supplierName.trim()) {
      throw new Error('Supplier Name is a required field.');
    }
    const supplier = await supplierRepository.createSupplier(companyId, data);
    
    // Log audit log
    await supplierRepository.createAuditLog(
      companyId, 
      userId, 
      'Supplier Created', 
      `Supplier profile for ${supplier.SupplierName} (${supplier.SupplierCode}) has been successfully created.`
    );
    
    return supplier;
  }

  async updateSupplierProfile(supplierId, companyId, userId, data) {
    if (!data.supplierName || !data.supplierName.trim()) {
      throw new Error('Supplier Name is a required field.');
    }
    const supplier = await supplierRepository.updateSupplier(supplierId, companyId, data);
    
    // Log audit log
    await supplierRepository.createAuditLog(
      companyId, 
      userId, 
      'Supplier Updated', 
      `Supplier profile for ${supplier.SupplierName} (${supplier.SupplierCode}) has been updated.`
    );

    // Check Credit Limit Warning
    await this.checkCreditLimitThreshold(companyId, supplier);
    
    return supplier;
  }

  async deleteSupplierProfile(supplierId, companyId, userId) {
    const supplier = await supplierRepository.getSupplierById(supplierId, companyId);
    if (!supplier) throw new Error('Supplier not found.');

    const result = await supplierRepository.deleteSupplier(supplierId, companyId);
    if (result === 'HAS_TRANSACTIONS') {
      throw new Error('Cannot delete supplier because they have associated purchase orders, payments, or returns. Please set their status to Inactive instead.');
    }
    
    if (result === 'DELETED') {
      await supplierRepository.createAuditLog(
        companyId, 
        userId, 
        'Supplier Deleted', 
        `Supplier profile for ${supplier.SupplierName} (${supplier.SupplierCode}) was removed from the database.`
      );
      return true;
    }
    return false;
  }

  // --- ACTIONS ---

  async createPO(companyId, userId, data) {
    if (!data.supplierId) throw new Error('Supplier selection is required.');
    if (!data.items || data.items.length === 0) throw new Error('Purchase order must contain at least 1 item.');

    const supplier = await supplierRepository.getSupplierById(data.supplierId, companyId);
    if (!supplier) throw new Error('Selected supplier does not exist.');

    const po = await supplierRepository.createPurchaseOrder(companyId, userId, data);

    // Raise Alert
    await db.query(`
      INSERT INTO dbo.SystemNotifications (CompanyID, Type, Message)
      VALUES (@CompanyID, 'SupplierPO', @Message)
    `, {
      CompanyID: companyId,
      Message: `New Purchase Order ${po.PONumber} generated for supplier ${supplier.SupplierName}.`
    });

    // Log Audit
    await supplierRepository.createAuditLog(
      companyId, 
      userId, 
      'PO Generated', 
      `Purchase Order ${po.PONumber} raised for ${supplier.SupplierName}. Total amount: Rs. ${po.TotalAmount}`
    );

    return po;
  }

  async createDirectCashPurchase(companyId, userId, data) {
    if (!data.supplierId) throw new Error('Supplier selection is required.');
    if (!data.items || data.items.length === 0) throw new Error('Direct cash purchase must contain at least 1 item.');

    const supplier = await supplierRepository.getSupplierById(data.supplierId, companyId);
    if (!supplier) throw new Error('Selected supplier does not exist.');

    const result = await supplierRepository.createDirectCashPurchase(companyId, userId, data);

    // Raise Alert
    await db.query(`
      INSERT INTO dbo.SystemNotifications (CompanyID, Type, Message)
      VALUES (@CompanyID, 'SupplierPO', @Message)
    `, {
      CompanyID: companyId,
      Message: `Direct Cash Purchase (${result.PONumber}) generated for supplier ${supplier.SupplierName}.`
    });

    // Log Audit
    await supplierRepository.createAuditLog(
      companyId, 
      userId, 
      'PO Generated', 
      `Direct Cash Purchase ${result.PONumber} finalized for ${supplier.SupplierName}. Total amount: Rs. ${parseFloat(result.TotalAmount).toFixed(2)}`
    );

    return result;
  }

  async createDirectCreditPurchase(companyId, userId, data) {
    if (!data.supplierId) throw new Error('Supplier selection is required.');
    if (!data.items || data.items.length === 0) throw new Error('Direct credit purchase must contain at least 1 item.');

    const supplier = await supplierRepository.getSupplierById(data.supplierId, companyId);
    if (!supplier) throw new Error('Selected supplier does not exist.');

    const result = await supplierRepository.createDirectCreditPurchase(companyId, userId, data);

    // Raise Alert
    await db.query(`
      INSERT INTO dbo.SystemNotifications (CompanyID, Type, Message)
      VALUES (@CompanyID, 'SupplierPO', @Message)
    `, {
      CompanyID: companyId,
      Message: `Direct Credit Purchase Invoice (${result.PONumber}) generated for supplier ${supplier.SupplierName}.`
    });

    // Log Audit
    await supplierRepository.createAuditLog(
      companyId, 
      userId, 
      'PO Generated', 
      `Direct Credit Purchase Invoice ${result.PONumber} finalized for ${supplier.SupplierName}. Total amount: Rs. ${parseFloat(result.TotalAmount).toFixed(2)}, Paid: Rs. ${parseFloat(data.paidAmount || 0).toFixed(2)}`
    );

    // Check Credit Limit Threshold
    await this.checkCreditLimitThreshold(companyId, supplier);

    return result;
  }

  async updatePO(purchaseOrderId, companyId, userId, data) {
    if (!data.supplierId) throw new Error('Supplier selection is required.');
    if (!data.items || data.items.length === 0) throw new Error('Purchase order must contain at least 1 item.');
    const updated = await supplierRepository.updatePurchaseOrder(purchaseOrderId, companyId, data);
    await supplierRepository.createAuditLog(companyId, userId, 'PO Updated',
      `Purchase Order ${updated.PONumber} updated by user.`);
    return updated;
  }

  async deletePO(purchaseOrderId, companyId, userId) {
    const po = await supplierRepository.getPurchaseOrderById(purchaseOrderId, companyId);
    if (!po) throw new Error('Purchase Order not found.');
    await supplierRepository.deletePurchaseOrder(purchaseOrderId, companyId);
    await supplierRepository.createAuditLog(companyId, userId, 'PO Deleted',
      `Purchase Order ${po.PONumber} deleted by user.`);
    return true;
  }

  async receivePOStock(purchaseOrderId, companyId, userId, data) {
    if (!data.items || data.items.length === 0) throw new Error('GRN must contain received items.');

    const po = await supplierRepository.getPurchaseOrderById(purchaseOrderId, companyId);
    if (!po) throw new Error('Purchase Order not found.');

    const result = await supplierRepository.receiveGRN(purchaseOrderId, companyId, data);

    // Raise alert
    await db.query(`
      INSERT INTO dbo.SystemNotifications (CompanyID, Type, Message)
      VALUES (@CompanyID, 'Expiry', @Message)
    `, {
      CompanyID: companyId,
      Message: `Goods Received Note (${result.grnNumber}) approved. Stocks received against order ${po.PONumber}.`
    });

    // Log audit
    await supplierRepository.createAuditLog(
      companyId, 
      userId, 
      'GRN Received', 
      `Approved Goods Received Note ${result.grnNumber} against Purchase Order ${po.PONumber}.`
    );

    return result;
  }

  async invoicePOBill(purchaseOrderId, companyId, userId, data) {
    const po = await supplierRepository.getPurchaseOrderById(purchaseOrderId, companyId);
    if (!po) throw new Error('Purchase Order not found.');

    const result = await supplierRepository.invoicePurchaseOrder(purchaseOrderId, companyId, data);

    // Fetch updated supplier details to review credit limit
    const supplier = await supplierRepository.getSupplierById(po.SupplierID, companyId);

    // Trigger credit warnings
    await this.checkCreditLimitThreshold(companyId, supplier);

    // Log audit
    await supplierRepository.createAuditLog(
      companyId, 
      userId, 
      'Invoice Finalized', 
      `Purchase invoice ${result.invoiceNumber} recorded against order ${po.PONumber}. Supplier ledger credited by Rs. ${po.TotalAmount}.`
    );

    return result;
  }

  async makeSupplierSettlement(companyId, userId, data) {
    if (!data.supplierId) throw new Error('Supplier selection is required.');
    if (!data.amount || parseFloat(data.amount) <= 0) throw new Error('Payment amount must be greater than zero.');

    const supplier = await supplierRepository.getSupplierById(data.supplierId, companyId);
    if (!supplier) throw new Error('Supplier not found.');

    const result = await supplierRepository.createSupplierPayment(companyId, userId, data);

    // Log audit
    await supplierRepository.createAuditLog(
      companyId, 
      userId, 
      'Payment Logged', 
      `Settlement payment of Rs. ${parseFloat(data.amount).toFixed(2)} made to ${supplier.SupplierName} via Voucher ${result.paymentNumber}.`
    );

    return result;
  }

  async makeSupplierReturn(companyId, userId, data) {
    if (!data.supplierId) throw new Error('Supplier selection is required.');
    if (!data.items || data.items.length === 0) throw new Error('Supplier returns must specify returned inventory items.');

    const supplier = await supplierRepository.getSupplierById(data.supplierId, companyId);
    if (!supplier) throw new Error('Supplier not found.');

    const returnDoc = await supplierRepository.createSupplierReturn(companyId, userId, data);

    // Log audit
    await supplierRepository.createAuditLog(
      companyId, 
      userId, 
      'Supplier Return', 
      `Supplier return ${returnDoc.ReturnNumber} (${returnDoc.ReturnType} return) processed for ${supplier.SupplierName}. Total value: Rs. ${parseFloat(returnDoc.TotalAmount).toFixed(2)}.`
    );

    return returnDoc;
  }

  async getReturnsList(companyId, filters = {}) {
    return await supplierRepository.getSupplierReturns(companyId, filters);
  }

  async getReturnDetail(returnId, companyId) {
    const ret = await supplierRepository.getSupplierReturnById(returnId, companyId);
    if (!ret) throw new Error('Supplier Return not found.');
    return ret;
  }

  async updateReturn(returnId, companyId, userId, data) {
    if (!data.supplierId) throw new Error('Supplier selection is required.');
    if (!data.items || data.items.length === 0) throw new Error('Supplier return must contain items.');

    const supplier = await supplierRepository.getSupplierById(data.supplierId, companyId);
    if (!supplier) throw new Error('Supplier not found.');

    const updated = await supplierRepository.updateSupplierReturn(returnId, companyId, userId, data);

    await supplierRepository.createAuditLog(
      companyId,
      userId,
      'Return Updated',
      `Supplier return ${updated.ReturnNumber} (${updated.ReturnType} return) has been updated for supplier ${supplier.SupplierName}. New Total: Rs. ${parseFloat(updated.TotalAmount).toFixed(2)}.`
    );

    return updated;
  }

  async deleteReturn(returnId, companyId, userId) {
    const ret = await supplierRepository.getSupplierReturnById(returnId, companyId);
    if (!ret) throw new Error('Supplier Return not found.');

    await supplierRepository.deleteSupplierReturn(returnId, companyId);

    await supplierRepository.createAuditLog(
      companyId,
      userId,
      'Return Deleted',
      `Supplier return ${ret.ReturnNumber} was deleted and stock/ledger mappings were reversed.`
    );

    return true;
  }

  // --- LEDGER STATS ---

  async getLedgerTransactions(supplierId, companyId, filters) {
    return await supplierRepository.getSupplierLedger(supplierId, companyId, filters);
  }

  async makeLedgerAdjustment(companyId, userId, data) {
    if (!data.supplierId) throw new Error('Supplier selection is required.');
    if (!data.amount || parseFloat(data.amount) <= 0) throw new Error('Amount must be greater than zero.');
    if (!data.adjustmentType) throw new Error('Adjustment type is required.');
    if (!data.effect) throw new Error('Adjustment effect is required (Credit or Debit).');

    const supplier = await supplierRepository.getSupplierById(data.supplierId, companyId);
    if (!supplier) throw new Error('Supplier not found.');

    const result = await supplierRepository.createLedgerAdjustment(companyId, userId, data);

    // Log audit
    await supplierRepository.createAuditLog(
      companyId, 
      userId, 
      'Ledger Adjustment', 
      `${data.adjustmentType} adjustment processed for supplier ${supplier.SupplierName}. Amount: Rs. ${parseFloat(data.amount).toFixed(2)}, Effect: ${data.effect}.`
    );

    return result;
  }

  async getWidgets(companyId) {
    return await supplierRepository.getSupplierWidgets(companyId);
  }

  async getAuditTrail(companyId) {
    return await supplierRepository.getAuditLogs(companyId);
  }

  // --- HELPERS ---

  async checkCreditLimitThreshold(companyId, supplier) {
    const limit = parseFloat(supplier.CreditLimit);
    const balance = parseFloat(supplier.CurrentBalance);

    if (limit > 0 && balance >= (limit * 0.9)) {
      const pct = ((balance / limit) * 100).toFixed(0);
      const message = `Alert: Supplier ${supplier.SupplierName} (${supplier.SupplierCode}) outstanding balance is Rs. ${balance.toFixed(2)}, reaching ${pct}% of credit limit (Rs. ${limit.toFixed(2)}).`;

      // Check if duplicate alert raised recently (e.g. today)
      const recent = await db.query(`
        SELECT TOP 1 NotificationID 
        FROM dbo.SystemNotifications
        WHERE CompanyID = @CompanyID AND Message = @Msg AND IsRead = 0
      `, { CompanyID: companyId, Msg: message });

      if (recent.recordset.length === 0) {
        await db.query(`
          INSERT INTO dbo.SystemNotifications (CompanyID, Type, Message)
          VALUES (@CompanyID, 'SupplierCredit', @Message)
        `, { CompanyID: companyId, Message: message });
      }
    }
  }

  async sendStatementEmail(companyId, userId, supplierId, data) {
    const fs = require('fs');
    const path = require('path');
    const companyService = require('./companyService');

    const supplier = await supplierRepository.getSupplierById(supplierId, companyId);
    if (!supplier) throw new Error('Supplier not found.');
    if (!supplier.EmailAddress) {
      throw new Error(`Supplier '${supplier.SupplierName}' does not have a registered email address.`);
    }

    const company = await companyService.getCompanyProfile(companyId);
    const { startDate, endDate, branchName } = data;

    // Fetch ledger calculations
    const ledger = await supplierRepository.getSupplierLedger(supplierId, companyId, { startDate, endDate, branchName });
    
    // Calculate summaries
    let totalPurchases = 0;
    let totalPayments = 0;
    let totalReturns = 0;

    ledger.transactions.forEach(t => {
      const amt = parseFloat(t.Amount || 0);
      if (t.ReferenceType === 'Purchase Invoice') {
        totalPurchases += amt;
      } else if (t.ReferenceType === 'Payment Made') {
        totalPayments += amt;
      } else if (t.ReferenceType === 'Supplier Return') {
        totalReturns += amt;
      }
    });

    const periodStr = startDate && endDate ? `${startDate} to ${endDate}` : 'All-Time';
    const timestamp = new Date().toISOString();

    // Construct text representation
    let emailText = `\n================================================================================\n`;
    emailText += `SIMULATED EMAIL STATEMENT TRANSMISSION\n`;
    emailText += `Timestamp: ${timestamp}\n`;
    emailText += `--------------------------------------------------------------------------------\n`;
    emailText += `From: ${company.Email || 'billing@sellmaxpro.com'} (CC: ${company.Email || ''})\n`;
    emailText += `To: ${supplier.EmailAddress} (Attn: ${supplier.ContactPerson || supplier.SupplierName})\n`;
    emailText += `Subject: Account Statement from ${company.Name} [${periodStr}]\n\n`;
    emailText += `Dear ${supplier.ContactPerson || supplier.SupplierName},\n\n`;
    emailText += `Please find below the account summary and statement details of your account for the period ${periodStr}.\n\n`;
    
    emailText += `STATEMENT SUMMARY:\n`;
    emailText += `- Period Opening Balance: Rs. ${parseFloat(ledger.openingBalance).toFixed(2)}\n`;
    emailText += `- Total Purchases (+):    Rs. ${totalPurchases.toFixed(2)}\n`;
    emailText += `- Total Payments (-):     Rs. ${totalPayments.toFixed(2)}\n`;
    emailText += `- Total Returns (-):      Rs. ${totalReturns.toFixed(2)}\n`;
    emailText += `- Period Closing Balance: Rs. ${parseFloat(ledger.closingBalance).toFixed(2)}\n`;
    emailText += `- Current Balance Due:    Rs. ${parseFloat(supplier.CurrentBalance).toFixed(2)}\n\n`;

    emailText += `TRANSACTION DETAILS:\n`;
    emailText += `Date       | Ref / Doc No  | Type                | Debit      | Credit     | Running Balance\n`;
    emailText += `-----------|---------------|---------------------|------------|------------|----------------\n`;
    emailText += `           |               | Opening Balance     |            |            | Rs. ${parseFloat(ledger.openingBalance).toFixed(2)}\n`;

    ledger.transactions.forEach(t => {
      const dateStr = new Date(t.TransactionDate).toLocaleDateString().padEnd(10);
      const docNo = (t.ReferenceNumber || '').padEnd(13);
      const typeStr = (t.ReferenceType || '').padEnd(19);
      const deb = t.TransactionType === 'Debit' ? `Rs. ${parseFloat(t.Amount).toFixed(2)}` : '';
      const cred = t.TransactionType === 'Credit' ? `Rs. ${parseFloat(t.Amount).toFixed(2)}` : '';
      const bal = `Rs. ${parseFloat(t.RunningBalance).toFixed(2)}`;
      
      emailText += `${dateStr} | ${docNo} | ${typeStr} | ${deb.padEnd(10)} | ${cred.padEnd(10)} | ${bal}\n`;
    });
    
    emailText += `           |               | Closing Balance     |            |            | Rs. ${parseFloat(ledger.closingBalance).toFixed(2)}\n`;
    emailText += `--------------------------------------------------------------------------------\n`;
    emailText += `Company: ${company.Name} | Phone: ${company.MobileNumber || company.TelephoneNumber || ''} | Address: ${company.AddressLine1 || ''}, ${company.City || ''}\n`;
    emailText += `================================================================================\n`;

    // Write to email log
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, 'email_notifications.log');
    fs.appendFileSync(logPath, emailText);

    // Create Audit Log
    await supplierRepository.createAuditLog(
      companyId,
      userId,
      'Email Statement',
      `Account statement for period [${periodStr}] emailed to supplier ${supplier.SupplierName} at ${supplier.EmailAddress}.`
    );

    return { success: true, message: `Account statement email successfully simulated and logged to logs/email_notifications.log.` };
  }
}

module.exports = new SupplierService();
