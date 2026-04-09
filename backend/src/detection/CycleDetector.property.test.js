const fc = require("fast-check");
const GraphManager = require("./GraphManager");
const CycleDetector = require("./CycleDetector");

// Feature: intelligent-aml-framework, Property 9: Cycle Detection Completeness and Time Window Enforcement
// Feature: intelligent-aml-framework, Property 10: Cycle Alert Completeness and Score Bounds

describe("CycleDetector property tests", () => {
    function buildCycleGraph(length, baseTime, inWindow) {
        const graph = new GraphManager({ logger: { info: jest.fn() } });
        const nodes = Array.from({ length }, (_, i) => `A${i}`);

        const newEdge = {
            from: nodes[0],
            to: nodes[1],
            amount: 5000,
            timestamp: new Date(baseTime).toISOString(),
            txId: crypto.randomUUID(),
            geolocation: { sender_country: "US", receiver_country: "GB" },
        };

        for (let i = 1; i < nodes.length; i += 1) {
            const from = nodes[i];
            const to = nodes[(i + 1) % nodes.length];
            const ts = inWindow
                ? new Date(baseTime + i * 1000)
                : new Date(baseTime + (80 + i) * 60 * 60 * 1000);

            graph.addEdge(from, to, 1200 + i, ts.toISOString(), crypto.randomUUID(), {
                geolocation: { sender_country: "US", receiver_country: "GB" },
            });
        }

        return { graph, newEdge, nodes };
    }

    test("detects strict-window cycles and classifies slower cycles via relaxed window", async () => {
        const detector = new CycleDetector({ logger: { warn: jest.fn() } });

        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 2, max: 6 }), async (length) => {
                const now = Date.now();

                const inWindowGraph = buildCycleGraph(length, now, true);
                const found = detector.detectCycles(inWindowGraph.graph, inWindowGraph.newEdge, 7, 72);
                expect(found.length).toBeGreaterThanOrEqual(1);
                expect(found[0].window_type).toBe("STRICT");

                const outWindowGraph = buildCycleGraph(length, now, false);
                const relaxed = detector.detectCycles(outWindowGraph.graph, outWindowGraph.newEdge, 7, 72);
                expect(relaxed.length).toBeGreaterThanOrEqual(1);
                expect(relaxed[0].window_type).toBe("RELAXED");
                expect(relaxed[0].cycle_score).toBeLessThanOrEqual(found[0].cycle_score);
            }),
            { numRuns: 100 }
        );
    });

    test("cycle score is bounded and FATF bonus adds 20 points with cap", async () => {
        const detector = new CycleDetector({ logger: { warn: jest.fn() }, fatfJurisdictions: ["IR"] });

        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 2, max: 6 }), async (length) => {
                const now = Date.now();
                const { graph, newEdge, nodes } = buildCycleGraph(length, now, true);

                const cycles = detector.detectCycles(graph, newEdge, 7, 72);
                expect(cycles.length).toBeGreaterThanOrEqual(1);

                const cycle = cycles[0];
                expect(cycle.cycle_score).toBeGreaterThanOrEqual(0);
                expect(cycle.cycle_score).toBeLessThanOrEqual(100);
                expect(cycle.involved_accounts.length).toBeGreaterThanOrEqual(nodes.length);
                expect(cycle.transaction_sequence.length).toBe(length);

                const edges = cycle.transaction_sequence.map((edge) => ({
                    ...edge,
                    timestamp: edge.timestamp,
                    amount: edge.amount,
                }));

                const noFatf = detector.computeCycleScore(edges, false);
                const withFatf = detector.computeCycleScore(edges, true);
                expect(withFatf).toBe(Math.min(100, noFatf + 20));
            }),
            { numRuns: 100 }
        );
    });
});
