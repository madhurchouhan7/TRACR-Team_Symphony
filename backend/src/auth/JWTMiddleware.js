const jwt = require("jsonwebtoken");

function JWTMiddleware({ jwtSecret = process.env.JWT_SECRET, logger = console } = {}) {
    return function jwtMiddleware(req, res, next) {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

        if (!token) {
            return res.status(401).json({ error: "unauthorized" });
        }

        try {
            const decoded = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
            req.user = {
                user_id: decoded.user_id,
                role: decoded.role,
            };
            return next();
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({ error: "token_expired" });
            }

            logger.warn("jwt_auth_failed", { reason: error.message });
            return res.status(401).json({ error: "unauthorized" });
        }
    };
}

module.exports = JWTMiddleware;
