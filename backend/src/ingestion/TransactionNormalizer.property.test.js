const fc = require("fast-check");
const TransactionNormalizer = require("./TransactionNormalizer");
const { makeValidTransaction } = require("../testUtils/factories");

// Feature: intelligent-aml-framework, Property 6: Currency Normalization Correctness

describe("TransactionNormalizer property tests", () => {
    const rates = {
        USD: 1,
        EUR: 1.1,
        GBP: 1.25,
        INR: 0.012,
    };

    const thresholdConfig = {
        get: (key) => (key === "exchange_rates" ? rates : null),
    };

    test("amount_usd equals amount_original multiplied by configured exchange rate", async () => {
        const normalizer = new TransactionNormalizer({ warn: jest.fn() });

        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom("USD", "EUR", "GBP", "INR"),
                fc.double({ min: 0.01, max: 100000, noNaN: true, noDefaultInfinity: true }),
                async (currency, amount) => {
                    const tx = makeValidTransaction({ amount, currency });
                    const normalized = normalizer.normalize(tx, thresholdConfig);
                    expect(normalized.amount_original).toBe(amount);
                    expect(normalized.amount_usd).toBeCloseTo(amount * rates[currency], 8);
                    expect(normalized.currency_original).toBe(currency);
                }
            ),
            { numRuns: 100 }
        );
    });

    test("USD normalization is idempotent", async () => {
        const normalizer = new TransactionNormalizer({ warn: jest.fn() });

        await fc.assert(
            fc.asyncProperty(
                fc.double({ min: 0.01, max: 500000, noNaN: true, noDefaultInfinity: true }),
                async (amount) => {
                    const tx = makeValidTransaction({ amount, currency: "USD" });
                    const normalized = normalizer.normalize(tx, thresholdConfig);
                    expect(normalized.amount_usd).toBeCloseTo(amount, 8);
                    expect(normalized.currency_normalized).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});
