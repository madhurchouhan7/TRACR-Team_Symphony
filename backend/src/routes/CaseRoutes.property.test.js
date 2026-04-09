const fc = require("fast-check");
const createCaseRoutes = require("./cases");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");

// Feature: intelligent-aml-framework, Property 24: Case State Machine Validity

describe("Case routes property tests", () => {
    const transitions = {
        OPEN: ["UNDER_REVIEW"],
        UNDER_REVIEW: ["ESCALATED", "CLOSED_DISMISSED"],
        ESCALATED: ["CLOSED_SAR_FILED", "CLOSED_DISMISSED"],
        CLOSED_SAR_FILED: [],
        CLOSED_DISMISSED: [],
    };

    test("only valid transitions are accepted and CLOSED_SAR_FILED requires SAR", async () => {
        const store = new Map();
        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "u1", role: "ANALYST" };
            next();
        };

        const caseModel = {
            findOne: async ({ case_id }) => store.get(case_id) || null,
            create: async (doc) => {
                const created = {
                    ...doc,
                    case_id: doc.case_id || crypto.randomUUID(),
                    notes: doc.notes || [],
                    save: async function save() {
                        store.set(this.case_id, this);
                        return this;
                    },
                };
                store.set(created.case_id, created);
                return created;
            },
        };

        const router = createCaseRoutes({
            jwtMiddleware,
            auditLogger: { log: jest.fn(async () => { }) },
            caseModel,
        });

        const app = createAppWithJson(router, "/api/cases");
        const server = await startServer(app);

        try {
            await fc.assert(
                fc.asyncProperty(
                    fc.constantFrom("OPEN", "UNDER_REVIEW", "ESCALATED", "CLOSED_SAR_FILED", "CLOSED_DISMISSED"),
                    fc.constantFrom("OPEN", "UNDER_REVIEW", "ESCALATED", "CLOSED_SAR_FILED", "CLOSED_DISMISSED"),
                    fc.boolean(),
                    async (fromState, toState, hasSarDraft) => {
                        const id = crypto.randomUUID();
                        store.set(id, {
                            case_id: id,
                            state: fromState,
                            sar_draft_id: hasSarDraft ? "sar-1" : null,
                            state_history: [],
                            notes: [],
                            save: async function save() {
                                store.set(this.case_id, this);
                                return this;
                            },
                        });

                        const response = await jsonRequest(server.baseUrl, `/api/cases/${id}/state`, {
                            method: "PATCH",
                            body: { to_state: toState, reason_code: "TEST" },
                        });

                        const validTransition = transitions[fromState].includes(toState);
                        const sarOk = toState !== "CLOSED_SAR_FILED" || hasSarDraft;
                        const expectedSuccess = validTransition && sarOk;

                        if (expectedSuccess) {
                            expect(response.status).toBe(200);
                        } else {
                            expect(response.status).toBe(400);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        } finally {
            await server.close();
        }
    });
});
