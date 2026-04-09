const fc = require("fast-check");
const {
    SmurfingDetector,
    POPULATION_MEAN_HOURLY_TX,
    POPULATION_STDDEV_HOURLY_TX,
} = require("./SmurfingDetector");

// Feature: intelligent-aml-framework, Property 11: Structuring Classification Correctness
// Feature: intelligent-aml-framework, Property 12: Coordinated Smurfing Multiplier
// Feature: intelligent-aml-framework, Property 13: Velocity Spike Detection at 3 Sigma

describe("SmurfingDetector property tests", () => {
    test("structuring emitted iff aggregate exceeds threshold with sufficient sub-threshold concentration", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.integer({ min: 1, max: 15000 }), { minLength: 1, maxLength: 20 }),
                async (amounts) => {
                    const detector = new SmurfingDetector({ logger: { warn: jest.fn() } });
                    const ctrThreshold = 10000;
                    const minTxCount = 3;
                    const minBelowThresholdRatio = 0.7;
                    let signal = null;

                    for (let i = 0; i < amounts.length; i += 1) {
                        signal = detector.evaluateSmurfing("ACC-1", {
                            transaction_id: `tx-${i}`,
                            timestamp: new Date(Date.now() + i * 1000).toISOString(),
                            amount_usd: amounts[i],
                            receiver_account_id: `R-${i % 2}`,
                        }, {
                            windowHours: 24,
                            ctrThreshold,
                            minTxCount,
                            minBelowThresholdRatio,
                        });
                    }

                    const aggregate = amounts.reduce((sum, v) => sum + v, 0);
                    const belowCount = amounts.filter((v) => v < ctrThreshold).length;
                    const ratio = amounts.length > 0 ? belowCount / amounts.length : 0;
                    const expected =
                        aggregate >= ctrThreshold &&
                        amounts.length >= minTxCount &&
                        belowCount >= minTxCount &&
                        ratio >= minBelowThresholdRatio;
                    expect(Boolean(signal)).toBe(expected);
                }
            ),
            { numRuns: 100 }
        );
    });

    test("coordinated multiplier is applied iff distinct receivers are at least three", async () => {
        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 3, max: 10 }), async (txCount) => {
                const detector = new SmurfingDetector({ logger: { warn: jest.fn() } });
                const ctrThreshold = 10000;

                const receiverPool = txCount % 2 === 0 ? ["R1", "R2"] : ["R1", "R2", "R3", "R4"];
                let finalSignal = null;

                for (let i = 0; i < txCount; i += 1) {
                    finalSignal = detector.evaluateSmurfing("ACC-COORD", {
                        transaction_id: `tx-${i}`,
                        timestamp: new Date(Date.now() + i * 100).toISOString(),
                        amount_usd: 4000,
                        receiver_account_id: receiverPool[i % receiverPool.length],
                    }, {
                        windowHours: 24,
                        ctrThreshold,
                    });
                }

                expect(finalSignal).toBeTruthy();
                const shouldApply = finalSignal.distinct_receiver_count >= 3;
                expect(finalSignal.coordinated_multiplier_applied).toBe(shouldApply);

                const expectedFinal = shouldApply
                    ? Math.min(100, finalSignal.base_smurfing_score * 1.25)
                    : finalSignal.base_smurfing_score;
                expect(finalSignal.smurfing_score).toBeCloseTo(expectedFinal, 8);
            }),
            { numRuns: 100 }
        );
    });

    test("velocity spike triggers iff z-score is greater than three and uses population stats when baseline is immature", async () => {
        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 0, max: 20 }), async (hourlyTxCount) => {
                const detector = new SmurfingDetector({ logger: { warn: jest.fn() } });
                const baseline = { history_days: 10 };

                const signal = detector.checkVelocitySpike("ACC-V", baseline, hourlyTxCount);
                const z = (hourlyTxCount - POPULATION_MEAN_HOURLY_TX) / POPULATION_STDDEV_HOURLY_TX;

                if (z > 3) {
                    expect(signal).toBeTruthy();
                    expect(signal.used_population_stats).toBe(true);
                    expect(signal.mean).toBe(POPULATION_MEAN_HOURLY_TX);
                    expect(signal.stddev).toBe(POPULATION_STDDEV_HOURLY_TX);
                } else {
                    expect(signal).toBeNull();
                }
            }),
            { numRuns: 100 }
        );
    });

    test("mixed-threshold structuring still alerts when sub-threshold ratio remains high", () => {
        const detector = new SmurfingDetector({ logger: { warn: jest.fn() } });

        const txs = [3200, 3400, 3600, 10250, 3500, 3300];
        let signal = null;

        for (let i = 0; i < txs.length; i += 1) {
            signal = detector.evaluateSmurfing(
                "ACC-MIXED",
                {
                    transaction_id: `mixed-${i}`,
                    timestamp: new Date(Date.now() + i * 1000).toISOString(),
                    amount_usd: txs[i],
                    receiver_account_id: `R${i % 3}`,
                },
                {
                    windowHours: 24,
                    ctrThreshold: 10000,
                    minTxCount: 3,
                    minBelowThresholdRatio: 0.7,
                }
            );
        }

        expect(signal).toBeTruthy();
        expect(signal.mixed_threshold_pattern).toBe(true);
        expect(signal.below_threshold_ratio).toBeGreaterThanOrEqual(0.7);
    });
});
