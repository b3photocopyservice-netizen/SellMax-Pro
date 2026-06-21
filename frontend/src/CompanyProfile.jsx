import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { 
  Building2, Phone, MapPin, Coins, RefreshCw, Upload, Image, ShieldCheck, X, FileText 
} from 'lucide-react';

export default function CompanyProfile({ setToast }) {
  const { token, API_URL, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalProfile, setOriginalProfile] = useState(null);
  
  const [profile, setProfile] = useState({
    name: '',
    businessRegNo: '',
    taxRegNo: '',
    industryType: '',
    logoUrl: '',
    sealUrl: '',
    contactPerson: '',
    mobileNumber: '',
    telephoneNumber: '',
    email: '',
    website: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    district: '',
    province: '',
    country: '',
    postalCode: '',
    currency: 'LKR',
    currencySymbol: 'Rs.',
    taxPercentage: '0.00',
    isTaxActive: true,
    financialYearStart: '',
    allowNegativeStock: false
  });

  const canManage = hasPermission('MANAGE_SETTINGS');

  useEffect(() => {
    fetchCompanyProfile();
  }, []);

  const fetchCompanyProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/company`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const formatted = {
          name: data.Name || '',
          businessRegNo: data.BusinessRegNo || '',
          taxRegNo: data.TaxRegNo || '',
          industryType: data.IndustryType || '',
          logoUrl: data.LogoURL || '',
          sealUrl: data.SealURL || '',
          contactPerson: data.ContactPerson || '',
          mobileNumber: data.MobileNumber || '',
          telephoneNumber: data.TelephoneNumber || '',
          email: data.Email || '',
          website: data.Website || '',
          addressLine1: data.AddressLine1 || '',
          addressLine2: data.AddressLine2 || '',
          city: data.City || '',
          district: data.District || '',
          province: data.Province || '',
          country: data.Country || '',
          postalCode: data.PostalCode || '',
          currency: data.Currency || 'LKR',
          currencySymbol: data.CurrencySymbol || 'Rs.',
          taxPercentage: data.TaxPercentage !== undefined ? Number(data.TaxPercentage).toFixed(2) : '0.00',
          isTaxActive: data.IsTaxActive !== undefined ? !!data.IsTaxActive : true,
          financialYearStart: data.FinancialYearStart ? data.FinancialYearStart.split('T')[0] : '',
          allowNegativeStock: data.AllowNegativeStock !== undefined ? !!data.AllowNegativeStock : false
        };
        setProfile(formatted);
        setOriginalProfile(formatted);
      } else {
        const errorData = await res.json();
        setToast({ type: 'error', message: errorData.error || 'Failed to fetch company profile.' });
      }
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Connection error while fetching profile settings.' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setToast({ type: 'error', message: 'Only image files are allowed.' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Data = reader.result;
        const res = await fetch(`${API_URL}/api/company/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ image: base64Data, name: file.name })
        });
        const data = await res.json();
        if (res.ok) {
          setProfile(prev => ({ 
            ...prev, 
            [type === 'logo' ? 'logoUrl' : 'sealUrl']: `${API_URL}${data.imageUrl}` 
          }));
          setToast({ type: 'success', message: `${type === 'logo' ? 'Logo' : 'Seal'} uploaded successfully.` });
        } else {
          setToast({ type: 'error', message: data.error || 'Upload failed.' });
        }
      } catch (err) {
        setToast({ type: 'error', message: 'Image upload failed: ' + err.message });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (type) => {
    setProfile(prev => ({ 
      ...prev, 
      [type === 'logo' ? 'logoUrl' : 'sealUrl']: '' 
    }));
  };

  const handleReset = () => {
    if (originalProfile) {
      setProfile(originalProfile);
      setToast({ type: 'info', message: 'Form values reset to original state.' });
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!canManage) {
      setToast({ type: 'error', message: 'Permission Denied: You cannot edit configuration settings.' });
      return;
    }

    if (!profile.name || !profile.name.trim()) {
      setToast({ type: 'error', message: 'Company Name is a required field.' });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`${API_URL}/api/company`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: 'Company profile configurations updated successfully.' });
        const updated = {
          name: data.Name || '',
          businessRegNo: data.BusinessRegNo || '',
          taxRegNo: data.TaxRegNo || '',
          industryType: data.IndustryType || '',
          logoUrl: data.LogoURL || '',
          sealUrl: data.SealURL || '',
          contactPerson: data.ContactPerson || '',
          mobileNumber: data.MobileNumber || '',
          telephoneNumber: data.TelephoneNumber || '',
          email: data.Email || '',
          website: data.Website || '',
          addressLine1: data.AddressLine1 || '',
          addressLine2: data.AddressLine2 || '',
          city: data.City || '',
          district: data.District || '',
          province: data.Province || '',
          country: data.Country || '',
          postalCode: data.PostalCode || '',
          currency: data.Currency || 'LKR',
          currencySymbol: data.CurrencySymbol || 'Rs.',
          taxPercentage: data.TaxPercentage !== undefined ? Number(data.TaxPercentage).toFixed(2) : '0.00',
          isTaxActive: data.IsTaxActive !== undefined ? !!data.IsTaxActive : true,
          financialYearStart: data.FinancialYearStart ? data.FinancialYearStart.split('T')[0] : '',
          allowNegativeStock: data.AllowNegativeStock !== undefined ? !!data.AllowNegativeStock : false
        };
        setProfile(updated);
        setOriginalProfile(updated);
      } else {
        setToast({ type: 'error', message: data.error || 'Failed to update company settings.' });
      }
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Connection error while saving settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
        <RefreshCw size={36} style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading configuration dashboard...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Access Protection Warning Banner */}
      {!canManage && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px', color: '#fca5a5', fontSize: '13px'
        }}>
          <ShieldCheck size={18} style={{ flexShrink: 0, color: 'var(--danger)' }} />
          <span><strong>Read-Only Mode:</strong> You do not possess the required privilege (`MANAGE_SETTINGS`) to commit modifications. Saving updates is disabled.</span>
        </div>
      )}

      {/* Grid Layout of Settings Cards */}
      <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* SECTION 1: Company Information */}
        <div className="glass-panel" style={{ padding: '24px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Building2 size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Company Information</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Company Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text"
                name="name"
                value={profile.name}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Enter registered legal name"
                disabled={!canManage}
                required
              />
            </div>

            <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Business Registration No.</label>
                <input
                  type="text"
                  name="businessRegNo"
                  value={profile.businessRegNo}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="e.g. PV-002345"
                  disabled={!canManage}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tax/VAT Reg. No.</label>
                <input
                  type="text"
                  name="taxRegNo"
                  value={profile.taxRegNo}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="e.g. 102394850"
                  disabled={!canManage}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Industry Type</label>
              <select
                name="industryType"
                value={profile.industryType}
                onChange={handleInputChange}
                className="form-select"
                disabled={!canManage}
              >
                <option value="">Select industry type</option>
                <option value="Retail & Grocery">Retail & Grocery</option>
                <option value="Pharmacy & Healthcare">Pharmacy & Healthcare</option>
                <option value="Electronics & IT">Electronics & IT</option>
                <option value="Apparel & Fashion">Apparel & Fashion</option>
                <option value="Food & Beverages">Food & Beverages</option>
                <option value="Wholesale Distribution">Wholesale Distribution</option>
                <option value="Other">Other Services</option>
              </select>
            </div>

            {/* Logo and Seal upload side-by-side */}
            <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
              
              {/* Logo Upload */}
              <div className="form-group">
                <label className="form-label">Company Logo</label>
                {profile.logoUrl ? (
                  <div style={{ position: 'relative', width: '100%', height: '110px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img src={profile.logoUrl} alt="Logo" style={{ maxHeight: '90px', maxWidth: '90%', objectFit: 'contain' }} />
                    {canManage && (
                      <button type="button" onClick={() => handleRemoveImage('logo')} style={{ position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '110px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', cursor: canManage ? 'pointer' : 'default', background: 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}>
                    <Upload size={20} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Upload Logo</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} style={{ display: 'none' }} disabled={!canManage} />
                  </label>
                )}
              </div>

              {/* Seal Upload */}
              <div className="form-group">
                <label className="form-label">Company Seal (Optional)</label>
                {profile.sealUrl ? (
                  <div style={{ position: 'relative', width: '100%', height: '110px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img src={profile.sealUrl} alt="Company Seal" style={{ maxHeight: '90px', maxWidth: '90%', objectFit: 'contain' }} />
                    {canManage && (
                      <button type="button" onClick={() => handleRemoveImage('seal')} style={{ position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '110px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', cursor: canManage ? 'pointer' : 'default', background: 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}>
                    <Upload size={20} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Upload Seal</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'seal')} style={{ display: 'none' }} disabled={!canManage} />
                  </label>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* SECTION 2: Contact Information */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Phone size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Information</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input
                type="text"
                name="contactPerson"
                value={profile.contactPerson}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Owner, manager, or supervisor name"
                disabled={!canManage}
              />
            </div>

            <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  type="text"
                  name="mobileNumber"
                  value={profile.mobileNumber}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="e.g. +94 77 123 4567"
                  disabled={!canManage}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Telephone Number</label>
                <input
                  type="text"
                  name="telephoneNumber"
                  value={profile.telephoneNumber}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="e.g. +94 11 234 5678"
                  disabled={!canManage}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                name="email"
                value={profile.email}
                onChange={handleInputChange}
                className="form-input"
                placeholder="e.g. office@company.com"
                disabled={!canManage}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Website</label>
              <input
                type="text"
                name="website"
                value={profile.website}
                onChange={handleInputChange}
                className="form-input"
                placeholder="e.g. www.sellmaxretail.com"
                disabled={!canManage}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Address Information */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <MapPin size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Address Information</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Address Line 1</label>
              <input
                type="text"
                name="addressLine1"
                value={profile.addressLine1}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Building number, street name"
                disabled={!canManage}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Address Line 2</label>
              <input
                type="text"
                name="addressLine2"
                value={profile.addressLine2}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Floor, suite, or area details"
                disabled={!canManage}
              />
            </div>

            <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  type="text"
                  name="city"
                  value={profile.city}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Colombo"
                  disabled={!canManage}
                />
              </div>
              <div className="form-group">
                <label className="form-label">District</label>
                <input
                  type="text"
                  name="district"
                  value={profile.district}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Colombo"
                  disabled={!canManage}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Province</label>
                <input
                  type="text"
                  name="province"
                  value={profile.province}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Western"
                  disabled={!canManage}
                />
              </div>
            </div>

            <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Country</label>
                <input
                  type="text"
                  name="country"
                  value={profile.country}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Sri Lanka"
                  disabled={!canManage}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Postal Code</label>
                <input
                  type="text"
                  name="postalCode"
                  value={profile.postalCode}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="00100"
                  disabled={!canManage}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: Financial Settings */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Coins size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Financial Settings</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select
                  name="currency"
                  value={profile.currency}
                  onChange={handleInputChange}
                  className="form-select"
                  disabled={!canManage}
                >
                  <option value="LKR">LKR (Sri Lankan Rupee)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="GBP">GBP (British Pound)</option>
                  <option value="INR">INR (Indian Rupee)</option>
                  <option value="AED">AED (UAE Dirham)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Currency Symbol</label>
                <input
                  type="text"
                  name="currencySymbol"
                  value={profile.currencySymbol}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="e.g. Rs. or $"
                  disabled={!canManage}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div className="form-group" style={{ flexGrow: 1 }}>
                <label className="form-label">Default Tax/VAT Percentage (%)</label>
                <input
                  type="number"
                  name="taxPercentage"
                  step="0.01"
                  min="0"
                  max="100"
                  value={profile.taxPercentage}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="15.00"
                  disabled={!canManage}
                />
              </div>

              <div className="form-group" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <label className="form-label">VAT/Tax Status</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '46px' }}>
                  <div style={{ position: 'relative', width: '56px', height: '28px' }}>
                    <input 
                      type="checkbox"
                      checked={profile.isTaxActive}
                      onChange={() => setProfile(prev => ({ ...prev, isTaxActive: !prev.isTaxActive }))}
                      disabled={!canManage}
                      style={{ opacity: 0, width: 0, height: 0, margin: 0 }}
                      id="tax-active-toggle"
                    />
                    <label 
                      htmlFor="tax-active-toggle"
                      style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: profile.isTaxActive ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '30px',
                        cursor: canManage ? 'pointer' : 'default',
                        transition: 'background-color 0.3s ease',
                        border: '1px solid var(--border-color)',
                        display: 'block'
                      }}
                    >
                      <span 
                        style={{
                          position: 'absolute',
                          height: '20px',
                          width: '20px',
                          left: profile.isTaxActive ? '30px' : '4px',
                          bottom: '3px',
                          backgroundColor: '#ffffff',
                          borderRadius: '50%',
                          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                      />
                    </label>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', width: '30px', color: profile.isTaxActive ? 'var(--success)' : 'var(--text-secondary)' }}>
                    {profile.isTaxActive ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Financial Year Start Date</label>
              <input
                type="date"
                name="financialYearStart"
                value={profile.financialYearStart}
                onChange={handleInputChange}
                className="form-input"
                disabled={!canManage}
              />
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="allowNegativeStock"
                  checked={profile.allowNegativeStock}
                  onChange={(e) => setProfile(prev => ({ ...prev, allowNegativeStock: e.target.checked }))}
                  disabled={!canManage}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: '500' }}>
                  Allow Sales Without Stock (Negative Inventory)
                </span>
              </label>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '26px', marginTop: '4px' }}>
                When enabled, cashier can sell items even if stock quantity is zero or negative. Stock automatically goes into negative values.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Button controls (Save, Update, Reset) */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={saving || !canManage}
          style={{ padding: '10px 24px' }}
        >
          Reset
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || !canManage}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 28px' }}
        >
          {saving ? (
            <>
              <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
              Saving Settings...
            </>
          ) : (
            'Save & Update Profile'
          )}
        </button>
      </div>

    </form>
  );
}
