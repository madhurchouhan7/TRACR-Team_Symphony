const fc = require("fast-check");
const { BehavioralProfiler } = require("./BehavioralProfiler");

// Feature: intelligent-aml-framework, Property 8: New Account Baseline Initialization
// Feature: intelligent-aml-framework, Property 14: High-Value New Counterparty Anomaly Detection
// Feature: intelligent-aml-framework, Property 15: Frequency Anomaly Detection at 3 Sigma

describe("BehavioralProfiler property tests", () => {
    test("initializeBaseline creates first-seen account with history_days = 0", async () => {
        await fc.assert(
            fc.asyncProperty(fc.string({ minLength: 1, maxLength: 10 }), async (accountId) => {
                const store = new Map();
                const accountModel = {
                    findOne: ({ account_id }) => ({
                        lean: async () => store.get(account_id) || null,
                    }),
                    create: async (doc) => {
                        store.set(doc.account_id, doc);
                        return doc;
                    },
                };

                const profiler = new BehavioralProfiler({
                    accountModel,
                    transactionModel: { countDocuments: async () => 0 },
                });

                const created = await profiler.initializeBaseline(accountId);
                expect(created).toBeTruthy();
                expect(created.baseline.history_days).toBe(0);
            }),
            { numRuns: 100 }
        );
    });

    test("high-value new counterparty anomaly requires both amount and novelty conditions", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 100, max: 10000 }),
                fc.boolean(),
                fc.boolean(),
                async (p90, amountAbove, newCounterparty) => {
                    const profiler = new BehavioralProfiler({
                        accountModel: {},
                        transactionModel: { countDocuments: async () => 1 },
                    });

                    const receiver = "ACC-R";
                    const account = {
                        baseline: {
                            history_days: 90,
                            amount_p90: p90,
                            known_counterparties: newCounterparty ? [] : [receiver],
                            daily_freq_mean: 10,
                            daily_freq_stddev: 2,
                        },
                    };

                    const tx = {
                        sender_account_id: "ACC-S",
                        receiver_account_id: receiver,
                        amount_usd: amountAbove ? p90 + 1 : Math.max(0, p90 - 1),
                        timestamp: new Date().toISOString(),
                    };

                    const signal = await profiler.scoreAnomaly(tx, account);
                    const expected = amountAbove && newCounterparty;

                    const hasHighValue = Boolean(signal?.anomalies?.find((a) => a.anomalyType === "HIGH_VALUE_NEW_COUNTERPARTY"));
                    expect(hasHighValue).toBe(expected);
                }
            ),
            { numRuns: 100 }
        );
    });

    test("immature baseline with missing amount percentile does not emit high-value anomaly by default", async () => {
        const profiler = new BehavioralProfiler({
            accountModel: {},
            transactionModel: { countDocuments: async () => 1 },
        });

        const account = {
            baseline: {
                history_days: 3,
                amount_p90: 0,
                amount_mean: 0,
                amount_stddev: 0,
                known_counterparties: [],
                daily_freq_mean: 10,
                daily_freq_stddev: 2,
            },
        };

        const tx = {
            sender_account_id: "ACC-S",
            receiver_account_id: "ACC-R",
            amount_usd: 999999,
            timestamp: new Date().toISOString(),
        };

        const signal = await profiler.scoreAnomaly(tx, account);
        const hasHighValue = Boolean(signal?.anomalies?.find((a) => a.anomalyType === "HIGH_VALUE_NEW_COUNTERPARTY"));
        expect(hasHighValue).toBe(false);
    });

    test("frequency anomaly appears iff observed count is greater than mean plus three stddev", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 50 }),
                fc.integer({ min: 1, max: 20 }),
                fc.integer({ min: 1, max: 10 }),
                async (count, mean, stddev) => {
                    const profiler = new BehavioralProfiler({
                        accountModel: {},
                        transactionModel: { countDocuments: async () => count },
                    });

                    const account = {
                        baseline: {
                            history_days: 120,
                            amount_p90: 1000000,
                            known_counterparties: ["ACC-R"],
                            daily_freq_mean: mean,
                            daily_freq_stddev: stddev,
                        },
                    };

                    const tx = {
                        sender_account_id: "ACC-S",
                        receiver_account_id: "ACC-R",
                        amount_usd: 1,
                        timestamp: new Date().toISOString(),
                    };

                    const signal = await profiler.scoreAnomaly(tx, account);
                    const expected = count > mean + 3 * stddev;
                    const hasFrequency = Boolean(signal?.anomalies?.find((a) => a.anomalyType === "FREQUENCY_SPIKE"));
                    expect(hasFrequency).toBe(expected);
                }
            ),
            { numRuns: 100 }
        );
    });
});
