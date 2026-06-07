import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { User, Key, Lock, Eye, ToggleLeft, RefreshCw, CheckSquare, Square, Shield } from 'lucide-react';

export default function UserManagement({ setToast }) {
  const { token, API_URL, hasPermission } = useAuth();
  
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'permissions', 'audits'
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Permission Matrix states
  const [matrixData, setMatrixData] = useState({ roles: [], permissions: [], mappings: [] });
  const [permissionMappings, setPermissionMappings] = useState({}); // {roleId: Set(permissionIds)}

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [activeUserId, setActiveUserId] = useState(null);

  // Form states
  const [userForm, setUserForm] = useState({ username: '', email: '', roleId: '', isActive: true, password: '', pin: '' });
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetPinVal, setResetPinVal] = useState('');

  const canManageUsers = hasPermission('MANAGE_USERS');
  const canManagePermissions = hasPermission('EDIT_PERMISSIONS');

  useEffect(() => {
    fetchAdminData();
  }, [activeTab]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'users') {
        const usersRes = await fetch(`${API_URL}/api/auth/users`, { headers: { 'Authorization': `Bearer ${token}` } });
        const rolesRes = await fetch(`${API_URL}/api/auth/roles`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (usersRes.ok && rolesRes.ok) {
          setUsers(await usersRes.json());
          setRoles(await rolesRes.json());
        }
      } 
      else if (activeTab === 'permissions') {
        const matrixRes = await fetch(`${API_URL}/api/auth/permission-matrix`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (matrixRes.ok) {
          const data = await matrixRes.json();
          setMatrixData(data);
          
          // Re-map mappings array to a fast-lookup object: { roleId: Set(permIds) }
          const mapped = {};
          data.roles.forEach(r => mapped[r.RoleID] = new Set());
          data.mappings.forEach(m => {
            if (mapped[m.RoleID]) mapped[m.RoleID].add(m.PermissionID);
          });
          setPermissionMappings(mapped);
        }
      } 
      else if (activeTab === 'audits') {
        const historyRes = await fetch(`${API_URL}/api/auth/login-history`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (historyRes.ok) {
          setLoginHistory(await historyRes.json());
        }
      }
    } catch (err) {
      console.error('Failed to load admin panel data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!canManageUsers) return;

    try {
      let url = `${API_URL}/api/auth/users`;
      let method = 'POST';
      let body = { ...userForm };
      
      if (modalMode === 'edit') {
        url = `${API_URL}/api/auth/users/${activeUserId}`;
        method = 'PUT';
        delete body.password; // Do not send password on update
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed.');

      setToast({ type: 'success', message: `User ${modalMode === 'add' ? 'created' : 'updated'} successfully.` });
      setShowUserModal(false);
      fetchAdminData();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleEditUserClick = (u) => {
    setModalMode('edit');
    setActiveUserId(u.UserID);
    setUserForm({
      username: u.Username,
      email: u.Email,
      roleId: u.RoleID,
      isActive: u.IsActive === 1 || u.IsActive === true,
      password: '',
      pin: ''
    });
    setShowUserModal(true);
  };

  const handleAddUserClick = () => {
    setModalMode('add');
    setUserForm({
      username: '',
      email: '',
      roleId: roles[2]?.RoleID || '', // Default to manager/cashier
      isActive: true,
      password: '',
      pin: ''
    });
    setShowUserModal(true);
  };

  const handlePasswordResetClick = (u) => {
    setActiveUserId(u.UserID);
    setResetPasswordVal('');
    setShowPasswordModal(true);
  };

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    if (!canManageUsers) return;

    try {
      const res = await fetch(`${API_URL}/api/auth/users/${activeUserId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: resetPasswordVal })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed.');

      setToast({ type: 'success', message: 'Password reset completed successfully.' });
      setShowPasswordModal(false);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handlePinResetClick = (u) => {
    setActiveUserId(u.UserID);
    setResetPinVal('');
    setShowPinModal(true);
  };

  const handlePinResetSubmit = async (e) => {
    e.preventDefault();
    if (!canManageUsers) return;

    if (resetPinVal.length > 0 && resetPinVal.length !== 4) {
      setToast({ type: 'error', message: 'PIN must be exactly 4 digits.' });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/users/${activeUserId}/reset-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pin: resetPinVal || null })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed.');

      setToast({ type: 'success', message: resetPinVal ? 'PIN code updated successfully.' : 'PIN code cleared.' });
      setShowPinModal(false);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Toggle Matrix checkbox
  const handleTogglePermission = (roleId, permId) => {
    if (!canManagePermissions) return;

    const currentRoleSet = new Set(permissionMappings[roleId]);
    if (currentRoleSet.has(permId)) {
      currentRoleSet.delete(permId);
    } else {
      currentRoleSet.add(permId);
    }

    setPermissionMappings({
      ...permissionMappings,
      [roleId]: currentRoleSet
    });
  };

  // Save modified permission matrix
  const handleSavePermissionMatrix = async (roleId) => {
    if (!canManagePermissions) return;

    const permissionIds = Array.from(permissionMappings[roleId]);
    try {
      const res = await fetch(`${API_URL}/api/auth/permission-matrix/${roleId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ permissionIds })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update permissions.');

      setToast({ type: 'success', message: 'Permissions saved. Changes will apply at next user login.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  return (
    <div>
      {/* Sub tabs */}
      <div className="category-tabs" style={{ marginBottom: '24px' }}>
        <button 
          className={`category-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Account Directory
        </button>
        {canManagePermissions && (
          <button 
            className={`category-tab ${activeTab === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('permissions')}
          >
            RBAC Permission Matrix
          </button>
        )}
        <button 
          className={`category-tab ${activeTab === 'audits' ? 'active' : ''}`}
          onClick={() => setActiveTab('audits')}
        >
          Security Audit Login History
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
        </div>
      ) : (
        <div>
          {/* TAB 1: User Accounts Directory */}
          {activeTab === 'users' && (
            <div>
              {canManageUsers && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                  <button className="btn btn-primary" onClick={handleAddUserClick}>
                    + Create New User
                  </button>
                </div>
              )}

              <div className="glass-panel" style={{ padding: 0 }}>
                <div className="table-container">
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email Address</th>
                        <th>Assigned Role</th>
                        <th>Status</th>
                        <th>Date Created</th>
                        {canManageUsers && <th style={{ textAlign: 'right' }}>Administrative Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.UserID}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="avatar" style={{ width: '30px', height: '30px', fontSize: '12px' }}>
                                {u.Username[0].toUpperCase()}
                              </div>
                              <span style={{ fontWeight: '600' }}>{u.Username}</span>
                            </div>
                          </td>
                          <td>{u.Email}</td>
                          <td>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              background: 'var(--border-color)',
                              color: 'var(--text-primary)'
                            }}>
                              {u.RoleName}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              background: u.IsActive ? 'var(--success-bg)' : 'var(--danger-bg)',
                              color: u.IsActive ? '#a7f3d0' : '#fca5a5'
                            }}>
                              {u.IsActive ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td>{new Date(u.CreatedAt).toLocaleDateString()}</td>
                          {canManageUsers && (
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary btn-icon" onClick={() => handleEditUserClick(u)} title="Edit Account">
                                  <User size={14} />
                                </button>
                                <button className="btn btn-secondary btn-icon" onClick={() => handlePasswordResetClick(u)} title="Reset Password">
                                  <Key size={14} />
                                </button>
                                <button className="btn btn-secondary btn-icon" onClick={() => handlePinResetClick(u)} title="Reset PIN Code">
                                  <Lock size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Permission Matrix */}
          {activeTab === 'permissions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                Toggling values changes access properties globally. Save changes individually per role using the button below. Note: Super Admin role has hardcoded global access bypass.
              </p>

              {matrixData.roles.filter(r => r.RoleName !== 'Super Admin').map((role) => (
                <div key={role.RoleID} className="glass-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                      <Shield size={18} style={{ color: 'var(--primary)' }} />
                      {role.RoleName} Permissions
                    </h4>
                    <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12.5px' }} onClick={() => handleSavePermissionMatrix(role.RoleID)}>
                      Save Mappings
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                    {matrixData.permissions.map((perm) => {
                      const isChecked = permissionMappings[role.RoleID]?.has(perm.PermissionID);
                      return (
                        <div
                          key={perm.PermissionID}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px',
                            background: 'rgba(255,255,255,0.01)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                          onClick={() => handleTogglePermission(role.RoleID, perm.PermissionID)}
                        >
                          {isChecked ? (
                            <CheckSquare size={18} style={{ color: 'var(--primary)' }} />
                          ) : (
                            <Square size={18} style={{ color: 'var(--text-muted)' }} />
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: '600' }}>{perm.PermissionName}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{perm.Description || 'No description'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: Auditing log history */}
          {activeTab === 'audits' && (
            <div className="glass-panel" style={{ padding: 0 }}>
              <div className="table-container">
                <table className="table-glass">
                  <thead>
                    <tr>
                      <th>Audit Timestamp</th>
                      <th>Account Username</th>
                      <th>IP Address</th>
                      <th>Client Web Browser</th>
                      <th>Audit Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No audit trail files located.
                        </td>
                      </tr>
                    ) : (
                      loginHistory.map((lh) => (
                        <tr key={lh.HistoryID}>
                          <td className="mono" style={{ fontSize: '13px' }}>{new Date(lh.LoginTime).toLocaleString()}</td>
                          <td>
                            <span style={{ fontWeight: '600' }}>{lh.Username}</span>
                          </td>
                          <td className="mono" style={{ fontSize: '13px' }}>{lh.IPAddress || '--'}</td>
                          <td style={{ fontSize: '12.5px', maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={lh.UserAgent}>
                            {lh.UserAgent || 'Unknown'}
                          </td>
                          <td>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: lh.Status.includes('Success') ? 'var(--success-bg)' : 'var(--danger-bg)',
                              color: lh.Status.includes('Success') ? '#a7f3d0' : '#fca5a5'
                            }}>
                              {lh.Status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================================
         MODAL: CREATE/EDIT USER ACCOUNT
         ============================================================================ */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px' }}>
            <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              {modalMode === 'add' ? 'Create Staff Profile' : 'Edit Staff Account'}
            </h3>

            <form onSubmit={handleUserSubmit}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  disabled={modalMode === 'edit'}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  required
                />
              </div>

              {modalMode === 'add' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Starting Password</label>
                    <input
                      type="password"
                      className="form-input"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quick Login PIN Code (4 Digits, Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 4444"
                      maxLength={4}
                      pattern="[0-9]*"
                      value={userForm.pin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setUserForm({ ...userForm, pin: val });
                      }}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Access Role Group</label>
                <select
                  className="form-select"
                  value={userForm.roleId}
                  onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}
                  required
                >
                  <option value="">-- Choose Access Role --</option>
                  {roles.map(r => (
                    <option key={r.RoleID} value={r.RoleID}>{r.RoleName}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px' }}>
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={userForm.isActive}
                  onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="userActiveCheck" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Is Active Profile</label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{modalMode === 'add' ? 'Save User' : 'Apply Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: ADMINISTRATIVE PASSWORD RESET
         ============================================================================ */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '400px' }}>
            <h3 style={{ marginBottom: '20px' }}>Reset Account Password</h3>
            <form onSubmit={handlePasswordResetSubmit}>
              <div className="form-group">
                <label className="form-label">New Password Value</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter new strong password"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--warning)', borderColor: 'var(--warning)' }}>
                  Override Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: ADMINISTRATIVE PIN RESET
         ============================================================================ */}
      {showPinModal && (
         <div className="modal-overlay">
           <div className="modal-content" style={{ width: '400px' }}>
             <h3 style={{ marginBottom: '20px' }}>Configure Staff Login PIN</h3>
             <form onSubmit={handlePinResetSubmit}>
               <div className="form-group">
                 <label className="form-label">New 4-Digit PIN (Numeric, Leave empty to clear PIN)</label>
                 <input
                   type="text"
                   className="form-input"
                   placeholder="e.g. 1234"
                   maxLength={4}
                   pattern="[0-9]*"
                   value={resetPinVal}
                   onChange={(e) => {
                     const val = e.target.value.replace(/[^0-9]/g, '');
                     setResetPinVal(val);
                   }}
                   autoFocus
                 />
               </div>

               <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                 <button type="button" className="btn btn-secondary" onClick={() => setShowPinModal(false)}>Cancel</button>
                 <button type="submit" className="btn btn-primary" style={{ background: 'var(--warning)', borderColor: 'var(--warning)', color: '#000' }}>
                   Update PIN Code
                 </button>
               </div>
             </form>
           </div>
         </div>
       )}

    </div>
  );
}
