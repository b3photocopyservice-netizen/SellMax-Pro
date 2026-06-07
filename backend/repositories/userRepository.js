const db = require('../config/db');

class UserRepository {
  async getByUsername(username) {
    const sqlQuery = `
      SELECT u.*, r.RoleName, c.Name AS CompanyName
      FROM dbo.Users u
      INNER JOIN dbo.Roles r ON u.RoleID = r.RoleID
      LEFT JOIN dbo.Companies c ON u.CompanyID = c.CompanyID
      WHERE u.Username = @Username
    `;
    const result = await db.query(sqlQuery, { Username: username });
    return result.recordset[0] || null;
  }

  async getById(id) {
    const sqlQuery = `
      SELECT u.UserID, u.CompanyID, u.Username, u.Email, u.RoleID, u.IsActive, u.CreatedAt, r.RoleName, c.Name AS CompanyName
      FROM dbo.Users u
      INNER JOIN dbo.Roles r ON u.RoleID = r.RoleID
      LEFT JOIN dbo.Companies c ON u.CompanyID = c.CompanyID
      WHERE u.UserID = @UserID
    `;
    const result = await db.query(sqlQuery, { UserID: id });
    return result.recordset[0] || null;
  }

  async getUsers(companyId) {
    const sqlQuery = `
      SELECT u.UserID, u.CompanyID, u.Username, u.Email, u.RoleID, u.IsActive, u.CreatedAt, r.RoleName
      FROM dbo.Users u
      INNER JOIN dbo.Roles r ON u.RoleID = r.RoleID
      WHERE u.CompanyID = @CompanyID
      ORDER BY u.Username ASC
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId });
    return result.recordset;
  }

  async create(userData, companyId) {
    const sqlQuery = `
      INSERT INTO dbo.Users (CompanyID, Username, Email, PasswordHash, PINHash, RoleID, IsActive)
      OUTPUT inserted.UserID, inserted.CompanyID, inserted.Username, inserted.Email, inserted.RoleID, inserted.IsActive, inserted.CreatedAt
      VALUES (@CompanyID, @Username, @Email, @PasswordHash, @PINHash, @RoleID, @IsActive)
    `;
    const result = await db.query(sqlQuery, {
      CompanyID: companyId,
      Username: userData.username,
      Email: userData.email,
      PasswordHash: userData.passwordHash,
      PINHash: userData.pinHash || null,
      RoleID: userData.roleId,
      IsActive: userData.isActive !== undefined ? (userData.isActive ? 1 : 0) : 1
    });
    return result.recordset[0];
  }

  async update(id, userData, companyId) {
    const sqlQuery = `
      UPDATE dbo.Users
      SET Email = @Email,
          RoleID = @RoleID,
          IsActive = @IsActive
      OUTPUT inserted.UserID, inserted.CompanyID, inserted.Username, inserted.Email, inserted.RoleID, inserted.IsActive, inserted.CreatedAt
      WHERE UserID = @UserID AND CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, {
      UserID: id,
      CompanyID: companyId,
      Email: userData.email,
      RoleID: userData.roleId,
      IsActive: userData.isActive ? 1 : 0
    });
    return result.recordset[0] || null;
  }

  async resetPassword(id, passwordHash, companyId) {
    const sqlQuery = `
      UPDATE dbo.Users
      SET PasswordHash = @PasswordHash
      WHERE UserID = @UserID AND CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, {
      UserID: id,
      CompanyID: companyId,
      PasswordHash: passwordHash
    });
    return result.rowsAffected[0] > 0;
  }

  async getRoles() {
    const sqlQuery = `SELECT * FROM dbo.Roles ORDER BY RoleID ASC`;
    const result = await db.query(sqlQuery);
    return result.recordset;
  }

  async getPermissionMatrix() {
    // Get all roles, all permissions, and the active links
    const rolesQuery = `SELECT * FROM dbo.Roles`;
    const permissionsQuery = `SELECT * FROM dbo.Permissions`;
    const matrixQuery = `SELECT RoleID, PermissionID FROM dbo.RolePermissions`;

    const roles = await db.query(rolesQuery);
    const permissions = await db.query(permissionsQuery);
    const matrix = await db.query(matrixQuery);

    return {
      roles: roles.recordset,
      permissions: permissions.recordset,
      mappings: matrix.recordset
    };
  }

  async updatePermissionMatrix(roleId, permissionIds) {
    const pool = await db.poolPromise;
    const transaction = new db.sql.Transaction(pool);

    try {
      await transaction.begin();

      // 1. Delete existing permissions for role
      const deleteRequest = new db.sql.Request(transaction);
      deleteRequest.input('RoleID', db.sql.Int, roleId);
      await deleteRequest.query(`DELETE FROM dbo.RolePermissions WHERE RoleID = @RoleID`);

      // 2. Insert new permissions
      if (permissionIds && permissionIds.length > 0) {
        for (const permId of permissionIds) {
          const insertRequest = new db.sql.Request(transaction);
          insertRequest.input('RoleID', db.sql.Int, roleId);
          insertRequest.input('PermissionID', db.sql.Int, permId);
          await insertRequest.query(`
            INSERT INTO dbo.RolePermissions (RoleID, PermissionID)
            VALUES (@RoleID, @PermissionID)
          `);
        }
      }

      await transaction.commit();
      return true;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async logLoginHistory(userId, ipAddress, userAgent, status) {
    const sqlQuery = `
      INSERT INTO dbo.LoginHistory (UserID, IPAddress, UserAgent, Status)
      VALUES (@UserID, @IPAddress, @UserAgent, @Status)
    `;
    await db.query(sqlQuery, {
      UserID: userId,
      IPAddress: ipAddress || null,
      UserAgent: userAgent || null,
      Status: status
    });
  }

  async getLoginHistory(companyId) {
    const sqlQuery = `
      SELECT TOP 100 lh.*, u.Username
      FROM dbo.LoginHistory lh
      INNER JOIN dbo.Users u ON lh.UserID = u.UserID
      WHERE u.CompanyID = @CompanyID
      ORDER BY lh.LoginTime DESC
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId });
    return result.recordset;
  }

  async getUserPermissions(userId) {
    const sqlQuery = `
      SELECT p.PermissionName 
      FROM dbo.Users u
      INNER JOIN dbo.RolePermissions rp ON u.RoleID = rp.RoleID
      INNER JOIN dbo.Permissions p ON rp.PermissionID = p.PermissionID
      WHERE u.UserID = @UserID AND u.IsActive = 1
    `;
    const result = await db.query(sqlQuery, { UserID: userId });
    return result.recordset.map(row => row.PermissionName);
  }

  async updatePin(id, pinHash, companyId) {
    const sqlQuery = `
      UPDATE dbo.Users
      SET PINHash = @PINHash
      WHERE UserID = @UserID AND CompanyID = @CompanyID
    `;
    const result = await db.query(sqlQuery, {
      UserID: id,
      CompanyID: companyId,
      PINHash: pinHash
    });
    return result.rowsAffected[0] > 0;
  }

  async getActiveUsersForPin() {
    const sqlQuery = `
      SELECT u.UserID, u.Username, r.RoleName
      FROM dbo.Users u
      INNER JOIN dbo.Roles r ON u.RoleID = r.RoleID
      WHERE u.IsActive = 1
      ORDER BY u.Username ASC
    `;
    const result = await db.query(sqlQuery);
    return result.recordset;
  }
}

module.exports = new UserRepository();
