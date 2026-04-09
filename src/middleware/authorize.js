/**
 * Role-based authorization middleware.
 * Usage: authorize('admin', 'staff') — allows any of the listed roles.
 * Must be used AFTER verifyToken (which attaches req.user).
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: insufficient permissions',
        required: allowedRoles,
        got: req.user.role
      });
    }

    next();
  };
}

module.exports = authorize;
