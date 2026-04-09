const { EventEmitter } = require("events");
const createTransactionRoutes = require("../routes/transactions");
const TransactionValidator = require("../ingestion/TransactionValidator");
const TransactionNormalizer = require("../ingestion/TransactionNormalizer");
const TransactionRepository = require("../ingestion/TransactionRepository");
const GraphManager = require("../detection/GraphManager");
const CycleDetector = require("../detection/CycleDetector");
const { SmurfingDetector } = require("../detection/SmurfingDetector");
const DetectionOrchestrator = require("../detection/DetectionOrchestrator");
const RiskScorer = require("../scoring/RiskScorer");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");
const { makeValidTransaction } = require("../testUtils/factories");

describe("Integration: ingestion to alert pipeline", () => {
    test("known smurfing sequence persists alert with score breakdown and emits alert:new", async () => {
        const emitter = new EventEmitter();
        const storedTransactions = [];
        const storedAlerts = [];
        const emittedAlerts = [];

        emitter.on("alert:new", (payload) => emittedAlerts.push(payload));

        const transactionModel = {
            create: async (doc) => {
                storedTransactions.push(doc);
                return { ...doc, toObject: () => doc };
            },
            findOne: () => ({ lean: async () => null }),
        };

        const alertModel = {
            create: async (doc) => {
                const persisted = {
                    alert_id: crypto.randomUUID(),
                    created_at: new Date(),
                    ...doc,
                };
                storedAlerts.push(persisted);
                return { ...persisted, toObject: () => persisted };
            },
        };

        const thresholdConfig = {
            get: (key, fallback = null) => ({
                ctr_threshold: 10000,
                rolling_window_hours: 24,
                cycle_max_length: 6,
                cycle_time_window_hours: 72,
                score_weight_cycle: 0.35,
                score_weight_smurfing: 0.3,
                score_weight_behavioral: 0.2,
                score_weight_geo: 0.15,
            }[key] ?? fallback),
        };

        const validator = new TransactionValidator({ error: jest.fn() });
        const normalizer = new TransactionNormalizer({ warn: jest.fn() });
        const repository = new TransactionRepository({ model: transactionModel, emitter, logger: { warn: jest.fn() } });

        const graphManager = new GraphManager({ thresholdConfig, logger: { info: jest.fn() } });
        const cycleDetector = new CycleDetector({ thresholdConfig, logger: { warn: jest.fn() } });
        const smurfingDetector = new SmurfingDetector({ thresholdConfig, logger: { warn: jest.fn() } });

        const behavioralProfiler = {
            scoreAnomaly: async () => null,
        };

        const accountModel = {
            findOne: () => ({ lean: async () => ({ account_id: "S-1", baseline: { history_days: 0 } }) }),
        };

        const riskScorer = new RiskScorer({
            alertModel,
            thresholdConfig,
            emitter,
            geoRiskEvaluator: { score: () => 0 },
        });

        const orchestrator = new DetectionOrchestrator({
            graphManager,
            cycleDetector,
            smurfingDetector,
            behavioralProfiler,
            riskScorer,
            emitter,
            accountModel,
            thresholdConfig,
            logger: { info: jest.fn() },
        });

        orchestrator.start();

        const router = createTransactionRoutes({
            validator,
            normalizer,
            repository,
            thresholdConfig,
        });

        const app = createAppWithJson(router, "/api/transactions");
        const server = await startServer(app);

        try {
            const sender = "S-1";
            const txSet = [
                makeValidTransaction({ sender_account_id: sender, receiver_account_id: "R-1", amount: 4000, currency: "USD" }),
                makeValidTransaction({ sender_account_id: sender, receiver_account_id: "R-2", amount: 4000, currency: "USD" }),
                makeValidTransaction({ sender_account_id: sender, receiver_account_id: "R-3", amount: 4000, currency: "USD" }),
            ];

            for (const tx of txSet) {
                const response = await jsonRequest(server.baseUrl, "/api/transactions/ingest", {
                    method: "POST",
                    body: tx,
                });
                expect(response.status).toBe(202);
            }

            const waitUntil = async (predicate, timeoutMs = 2000) => {
                const deadline = Date.now() + timeoutMs;
                while (Date.now() < deadline) {
                    if (predicate()) return;
                    await new Promise((resolve) => setTimeout(resolve, 20));
                }
                throw new Error("condition_not_met_in_time");
            };

            await waitUntil(() => storedAlerts.length >= 3);

            const smurfingAlert = storedAlerts.find((alert) => alert.pattern_type === "SMURFING");
            expect(smurfingAlert).toBeTruthy();
            expect(smurfingAlert.score_breakdown).toEqual(
                expect.objectContaining({
                    cycle_score: expect.any(Number),
                    smurfing_score: expect.any(Number),
                    behavioral_score: expect.any(Number),
                    geographic_score: expect.any(Number),
                })
            );
            expect(["LOW", "MEDIUM", "HIGH"]).toContain(smurfingAlert.risk_tier);

            await waitUntil(() => emittedAlerts.length >= 1);
            const emitted = emittedAlerts.find((alert) => alert.pattern_type === "SMURFING") || emittedAlerts[0];
            expect(emitted).toBeTruthy();
            expect(emitted.transaction_ids).toEqual(expect.arrayContaining([txSet[2].transaction_id]));
        } finally {
            orchestrator.stop();
            await server.close();
        }
    });
});
