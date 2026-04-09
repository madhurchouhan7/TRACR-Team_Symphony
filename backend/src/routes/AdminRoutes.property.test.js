const fc = require("fast-check");
const createAdminRoutes = require("./admin");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");

// Feature: intelligent-aml-framework, Property 27: Config Validation Rejects Out-of-Range Values

describe("Admin routes property tests", () => {
    test("out-of-range config updates are rejected and existing value remains unchanged", async () => {
        const state = {
            ctr_threshold: {
                config_key: "ctr_threshold",
                value: 10000,
                valid_range: { min: 1000, max: 100000 },
                save: jest.fn(async function save() {
                    return this;
                }),
            },
        };

        const systemConfigModel = {
            find: () => ({ lean: async () => Object.values(state) }),
            findOne: async ({ config_key }) => state[config_key] || null,
        };

        const thresholdConfig = { reload: jest.fn(async () => { }) };
        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "admin1", role: "ADMIN" };
            next();
        };

        const router = createAdminRoutes({
            jwtMiddleware,
            thresholdConfig,
            systemConfigModel,
            auditLogger: { log: jest.fn(async () => { }) },
            auditLogModel: { find: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }), countDocuments: async () => 0 },
        });

        const app = createAppWithJson(router, "/api/admin");
        const server = await startServer(app);

        try {
            await fc.assert(
                fc.asyncProperty(fc.integer({ min: -100000, max: 500000 }), async (candidate) => {
                    const before = state.ctr_threshold.value;
                    const outOfRange = candidate < 1000 || candidate > 100000;
                    if (!outOfRange) {
                        return;
                    }

                    const response = await jsonRequest(server.baseUrl, "/api/admin/config", {
                        method: "PUT",
                        body: [{ config_key: "ctr_threshold", value: candidate }],
                    });

                    expect(response.status).toBe(400);
                    expect(state.ctr_threshold.value).toBe(before);
                }),
                { numRuns: 100 }
            );
        } finally {
            await server.close();
        }
    });
});
