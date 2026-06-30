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
          AllowNegativeStock = @AllowNegativeStock,
          PrintHeader = @PrintHeader,
          HeaderMessage = @HeaderMessage,
          PrintLogo = @PrintLogo,
          PrintDateTime = @PrintDateTime,
          PrintCashier = @PrintCashier,
          PrintBranch = @PrintBranch,
          PrintFooter = @PrintFooter,
          FooterMessage = @FooterMessage,
          PaperSize = @PaperSize,
          AutoCut = @AutoCut,
          OpenDrawer = @OpenDrawer,
          ReceiptCopies = @ReceiptCopies,
          DefaultPrinter = @DefaultPrinter
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
      AllowNegativeStock: companyData.allowNegativeStock ? 1 : 0,
      PrintHeader: companyData.printHeader !== undefined ? (companyData.printHeader ? 1 : 0) : 1,
      HeaderMessage: companyData.headerMessage || null,
      PrintLogo: companyData.printLogo !== undefined ? (companyData.printLogo ? 1 : 0) : 1,
      PrintDateTime: companyData.printDateTime !== undefined ? (companyData.printDateTime ? 1 : 0) : 1,
      PrintCashier: companyData.printCashier !== undefined ? (companyData.printCashier ? 1 : 0) : 1,
      PrintBranch: companyData.printBranch !== undefined ? (companyData.printBranch ? 1 : 0) : 1,
      PrintFooter: companyData.printFooter !== undefined ? (companyData.printFooter ? 1 : 0) : 1,
      FooterMessage: companyData.footerMessage || null,
      PaperSize: companyData.paperSize || '80mm',
      AutoCut: companyData.autoCut !== undefined ? (companyData.autoCut ? 1 : 0) : 1,
      OpenDrawer: companyData.openDrawer !== undefined ? (companyData.openDrawer ? 1 : 0) : 1,
      ReceiptCopies: companyData.receiptCopies !== undefined ? parseInt(companyData.receiptCopies, 10) : 1,
      DefaultPrinter: companyData.defaultPrinter || null
    });
    
    return result.recordset[0] || null;
  }
}

module.exports = new CompanyRepository();
