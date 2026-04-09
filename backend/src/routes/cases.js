const express = require("express");
const Case = require("../models/Case");

const ALLOWED_TRANSITIONS = {
    OPEN: ["UNDER_REVIEW"],
    UNDER_REVIEW: ["ESCALATED", "CLOSED_DISMISSED"],
    ESCALATED: ["CLOSED_SAR_FILED", "CLOSED_DISMISSED"],
    CLOSED_SAR_FILED: [],
    CLOSED_DISMISSED: [],
};

function createCaseRoutes({ jwtMiddleware, auditLogger = null, caseModel = Case } = {}) {
    const router = express.Router();

    router.post("/", jwtMiddleware, async (req, res) => {
        const { alert_id, subject_account_id, assigned_to } = req.body || {};
        if (!alert_id || !subject_account_id) {
            return res.status(400).json({ error: "missing_fields" });
        }

        const created = await caseModel.create({
            alert_id,
            subject_account_id,
            state: "OPEN",
            state_history: [
                {
                    from_state: null,
                    to_state: "OPEN",
                    reason_code: "INITIAL_CREATE",
                    changed_by: req.user.user_id,
                    changed_at: new Date(),
                },
            ],
            assigned_to: assigned_to || null,
        });

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "CASE_CREATE",
                resourceType: "CASE",
                resourceId: created.case_id,
                outcome: "SUCCESS",
                ipAddress: req.ip,
            });
        }

        return res.status(201).json(created);
    });

    router.get("/:id", jwtMiddleware, async (req, res) => {
        const c = await caseModel.findOne({ case_id: req.params.id }).lean();
        if (!c) {
            return res.status(404).json({ error: "not_found" });
        }
        return res.json(c);
    });

    router.patch("/:id/state", jwtMiddleware, async (req, res) => {
        const c = await caseModel.findOne({ case_id: req.params.id });
        if (!c) {
            return res.status(404).json({ error: "not_found" });
        }

        const { to_state, reason_code } = req.body || {};
        if (!to_state || !reason_code) {
            return res.status(400).json({ error: "missing_fields" });
        }

        const allowed = ALLOWED_TRANSITIONS[c.state] || [];
        if (!allowed.includes(to_state)) {
            return res.status(400).json({ error: "invalid_transition" });
        }

        if (to_state === "CLOSED_SAR_FILED" && !c.sar_draft_id) {
            return res.status(400).json({ error: "sar_required" });
        }

        const fromState = c.state;
        c.state = to_state;
        c.state_history.push({
            from_state: fromState,
            to_state,
            reason_code,
            changed_by: req.user.user_id,
            changed_at: new Date(),
        });

        await c.save();

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "CASE_TRANSITION",
                resourceType: "CASE",
                resourceId: c.case_id,
                outcome: "SUCCESS",
                metadata: { from_state: fromState, to_state },
                ipAddress: req.ip,
            });
        }

        return res.json(c);
    });

    router.post("/:id/notes", jwtMiddleware, async (req, res) => {
        const c = await caseModel.findOne({ case_id: req.params.id });
        if (!c) {
            return res.status(404).json({ error: "not_found" });
        }

        const note = req.body?.note;
        if (!note) {
            return res.status(400).json({ error: "missing_note" });
        }

        c.notes.push({
            author_user_id: req.user.user_id,
            note,
            timestamp: new Date(),
        });

        await c.save();

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "NOTE_ADD",
                resourceType: "CASE",
                resourceId: c.case_id,
                outcome: "SUCCESS",
                ipAddress: req.ip,
            });
        }

        return res.status(201).json(c.notes[c.notes.length - 1]);
    });

    return router;
}

module.exports = createCaseRoutes;
