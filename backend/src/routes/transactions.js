const express = require("express");
const Transaction = require("../models/Transaction");

function createTransactionRoutes({
    validator,
    normalizer,
    repository,
    thresholdConfig = null,
    jwtMiddleware = null,
    transactionModel = Transaction,
} = {}) {
    const router = express.Router();

    const ingestMiddlewares = jwtMiddleware ? [jwtMiddleware] : [];
    router.post("/ingest", ...ingestMiddlewares, async (req, res) => {
        const validation = validator.validate(req.body);
        if (!validation.valid) {
            return res.status(400).json({ error: "validation_failed", details: validation.errors });
        }

        const normalized = normalizer.normalize(req.body, thresholdConfig);
        const saved = await repository.save(normalized);
        return res.status(202).json({ transaction_id: saved.transaction_id });
    });

    if (jwtMiddleware) {
        router.get("/:id", jwtMiddleware, async (req, res) => {
            const tx = await transactionModel.findOne({ transaction_id: req.params.id }).lean();
            if (!tx) {
                return res.status(404).json({ error: "not_found" });
            }
            return res.json(tx);
        });
    }

    return router;
}

module.exports = createTransactionRoutes;
