class SARFormatter {
    format(geminiResponse, alert) {
        if (!geminiResponse || geminiResponse.partial || !geminiResponse.text) {
            return this.#partialTemplate(alert);
        }

        try {
            const parsed = JSON.parse(geminiResponse.text);
            return {
                subject_summary: parsed.subject_summary || "",
                activity_narrative: parsed.activity_narrative || "",
                transaction_timeline: parsed.transaction_timeline || [],
                risk_indicators: parsed.risk_indicators || [],
                recommended_filing_category: parsed.recommended_filing_category || "",
                is_partial: false,
            };
        } catch (_) {
            return this.#partialTemplate(alert);
        }
    }

    #partialTemplate(alert) {
        return {
            subject_summary: `Subject account ${alert.subject_account_id}`,
            activity_narrative: `Pattern ${alert.pattern_type} triggered with risk score ${alert.risk_score}.`,
            transaction_timeline: (alert.transaction_ids || []).map((txId) => ({ txId })),
            risk_indicators: [
                {
                    pattern_type: alert.pattern_type,
                    risk_score: alert.risk_score,
                    risk_tier: alert.risk_tier,
                },
            ],
            recommended_filing_category: "REVIEW_REQUIRED",
            is_partial: true,
        };
    }
}

module.exports = SARFormatter;
