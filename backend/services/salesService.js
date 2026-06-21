const salesRepository = require('../repositories/salesRepository');
const productRepository = require('../repositories/productRepository');
const customerRepository = require('../repositories/customerRepository');
const companyRepository = require('../repositories/companyRepository');
const authService = require('./authService');

class SalesService {
  async getSalesHistory(companyId, filters) {
    return await salesRepository.getSalesHistory(companyId, filters);
  }

  async getSaleDetails(orderId, companyId) {
    const details = await salesRepository.getSaleDetails(orderId, companyId);
    if (!details) throw new Error('Sale transaction not found.');
    return details;
  }

  async createSale(saleData, companyId, userId) {
    // 1. Validation: Cart cannot be empty
    if (!saleData.items || saleData.items.length === 0) {
      throw new Error('Cannot process checkout. Cart is empty.');
    }

    const company = await companyRepository.getCompanyById(companyId);
    const allowNegativeStock = company && (company.AllowNegativeStock === 1 || company.AllowNegativeStock === true);

    // 2. Validation: Check product stock levels & fetch limits
    for (const item of saleData.items) {
      const product = await productRepository.getById(item.productId, companyId);
      if (!product) {
        throw new Error(`Product ID ${item.productId} not found in database.`);
      }
      if (product.IsActive === false || product.IsActive === 0) {
        throw new Error(`Product '${product.Name}' is inactive and cannot be sold.`);
      }
      if (!allowNegativeStock && product.Stock < item.quantity) {
        throw new Error(`Insufficient stock for '${product.Name}'. Available: ${product.Stock}, Requested: ${item.quantity}`);
      }
      
      // Store original price
      item.originalPrice = product.Price;
      item.cost = product.Cost;

      // Check if price is overridden
      let actualPrice = product.Price;
      let isOverridden = false;
      let needsManagerPin = false;

      if (item.price !== undefined && Number(item.price) !== Number(product.Price)) {
        actualPrice = Number(item.price);
        isOverridden = true;

        if (actualPrice < product.Price) {
          const discountAmt = product.Price - actualPrice;
          const discountPct = (discountAmt / product.Price) * 100;
          
          // Limits check:
          // 1. MaxDiscountPct (default 15% if null/0)
          const maxPct = Number(product.MaxDiscountPct) || 15;
          if (discountPct > maxPct) {
            needsManagerPin = true;
          }
          // 2. Drops below cost
          if (actualPrice < product.Cost) {
            needsManagerPin = true;
          }
          // 3. Violates MinProfitMargin
          const margin = actualPrice > 0 ? ((actualPrice - product.Cost) / actualPrice) * 100 : -100;
          const minMargin = Number(product.MinProfitMargin) || 0;
          if (margin < minMargin) {
            needsManagerPin = true;
          }
        }
      }

      item.price = actualPrice;
      item.isOverridden = isOverridden;
      item.needsManagerPin = needsManagerPin;
      item.subtotal = Number((actualPrice * item.quantity).toFixed(2));

      // Retrieve discount and profit constraints
      item.minDiscountAmt = Number(product.MinDiscountAmt) || 0;
      item.minDiscountPct = Number(product.MinDiscountPct) || 0;
      item.maxDiscountAmt = Number(product.MaxDiscountAmt) || 0;
      item.maxDiscountPct = Number(product.MaxDiscountPct) || 0;
      item.minProfitMargin = Number(product.MinProfitMargin) || 0;
    }

    // Check manager PIN if needed
    let pinApprovedManagerId = null;
    const itemsRequiringPin = saleData.items.filter(item => item.needsManagerPin);
    if (itemsRequiringPin.length > 0) {
      if (!saleData.managerPin) {
        throw new Error('Manager approval PIN is required for one or more price overrides.');
      }
      const verifyResult = await authService.verifyManagerPin(saleData.managerPin);
      if (!verifyResult.success) {
        throw new Error('Invalid manager PIN for price override.');
      }
      pinApprovedManagerId = verifyResult.user.userId;
    }

    // Assign manager approver ID to items that needed it
    for (const item of saleData.items) {
      item.approvedByUserId = item.needsManagerPin ? pinApprovedManagerId : null;
    }

    const subtotal = saleData.items.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = saleData.discountAmount || 0;

    // Enforce discount limits and minimum profit margin rules
    if (discountAmount > 0 && subtotal > 0) {
      for (const item of saleData.items) {
        if (item.isOverridden) continue; // Bypass standard constraint checks for price-overridden items

        const itemDiscount = discountAmount * (item.subtotal / subtotal);
        const unitDiscount = itemDiscount / item.quantity;
        const discountPct = (unitDiscount / item.price) * 100;
        const effectivePrice = item.price - unitDiscount;

        // Min discount check
        if ((item.minDiscountAmt > 0 || item.minDiscountPct > 0) && unitDiscount <= 0) {
          throw new Error(`Product '${item.name}' requires a mandatory minimum discount, but none was applied.`);
        }
        if (unitDiscount > 0) {
          if (item.minDiscountAmt > 0 && unitDiscount < item.minDiscountAmt) {
            throw new Error(`Discount on '${item.name}' (Rs. ${unitDiscount.toFixed(2)}/unit) is below the minimum allowed discount of Rs. ${item.minDiscountAmt.toFixed(2)}/unit.`);
          }
          if (item.minDiscountPct > 0 && discountPct < item.minDiscountPct) {
            throw new Error(`Discount on '${item.name}' (${discountPct.toFixed(1)}%) is below the minimum allowed discount of ${item.minDiscountPct.toFixed(1)}%.`);
          }
        }

        // Max discount check
        if (item.maxDiscountAmt > 0 && unitDiscount > item.maxDiscountAmt) {
          throw new Error(`Discount on '${item.name}' (Rs. ${unitDiscount.toFixed(2)}/unit) exceeds the maximum allowed discount of Rs. ${item.maxDiscountAmt.toFixed(2)}/unit.`);
        }
        if (item.maxDiscountPct > 0 && discountPct > item.maxDiscountPct) {
          throw new Error(`Discount on '${item.name}' (${discountPct.toFixed(1)}%) exceeds the maximum allowed discount of ${item.maxDiscountPct.toFixed(1)}%.`);
        }

        // Min profit margin check
        if (effectivePrice <= 0) {
          throw new Error(`Discount on '${item.name}' is too high, resulting in a zero or negative selling price.`);
        }
        const grossMargin = ((effectivePrice - item.cost) / effectivePrice) * 100;
        if (grossMargin < item.minProfitMargin) {
          throw new Error(`Discount on '${item.name}' reduces the gross profit margin (${grossMargin.toFixed(1)}%) below the minimum required profit margin of ${item.minProfitMargin.toFixed(1)}%.`);
        }
      }
    } else if (discountAmount === 0) {
      for (const item of saleData.items) {
        if (item.isOverridden) continue; // Bypass standard constraint checks for price-overridden items

        if (item.minDiscountAmt > 0 || item.minDiscountPct > 0) {
          throw new Error(`Product '${item.name}' requires a mandatory minimum discount, but none was applied.`);
        }
        const grossMargin = ((item.price - item.cost) / item.price) * 100;
        if (grossMargin < item.minProfitMargin) {
          throw new Error(`Product '${item.name}' base price gross profit margin (${grossMargin.toFixed(1)}%) is below the minimum required profit margin of ${item.minProfitMargin.toFixed(1)}%.`);
        }
      }
    }
    // Use the tax amount provided by the client (which uses the company's tax config)
    // Fall back to 10% only if the client didn't send taxAmount
    const taxAmount = saleData.taxAmount !== undefined 
      ? Number(Number(saleData.taxAmount).toFixed(2))
      : Number(((subtotal - discountAmount) * 0.10).toFixed(2));
    const serverTotalAmount = Number((subtotal - discountAmount + taxAmount).toFixed(2));

    // The client's totalAmount is what the user agreed to pay.
    // Accept the client's total if it's within Rs. 1.00 of the server-recalculated total
    // (handles floating-point precision differences and mid-session price display).
    // The payment sum is always validated against the CLIENT's totalAmount.
    const clientTotalAmount = saleData.totalAmount !== undefined
      ? Number(Number(saleData.totalAmount).toFixed(2))
      : serverTotalAmount;

    if (Math.abs(clientTotalAmount - serverTotalAmount) > 1.00) {
      throw new Error(`Order total mismatch detected. Client total: Rs. ${clientTotalAmount.toFixed(2)}, Server total: Rs. ${serverTotalAmount.toFixed(2)}. Please refresh and retry.`);
    }

    // Use server-recalculated values for the actual stored record
    const totalAmount = serverTotalAmount;
    saleData.subtotal = subtotal;
    saleData.totalAmount = totalAmount;
    saleData.taxAmount = taxAmount;

    // 3. Validation: Verify Split Payment Sum matches what the CLIENT presented
    const paymentsSum = saleData.payments.reduce((sum, pay) => sum + pay.amount, 0);
    if (Math.abs(paymentsSum - clientTotalAmount) > 0.01) {
      throw new Error(`Payment mismatch. Total due: Rs. ${clientTotalAmount.toFixed(2)}, Paid: Rs. ${paymentsSum.toFixed(2)}`);
    }

    // 4. Validation: Verify Customer Credit Limits
    let creditAmount = 0;
    for (const payment of saleData.payments) {
      if (payment.method === 'Credit') {
        creditAmount += payment.amount;
      }
    }

    if (creditAmount > 0) {
      if (!saleData.customerId) {
        throw new Error('A customer must be attached to the sale to perform a Credit Sale.');
      }
      const customer = await customerRepository.getById(saleData.customerId, companyId);
      if (!customer) {
        throw new Error('Customer account not found.');
      }
      const potentialBalance = customer.CurrentBalance + creditAmount;
      if (potentialBalance > customer.CreditLimit) {
        throw new Error(`Credit limit exceeded. Customer Limit: Rs. ${customer.CreditLimit.toFixed(2)}, Current Balance: Rs. ${customer.CurrentBalance.toFixed(2)}, Requested Credit: Rs. ${creditAmount.toFixed(2)}`);
      }
    }

    return await salesRepository.createSale(saleData, companyId, userId);
  }

  async holdSale(saleData, companyId, userId) {
    if (!saleData.items || saleData.items.length === 0) {
      throw new Error('Cannot hold an empty cart.');
    }
    return await salesRepository.holdSale(saleData, companyId, userId);
  }

  async getHeldSales(companyId) {
    return await salesRepository.getHeldSales(companyId);
  }

  async resumeHeldSale(orderId, companyId) {
    return await salesRepository.resumeHeldSale(orderId, companyId);
  }

  async cancelHeldSale(orderId, companyId) {
    if (!orderId) {
      throw new Error('Order ID is required to cancel a held sale.');
    }
    const success = await salesRepository.deleteHeldSale(orderId, companyId);
    if (!success) {
      throw new Error('Held sale not found or already cancelled.');
    }
    return true;
  }

  async processReturn(returnRequest, companyId, userId) {
    // 1. Check original invoice
    const originalDetails = await salesRepository.getSaleDetails(returnRequest.originalOrderId, companyId);
    if (!originalDetails) {
      throw new Error('Original sale transaction not found.');
    }

    // 2. Validate return items against original invoice items
    for (const returnItem of returnRequest.items) {
      const originalItem = originalDetails.items.find(oi => oi.ProductID === returnItem.productId);
      if (!originalItem) {
        throw new Error(`Item '${returnItem.name}' was not part of the original invoice.`);
      }
      if (returnItem.quantity > originalItem.Quantity) {
        throw new Error(`Cannot return more items than purchased. Purchased: ${originalItem.Quantity}, Requested Return: ${returnItem.quantity}`);
      }
      // Populate correct costs/prices
      returnItem.price = originalItem.Price;
      returnItem.cost = originalItem.Cost;
      returnItem.subtotal = Number((originalItem.Price * returnItem.quantity).toFixed(2));
      returnItem.batchNo = originalItem.BatchNo || null;
    }

    // Calculate refund amounts
    const subtotal = returnRequest.items.reduce((sum, item) => sum + item.subtotal, 0);
    // Apply proportional discount if original order had a discount
    const originalSubtotal = originalDetails.order.Subtotal;
    const discountRatio = originalDetails.order.DiscountAmount / (originalSubtotal || 1);
    const discountAmount = Number((subtotal * discountRatio).toFixed(2));
    const taxAmount = Number(((subtotal - discountAmount) * 0.10).toFixed(2)); // assuming standard 10%
    const totalAmount = Number((subtotal - discountAmount + taxAmount).toFixed(2));

    returnRequest.subtotal = subtotal;
    returnRequest.discountAmount = discountAmount;
    returnRequest.taxAmount = taxAmount;
    returnRequest.totalAmount = totalAmount;
    returnRequest.customerId = originalDetails.order.CustomerID;

    // Validate refund payments match total refund due
    const refundPaymentsSum = returnRequest.payments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(refundPaymentsSum - totalAmount) > 0.01) {
      throw new Error(`Refund payments mismatch. Refund due: Rs. ${totalAmount.toFixed(2)}, Refund processed: Rs. ${refundPaymentsSum.toFixed(2)}`);
    }

    // Validate credit refund: cannot refund more credit than outstanding debt
    let creditRefundAmount = 0;
    for (const payment of returnRequest.payments) {
      if (payment.method === 'Credit') {
        creditRefundAmount += payment.amount;
      }
    }

    if (creditRefundAmount > 0 && originalDetails.order.CustomerID) {
      const customer = await customerRepository.getById(originalDetails.order.CustomerID, companyId);
      if (customer && customer.CurrentBalance < creditRefundAmount) {
        throw new Error(`Cannot refund Rs. ${creditRefundAmount.toFixed(2)} to credit balance. Customer outstanding balance is only Rs. ${customer.CurrentBalance.toFixed(2)}`);
      }
    }

    return await salesRepository.processReturn(returnRequest, companyId, userId);
  }

  async getCashDrawerSessionToday(companyId, userId) {
    return await salesRepository.getCashDrawerSessionToday(companyId, userId);
  }

  async createCashDrawerSession(companyId, userId, data) {
    const existing = await salesRepository.getCashDrawerSessionToday(companyId, userId);
    if (existing) {
      throw new Error('A cash drawer session has already been started for today.');
    }
    return await salesRepository.createCashDrawerSession(companyId, userId, data);
  }
}

module.exports = new SalesService();
