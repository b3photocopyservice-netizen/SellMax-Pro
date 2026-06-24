const customerPaymentRepository = require('../repositories/customerPaymentRepository');
const customerRepository = require('../repositories/customerRepository');

class CustomerPaymentService {
  async getUnpaidInvoices(customerId, companyId) {
    if (!customerId) {
      throw new Error('Customer ID is required.');
    }
    return await customerPaymentRepository.getUnpaidInvoices(customerId, companyId);
  }

  async processCustomerPayment(payload, companyId, userId) {
    const { customerId, paymentDate, modes, allocationOption } = payload;

    if (!customerId) {
      throw new Error('Customer ID is required.');
    }
    if (!paymentDate) {
      throw new Error('Payment date is required.');
    }
    if (!modes || !Array.isArray(modes) || modes.length === 0) {
      throw new Error('At least one payment mode is required.');
    }

    // Verify customer exists
    const customer = await customerRepository.getById(customerId, companyId);
    if (!customer) {
      throw new Error('Customer not found.');
    }
    payload.customerName = customer.Name;

    // Calculate total paid amount
    const totalAmount = modes.reduce((sum, mode) => {
      const amt = parseFloat(mode.amount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error('Payment mode amount must be greater than zero.');
      }
      return sum + amt;
    }, 0);

    payload.totalAmount = parseFloat(totalAmount.toFixed(2));

    // Handle Allocations (FIFO vs Manual)
    if (allocationOption === 'FIFO') {
      const unpaidInvoices = await customerPaymentRepository.getUnpaidInvoices(customerId, companyId);
      let remainingAmount = totalAmount;
      const allocations = [];

      for (const invoice of unpaidInvoices) {
        if (remainingAmount <= 0) break;
        const balance = parseFloat(invoice.BalanceAmount);
        if (balance <= 0) continue;

        const allocatedAmount = Math.min(remainingAmount, balance);
        allocations.push({
          orderId: invoice.OrderID,
          allocatedAmount: parseFloat(allocatedAmount.toFixed(2))
        });
        remainingAmount -= allocatedAmount;
      }

      payload.allocations = allocations;
    } else {
      // Manual Allocation
      const allocations = payload.allocations || [];
      const allocSum = allocations.reduce((sum, alloc) => {
        const amt = parseFloat(alloc.allocatedAmount);
        if (isNaN(amt) || amt < 0) {
          throw new Error('Allocated amount must be a valid non-negative number.');
        }
        return sum + amt;
      }, 0);

      if (allocSum > totalAmount + 0.005) {
        throw new Error(`Total allocated amount (${allocSum.toFixed(2)}) cannot exceed total payment amount (${totalAmount.toFixed(2)}).`);
      }

      // Check if trying to allocate more than the invoice balance
      const unpaidInvoices = await customerPaymentRepository.getUnpaidInvoices(customerId, companyId);
      const unpaidMap = new Map(unpaidInvoices.map(inv => [inv.OrderID, parseFloat(inv.BalanceAmount)]));

      for (const alloc of allocations) {
        if (alloc.allocatedAmount <= 0) continue;
        const maxAllowed = unpaidMap.get(alloc.orderId) || 0;
        if (alloc.allocatedAmount > maxAllowed + 0.005) {
          throw new Error(`Cannot allocate ${alloc.allocatedAmount.toFixed(2)} to Invoice #${alloc.orderId}. Max allowed is ${maxAllowed.toFixed(2)}.`);
        }
      }

      // Filter out zero allocations
      payload.allocations = allocations.filter(a => a.allocatedAmount > 0);
    }

    // Call repository within transaction
    return await customerPaymentRepository.createPayment(companyId, userId, payload);
  }

  async getPaymentsList(companyId, filters) {
    return await customerPaymentRepository.getPaymentsList(companyId, filters);
  }

  async getPaymentDetails(paymentId, companyId) {
    const payment = await customerPaymentRepository.getPaymentDetails(paymentId, companyId);
    if (!payment) {
      throw new Error('Payment not found.');
    }
    return payment;
  }

  async getOutstandingReceivables(companyId) {
    return await customerPaymentRepository.getOutstandingReceivables(companyId);
  }

  async getStatementLedger(customerId, companyId, startDate, endDate) {
    if (!customerId) {
      throw new Error('Customer ID is required.');
    }
    return await customerPaymentRepository.getCustomerStatement(customerId, companyId, startDate, endDate);
  }
  async getPaymentModeSummary(companyId, startDate, endDate) {
    return await customerPaymentRepository.getPaymentModeSummary(companyId, startDate, endDate);
  }

  async recordCustomerAdjustment(companyId, userId, data) {
    if (!data.customerId) throw new Error('Customer ID is required.');
    if (!data.amount || parseFloat(data.amount) <= 0) throw new Error('Adjustment amount must be greater than zero.');
    if (!data.adjustmentType) throw new Error('Adjustment type is required.');
    if (!data.effect || !['Debit', 'Credit'].includes(data.effect)) throw new Error('Effect must be Debit or Credit.');

    return await customerPaymentRepository.createLedgerAdjustment(companyId, userId, data);
  }
}

module.exports = new CustomerPaymentService();
