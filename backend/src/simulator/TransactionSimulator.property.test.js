const fc = require("fast-check");
const TransactionSimulator = require("./TransactionSimulator");

// Feature: intelligent-aml-framework, Property 1: Transaction Record Field Completeness
// Feature: intelligent-aml-framework, Property 2: Smurfing Pattern Structural Invariants
// Feature: intelligent-aml-framework, Property 3: Circular Trading Pattern Structural Invariants
// Feature: intelligent-aml-framework, Property 4: Realistic Amount Distribution

describe("TransactionSimulator property tests", () => {
    test("generated transaction records are field-complete and correctly typed", async () => {
        const simulator = new TransactionSimulator({ smurfingEnabled: false, circularEnabled: false });

        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async () => {
                const tx = simulator.generateTransaction();

                expect(tx.transaction_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
                expect(typeof tx.sender_account_id).toBe("string");
                expect(typeof tx.receiver_account_id).toBe("string");
                expect(typeof tx.amount).toBe("number");
                expect(new Date(tx.timestamp).toString()).not.toBe("Invalid Date");
                expect(["WIRE", "ACH", "CASH", "CRYPTO"]).toContain(tx.transaction_type);
                expect(tx.geolocation.sender_country).toMatch(/^[A-Z]{2}$/);
                expect(tx.geolocation.receiver_country).toMatch(/^[A-Z]{2}$/);
                expect(["MOBILE", "BRANCH", "ATM", "ONLINE"]).toContain(tx.channel);
                expect(typeof tx.device_id).toBe("string");
            }),
            { numRuns: 100 }
        );
    });

    test("smurfing clusters satisfy structural invariants", async () => {
        const simulator = new TransactionSimulator({ smurfingEnabled: true, circularEnabled: false });

        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async () => {
                const cluster = simulator.generateSmurfingCluster();
                expect(cluster.length).toBeGreaterThanOrEqual(3);
                expect(cluster.length).toBeLessThanOrEqual(15);

                const senderSet = new Set(cluster.map((tx) => tx.sender_account_id));
                expect(senderSet.size).toBe(1);

                const receivers = new Set(cluster.map((tx) => tx.receiver_account_id));
                expect(receivers.size).toBeGreaterThanOrEqual(2);

                const timestamps = cluster.map((tx) => new Date(tx.timestamp).getTime());
                const span = (Math.max(...timestamps) - Math.min(...timestamps)) / (60 * 1000);
                expect(span).toBeLessThanOrEqual(60);

                for (const tx of cluster) {
                    expect(tx.amount).toBeGreaterThanOrEqual(1000);
                    expect(tx.amount).toBeLessThanOrEqual(9999);
                    expect(tx.pattern_tag).toBe("SMURFING");
                }
            }),
            { numRuns: 100 }
        );
    });

    test("circular chains satisfy return-to-origin and length invariants", async () => {
        const simulator = new TransactionSimulator({ smurfingEnabled: false, circularEnabled: true, circularWindowHours: 72 });

        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async () => {
                const chain = simulator.generateCircularChain();
                expect(chain.length).toBeGreaterThanOrEqual(2);
                expect(chain.length).toBeLessThanOrEqual(6);

                for (let i = 0; i < chain.length - 1; i += 1) {
                    expect(chain[i].receiver_account_id).toBe(chain[i + 1].sender_account_id);
                }
                expect(chain[chain.length - 1].receiver_account_id).toBe(chain[0].sender_account_id);

                const timestamps = chain.map((tx) => new Date(tx.timestamp).getTime());
                const spanHours = (Math.max(...timestamps) - Math.min(...timestamps)) / (60 * 60 * 1000);
                expect(spanHours).toBeLessThanOrEqual(72);

                for (const tx of chain) {
                    expect(tx.pattern_tag).toBe("CIRCULAR_TRADING");
                }
            }),
            { numRuns: 100 }
        );
    });

    test("base amount distribution keeps at least 70 percent below 5000", async () => {
        const simulator = new TransactionSimulator({ smurfingEnabled: false, circularEnabled: false });

        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 1000, max: 1200 }), async (sampleSize) => {
                const generated = Array.from({ length: sampleSize }, () => simulator.generateTransaction());
                const below = generated.filter((tx) => tx.amount < 5000).length;
                expect(below / sampleSize).toBeGreaterThanOrEqual(0.7);
            }),
            { numRuns: 100 }
        );
    });
});
