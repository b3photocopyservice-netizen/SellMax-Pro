const db = require('../config/db');

class CompanyRepository {
  async getCompanyById(companyId) {
    const sqlQuery = `
      SELECT *
      FROM dbo.Companies
      WHERE CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId });
    return result.recordset[0] || null;
  }

  async updateCompany(companyId, companyData) {
    const sqlQuery = `
      UPDATE dbo.Companies
      SET Name = @Name,
          BusinessRegNo = @BusinessRegNo,
          TaxRegNo = @TaxRegNo,
          IndustryType = @IndustryType,
          LogoURL = @LogoURL,
          SealURL = @SealURL,
          ContactPerson = @ContactPerson,
          MobileNumber = @MobileNumber,
          TelephoneNumber = @TelephoneNumber,
          Email = @Email,
          Website = @Website,
          AddressLine1 = @AddressLine1,
          AddressLine2 = @AddressLine2,
          City = @City,
          District = @District,
          Province = @Province,
          Country = @Country,
          PostalCode = @PostalCode,
          Currency = @Currency,
          CurrencySymbol = @CurrencySymbol,
          TaxPercentage = @TaxPercentage,
          IsTaxActive = @IsTaxActive,
          FinancialYearStart = @FinancialYearStart,
          AllowNegativeStock = @AllowNegativeStock
      OUTPUT inserted.*
      WHERE CompanyID = @CompanyID
    `;
    
    const result = await db.query(sqlQuery, {
      CompanyID: companyId,
      Name: companyData.name,
      BusinessRegNo: companyData.businessRegNo || null,
      TaxRegNo: companyData.taxRegNo || null,
      IndustryType: companyData.industryType || null,
      LogoURL: companyData.logoUrl || null,
      SealURL: companyData.sealUrl || null,
      ContactPerson: companyData.contactPerson || null,
      MobileNumber: companyData.mobileNumber || null,
      TelephoneNumber: companyData.telephoneNumber || null,
      Email: companyData.email || null,
      Website: companyData.website || null,
      AddressLine1: companyData.addressLine1 || null,
      AddressLine2: companyData.addressLine2 || null,
      City: companyData.city || null,
      District: companyData.district || null,
      Province: companyData.province || null,
      Country: companyData.country || null,
      PostalCode: companyData.postalCode || null,
      Currency: companyData.currency || 'LKR',
      CurrencySymbol: companyData.currencySymbol || 'Rs.',
      TaxPercentage: companyData.taxPercentage !== undefined ? parseFloat(companyData.taxPercentage) : 0.00,
      IsTaxActive: companyData.isTaxActive ? 1 : 0,
      FinancialYearStart: companyData.financialYearStart || null,
      AllowNegativeStock: companyData.allowNegativeStock ? 1 : 0
    });
    
    return result.recordset[0] || null;
  }
}

module.exports = new CompanyRepository();
