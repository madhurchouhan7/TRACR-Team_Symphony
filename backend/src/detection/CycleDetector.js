const DEFAULT_MAX_LENGTH = 6;
const DEFAULT_WINDOW_HOURS = 72;
const DEFAULT_RELAXED_WINDOW_HOURS = 336;
const DEFAULT_DETECTION_TIME_BUDGET_MS = 1500;

const DEFAULT_FATF_HIGH_RISK_JURISDICTIONS = [
    "IR",
    "KP",
    "MM",
];

class CycleDetector {
    constructor({ thresholdConfig = null, logger = console, fatfJurisdictions = null } = {}) {
        this.thresholdConfig = thresholdConfig;
        this.logger = logger;
        this.fatfJurisdictions = new Set(
            (fatfJurisdictions || this.#getConfigValue("fatf_high_risk_jurisdictions") || DEFAULT_FATF_HIGH_RISK_JURISDICTIONS).map(
                (code) => String(code).toUpperCase()
            )
        );
    }

    detectCycles(graph, newEdge, maxLength = DEFAULT_MAX_LENGTH, timeWindowHours = DEFAULT_WINDOW_HOURS) {
        const startTime = Date.now();
        const maxMs = this.#resolveTimeBudget(maxLength);

        const resolvedMaxLength = Math.max(2, Number(maxLength) || DEFAULT_MAX_LENGTH);
        const resolvedWindowHours = Math.max(1, Number(timeWindowHours) || DEFAULT_WINDOW_HOURS);
        const relaxedWindowHours = Math.max(
            resolvedWindowHours,
            this.#getConfigNumber("cycle_relaxed_time_window_hours", Math.max(DEFAULT_RELAXED_WINDOW_HOURS, resolvedWindowHours * 2))
        );

        const source = newEdge.from;
        const target = newEdge.to;
        const seedEdge = {
            ...newEdge,
            timestamp: new Date(newEdge.timestamp),
        };

        const stack = [
            {
                currentNode: target,
                pathNodes: [source, target],
                pathEdges: [],
            },
        ];

        const cycles = [];
        const cycleKeys = new Set();
        let timedOut = false;

        while (stack.length > 0) {
            if (Date.now() - startTime > maxMs) {
                timedOut = true;
                this.logger.warn("cycle_detection_timeout", {
                    txId: newEdge.txId,
                    elapsed_ms: Date.now() - startTime,
                    max_ms: maxMs,
                });
                break;
            }

            const state = stack.pop();
            const depth = state.pathEdges.length + 1;
            if (depth >= resolvedMaxLength) {
                continue;
            }

            const neighbors = graph.getNeighbors(state.currentNode);
            for (const neighbor of neighbors) {
                for (const edge of neighbor.edges) {
                    const edgeTimestamp = new Date(edge.timestamp);

                    if (neighbor.neighborId === source) {
                        const cycleEdges = [
                            seedEdge,
                            ...state.pathEdges,
                            {
                                ...edge,
                                timestamp: edgeTimestamp,
                            },
                        ];

                        const inStrictWindow = this.allWithinTimeWindow(cycleEdges, resolvedWindowHours);
                        const inRelaxedWindow = !inStrictWindow && this.allWithinTimeWindow(cycleEdges, relaxedWindowHours);

                        if (!(inStrictWindow || inRelaxedWindow)) {
                            continue;
                        }

                        const accountIds = this.#extractAccountIds(cycleEdges);
                        const fatfFlag = this.anyFATFJurisdiction(accountIds, graph, cycleEdges);
                        const baseScore = this.computeCycleScore(cycleEdges, fatfFlag);
                        const isRelaxed = !inStrictWindow;
                        const score = isRelaxed ? Math.max(15, baseScore * 0.65) : baseScore;

                        const cycleKey = cycleEdges
                            .map((cEdge) => `${cEdge.from}->${cEdge.to}:${cEdge.txId || "NO_TX"}`)
                            .join("|");
                        if (cycleKeys.has(cycleKey)) {
                            continue;
                        }
                        cycleKeys.add(cycleKey);

                        cycles.push({
                            pattern_type: "CIRCULAR_TRADING",
                            involved_accounts: accountIds,
                            transaction_sequence: cycleEdges.map((cEdge) => ({
                                from: cEdge.from,
                                to: cEdge.to,
                                amount: cEdge.amount,
                                timestamp: new Date(cEdge.timestamp).toISOString(),
                                txId: cEdge.txId,
                            })),
                            cycle_length: cycleEdges.length,
                            cycle_score: score,
                            fatf_flag: fatfFlag,
                            window_type: isRelaxed ? "RELAXED" : "STRICT",
                            relaxed_window_used: isRelaxed,
                            detected_at: new Date().toISOString(),
                        });
                        continue;
                    }

                    if (state.pathNodes.includes(neighbor.neighborId)) {
                        continue;
                    }

                    stack.push({
                        currentNode: neighbor.neighborId,
                        pathNodes: [...state.pathNodes, neighbor.neighborId],
                        pathEdges: [
                            ...state.pathEdges,
                            {
                                ...edge,
                                timestamp: edgeTimestamp,
                            },
                        ],
                    });
                }
            }
        }

        if (timedOut) {
            for (const cycle of cycles) {
                cycle.incomplete_search = true;
            }
        }

        cycles.sort((a, b) => Number(b.cycle_score || 0) - Number(a.cycle_score || 0));

        return cycles;
    }

    allWithinTimeWindow(edges, windowHours) {
        if (!edges || edges.length === 0) {
            return false;
        }

        const timestamps = edges.map((edge) => new Date(edge.timestamp).getTime());
        const minTs = Math.min(...timestamps);
        const maxTs = Math.max(...timestamps);
        const windowMs = Number(windowHours) * 60 * 60 * 1000;

        return maxTs - minTs <= windowMs;
    }

    computeCycleScore(cycleEdges, fatfFlag = false) {
        const length = cycleEdges.length;
        const totalValue = cycleEdges.reduce((sum, edge) => sum + Number(edge.amount || 0), 0);

        const timestamps = cycleEdges.map((edge) => new Date(edge.timestamp).getTime()).sort((a, b) => a - b);
        const durationMs = Math.max(1, timestamps[timestamps.length - 1] - timestamps[0]);
        const minPossibleMs = Math.max(1, (length - 1) * 1000);
        const timeCompressionRatio = durationMs / minPossibleMs;

        const lengthScore = Math.max(0, Math.min(40, (7 - length) * 8));
        const valueScore = Math.max(0, Math.min(30, totalValue / 10000));
        const compressionScore = Math.max(0, Math.min(10, 10 / timeCompressionRatio));
        const fatfBonus = fatfFlag ? 20 : 0;

        return Math.min(100, lengthScore + valueScore + compressionScore + fatfBonus);
    }

    anyFATFJurisdiction(accountIds, graph, cycleEdges = []) {
        const countries = new Set();

        for (const edge of cycleEdges) {
            if (edge.geolocation?.sender_country) {
                countries.add(String(edge.geolocation.sender_country).toUpperCase());
            }
            if (edge.geolocation?.receiver_country) {
                countries.add(String(edge.geolocation.receiver_country).toUpperCase());
            }
        }

        for (const accountId of accountIds) {
            const neighbors = graph.getNeighbors(accountId);
            for (const neighbor of neighbors) {
                for (const edge of neighbor.edges) {
                    if (edge.geolocation?.sender_country) {
                        countries.add(String(edge.geolocation.sender_country).toUpperCase());
                    }
                    if (edge.geolocation?.receiver_country) {
                        countries.add(String(edge.geolocation.receiver_country).toUpperCase());
                    }
                }
            }
        }

        for (const country of countries) {
            if (this.fatfJurisdictions.has(country)) {
                return true;
            }
        }

        return false;
    }

    #extractAccountIds(cycleEdges) {
        const ids = new Set();
        for (const edge of cycleEdges) {
            ids.add(edge.from);
            ids.add(edge.to);
        }
        return Array.from(ids);
    }

    #getConfigValue(key) {
        if (!this.thresholdConfig || typeof this.thresholdConfig.get !== "function") {
            return null;
        }
        return this.thresholdConfig.get(key);
    }

    #getConfigNumber(key, fallback) {
        const configured = this.#getConfigValue(key);
        if (configured === null || configured === undefined || configured === "") {
            return fallback;
        }

        const value = Number(configured);
        return Number.isFinite(value) ? value : fallback;
    }

    #resolveTimeBudget(maxLength) {
        const configured = this.#getConfigNumber("cycle_detection_time_budget_ms", DEFAULT_DETECTION_TIME_BUDGET_MS);
        const adaptiveBonus = Math.max(0, (Number(maxLength) || DEFAULT_MAX_LENGTH) - DEFAULT_MAX_LENGTH) * 120;
        return Math.max(250, configured + adaptiveBonus);
    }
}

module.exports = CycleDetector;
