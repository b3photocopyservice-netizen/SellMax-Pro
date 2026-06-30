import React, { useState } from 'react';
import { Printer, FileDown, FileSpreadsheet, X, Eye } from 'lucide-react';
import formatCurrency from './utils/formatCurrency';

export default function PrintPreviewModal({ 
  show, 
  onClose, 
  title, 
  companyInfo, 
  filters = {}, 
  headers = [], 
  rows = [], // Array of arrays or array of objects matching headers
  columnConfig = [], // Array of config: { align: 'left'|'right'|'center', isCurrency: boolean, width: string }
  totalsRow = null, // Array of strings/numbers representing totals row at bottom
  layoutPreset = 'portrait' // 'portrait' (A4 Portrait), 'landscape' (A4 Landscape), 'thermal' (80mm Receipt)
}) {
  const [layout, setLayout] = useState(layoutPreset);
  const [zoom, setZoom] = useState(100);

  if (!show) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvRows = [];
    // Report Title & Meta
    csvRows.push(`"${title.replace(/"/g, '""')}"`);
    csvRows.push(`"Company: ${String(companyInfo?.Name || 'SellMax Pro POS').replace(/"/g, '""')}"`);
    csvRows.push(`"Print Date: ${new Date().toLocaleString()}"`);
    
    // Filters metadata
    if (Object.keys(filters).length > 0) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val) {
          csvRows.push(`"${key.replace(/"/g, '""')}: ${String(val).replace(/"/g, '""')}"`);
        }
      });
    }
    csvRows.push(''); // blank spacing

    // Table Headers
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

    // Table Rows
    rows.forEach(r => {
      const cells = Array.isArray(r) ? r : headers.map(h => r[h] ?? '');
      csvRows.push(cells.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','));
    });

    // Totals Row
    if (totalsRow) {
      csvRows.push(totalsRow.map(t => `"${String(t ?? '').replace(/"/g, '""')}"`).join(','));
    }

    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sizing styles depending on layout selection
  const pageStyles = {
    portrait: {
      width: '210mm',
      minHeight: '297mm',
      padding: '20mm',
      margin: '0 auto',
      background: 'white',
      color: 'black',
      boxShadow: '0 0 20px rgba(0,0,0,0.15)',
      borderRadius: '4px',
      transform: `scale(${zoom / 100})`,
      transformOrigin: 'top center',
      boxSizing: 'border-box'
    },
    landscape: {
      width: '297mm',
      minHeight: '210mm',
      padding: '20mm',
      margin: '0 auto',
      background: 'white',
      color: 'black',
      boxShadow: '0 0 20px rgba(0,0,0,0.15)',
      borderRadius: '4px',
      transform: `scale(${zoom / 100})`,
      transformOrigin: 'top center',
      boxSizing: 'border-box'
    },
    thermal: {
      width: '80mm',
      minHeight: '120mm',
      padding: '5mm',
      margin: '0 auto',
      background: 'white',
      color: 'black',
      boxShadow: '0 0 20px rgba(0,0,0,0.15)',
      borderRadius: '4px',
      transform: `scale(${zoom / 100})`,
      transformOrigin: 'top center',
      boxSizing: 'border-box',
      fontFamily: 'monospace'
    }
  };

  const currentStyles = pageStyles[layout] || pageStyles.portrait;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', flexDirection: 'column', padding: '24px 0 0 0', overflowY: 'hidden', backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.85)' }}>
      
      {/* ── Printing Styles Injection ── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
            background: transparent !important;
          }
          #print-preview-sheet, #print-preview-sheet * {
            visibility: visible !important;
          }
          #print-preview-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${layout === 'thermal' ? '80mm' : layout === 'landscape' ? '297mm' : '210mm'} !important;
            padding: ${layout === 'thermal' ? '5mm' : '15mm'} !important;
            margin: 0 !important;
            box-shadow: none !important;
            transform: none !important;
            background: white !important;
            color: black !important;
            box-sizing: border-box !important;
          }
          .modal-overlay, .print-preview-scroll-container {
            position: static !important;
            overflow: visible !important;
            padding: 0 !important;
            background: white !important;
          }
          .preview-toolbar {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            color: black !important;
            border: 1px solid #cbd5e1 !important;
            padding: 6px 8px !important;
            font-size: ${layout === 'thermal' ? '10px' : '11px'} !important;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Toolbar Area */}
      <div className="preview-toolbar glass-panel" style={{ width: '92%', maxWidth: '1200px', margin: '0 auto 16px auto', padding: '12px 24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Eye size={20} style={{ color: 'var(--primary)' }} />
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>Print & Export Preview</h4>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>Configure document layout and export parameters</p>
          </div>
        </div>

        {/* Layout & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Size Preset:</span>
            <select 
              className="form-select" 
              style={{ width: '150px', padding: '5px 10px', fontSize: '13px' }} 
              value={layout} 
              onChange={(e) => setLayout(e.target.value)}
            >
              <option value="portrait">A4 Portrait</option>
              <option value="landscape">A4 Landscape</option>
              <option value="thermal">Thermal (80mm)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Zoom:</span>
            <input 
              type="range" 
              min="50" 
              max="150" 
              value={zoom} 
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ width: '90px', accentColor: 'var(--primary)' }}
            />
            <span style={{ fontSize: '12px', width: '32px', textAlign: 'right' }} className="mono">{zoom}%</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '13px' }}>
            <FileSpreadsheet size={15} />
            <span>Excel</span>
          </button>
          
          <button className="btn btn-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '13px' }}>
            <FileDown size={15} />
            <span>PDF / Print</span>
          </button>

          <button 
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '7px 12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Sheet Display Area */}
      <div className="print-preview-scroll-container" style={{ flexGrow: 1, overflowY: 'auto', padding: '16px 24px 80px 24px', display: 'flex', justifyContent: 'center' }}>
        <div 
          id="print-preview-sheet" 
          style={currentStyles}
        >
          {/* Document Header */}
          <div style={{ borderBottom: '2px solid #1e293b', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: layout === 'thermal' ? '14px' : '20px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' }}>
                {companyInfo?.Name || 'SELLMAX PRO POS'}
              </h2>
              {companyInfo?.Address && (
                <p style={{ margin: '0 0 2px 0', fontSize: layout === 'thermal' ? '9px' : '11px', color: '#475569' }}>
                  {companyInfo.Address}
                </p>
              )}
              {companyInfo?.Phone && (
                <p style={{ margin: 0, fontSize: layout === 'thermal' ? '9px' : '11px', color: '#475569' }}>
                  Tel: {companyInfo.Phone} {companyInfo.Email ? `| Email: ${companyInfo.Email}` : ''}
                </p>
              )}
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: layout === 'thermal' ? '12px' : '15px', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', color: '#0284c7' }}>
                {title}
              </h3>
              <p style={{ margin: 0, fontSize: layout === 'thermal' ? '9px' : '10px', color: '#64748b' }}>
                Date: {new Date().toLocaleDateString('en-LK')} | {new Date().toLocaleTimeString('en-LK')}
              </p>
            </div>
          </div>

          {/* Active Filter Metadata */}
          {Object.keys(filters).length > 0 && (
            <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: layout === 'thermal' ? '9px' : '11px', display: 'flex', flexWrap: 'wrap', gap: '12px', color: '#334155' }}>
              {Object.entries(filters).map(([k, v]) => {
                if (!v) return null;
                return (
                  <span key={k}>
                    <strong>{k}:</strong> {v}
                  </span>
                );
              })}
            </div>
          )}

          {/* Tabular data structure */}
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'black', fontSize: layout === 'thermal' ? '10px' : '11px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {headers.map((h, i) => {
                    const cfg = columnConfig[i] || {};
                    return (
                      <th 
                        key={i} 
                        style={{ 
                          border: '1px solid #cbd5e1', 
                          padding: '8px 10px', 
                          textAlign: cfg.align || 'left',
                          width: cfg.width || 'auto',
                          color: '#1e293b',
                          fontWeight: '700',
                          fontSize: layout === 'thermal' ? '10px' : '11px'
                        }}
                      >
                        {h}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length} style={{ textAlign: 'center', padding: '16px', color: '#64748b', border: '1px solid #cbd5e1' }}>
                      No data records available for this query block.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rIdx) => {
                    const cells = Array.isArray(row) ? row : headers.map(h => row[h] ?? '');
                    return (
                      <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? 'white' : '#f8fafc' }}>
                        {cells.map((cell, cIdx) => {
                          const cfg = columnConfig[cIdx] || {};
                          const formatted = cfg.isCurrency && typeof cell === 'number' 
                            ? `Rs. ${formatCurrency(cell)}` 
                            : cell;
                          return (
                            <td 
                              key={cIdx} 
                              style={{ 
                                border: '1px solid #cbd5e1', 
                                padding: '6px 10px', 
                                textAlign: cfg.align || 'left',
                                color: '#334155',
                                wordBreak: 'break-word',
                                fontSize: layout === 'thermal' ? '9px' : '11px'
                              }}
                            >
                              {formatted}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
              
              {/* Grand Totals */}
              {totalsRow && (
                <tfoot>
                  <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}>
                    {totalsRow.map((t, i) => {
                      const cfg = columnConfig[i] || {};
                      const formatted = cfg.isCurrency && typeof t === 'number' 
                        ? `Rs. ${formatCurrency(t)}` 
                        : t;
                      return (
                        <td 
                          key={i} 
                          style={{ 
                            border: '1px solid #cbd5e1', 
                            padding: '8px 10px', 
                            textAlign: cfg.align || 'left',
                            color: '#0f172a',
                            fontWeight: '800',
                            borderTop: '2px solid #0f172a',
                            fontSize: layout === 'thermal' ? '10px' : '11px'
                          }}
                        >
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Page Footer */}
          <div style={{ marginTop: '30px', borderTop: '1px solid #cbd5e1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b' }}>
            <span>Generated by SellMax Pro POS System</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>

    </div>
  );
}
