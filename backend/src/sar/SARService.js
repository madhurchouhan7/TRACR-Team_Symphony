const SARDraft = require("../models/SARDraft");
const PromptBuilder = require("./PromptBuilder");
const GeminiClient = require("./GeminiClient");
const SARFormatter = require("./SARFormatter");
const SARQueue = require("./SARQueue");

class SARService {
    constructor({
        sarDraftModel = SARDraft,
        promptBuilder = new PromptBuilder(),
        geminiClient = new GeminiClient(),
        sarFormatter = new SARFormatter(),
        sarQueue = new SARQueue(),
        auditLogger = null,
        logger = console,
    } = {}) {
        this.sarDraftModel = sarDraftModel;
        this.promptBuilder = promptBuilder;
        this.geminiClient = geminiClient;
        this.sarFormatter = sarFormatter;
        this.sarQueue = sarQueue;
        this.auditLogger = auditLogger;
        this.logger = logger;
    }

    async generateSAR({ alert, account, generatedBy, caseId = null }) {
        return this.sarQueue.enqueue(async () => {
            const prompt = this.promptBuilder.build(alert, account);
            const geminiResponse = await this.geminiClient.generate(prompt);
            const formatted = this.sarFormatter.format(geminiResponse, alert);

            const draft = await this.sarDraftModel.create({
                alert_id: alert.alert_id,
                case_id: caseId,
                generated_by: generatedBy,
                gemini_request_id: geminiResponse.requestId,
                generated_at: new Date(),
                subject_summary: formatted.subject_summary,
                activity_narrative: formatted.activity_narrative,
                transaction_timeline: formatted.transaction_timeline,
                risk_indicators: formatted.risk_indicators,
                recommended_filing_category: formatted.recommended_filing_category,
                is_partial: formatted.is_partial,
            });

            if (this.auditLogger && typeof this.auditLogger.log === "function") {
                await this.auditLogger.log({
                    userId: generatedBy,
                    userRole: "INVESTIGATOR",
                    actionType: "SAR_GENERATE",
                    resourceType: "ALERT",
                    resourceId: alert.alert_id,
                    outcome: "SUCCESS",
                    metadata: {
                        sar_id: draft.sar_id,
                        generated_at: draft.generated_at,
                        gemini_request_id: geminiResponse.requestId,
                    },
                });
            }

            return draft.toObject ? draft.toObject() : draft;
        });
    }
}

module.exports = SARService;
