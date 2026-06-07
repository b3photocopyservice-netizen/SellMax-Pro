const db = require('../config/db');

class CustomerRepository {
  async getAll(companyId, search = '') {
    let sqlQuery = `SELECT * FROM dbo.Customers WHERE CompanyID = @CompanyID`;
    const params = { CompanyID: companyId };

    if (search) {
      sqlQuery += ` AND (Name LIKE @Search OR Phone LIKE @Search OR Email LIKE @Search)`;
      params.Search = `%${search}%`;
    }

    sqlQuery += ` ORDER BY Name ASC`;
    const result = await db.query(sqlQuery, params);
    return result.recordset;
  }

  async getById(id, companyId) {
    const sqlQuery = `SELECT * FROM dbo.Customers WHERE CustomerID = @CustomerID AND CompanyID = @CompanyID`;
    const result = await db.query(sqlQuery, { CustomerID: id, CompanyID: companyId });
    return result.recordset[0] || null;
  }

  async create(customerData, companyId) {
    const sqlQuery = `
      INSERT INTO dbo.Customers (CompanyID, Name, Phone, Email, CreditLimit, CurrentBalance, LoyaltyPoints)
      OUTPUT inserted.*
      VALUES (@CompanyID, @Name, @Phone, @Email, @CreditLimit, @CurrentBalance, @LoyaltyPoints)
    `;
    const result = await db.query(sqlQuery, {
      CompanyID: companyId,
      Name: customerData.name,
      Phone: customerData.phone || null,
      Email: customerData.email || null,
      CreditLimit: customerData.creditLimit || 0.00,
      CurrentBalance: customerData.currentBalance || 0.00,
      LoyaltyPoints: customerData.loyaltyPoints || 0
    });
    return result.recordset[0];
  }

  async update(id, customerData, companyId) {
    const sqlQuery = `
      UPDATE dbo.Customers
      SET Name = @Name,
          Phone = @Phone,
          Email = @Email,
          CreditLimit = @CreditLimit,
          CurrentBalance = @CurrentBalance,
          LoyaltyPoints = @LoyaltyPoints
      OUTPUT inserted.*
      WHERE CustomerID = @CustomerID AND CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, {
      CustomerID: id,
      CompanyID: companyId,
      Name: customerData.name,
      Phone: customerData.phone || null,
      Email: customerData.email || null,
      CreditLimit: customerData.creditLimit,
      CurrentBalance: customerData.currentBalance,
      LoyaltyPoints: customerData.loyaltyPoints
    });
    return result.recordset[0] || null;
  }

  /**
   * Helper to adjust balance and loyalty points within a transactional request context
   * @param {number} customerId 
   * @param {number} companyId 
   * @param {number} balanceDelta Change in balance (positive = add debt, negative = pay debt)
   * @param {number} pointsDelta Change in points (positive = earn points, negative = redeem/deduct points)
   * @param {object} transactionRequest Optional mssql.Request linked to an active transaction
   */
  async adjustBalanceAndPoints(customerId, companyId, balanceDelta, pointsDelta, transactionRequest = null) {
    const queryStr = `
      UPDATE dbo.Customers
      SET CurrentBalance = CurrentBalance + @BalanceDelta,
          LoyaltyPoints = LoyaltyPoints + @PointsDelta
      OUTPUT inserted.*
      WHERE CustomerID = @CustomerID AND CompanyID = @CompanyID
    `;

    if (transactionRequest) {
      transactionRequest.input('CustomerID', db.sql.Int, customerId);
      transactionRequest.input('CompanyID', db.sql.Int, companyId);
      transactionRequest.input('BalanceDelta', db.sql.Decimal(18, 2), balanceDelta);
      transactionRequest.input('PointsDelta', db.sql.Int, pointsDelta);
      const result = await transactionRequest.query(queryStr);
      return result.recordset[0] || null;
    } else {
      const result = await db.query(queryStr, {
        CustomerID: customerId,
        CompanyID: companyId,
        BalanceDelta: balanceDelta,
        PointsDelta: pointsDelta
      });
      return result.recordset[0] || null;
    }
  }
}

module.exports = new CustomerRepository();
