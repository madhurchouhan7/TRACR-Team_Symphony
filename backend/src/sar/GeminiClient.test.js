jest.mock("@google/generative-ai", () => {
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
            getGenerativeModel: jest.fn(() => ({
                generateContent: jest.fn(
                    () =>
                        new Promise((resolve) => {
                            setTimeout(
                                () =>
                                    resolve({
                                        response: {
                                            text: () => "{}",
                                            responseId: "req-1",
                                        },
                                    }),
                                100
                            );
                        })
                ),
            })),
        })),
    };
});

const GeminiClient = require("./GeminiClient");

describe("GeminiClient", () => {
    test("returns partial response on timeout and logs failure", async () => {
        const logger = { error: jest.fn() };

        const client = new GeminiClient({
            apiKey: "test-key",
            timeoutMs: 10,
            logger,
        });

        const result = await client.generate("test prompt");
        expect(result.partial).toBe(true);
        expect(result.error).toBeTruthy();
        expect(logger.error).toHaveBeenCalled();
    });
});
