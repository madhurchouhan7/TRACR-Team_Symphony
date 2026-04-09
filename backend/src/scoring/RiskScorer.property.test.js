const fc = require("fast-check");
const GeoRiskEvaluator = require("./GeoRiskEvaluator");
const RiskScorer = require("./RiskScorer");

// Feature: intelligent-aml-framework, Property 16: Composite Risk Score Invariants
// Feature: intelligent-aml-framework, Property 17: Geographic Risk Score for FATF Jurisdictions
// Feature: intelligent-aml-framework, Property 18: Score Decomposition Recorded in Alert
// Feature: intelligent-aml-framework, Property 19: Config Weight Changes Applied to Subsequent Scores

describe("RiskScorer property tests", () => {
    function makeDetectionResult(cycle, smurfing, hasBehavior) {
        return {
            transaction_id: crypto.randomUUID(),
            subject_account_id: "ACC-1",
            cycle_signals: cycle > 0 ? [{ cycle_score: cycle, involved_accounts: ["ACC-1"], transaction_sequence: [] }] : [],
            smurfing_signal: smurfing > 0 ? { smurfing_score: smurfing, transaction_ids: [] } : null,
            behavioral_signal: hasBehavior ? { anomalies: [{ anomalyType: "HIGH_VALUE_NEW_COUNTERPARTY" }] } : null,
        };
    }

    test("composite score remains in bounds and tiers match ranges", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 100 }),
                fc.integer({ min: 0, max: 100 }),
                fc.boolean(),
                fc.constantFrom(0, 15),
                async (cycle, smurfing, hasBehavior, geoScore) => {
                    let createdDoc = null;
                    const alertModel = {
                        create: async (doc) => {
                            createdDoc = doc;
                            return { ...doc, toObject: () => doc };
                        },
                    };

                    const weights = {
                        score_weight_cycle: 0.35,
                        score_weight_smurfing: 0.3,
                        score_weight_behavioral: 0.2,
                        score_weight_geo: 0.15,
                    };

                    const thresholdConfig = { get: (key) => weights[key] };
                    const scorer = new RiskScorer({
                        alertModel,
                        thresholdConfig,
                        geoRiskEvaluator: { score: () => geoScore },
                        emitter: { emit: jest.fn() },
                    });

                    const result = makeDetectionResult(cycle, smurfing, hasBehavior);
                    const alert = await scorer.compute(result, { sender_country: "US", receiver_country: "GB" });

                    expect(alert.risk_score).toBeGreaterThanOrEqual(0);
                    expect(alert.risk_score).toBeLessThanOrEqual(100);

                    if (alert.risk_score >= 70) expect(alert.risk_tier).toBe("HIGH");
                    else if (alert.risk_score >= 40) expect(alert.risk_tier).toBe("MEDIUM");
                    else expect(alert.risk_tier).toBe("LOW");

                    const behavioralScore = hasBehavior ? 40 : 0;
                    const expected = Math.max(
                        0,
                        Math.min(
                            100,
                            cycle * 0.35 +
                            smurfing * 0.3 +
                            behavioralScore * 0.2 +
                            ((geoScore / 15) * 100) * 0.15
                        )
                    );
                    expect(alert.risk_score).toBeCloseTo(expected, 6);
                    expect(createdDoc).toBeTruthy();
                }
            ),
            { numRuns: 100 }
        );
    });

    test("geographic risk assigns positive score only for FATF jurisdictions", async () => {
        await fc.assert(
            fc.asyncProperty(fc.constantFrom("IR", "KP", "MM", "US", "GB", "IN"), async (country) => {
                const evaluator = new GeoRiskEvaluator({ thresholdConfig: null });
                const score = evaluator.score({ sender_country: country, receiver_country: "US" });

                if (["IR", "KP", "MM"].includes(country)) {
                    expect(score).toBeGreaterThan(0);
                    expect(score).toBeLessThanOrEqual(15);
                } else {
                    expect(score).toBe(0);
                }
            }),
            { numRuns: 100 }
        );
    });

    test("score breakdown always permits full score reconstruction", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 100 }),
                fc.integer({ min: 0, max: 100 }),
                fc.boolean(),
                async (cycle, smurfing, hasBehavior) => {
                    const alertModel = {
                        create: async (doc) => ({ ...doc, toObject: () => doc }),
                    };

                    const thresholdConfig = {
                        get: (key) => ({
                            score_weight_cycle: 0.4,
                            score_weight_smurfing: 0.3,
                            score_weight_behavioral: 0.2,
                            score_weight_geo: 0.1,
                        }[key]),
                    };

                    const scorer = new RiskScorer({
                        alertModel,
                        thresholdConfig,
                        geoRiskEvaluator: { score: () => 15 },
                        emitter: { emit: jest.fn() },
                    });

                    const detectionResult = makeDetectionResult(cycle, smurfing, hasBehavior);
                    const alert = await scorer.compute(detectionResult, { sender_country: "IR", receiver_country: "US" });

                    const b = alert.score_breakdown;
                    expect(b).toEqual(
                        expect.objectContaining({
                            cycle_score: expect.any(Number),
                            smurfing_score: expect.any(Number),
                            behavioral_score: expect.any(Number),
                            geographic_score: expect.any(Number),
                            cycle_weight: expect.any(Number),
                            smurfing_weight: expect.any(Number),
                            behavioral_weight: expect.any(Number),
                            geographic_weight: expect.any(Number),
                        })
                    );

                    const reconstructed = Math.max(
                        0,
                        Math.min(
                            100,
                            b.cycle_score * b.cycle_weight +
                            b.smurfing_score * b.smurfing_weight +
                            b.behavioral_score * b.behavioral_weight +
                            ((b.geographic_score / 15) * 100) * b.geographic_weight
                        )
                    );
                    expect(alert.risk_score).toBeCloseTo(reconstructed, 6);
                }
            ),
            { numRuns: 100 }
        );
    });

    test("updated config weights affect only subsequent scores", async () => {
        const state = {
            score_weight_cycle: 0.35,
            score_weight_smurfing: 0.3,
            score_weight_behavioral: 0.2,
            score_weight_geo: 0.15,
        };

        const thresholdConfig = { get: (key) => state[key] };
        const alertModel = { create: async (doc) => ({ ...doc, toObject: () => doc }) };
        const scorer = new RiskScorer({
            alertModel,
            thresholdConfig,
            geoRiskEvaluator: { score: () => 0 },
            emitter: { emit: jest.fn() },
        });

        const detectionResult = makeDetectionResult(90, 90, true);
        const before = await scorer.compute(detectionResult, { sender_country: "US", receiver_country: "GB" });

        state.score_weight_cycle = 0.6;
        state.score_weight_smurfing = 0.2;
        state.score_weight_behavioral = 0.1;
        state.score_weight_geo = 0.1;

        const after = await scorer.compute(detectionResult, { sender_country: "US", receiver_country: "GB" });

        expect(after.risk_score).not.toBeCloseTo(before.risk_score, 8);

        const expectedBefore = Math.max(0, Math.min(100, 90 * 0.35 + 90 * 0.3 + 40 * 0.2));
        expect(before.risk_score).toBeCloseTo(expectedBefore, 8);
    });
});
