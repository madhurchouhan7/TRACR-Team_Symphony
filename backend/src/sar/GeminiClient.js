const { GoogleGenerativeAI } = require("@google/generative-ai");

class GeminiClient {
    constructor({ apiKey = process.env.GEMINI_API_KEY, model = "gemini-1.5-flash", timeoutMs = 10000, logger = console } = {}) {
        this.apiKey = apiKey;
        this.model = model;
        this.timeoutMs = timeoutMs;
        this.logger = logger;

        this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    }

    async generate(prompt) {
        if (!this.client) {
            return {
                partial: true,
                error: "gemini_api_key_missing",
                text: null,
                requestId: null,
            };
        }

        const model = this.client.getGenerativeModel({ model: this.model });

        try {
            const response = await Promise.race([
                model.generateContent(prompt),
                this.#timeout(this.timeoutMs),
            ]);

            const text = response.response.text();
            const requestId = response.response?.responseId || null;

            return {
                partial: false,
                error: null,
                text,
                requestId,
            };
        } catch (error) {
            this.logger.error("gemini_generation_failed", {
                code: error.code || "GEMINI_ERROR",
                message: error.message,
                timestamp: new Date().toISOString(),
            });

            return {
                partial: true,
                error: error.code || "GEMINI_ERROR",
                text: null,
                requestId: null,
            };
        }
    }

    #timeout(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), ms);
        });
    }
}

module.exports = GeminiClient;
