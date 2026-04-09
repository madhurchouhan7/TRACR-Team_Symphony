const fc = require("fast-check");
const PromptBuilder = require("./PromptBuilder");
const SARFormatter = require("./SARFormatter");

// Feature: intelligent-aml-framework, Property 20: SAR Prompt Contains All Required Fields
// Feature: intelligent-aml-framework, Property 21: SAR Draft Section Completeness

describe("SAR property tests", () => {
    const promptBuilder = new PromptBuilder();
    const formatter = new SARFormatter();

    test("prompt always contains required context fields", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 12 }),
                fc.constantFrom("SMURFING", "CIRCULAR_TRADING", "BEHAVIORAL_ANOMALY"),
                async (subject, pattern) => {
                    const alert = {
                        subject_account_id: subject,
                        pattern_type: pattern,
                        risk_score: 88,
                        risk_tier: "HIGH",
                        score_breakdown: { cycle_score: 80 },
                        transaction_ids: ["tx-1", "tx-2"],
                        behavioral_detail: { anomalies: [] },
                    };

                    const account = {
                        baseline: {
                            daily_freq_mean: 3,
                            amount_mean: 100,
                        },
                    };

                    const prompt = promptBuilder.build(alert, account);
                    expect(prompt).toContain("subject_summary");
                    expect(prompt).toContain("activity_narrative");
                    expect(prompt).toContain("transaction_timeline");
                    expect(prompt).toContain("risk_indicators");
                    expect(prompt).toContain("recommended_filing_category");
                    expect(prompt).toContain("subject_account_id");
                    expect(prompt).toContain(pattern);
                }
            ),
            { numRuns: 100 }
        );
    });

    test("formatted SAR always includes all five required sections", async () => {
        await fc.assert(
            fc.asyncProperty(fc.boolean(), async (validJson) => {
                const alert = {
                    subject_account_id: "ACC-1",
                    pattern_type: "SMURFING",
                    risk_score: 77,
                    risk_tier: "HIGH",
                    transaction_ids: ["tx-1"],
                };

                const response = validJson
                    ? {
                        partial: false,
                        text: JSON.stringify({
                            subject_summary: "Subject",
                            activity_narrative: "Narrative",
                            transaction_timeline: [{ txId: "tx-1" }],
                            risk_indicators: [{ key: "k" }],
                            recommended_filing_category: "MANDATORY",
                        }),
                    }
                    : {
                        partial: true,
                        text: null,
                    };

                const draft = formatter.format(response, alert);
                expect(draft).toEqual(
                    expect.objectContaining({
                        subject_summary: expect.anything(),
                        activity_narrative: expect.anything(),
                        transaction_timeline: expect.any(Array),
                        risk_indicators: expect.any(Array),
                        recommended_filing_category: expect.anything(),
                        is_partial: expect.any(Boolean),
                    })
                );
            }),
            { numRuns: 100 }
        );
    });
});
