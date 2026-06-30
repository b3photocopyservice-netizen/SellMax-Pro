import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { 
  Building2, Phone, MapPin, Coins, RefreshCw, Upload, Image, ShieldCheck, X, FileText, Printer 
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
    allowNegativeStock: false,
    printHeader: true,
    headerMessage: '',
    printLogo: true,
    printDateTime: true,
    printCashier: true,
    printBranch: true,
    printFooter: true,
    footerMessage: '',
    paperSize: '80mm',
    autoCut: true,
    openDrawer: true,
    receiptCopies: 1,
    defaultPrinter: ''
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
          allowNegativeStock: data.AllowNegativeStock !== undefined ? !!data.AllowNegativeStock : false,
          printHeader: data.PrintHeader !== undefined ? !!data.PrintHeader : true,
          headerMessage: data.HeaderMessage || '',
          printLogo: data.PrintLogo !== undefined ? !!data.PrintLogo : true,
          printDateTime: data.PrintDateTime !== undefined ? !!data.PrintDateTime : true,
          printCashier: data.PrintCashier !== undefined ? !!data.PrintCashier : true,
          printBranch: data.PrintBranch !== undefined ? !!data.PrintBranch : true,
          printFooter: data.PrintFooter !== undefined ? !!data.PrintFooter : true,
          footerMessage: data.FooterMessage || '',
          paperSize: data.PaperSize || '80mm',
          autoCut: data.AutoCut !== undefined ? !!data.AutoCut : true,
          openDrawer: data.OpenDrawer !== undefined ? !!data.OpenDrawer : true,
          receiptCopies: data.ReceiptCopies !== undefined ? parseInt(data.ReceiptCopies, 10) : 1,
          defaultPrinter: data.DefaultPrinter || ''
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

  const handleTestPrint = () => {
    const dummyOrder = {
      OrderID: '9999',
      OrderDate: new Date().toISOString(),
      Username: 'Cashier-Admin',
      CustomerName: 'Test Walk-in Customer',
      Subtotal: 1350.00,
      DiscountAmount: 150.00,
      TaxAmount: 180.00,
      TotalAmount: 1380.00,
      BranchName: 'Main Branch'
    };

    const dummyItems = [
      { ProductName: 'Organic Basmati Rice', VariantName: '5kg Pack', Quantity: 1, UOM: 'pack', Subtotal: 950.00, Price: 950.00, OriginalPrice: 950.00 },
      { ProductName: 'Fresh Whole Milk', VariantName: '1 Litre', Quantity: 2, UOM: 'bottles', Subtotal: 400.00, Price: 200.00, OriginalPrice: 250.00 }
    ];

    const dummyPayments = [
      { Method: 'Cash', Amount: 1500.00, ReferenceNumber: 'Recv:1500.00,Change:120.00' }
    ];

    const logoUrl = profile.logoUrl || null;

    const paymentsHtml = dummyPayments.map(p => {
      const isCash = p.Method === 'Cash';
      let recv = null, change = null;
      if (isCash && p.ReferenceNumber && p.ReferenceNumber.startsWith('Recv:')) {
        p.ReferenceNumber.split(',').forEach(part => {
          if (part.startsWith('Recv:')) recv = parseFloat(part.replace('Recv:', ''));
          if (part.startsWith('Change:')) change = parseFloat(part.replace('Change:', ''));
        });
      }
      return `
        <div class="pay-row">
          <span>- ${p.Method}${!isCash && p.ReferenceNumber ? ` (${p.ReferenceNumber})` : ''}</span>
          <span>Rs. ${Number(p.Amount).toFixed(2)}</span>
        </div>
        ${recv !== null ? `<div class="pay-sub"><span>Received:</span><span>Rs. ${recv.toFixed(2)}</span></div>` : ''}
        ${change !== null ? `<div class="pay-sub"><span>Change:</span><span>Rs. ${change.toFixed(2)}</span></div>` : ''}
      `;
    }).join('');

    const itemsHtml = dummyItems.map(item => {
      const hasOverride = item.OriginalPrice && Number(item.OriginalPrice) !== Number(item.Price);
      const origHtml = hasOverride 
        ? `<div style="font-size: 9px; color: #d97706;">Orig: <span style="text-decoration: line-through;">Rs. ${Number(item.OriginalPrice).toFixed(2)}</span></div>` 
        : '';
      const variantHtml = item.VariantName
        ? `<div style="font-size: 9px; color: #6366f1; font-weight: 600;">${item.VariantName}</div>`
        : '';
      return `
        <tr>
          <td>
            <div>${item.ProductName}</div>
            ${variantHtml}
            ${origHtml}
          </td>
          <td style="text-align:center">${Number(item.Quantity)} ${item.UOM || 'pcs'}</td>
          <td style="text-align:right">Rs. ${Number(item.Subtotal).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const discountHtml = Number(dummyOrder.DiscountAmount) > 0
      ? `<div class="sum-row"><span>Discount:</span><span>-Rs. ${Number(dummyOrder.DiscountAmount).toFixed(2)}</span></div>`
      : '';

    const addressParts = [
      profile.addressLine1,
      profile.addressLine2,
      profile.city && profile.postalCode
        ? `${profile.city}, ${profile.postalCode}`
        : (profile.city || profile.postalCode || ''),
    ].filter(Boolean).join('<br>');

    const contactParts = [
      (profile.telephoneNumber || profile.mobileNumber)
        ? `Tel: ${profile.telephoneNumber || profile.mobileNumber}`
        : null,
      profile.email ? `Email: ${profile.email}` : null,
      profile.website || null,
    ].filter(Boolean).join('<br>');

    const paperWidth = profile.paperSize === '58mm' ? '58mm' : '80mm';
    const bodyFontSize = profile.paperSize === '58mm' ? '10.5px' : '12px';
    const copiesCount = parseInt(profile.receiptCopies, 10) || 1;

    let headerHtml = '';
    if (profile.printHeader) {
      const logoTag = (profile.printLogo && logoUrl) ? `<div><img class="logo" src="${logoUrl}" alt="Logo"></div>` : '';
      const nameTag = `<div class="company-name">${profile.name || 'SELLMAX PRO'}</div>`;
      const addrContactTag = addressParts || contactParts ? `<div class="company-sub">${[addressParts, contactParts].filter(Boolean).join('<br>')}</div>` : '';
      const headerMsgTag = profile.headerMessage ? `<div style="font-size: 11px; margin-top: 8px; border-top: 1px dotted #ccc; padding-top: 4px; font-style: italic; white-space: pre-line;">${profile.headerMessage}</div>` : '';
      
      headerHtml = `
        <div class="header">
          ${logoTag}
          ${nameTag}
          ${addrContactTag}
          ${headerMsgTag}
        </div>
      `;
    }

    let metaHtml = `<div>INVOICE: #SM-${dummyOrder.OrderID} (TEST PRINT)</div>`;
    if (profile.printDateTime) {
      metaHtml += `<div>DATE: ${new Date(dummyOrder.OrderDate).toLocaleString()}</div>`;
    }
    if (profile.printCashier) {
      metaHtml += `<div>CASHIER: ${dummyOrder.Username}</div>`;
    }
    if (profile.printBranch) {
      metaHtml += `<div>BRANCH: ${dummyOrder.BranchName}</div>`;
    }
    metaHtml += `<div>CUSTOMER: ${dummyOrder.CustomerName}</div>`;

    let footerHtml = '';
    if (profile.printFooter) {
      const customFooterMsg = profile.footerMessage 
        ? `<div style="margin-bottom: 8px; font-weight: bold; white-space: pre-line;">${profile.footerMessage}</div>` 
        : '<p>Thank you for shopping with us!</p>';
        
      footerHtml = `
        <div class="footer">
          ${customFooterMsg}
          <p style="margin-top: 8px; font-size: 8px; opacity: 0.8;">Powered by SellMax Pro POS</p>
        </div>
      `;
    }

    const singleReceipt = `
      <div class="receipt-container">
        ${headerHtml}
        
        <div class="meta">
          ${metaHtml}
        </div>

        <table>
          <thead>
            <tr>
              <th class="col-item" style="text-align:left">ITEM</th>
              <th class="col-qty">QTY</th>
              <th class="col-price">PRICE</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div class="summary">
          <div class="sum-row"><span>Subtotal:</span><span>Rs. ${Number(dummyOrder.Subtotal).toFixed(2)}</span></div>
          ${discountHtml}
          <div class="sum-row"><span>VAT:</span><span>Rs. ${Number(dummyOrder.TaxAmount).toFixed(2)}</span></div>
          <div class="sum-total"><span>TOTAL PAID:</span><span>Rs. ${Number(dummyOrder.TotalAmount).toFixed(2)}</span></div>
        </div>

        <div class="payments">
          <div class="pay-label">Payments:</div>
          ${paymentsHtml}
        </div>

        ${footerHtml}
      </div>
    `;

    let printBodyContent = '';
    for (let i = 0; i < copiesCount; i++) {
      const isLast = (i === copiesCount - 1);
      printBodyContent += `
        ${singleReceipt}
        ${!isLast ? '<div class="page-break"></div>' : ''}
      `;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Test Print Receipt</title>
<style>
  @page {
    size: ${paperWidth} auto;
    margin: 4mm 4mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: ${bodyFontSize};
    color: #000;
    width: 100%;
    background: white;
  }
  .receipt-container {
    width: 100%;
    margin-bottom: 20px;
  }
  .page-break {
    page-break-after: always;
    border-bottom: 2px dashed #000;
    margin: 15px 0;
    padding-bottom: 15px;
  }
  .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
  .logo { max-height: 50px; max-width: 90%; object-fit: contain; margin-bottom: 4px; }
  .company-name { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .company-sub { font-size: 10px; color: #111; line-height: 1.5; margin-top: 3px; }
  .meta { font-size: 11px; line-height: 1.7; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead th { font-size: 10px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 2px; }
  tbody td { font-size: 10px; padding: 3px 2px; vertical-align: top; word-break: break-word; }
  .col-item { width: 52%; }
  .col-qty  { width: 18%; text-align: center; }
  .col-price{ width: 30%; text-align: right; }
  .summary { border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
  .sum-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
  .sum-total { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; margin-top: 4px; padding: 4px 0; }
  .payments { border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px; font-size: 11px; }
  .pay-label { font-weight: bold; margin-bottom: 3px; font-size: 11px; }
  .pay-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
  .pay-sub { display: flex; justify-content: space-between; font-size: 10px; padding-left: 10px; color: #333; }
  .footer { text-align: center; border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; font-size: 10px; line-height: 1.6; color: #333; }
</style>
</head>
<body>
  ${printBodyContent}
  <script>
    window.onload = function() {
      window.focus();
      setTimeout(function() {
        window.print();
        setTimeout(function() { window.close(); }, 500);
      }, 300);
    };
  </script>
</body>
</html>`;

    const popup = window.open('', '_blank', 'width=320,height=600,toolbar=0,menubar=0,location=0,status=0');
    if (!popup) {
      setToast({ type: 'error', message: 'Pop-up blocked! Allow pop-ups to print test receipt.' });
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
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
          allowNegativeStock: data.AllowNegativeStock !== undefined ? !!data.AllowNegativeStock : false,
          printHeader: data.PrintHeader !== undefined ? !!data.PrintHeader : true,
          headerMessage: data.HeaderMessage || '',
          printLogo: data.PrintLogo !== undefined ? !!data.PrintLogo : true,
          printDateTime: data.PrintDateTime !== undefined ? !!data.PrintDateTime : true,
          printCashier: data.PrintCashier !== undefined ? !!data.PrintCashier : true,
          printBranch: data.PrintBranch !== undefined ? !!data.PrintBranch : true,
          printFooter: data.PrintFooter !== undefined ? !!data.PrintFooter : true,
          footerMessage: data.FooterMessage || '',
          paperSize: data.PaperSize || '80mm',
          autoCut: data.AutoCut !== undefined ? !!data.AutoCut : true,
          openDrawer: data.OpenDrawer !== undefined ? !!data.OpenDrawer : true,
          receiptCopies: data.ReceiptCopies !== undefined ? parseInt(data.ReceiptCopies, 10) : 1,
          defaultPrinter: data.DefaultPrinter || ''
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

        {/* SECTION 5: POS Printer Settings */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Printer size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>POS Printer Settings</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Receipt Header Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: '600' }}>Enable Receipt Header</span>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Show logo, company name, address, and messages.</p>
              </div>
              <div style={{ position: 'relative', width: '56px', height: '28px' }}>
                <input 
                  type="checkbox"
                  checked={profile.printHeader}
                  onChange={() => setProfile(prev => ({ ...prev, printHeader: !prev.printHeader }))}
                  disabled={!canManage}
                  style={{ opacity: 0, width: 0, height: 0, margin: 0 }}
                  id="print-header-toggle"
                />
                <label 
                  htmlFor="print-header-toggle"
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: profile.printHeader ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
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
                      left: profile.printHeader ? '30px' : '4px',
                      bottom: '3px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  />
                </label>
              </div>
            </div>

            {profile.printHeader && (
              <div style={{ paddingLeft: '12px', borderLeft: '2px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'all 0.3s' }}>
                <div className="form-group">
                  <label className="form-label">Custom Header Message (Multiple Lines)</label>
                  <textarea
                    name="headerMessage"
                    value={profile.headerMessage}
                    onChange={handleInputChange}
                    className="form-input"
                    rows="2"
                    placeholder="e.g., Welcome to our store!&#10;Thank you for shopping."
                    disabled={!canManage}
                    style={{ resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={profile.printLogo}
                      onChange={(e) => setProfile(prev => ({ ...prev, printLogo: e.target.checked }))}
                      disabled={!canManage}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <span style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>Print Company Logo</span>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={profile.printDateTime}
                      onChange={(e) => setProfile(prev => ({ ...prev, printDateTime: e.target.checked }))}
                      disabled={!canManage}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <span style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>Print Date & Time</span>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={profile.printCashier}
                      onChange={(e) => setProfile(prev => ({ ...prev, printCashier: e.target.checked }))}
                      disabled={!canManage}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <span style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>Print Cashier Name</span>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={profile.printBranch}
                      onChange={(e) => setProfile(prev => ({ ...prev, printBranch: e.target.checked }))}
                      disabled={!canManage}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <span style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>Print Branch Name</span>
                  </label>
                </div>
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

            {/* Receipt Footer Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: '600' }}>Enable Receipt Footer</span>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Show custom message, exchange policies, and brandings.</p>
              </div>
              <div style={{ position: 'relative', width: '56px', height: '28px' }}>
                <input 
                  type="checkbox"
                  checked={profile.printFooter}
                  onChange={() => setProfile(prev => ({ ...prev, printFooter: !prev.printFooter }))}
                  disabled={!canManage}
                  style={{ opacity: 0, width: 0, height: 0, margin: 0 }}
                  id="print-footer-toggle"
                />
                <label 
                  htmlFor="print-footer-toggle"
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: profile.printFooter ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
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
                      left: profile.printFooter ? '30px' : '4px',
                      bottom: '3px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  />
                </label>
              </div>
            </div>

            {profile.printFooter && (
              <div style={{ paddingLeft: '12px', borderLeft: '2px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Custom Footer Message (Multiple Lines)</label>
                  <textarea
                    name="footerMessage"
                    value={profile.footerMessage}
                    onChange={handleInputChange}
                    className="form-input"
                    rows="3"
                    placeholder="e.g., Thank You for Shopping!&#10;Goods Sold Are Not Returnable.&#10;Visit Again!"
                    disabled={!canManage}
                    style={{ resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

            {/* Paper Size and Copies */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Paper Size</label>
                <select
                  name="paperSize"
                  value={profile.paperSize}
                  onChange={handleInputChange}
                  className="form-select"
                  disabled={!canManage}
                >
                  <option value="80mm">80mm (Standard POS)</option>
                  <option value="58mm">58mm (Narrow Mobile/POS)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Number of Copies</label>
                <input
                  type="number"
                  name="receiptCopies"
                  min="1"
                  max="5"
                  value={profile.receiptCopies}
                  onChange={handleInputChange}
                  className="form-input"
                  disabled={!canManage}
                />
              </div>
            </div>

            {/* Auto Cut and Open Cash Drawer */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={profile.autoCut}
                  onChange={(e) => setProfile(prev => ({ ...prev, autoCut: e.target.checked }))}
                  disabled={!canManage}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                />
                <span style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>Auto Paper Cut</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={profile.openDrawer}
                  onChange={(e) => setProfile(prev => ({ ...prev, openDrawer: e.target.checked }))}
                  disabled={!canManage}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                />
                <span style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>Open Cash Drawer</span>
              </label>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

            {/* Default POS Printer Name & Test Button */}
            <div className="form-group">
              <label className="form-label">Default POS Printer Name</label>
              <input
                type="text"
                name="defaultPrinter"
                value={profile.defaultPrinter}
                onChange={handleInputChange}
                className="form-input"
                placeholder="e.g. EPSON TM-T88VI or XP-80"
                disabled={!canManage}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                Specify system printer name. If empty, the browser's default or last chosen printer will be used.
              </span>
            </div>

            <div style={{ marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTestPrint}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
              >
                <Printer size={16} />
                Test Print Receipt
              </button>
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
