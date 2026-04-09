const fc = require("fast-check");
const express = require("express");
const jwt = require("jsonwebtoken");
const JWTMiddleware = require("./JWTMiddleware");
const { requireRole } = require("./RBACMiddleware");
const { startServer, jsonRequest } = require("../testUtils/httpHarness");

// Feature: intelligent-aml-framework, Property 26: JWT Expiry Enforcement
// Feature: intelligent-aml-framework, Property 25: RBAC Permission Enforcement

describe("Auth property tests", () => {
    const secret = "test-secret";

    test("expired tokens are always rejected while unexpired tokens are accepted", async () => {
        const app = express();
        app.use(express.json());

        const middleware = JWTMiddleware({ jwtSecret: secret, logger: { warn: jest.fn() } });
        app.get("/protected", middleware, (_req, res) => {
            res.status(200).json({ ok: true });
        });

        const server = await startServer(app);

        try {
            await fc.assert(
                fc.asyncProperty(fc.boolean(), async (expired) => {
                    const exp = expired
                        ? Math.floor(Date.now() / 1000) - 60
                        : Math.floor(Date.now() / 1000) + 60;

                    const token = jwt.sign(
                        {
                            user_id: "u1",
                            role: "ANALYST",
                            exp,
                        },
                        secret,
                        { algorithm: "HS256", noTimestamp: true }
                    );

                    const response = await jsonRequest(server.baseUrl, "/protected", {
                        headers: { Authorization: `Bearer ${token}` },
                    });

                    if (expired) {
                        expect(response.status).toBe(401);
                        expect(response.body.error).toBe("token_expired");
                    } else {
                        expect(response.status).toBe(200);
                    }
                }),
                { numRuns: 100 }
            );
        } finally {
            await server.close();
        }
    });

    test("RBAC grants access iff user has required role and unauthorized calls never execute handler", async () => {
        let sideEffectCount = 0;
        const app = express();

        app.get(
            "/admin-only",
            (req, _res, next) => {
                req.user = { user_id: "u1", role: req.headers["x-role"] || "ANALYST" };
                next();
            },
            requireRole("ADMIN")({ auditLogger: { log: jest.fn() }, logger: { warn: jest.fn() } }),
            (_req, res) => {
                sideEffectCount += 1;
                res.status(200).json({ ok: true });
            }
        );

        const server = await startServer(app);

        try {
            await fc.assert(
                fc.asyncProperty(fc.constantFrom("ADMIN", "ANALYST", "VIEWER"), async (role) => {
                    const before = sideEffectCount;
                    const response = await jsonRequest(server.baseUrl, "/admin-only", {
                        headers: { "x-role": role },
                    });

                    if (role === "ADMIN") {
                        expect(response.status).toBe(200);
                        expect(sideEffectCount).toBe(before + 1);
                    } else {
                        expect(response.status).toBe(403);
                        expect(sideEffectCount).toBe(before);
                    }
                }),
                { numRuns: 100 }
            );
        } finally {
            await server.close();
        }
    });
});
