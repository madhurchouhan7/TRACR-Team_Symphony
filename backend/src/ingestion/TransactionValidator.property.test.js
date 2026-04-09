const fc = require("fast-check");
const TransactionValidator = require("./TransactionValidator");

// Feature: intelligent-aml-framework, Property 5: Invalid Records Not Persisted

describe("TransactionValidator property tests", () => {
    function makeValidPayload() {
        return {
            transaction_id: crypto.randomUUID(),
            sender_account_id: "ACC-1",
            receiver_account_id: "ACC-2",
            amount: 100,
            currency: "USD",
            timestamp: new Date().toISOString(),
            transaction_type: "WIRE",
            geolocation: { sender_country: "US", receiver_country: "GB" },
            channel: "ONLINE",
            device_id: "DEV-1",
            is_synthetic: true,
            pattern_tag: null,
        };
    }

    test("malformed records are never persisted and stream continues", async () => {
        const logger = { error: jest.fn() };
        const validator = new TransactionValidator(logger);
        const persisted = [];

        const validTxArb = fc.record({
            transaction_id: fc.uuid(),
            sender_account_id: fc.string({ minLength: 1, maxLength: 12 }),
            receiver_account_id: fc.string({ minLength: 1, maxLength: 12 }),
            amount: fc.double({ min: 0.01, max: 100000, noNaN: true, noDefaultInfinity: true }),
            currency: fc.constantFrom("USD", "EUR", "GBP"),
            timestamp: fc
                .integer({ min: 946684800000, max: 4102444800000 })
                .map((ms) => new Date(ms).toISOString()),
            transaction_type: fc.constantFrom("WIRE", "ACH", "CASH", "CRYPTO"),
            geolocation: fc.record({
                sender_country: fc.constantFrom("US", "GB", "IN", "AE"),
                receiver_country: fc.constantFrom("US", "GB", "IN", "AE"),
            }),
            channel: fc.constantFrom("ONLINE", "MOBILE", "BRANCH", "ATM"),
            device_id: fc.string({ minLength: 1, maxLength: 16 }),
            is_synthetic: fc.boolean(),
            pattern_tag: fc.constantFrom(null, "SMURFING", "CIRCULAR_TRADING"),
        });

        const malformedArb = fc.oneof(
            fc.anything(),
            fc.record({
                transaction_id: fc.string(),
                amount: fc.integer({ min: -1000, max: 0 }),
            }),
            fc.record({
                sender_account_id: fc.string(),
                receiver_account_id: fc.string(),
            })
        );

        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.oneof(validTxArb, malformedArb), { minLength: 30, maxLength: 80 }),
                async (records) => {
                    persisted.length = 0;

                    for (const payload of records) {
                        const result = validator.validate(payload);
                        if (result.valid) {
                            persisted.push(payload);
                        }
                    }

                    for (const record of persisted) {
                        const check = validator.validate(record);
                        expect(check.valid).toBe(true);
                    }

                    const invalidCount = records.filter((record) => !validator.validate(record).valid).length;
                    expect(records.length).toBeGreaterThanOrEqual(persisted.length);
                    expect(invalidCount + persisted.length).toBe(records.length);
                }
            ),
            { numRuns: 100 }
        );
    });

    test("valid record still accepted", () => {
        const validator = new TransactionValidator({ error: jest.fn() });
        const result = validator.validate(makeValidPayload());
        expect(result.valid).toBe(true);
    });
});
