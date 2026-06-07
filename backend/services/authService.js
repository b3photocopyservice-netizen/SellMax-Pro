const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');

const JWT_SECRET = process.env.JWT_SECRET || 'sellmax_secret_key_12345';
const TOKEN_EXPIRY = '12h';

class AuthService {
  async login(username, password, ipAddress, userAgent) {
    const user = await userRepository.getByUsername(username);

    if (!user) {
      throw new Error('Invalid username or password.');
    }

    if (!user.IsActive) {
      if (user.UserID) {
        await userRepository.logLoginHistory(user.UserID, ipAddress, userAgent, 'Failed (Inactive)');
      }
      throw new Error('Account is deactivated. Contact administrator.');
    }

    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      await userRepository.logLoginHistory(user.UserID, ipAddress, userAgent, 'Failed (Password)');
      throw new Error('Invalid username or password.');
    }

    // Login successful
    await userRepository.logLoginHistory(user.UserID, ipAddress, userAgent, 'Success');

    // Fetch user permissions
    const permissions = await userRepository.getUserPermissions(user.UserID);

    // Generate JWT
    const payload = {
      userId: user.UserID,
      username: user.Username,
      email: user.Email,
      roleId: user.RoleID,
      roleName: user.RoleName,
      companyId: user.CompanyID,
      companyName: user.CompanyName,
      permissions: permissions
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    return {
      token,
      user: {
        userId: user.UserID,
        username: user.Username,
        email: user.Email,
        roleId: user.RoleID,
        roleName: user.RoleName,
        companyId: user.CompanyID,
        companyName: user.CompanyName,
        permissions: permissions
      }
    };
  }

  async createUser(userData, companyId) {
    // Check if user already exists
    const existing = await userRepository.getByUsername(userData.username);
    if (existing) {
      throw new Error('Username already exists.');
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userData.password, salt);

    let pinHash = null;
    if (userData.pin) {
      pinHash = await bcrypt.hash(userData.pin.toString(), salt);
    }

    const createdUser = await userRepository.create({
      username: userData.username,
      email: userData.email,
      roleId: userData.roleId,
      passwordHash: passwordHash,
      pinHash: pinHash,
      isActive: userData.isActive
    }, companyId);

    return createdUser;
  }

  async resetPassword(userId, newPassword, companyId) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    return await userRepository.resetPassword(userId, passwordHash, companyId);
  }

  async getUsers(companyId) {
    return await userRepository.getUsers(companyId);
  }

  async updateUser(id, userData, companyId) {
    return await userRepository.update(id, userData, companyId);
  }

  async getRoles() {
    return await userRepository.getRoles();
  }

  async getPermissionMatrix() {
    return await userRepository.getPermissionMatrix();
  }

  async updatePermissionMatrix(roleId, permissionIds) {
    return await userRepository.updatePermissionMatrix(roleId, permissionIds);
  }

  async getLoginHistory(companyId) {
    return await userRepository.getLoginHistory(companyId);
  }

  async pinLogin(username, pin, ipAddress, userAgent) {
    const user = await userRepository.getByUsername(username);

    if (!user) {
      throw new Error('Invalid username or PIN.');
    }

    if (!user.IsActive) {
      if (user.UserID) {
        await userRepository.logLoginHistory(user.UserID, ipAddress, userAgent, 'Failed (Inactive)');
      }
      throw new Error('Account is deactivated. Contact administrator.');
    }

    if (!user.PINHash) {
      await userRepository.logLoginHistory(user.UserID, ipAddress, userAgent, 'Failed (No PIN Set)');
      throw new Error('PIN login not set up for this user. Use credentials.');
    }

    const isMatch = await bcrypt.compare(pin.toString(), user.PINHash);
    if (!isMatch) {
      await userRepository.logLoginHistory(user.UserID, ipAddress, userAgent, 'Failed (PIN)');
      throw new Error('Invalid username or PIN.');
    }

    // Login successful
    await userRepository.logLoginHistory(user.UserID, ipAddress, userAgent, 'Success (PIN)');

    // Fetch user permissions
    const permissions = await userRepository.getUserPermissions(user.UserID);

    // Generate JWT
    const payload = {
      userId: user.UserID,
      username: user.Username,
      email: user.Email,
      roleId: user.RoleID,
      roleName: user.RoleName,
      companyId: user.CompanyID,
      companyName: user.CompanyName,
      permissions: permissions
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    return {
      token,
      user: {
        userId: user.UserID,
        username: user.Username,
        email: user.Email,
        roleId: user.RoleID,
        roleName: user.RoleName,
        companyId: user.CompanyID,
        companyName: user.CompanyName,
        permissions: permissions
      }
    };
  }

  async resetPin(userId, newPin, companyId) {
    const salt = await bcrypt.genSalt(10);
    const pinHash = newPin ? await bcrypt.hash(newPin.toString(), salt) : null;
    return await userRepository.resetPin(userId, pinHash, companyId);
  }

  async getActiveUsersForPin() {
    return await userRepository.getActiveUsersForPin();
  }
}

module.exports = new AuthService();
