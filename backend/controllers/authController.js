const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { authenticateToken, checkPermission } = require('../middlewares/auth');

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(username, password, ipAddress, userAgent);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/active-users
router.get('/active-users', async (req, res, next) => {
  try {
    const list = await authService.getActiveUsersForPin();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/pin-login
router.post('/pin-login', async (req, res, next) => {
  try {
    const { username, pin } = req.body;
    if (!username || !pin) {
      return res.status(400).json({ error: 'Username and PIN are required.' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.pinLogin(username, pin, ipAddress, userAgent);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-pin
router.post('/verify-pin', authenticateToken, async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required.' });
    }

    const result = await authService.verifyManagerPin(pin);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/profile
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, async (req, res, next) => {
  try {
    const username = req.user.username;
    const companyId = req.user.companyId;
    const result = await authService.updateSelfProfile(username, req.body, companyId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/list
router.get('/users', authenticateToken, checkPermission('MANAGE_USERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const users = await authService.getUsers(companyId);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// POST /api/users/create
router.post('/users', authenticateToken, checkPermission('MANAGE_USERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const created = await authService.createUser(req.body, companyId);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id
router.put('/users/:id', authenticateToken, checkPermission('MANAGE_USERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const updated = await authService.updateUser(req.params.id, req.body, companyId);
    if (!updated) return res.status(404).json({ error: 'User not found.' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/users/:id/reset-password
router.post('/users/:id/reset-password', authenticateToken, checkPermission('MANAGE_USERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { password } = req.body;
    if (!password || password.trim() === '') {
      return res.status(400).json({ error: 'New password is required.' });
    }

    const success = await authService.resetPassword(req.params.id, password, companyId);
    if (!success) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'Password reset successful.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/users/:id/reset-pin
router.post('/users/:id/reset-pin', authenticateToken, checkPermission('MANAGE_USERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { pin } = req.body;
    const success = await authService.resetPin(req.params.id, pin, companyId);
    if (!success) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'PIN reset successful.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/roles
router.get('/roles', authenticateToken, async (req, res, next) => {
  try {
    const roles = await authService.getRoles();
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

// GET /api/permission-matrix
router.get('/permission-matrix', authenticateToken, checkPermission('EDIT_PERMISSIONS'), async (req, res, next) => {
  try {
    const matrix = await authService.getPermissionMatrix();
    res.json(matrix);
  } catch (err) {
    next(err);
  }
});

// POST /api/permission-matrix/:roleId
router.post('/permission-matrix/:roleId', authenticateToken, checkPermission('EDIT_PERMISSIONS'), async (req, res, next) => {
  try {
    const { permissionIds } = req.body;
    await authService.updatePermissionMatrix(req.params.roleId, permissionIds);
    res.json({ message: 'Permission matrix updated successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/login-history
router.get('/login-history', authenticateToken, checkPermission('MANAGE_USERS'), async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const history = await authService.getLoginHistory(companyId);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
