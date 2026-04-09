const express = require("express");
const Alert = require("../models/Alert");

function createAlertRoutes({
    jwtMiddleware,
    sarService,
    auditLogger = null,
    alertModel = Alert,
} = {}) {
    const router = express.Router();

    router.get("/", jwtMiddleware, async (req, res) => {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

        const query = {};
        if (req.query.risk_tier) query.risk_tier = req.query.risk_tier;
        if (req.query.pattern_type) query.pattern_type = req.query.pattern_type;
        if (req.query.subject_account_id) query.subject_account_id = req.query.subject_account_id;

        if (req.query.start_date || req.query.end_date) {
            query.created_at = {};
            if (req.query.start_date) query.created_at.$gte = new Date(req.query.start_date);
            if (req.query.end_date) query.created_at.$lte = new Date(req.query.end_date);
        }

        const [items, total] = await Promise.all([
            alertModel
                .find(query)
                .sort({ risk_score: -1, created_at: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            alertModel.countDocuments(query),
        ]);

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "ALERT_VIEW",
                resourceType: "ALERT",
                resourceId: "LIST",
                outcome: "SUCCESS",
                ipAddress: req.ip,
            });
        }

        return res.json({ page, limit, total, items });
    });

    router.get("/:id", jwtMiddleware, async (req, res) => {
        const alert = await alertModel.findOne({ alert_id: req.params.id }).lean();
        if (!alert) {
            return res.status(404).json({ error: "not_found" });
        }

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "ALERT_VIEW",
                resourceType: "ALERT",
                resourceId: req.params.id,
                outcome: "SUCCESS",
                ipAddress: req.ip,
            });
        }

        return res.json(alert);
    });

    router.post("/:id/sar", jwtMiddleware, async (req, res) => {
        const alert = await alertModel.findOne({ alert_id: req.params.id }).lean();
        if (!alert) {
            return res.status(404).json({ error: "not_found" });
        }

        const sarDraft = await sarService.generateSAR({
            alert,
            account: req.body?.account || null,
            generatedBy: req.user.user_id,
            caseId: req.body?.case_id || null,
        });

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "SAR_GENERATE",
                resourceType: "ALERT",
                resourceId: req.params.id,
                outcome: "SUCCESS",
                metadata: { sar_id: sarDraft.sar_id },
                ipAddress: req.ip,
            });
        }

        return res.status(202).json({ sar_id: sarDraft.sar_id, is_partial: sarDraft.is_partial });
    });

    return router;
}

module.exports = createAlertRoutes;
