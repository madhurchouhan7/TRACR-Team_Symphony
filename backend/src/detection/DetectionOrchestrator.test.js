const DetectionOrchestrator = require("./DetectionOrchestrator");

describe("DetectionOrchestrator", () => {
    test("runs detectors in parallel and aggregates signals", async () => {
        const delays = [];
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        let edgeAdded = false;
        const graphManager = {
            addEdge: jest.fn(() => {
                edgeAdded = true;
            }),
        };

        const cycleDetector = {
            detectCycles: jest.fn(async () => {
                delays.push({ name: "cycle", sawEdge: edgeAdded, at: Date.now() });
                await sleep(60);
                return [{ cycle_score: 80, involved_accounts: ["A", "B"], transaction_sequence: [] }];
            }),
        };

        const smurfingDetector = {
            evaluateSmurfing: jest.fn(async () => {
                delays.push({ name: "smurfing", sawEdge: edgeAdded, at: Date.now() });
                await sleep(60);
                return { smurfing_score: 70 };
            }),
        };

        const behavioralProfiler = {
            scoreAnomaly: jest.fn(async () => {
                delays.push({ name: "behavioral", sawEdge: edgeAdded, at: Date.now() });
                await sleep(60);
                return { anomalies: [{ anomalyType: "FREQUENCY_SPIKE" }] };
            }),
        };

        const accountModel = {
            findOne: () => ({ lean: async () => ({ account_id: "A", baseline: {} }) }),
        };

        const orchestrator = new DetectionOrchestrator({
            graphManager,
            cycleDetector,
            smurfingDetector,
            behavioralProfiler,
            accountModel,
            logger: { info: jest.fn() },
        });

        const tx = {
            transaction_id: "tx-1",
            sender_account_id: "A",
            receiver_account_id: "B",
            amount_usd: 1234,
            timestamp: new Date().toISOString(),
            geolocation: { sender_country: "US", receiver_country: "GB" },
            transaction_type: "WIRE",
            channel: "ONLINE",
        };

        const start = Date.now();
        const result = await orchestrator.analyze(tx);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(150);
        expect(graphManager.addEdge).toHaveBeenCalled();
        expect(delays.every((entry) => entry.sawEdge)).toBe(true);

        expect(result.transaction_id).toBe("tx-1");
        expect(result.cycle_signals).toHaveLength(1);
        expect(result.smurfing_signal.smurfing_score).toBe(70);
        expect(result.behavioral_signal.anomalies).toHaveLength(1);
    });
});
