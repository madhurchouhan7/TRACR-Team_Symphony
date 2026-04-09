const Transaction = require("../models/Transaction");

class GraphManager {
    constructor({ transactionModel = Transaction, thresholdConfig = null, logger = console } = {}) {
        this.transactionModel = transactionModel;
        this.thresholdConfig = thresholdConfig;
        this.logger = logger;

        this.adjacency = new Map();
        this.reverseAdjacency = new Map();
        this.nodeMeta = new Map();
    }

    async bootstrap(lastNHours) {
        const windowHours = Number.isFinite(lastNHours)
            ? lastNHours
            : this.#getConfigNumber("cycle_time_window_hours", 72);

        const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

        const transactions = await this.transactionModel
            .find({ timestamp: { $gte: since } })
            .sort({ timestamp: 1 })
            .lean();

        for (const tx of transactions) {
            this.addEdge(
                tx.sender_account_id,
                tx.receiver_account_id,
                tx.amount_usd,
                tx.timestamp,
                tx.transaction_id,
                {
                    geolocation: tx.geolocation,
                    transaction_type: tx.transaction_type,
                    channel: tx.channel,
                }
            );
        }

        this.logger.info("graph_bootstrap_complete", {
            loaded_transactions: transactions.length,
            window_hours: windowHours,
            node_count: this.nodeMeta.size,
        });
    }

    addEdge(from, to, amount, timestamp, txId, extra = {}) {
        const edge = {
            from,
            to,
            amount: Number(amount),
            timestamp: new Date(timestamp),
            txId,
            ...extra,
        };

        this.#ensureNode(from);
        this.#ensureNode(to);

        if (!this.adjacency.has(from)) {
            this.adjacency.set(from, new Map());
        }
        if (!this.reverseAdjacency.has(to)) {
            this.reverseAdjacency.set(to, new Map());
        }

        const fromNeighbors = this.adjacency.get(from);
        const toSources = this.reverseAdjacency.get(to);

        if (!fromNeighbors.has(to)) {
            fromNeighbors.set(to, []);
        }
        if (!toSources.has(from)) {
            toSources.set(from, []);
        }

        fromNeighbors.get(to).push(edge);
        toSources.get(from).push(edge);

        this.#updateNodeMetaForEdge(edge);
        return edge;
    }

    getNeighbors(nodeId) {
        const neighbors = this.adjacency.get(nodeId);
        if (!neighbors) {
            return [];
        }

        return Array.from(neighbors.entries()).map(([neighborId, edges]) => ({
            neighborId,
            edges: [...edges],
        }));
    }

    getSubgraph(nodeId, depth = 2) {
        const maxDepth = Math.max(0, Number(depth) || 0);
        const visited = new Set([nodeId]);
        const queue = [{ nodeId, level: 0 }];
        const nodes = new Set([nodeId]);
        const edgeMap = new Map();

        while (queue.length > 0) {
            const current = queue.shift();
            if (current.level >= maxDepth) {
                continue;
            }

            const outgoing = this.adjacency.get(current.nodeId) || new Map();
            const incoming = this.reverseAdjacency.get(current.nodeId) || new Map();

            for (const [neighborId, edges] of outgoing.entries()) {
                nodes.add(neighborId);
                for (const edge of edges) {
                    edgeMap.set(edge.txId, edge);
                }
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push({ nodeId: neighborId, level: current.level + 1 });
                }
            }

            for (const [neighborId, edges] of incoming.entries()) {
                nodes.add(neighborId);
                for (const edge of edges) {
                    edgeMap.set(edge.txId, edge);
                }
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push({ nodeId: neighborId, level: current.level + 1 });
                }
            }
        }

        return {
            nodes: Array.from(nodes).map((id) => ({
                nodeId: id,
                metadata: this.getNodeMeta(id),
            })),
            edges: Array.from(edgeMap.values()),
        };
    }

    getEdge(from, to) {
        const neighbors = this.adjacency.get(from);
        if (!neighbors || !neighbors.has(to)) {
            return [];
        }

        return [...neighbors.get(to)];
    }

    getNodeMeta(nodeId) {
        const meta = this.nodeMeta.get(nodeId);
        if (!meta) {
            return null;
        }

        return {
            total_inbound_usd: meta.total_inbound_usd,
            total_outbound_usd: meta.total_outbound_usd,
            transaction_count: meta.transaction_count,
            first_seen: meta.first_seen,
            last_seen: meta.last_seen,
        };
    }

    pruneOldEdges() {
        const windowHours = this.#getConfigNumber("cycle_time_window_hours", 72);
        const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);

        for (const [from, neighbors] of this.adjacency.entries()) {
            for (const [to, edges] of neighbors.entries()) {
                const kept = edges.filter((edge) => new Date(edge.timestamp) >= cutoff);
                if (kept.length === 0) {
                    neighbors.delete(to);
                } else {
                    neighbors.set(to, kept);
                }
            }

            if (neighbors.size === 0) {
                this.adjacency.delete(from);
            }
        }

        for (const [to, sources] of this.reverseAdjacency.entries()) {
            for (const [from, edges] of sources.entries()) {
                const kept = edges.filter((edge) => new Date(edge.timestamp) >= cutoff);
                if (kept.length === 0) {
                    sources.delete(from);
                } else {
                    sources.set(from, kept);
                }
            }

            if (sources.size === 0) {
                this.reverseAdjacency.delete(to);
            }
        }

        this.#rebuildNodeMeta();
        this.logger.info("graph_pruned", {
            cutoff: cutoff.toISOString(),
            node_count: this.nodeMeta.size,
        });
    }

    #ensureNode(nodeId) {
        if (!this.nodeMeta.has(nodeId)) {
            this.nodeMeta.set(nodeId, {
                total_inbound_usd: 0,
                total_outbound_usd: 0,
                transaction_count: 0,
                first_seen: null,
                last_seen: null,
            });
        }
    }

    #updateNodeMetaForEdge(edge) {
        const sender = this.nodeMeta.get(edge.from);
        const receiver = this.nodeMeta.get(edge.to);
        const ts = new Date(edge.timestamp);

        sender.total_outbound_usd += edge.amount;
        receiver.total_inbound_usd += edge.amount;

        sender.transaction_count += 1;
        receiver.transaction_count += 1;

        sender.first_seen = this.#minDate(sender.first_seen, ts);
        receiver.first_seen = this.#minDate(receiver.first_seen, ts);

        sender.last_seen = this.#maxDate(sender.last_seen, ts);
        receiver.last_seen = this.#maxDate(receiver.last_seen, ts);
    }

    #rebuildNodeMeta() {
        const allEdges = [];
        for (const neighbors of this.adjacency.values()) {
            for (const edges of neighbors.values()) {
                for (const edge of edges) {
                    allEdges.push(edge);
                }
            }
        }

        const nodeIds = new Set();
        for (const edge of allEdges) {
            nodeIds.add(edge.from);
            nodeIds.add(edge.to);
        }

        this.nodeMeta.clear();
        for (const nodeId of nodeIds) {
            this.#ensureNode(nodeId);
        }

        for (const edge of allEdges) {
            this.#updateNodeMetaForEdge(edge);
        }
    }

    #minDate(existing, incoming) {
        if (!existing) {
            return incoming;
        }
        return incoming < existing ? incoming : existing;
    }

    #maxDate(existing, incoming) {
        if (!existing) {
            return incoming;
        }
        return incoming > existing ? incoming : existing;
    }

    #getConfigNumber(key, fallbackValue) {
        if (!this.thresholdConfig || typeof this.thresholdConfig.get !== "function") {
            return fallbackValue;
        }

        const value = Number(this.thresholdConfig.get(key));
        return Number.isFinite(value) ? value : fallbackValue;
    }
}

module.exports = GraphManager;
