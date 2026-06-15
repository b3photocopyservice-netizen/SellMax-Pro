import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Search, Plus, Edit2, RefreshCw, Award, CreditCard } from 'lucide-react';
import formatCurrency from './utils/formatCurrency';

export default function Customers({ setToast }) {
  const { token, API_URL, hasPermission } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [activeCustomerId, setActiveCustomerId] = useState(null);

  // Form
  const [customerForm, setCustomerForm] = useState({
    name: '', phone: '', email: '', creditLimit: '0.00', currentBalance: '0.00', loyaltyPoints: '0'
  });

  const canManage = hasPermission('MANAGE_CUSTOMERS');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCustomers(await res.json());
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    const payload = {
      name: customerForm.name,
      phone: customerForm.phone || null,
      email: customerForm.email || null,
      creditLimit: parseFloat(customerForm.creditLimit) || 0.00,
      currentBalance: parseFloat(customerForm.currentBalance) || 0.00,
      loyaltyPoints: parseInt(customerForm.loyaltyPoints, 10) || 0
    };

    try {
      let url = `${API_URL}/api/customers`;
      let method = 'POST';

      if (modalMode === 'edit') {
        url = `${API_URL}/api/customers/${activeCustomerId}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed.');

      setToast({ type: 'success', message: `Customer ${modalMode === 'add' ? 'created' : 'updated'} successfully.` });
      setShowCustomerModal(false);
      fetchCustomers();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleEditCustomerClick = (customer) => {
    setModalMode('edit');
    setActiveCustomerId(customer.CustomerID);
    setCustomerForm({
      name: customer.Name,
      phone: customer.Phone || '',
      email: customer.Email || '',
      creditLimit: customer.CreditLimit,
      currentBalance: customer.CurrentBalance,
      loyaltyPoints: customer.LoyaltyPoints
    });
    setShowCustomerModal(true);
  };

  const handleAddCustomerClick = () => {
    setModalMode('add');
    setCustomerForm({
      name: '', phone: '', email: '', creditLimit: '0.00', currentBalance: '0.00', loyaltyPoints: '0'
    });
    setShowCustomerModal(true);
  };

  const filteredCustomers = customers.filter(c => 
    c.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.Phone && c.Phone.includes(searchQuery)) ||
    (c.Email && c.Email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getLoyaltyBadge = (points) => {
    if (points >= 500) {
      return { label: 'Gold VIP', bg: '#fef08a', color: '#854d0e' };
    } else if (points >= 200) {
      return { label: 'Silver VIP', bg: '#e2e8f0', color: '#334155' };
    } else {
      return { label: 'Bronze Partner', bg: '#ffedd5', color: '#c2410c' };
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div className="search-box-container" style={{ width: '320px' }}>
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="form-input pos-search"
            placeholder="Search CRM by name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {canManage && (
          <button className="btn btn-primary" onClick={handleAddCustomerClick}>
            <Plus size={16} />
            <span>New Customer</span>
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="table-glass">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Contact Info</th>
                  <th>Loyalty Status</th>
                  <th>Loyalty Points</th>
                  <th>Credit Limit</th>
                  <th>Owed Balance</th>
                  <th>Available Credit</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No customer files match.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => {
                    const badge = getLoyaltyBadge(c.LoyaltyPoints);
                    const availableCredit = c.CreditLimit - c.CurrentBalance;
                    return (
                      <tr key={c.CustomerID}>
                        <td>
                          <span style={{ fontWeight: '600' }}>{c.Name}</span>
                        </td>
                        <td>
                          <div style={{ fontSize: '13px' }}>{c.Phone || '--'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.Email || ''}</div>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: badge.bg,
                            color: badge.color,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Award size={10} />
                            {badge.label}
                          </span>
                        </td>
                        <td className="mono">{c.LoyaltyPoints} pts</td>
                        <td className="mono">Rs. {formatCurrency(c.CreditLimit)}</td>
                        <td className="mono" style={{ color: c.CurrentBalance > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          Rs. {formatCurrency(c.CurrentBalance)}
                        </td>
                        <td className="mono" style={{ color: 'var(--success)' }}>
                          Rs. {formatCurrency(availableCredit)}
                        </td>
                        {canManage && (
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-secondary btn-icon" onClick={() => handleEditCustomerClick(c)} title="Edit Account">
                              <Edit2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: ADD/EDIT CUSTOMER
         ============================================================================ */}
      {showCustomerModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '500px' }}>
            <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              {modalMode === 'add' ? 'Create Customer Profile' : 'Edit Customer Account'}
            </h3>

            <form onSubmit={handleCustomerSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. +94..."
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. name@domain.com"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Store Credit Limit (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input mono"
                    value={customerForm.creditLimit}
                    onChange={(e) => setCustomerForm({ ...customerForm, creditLimit: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Current Debt Balance (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input mono"
                    value={customerForm.currentBalance}
                    onChange={(e) => setCustomerForm({ ...customerForm, currentBalance: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Loyalty Points</label>
                  <input
                    type="number"
                    className="form-input mono"
                    value={customerForm.loyaltyPoints}
                    onChange={(e) => setCustomerForm({ ...customerForm, loyaltyPoints: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCustomerModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{modalMode === 'add' ? 'Save Profile' : 'Apply Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
