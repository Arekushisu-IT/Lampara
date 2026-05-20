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
      const response = { error: 'Forbidden: insufficient permissions' };

      // Only include debug info in non-production environments
      if (process.env.NODE_ENV !== 'production') {
        response.required = allowedRoles;
        response.got = req.user.role;
      }

      return res.status(403).json(response);
    }

    next();
  };
}

module.exports = authorize;
