const express = require("express");
const Account = require("../models/Account");

function createGraphRoutes({ jwtMiddleware, graphManager, accountModel = Account } = {}) {
    const router = express.Router();

    router.get("/graph/subgraph/:accountId", jwtMiddleware, async (req, res) => {
        const depth = Math.min(4, Math.max(1, Number(req.query.depth || 2)));
        const subgraph = graphManager.getSubgraph(req.params.accountId, depth);
        return res.json(subgraph);
    });

    router.get("/accounts/:id/baseline", jwtMiddleware, async (req, res) => {
        const account = await accountModel.findOne({ account_id: req.params.id }).lean();
        if (!account) {
            return res.status(404).json({ error: "not_found" });
        }
        return res.json(account.baseline || {});
    });

    return router;
}

module.exports = createGraphRoutes;
