const fc = require("fast-check");
const AuditLogger = require("./AuditLogger");

// Feature: intelligent-aml-framework, Property 23: Audit Log Append-Only Invariant
// Feature: intelligent-aml-framework, Property 22: Audit Log Entry Completeness

describe("AuditLogger property tests", () => {
    test("audit log length is monotonically non-decreasing", async () => {
        const entries = [];
        const auditLogger = new AuditLogger({
            auditLogModel: {
                create: async (doc) => {
                    entries.push(doc);
                    return { ...doc, toObject: () => doc };
                },
            },
        });

        await fc.assert(
            fc.asyncProperty(fc.array(fc.string({ minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 80 }), async (actions) => {
                let previousLength = entries.length;

                for (const action of actions) {
                    await auditLogger.log({
                        userId: "u1",
                        userRole: "ANALYST",
                        actionType: action,
                        resourceType: "ALERT",
                        resourceId: "r1",
                        outcome: "SUCCESS",
                        ipAddress: "127.0.0.1",
                    });

                    expect(entries.length).toBeGreaterThanOrEqual(previousLength);
                    previousLength = entries.length;
                }
            }),
            { numRuns: 100 }
        );
    });

    test("every logged action contains all required fields", async () => {
        const created = [];
        const auditLogger = new AuditLogger({
            auditLogModel: {
                create: async (doc) => {
                    created.push(doc);
                    return { ...doc, toObject: () => doc };
                },
            },
        });

        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    userId: fc.string({ minLength: 1, maxLength: 8 }),
                    userRole: fc.constantFrom("ADMIN", "ANALYST"),
                    actionType: fc.string({ minLength: 1, maxLength: 20 }),
                    resourceType: fc.string({ minLength: 1, maxLength: 20 }),
                    resourceId: fc.string({ minLength: 1, maxLength: 20 }),
                    outcome: fc.constantFrom("SUCCESS", "FAILURE"),
                }),
                async (input) => {
                    const doc = await auditLogger.log({
                        ...input,
                        metadata: { trace: "x" },
                        ipAddress: "127.0.0.1",
                    });

                    expect(doc.user_id).toBe(input.userId);
                    expect(doc.user_role).toBe(input.userRole);
                    expect(doc.action_type).toBe(input.actionType);
                    expect(doc.resource_id).toBe(input.resourceId);
                    expect(doc.outcome).toBe(input.outcome);
                    expect(new Date(doc.action_timestamp).toString()).not.toBe("Invalid Date");
                }
            ),
            { numRuns: 100 }
        );
    });
});
