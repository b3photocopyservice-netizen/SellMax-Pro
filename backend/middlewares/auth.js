const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'sellmax_secret_key_12345';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
    }
    
    req.user = user;
    next();
  });
}

function checkPermission(permissionName) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { permissions } = req.user;
    
    // Super Admins bypass all permission checks
    if (req.user.roleName === 'Super Admin') {
      return next();
    }

    if (!permissions || !permissions.includes(permissionName)) {
      return res.status(403).json({ 
        error: `Permission Denied: You do not have the required permission (${permissionName}) to perform this action.` 
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  checkPermission
};
