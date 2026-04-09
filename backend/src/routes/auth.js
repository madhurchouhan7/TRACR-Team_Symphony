const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function createAuthRoutes({ userModel = User, auditLogger = null, jwtSecret = process.env.JWT_SECRET } = {}) {
    const router = express.Router();

    router.post("/login", async (req, res) => {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ error: "missing_credentials" });
        }

        const user = await userModel.findOne({ username }).lean();
        if (!user) {
            if (auditLogger) {
                await auditLogger.log({
                    userId: username,
                    userRole: "UNKNOWN",
                    actionType: "AUTH_FAIL",
                    resourceType: "AUTH",
                    resourceId: "login",
                    outcome: "FAILURE",
                    metadata: { reason: "user_not_found" },
                    ipAddress: req.ip,
                });
            }
            return res.status(401).json({ error: "unauthorized" });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            if (auditLogger) {
                await auditLogger.log({
                    userId: user.user_id,
                    userRole: user.role,
                    actionType: "AUTH_FAIL",
                    resourceType: "AUTH",
                    resourceId: "login",
                    outcome: "FAILURE",
                    metadata: { reason: "invalid_password" },
                    ipAddress: req.ip,
                });
            }
            return res.status(401).json({ error: "unauthorized" });
        }

        const token = jwt.sign(
            { user_id: user.user_id, role: user.role },
            jwtSecret,
            { algorithm: "HS256", expiresIn: "8h" }
        );

        if (auditLogger) {
            await auditLogger.log({
                userId: user.user_id,
                userRole: user.role,
                actionType: "AUTH_LOGIN",
                resourceType: "AUTH",
                resourceId: "login",
                outcome: "SUCCESS",
                ipAddress: req.ip,
            });
        }

        return res.json({ token, user: { user_id: user.user_id, role: user.role } });
    });

    router.post("/logout", async (req, res) => {
        if (auditLogger) {
            await auditLogger.log({
                userId: req.user?.user_id || "UNKNOWN",
                userRole: req.user?.role || "UNKNOWN",
                actionType: "AUTH_LOGOUT",
                resourceType: "AUTH",
                resourceId: "logout",
                outcome: "SUCCESS",
                ipAddress: req.ip,
            });
        }

        return res.status(200).json({ ok: true });
    });

    return router;
}

module.exports = createAuthRoutes;
