const fc = require("fast-check");
const GraphManager = require("./GraphManager");

// Feature: intelligent-aml-framework, Property 7: Transaction Graph Update Correctness

describe("GraphManager property tests", () => {
    test("every ingested transaction creates an edge and updates node volume counters", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        from: fc.string({ minLength: 1, maxLength: 6 }),
                        to: fc.string({ minLength: 1, maxLength: 6 }),
                        amount: fc.double({ min: 0.01, max: 100000, noNaN: true, noDefaultInfinity: true }),
                        offsetMs: fc.integer({ min: 0, max: 60 * 60 * 1000 }),
                        txId: fc.uuid(),
                    }),
                    { minLength: 5, maxLength: 80 }
                ),
                async (edges) => {
                    const graph = new GraphManager({ logger: { info: jest.fn() } });
                    const baseTs = Date.now();

                    const expected = new Map();
                    const touch = (id) => {
                        if (!expected.has(id)) {
                            expected.set(id, {
                                total_inbound_usd: 0,
                                total_outbound_usd: 0,
                                transaction_count: 0,
                            });
                        }
                        return expected.get(id);
                    };

                    for (const edge of edges) {
                        graph.addEdge(edge.from, edge.to, edge.amount, new Date(baseTs + edge.offsetMs), edge.txId);

                        const sender = touch(edge.from);
                        sender.total_outbound_usd += edge.amount;
                        sender.transaction_count += 1;

                        const receiver = touch(edge.to);
                        receiver.total_inbound_usd += edge.amount;
                        receiver.transaction_count += 1;
                    }

                    for (const edge of edges) {
                        const actual = graph.getEdge(edge.from, edge.to).find((candidate) => candidate.txId === edge.txId);
                        expect(actual).toBeTruthy();
                        expect(actual.amount).toBeCloseTo(edge.amount, 8);
                    }

                    for (const [nodeId, nodeExpected] of expected.entries()) {
                        const meta = graph.getNodeMeta(nodeId);
                        expect(meta).toBeTruthy();
                        expect(meta.total_inbound_usd).toBeCloseTo(nodeExpected.total_inbound_usd, 8);
                        expect(meta.total_outbound_usd).toBeCloseTo(nodeExpected.total_outbound_usd, 8);
                        expect(meta.transaction_count).toBe(nodeExpected.transaction_count);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
