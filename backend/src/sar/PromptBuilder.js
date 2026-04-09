class PromptBuilder {
    build(alert, account) {
        const baseline = account?.baseline || {};

        return [
            "You are an AML compliance assistant. Generate a SAR draft in structured JSON.",
            "Required sections: subject_summary, activity_narrative, transaction_timeline, risk_indicators, recommended_filing_category.",
            "Subject account details:",
            JSON.stringify(
                {
                    subject_account_id: alert.subject_account_id,
                    account_baseline: {
                        history_days: baseline.history_days,
                        daily_freq_mean: baseline.daily_freq_mean,
                        daily_freq_stddev: baseline.daily_freq_stddev,
                        amount_mean: baseline.amount_mean,
                        amount_stddev: baseline.amount_stddev,
                        amount_p90: baseline.amount_p90,
                    },
                },
                null,
                2
            ),
            "Alert data:",
            JSON.stringify(
                {
                    pattern_type: alert.pattern_type,
                    risk_score: alert.risk_score,
                    risk_tier: alert.risk_tier,
                    score_breakdown: alert.score_breakdown,
                    cycle_detail: alert.cycle_detail,
                    smurfing_detail: alert.smurfing_detail,
                    behavioral_detail: alert.behavioral_detail,
                    transaction_ids: alert.transaction_ids,
                },
                null,
                2
            ),
            "Include specific quantitative comparisons between observed behavior and baseline.",
            "Return ONLY JSON.",
        ].join("\n\n");
    }
}

module.exports = PromptBuilder;
