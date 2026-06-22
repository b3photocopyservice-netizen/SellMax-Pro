const reportsRepository = require('../repositories/reportsRepository');

class ReportsService {
  async getDailySalesSummary(companyId, startDate, endDate) {
    return await reportsRepository.getDailySalesSummary(companyId, startDate, endDate);
  }

  async getProductPerformance(companyId, startDate, endDate, limit) {
    return await reportsRepository.getProductPerformance(companyId, startDate, endDate, limit);
  }

  async getLowStockAlerts(companyId) {
    return await reportsRepository.getLowStockAlerts(companyId);
  }

  async getCustomerLoyaltyStatement(companyId) {
    return await reportsRepository.getCustomerLoyaltyStatement(companyId);
  }

  async getExpiryReport(companyId) {
    return await reportsRepository.getExpiryReport(companyId);
  }

  async getPriceOverridesLog(companyId, startDate, endDate) {
    return await reportsRepository.getPriceOverridesLog(companyId, startDate, endDate);
  }

  async getStockMovement(companyId, filters) {
    return await reportsRepository.getStockMovement(companyId, filters);
  }
}

module.exports = new ReportsService();
