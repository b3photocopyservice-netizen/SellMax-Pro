const customerRepository = require('../repositories/customerRepository');

class CustomerService {
  async getAllCustomers(companyId, search) {
    return await customerRepository.getAll(companyId, search);
  }

  async getCustomerById(id, companyId) {
    const customer = await customerRepository.getById(id, companyId);
    if (!customer) throw new Error('Customer not found.');
    return customer;
  }

  async createCustomer(customerData, companyId) {
    if (!customerData.name || customerData.name.trim() === '') {
      throw new Error('Customer name is required.');
    }
    return await customerRepository.create(customerData, companyId);
  }

  async updateCustomer(id, customerData, companyId) {
    const existing = await customerRepository.getById(id, companyId);
    if (!existing) throw new Error('Customer not found.');
    return await customerRepository.update(id, customerData, companyId);
  }
}

module.exports = new CustomerService();
