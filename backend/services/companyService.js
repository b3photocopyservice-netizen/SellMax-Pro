const companyRepository = require('../repositories/companyRepository');

class CompanyService {
  async getCompanyProfile(companyId) {
    if (!companyId) {
      throw new Error('Company ID is required to fetch profile settings.');
    }
    const company = await companyRepository.getCompanyById(companyId);
    if (!company) {
      throw new Error(`Company settings with ID ${companyId} not found.`);
    }
    return company;
  }

  async updateCompanyProfile(companyId, companyData) {
    if (!companyId) {
      throw new Error('Company ID is required.');
    }
    if (!companyData.name || !companyData.name.trim()) {
      throw new Error('Company Name is a required field.');
    }
    
    // Additional validation can go here
    const updated = await companyRepository.updateCompany(companyId, companyData);
    if (!updated) {
      throw new Error('Failed to update company settings.');
    }
    return updated;
  }
}

module.exports = new CompanyService();
