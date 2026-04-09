function requireRole(...roles) {
    return function rbacMiddlewareFactory({ auditLogger = null, logger = console } = {}) {
        return async function rbacMiddleware(req, res, next) {
            const userRole = req.user?.role;

            if (roles.includes(userRole)) {
                return next();
            }

            if (auditLogger && typeof auditLogger.log === "function") {
                await auditLogger.log({
                    userId: req.user?.user_id || "UNKNOWN",
                    userRole: userRole || "UNKNOWN",
                    actionType: "AUTH_FAIL",
                    resourceType: "RBAC",
                    resourceId: req.originalUrl || "UNKNOWN",
                    outcome: "FAILURE",
                    metadata: {
                        attempted_roles: roles,
                        method: req.method,
                    },
                    ipAddress: req.ip,
                });
            }

            logger.warn("rbac_denied", {
                user_id: req.user?.user_id,
                role: userRole,
                required_roles: roles,
            });

            return res.status(403).json({ error: "forbidden" });
        };
    };
}

module.exports = {
    requireRole,
};
