const express = require("express");
const SystemConfig = require("../models/SystemConfig");
const AuditLog = require("../models/AuditLog");
const { requireRole } = require("../auth/RBACMiddleware");

function createAdminRoutes({
    jwtMiddleware,
    auditLogger = null,
    thresholdConfig,
    systemConfigModel = SystemConfig,
    auditLogModel = AuditLog,
} = {}) {
    const router = express.Router();

    const adminOnly = requireRole("ADMIN")({ auditLogger });

    router.use(jwtMiddleware, adminOnly);

    router.get("/config", async (req, res) => {
        const configs = await systemConfigModel.find({}).lean();
        return res.json(configs);
    });

    router.put("/config", async (req, res) => {
        const updates = Array.isArray(req.body) ? req.body : [];

        for (const update of updates) {
            const existing = await systemConfigModel.findOne({ config_key: update.config_key });
            if (!existing) {
                return res.status(404).json({ error: `config_not_found:${update.config_key}` });
            }

            const range = existing.valid_range || {};
            if (Number.isFinite(range.min) && update.value < range.min) {
                return res.status(400).json({ error: `value_below_min:${update.config_key}` });
            }
            if (Number.isFinite(range.max) && update.value > range.max) {
                return res.status(400).json({ error: `value_above_max:${update.config_key}` });
            }

            const previous = existing.value;
            existing.value = update.value;
            existing.updated_by = req.user.user_id;
            existing.updated_at = new Date();
            await existing.save();

            if (auditLogger) {
                await auditLogger.log({
                    userId: req.user.user_id,
                    userRole: req.user.role,
                    actionType: "THRESHOLD_CHANGE",
                    resourceType: "SYSTEM_CONFIG",
                    resourceId: existing.config_key,
                    outcome: "SUCCESS",
                    metadata: { previous, next: update.value },
                    ipAddress: req.ip,
                });
            }
        }

        await thresholdConfig.reload();
        return res.json({ ok: true });
    });

    router.get("/audit", async (req, res) => {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

        const query = {};
        if (req.query.start_date || req.query.end_date) {
            query.action_timestamp = {};
            if (req.query.start_date) query.action_timestamp.$gte = new Date(req.query.start_date);
            if (req.query.end_date) query.action_timestamp.$lte = new Date(req.query.end_date);
        }

        const [items, total] = await Promise.all([
            auditLogModel
                .find(query)
                .sort({ action_timestamp: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            auditLogModel.countDocuments(query),
        ]);

        return res.json({ page, limit, total, items });
    });

    return router;
}

module.exports = createAdminRoutes;
