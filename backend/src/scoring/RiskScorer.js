const eventBus = require("../events/eventBus");
const Alert = require("../models/Alert");
const GeoRiskEvaluator = require("./GeoRiskEvaluator");

class RiskScorer {
    constructor({
        alertModel = Alert,
        thresholdConfig,
        geoRiskEvaluator = null,
        emitter = eventBus,
        logger = console,
    } = {}) {
        this.alertModel = alertModel;
        this.thresholdConfig = thresholdConfig;
        this.geoRiskEvaluator = geoRiskEvaluator || new GeoRiskEvaluator({ thresholdConfig });
        this.emitter = emitter;
        this.logger = logger;
    }

    async compute(detectionResult, geolocation) {
        const cycleScore = this.#extractCycleScore(detectionResult);
        const smurfingScore = Number(detectionResult.smurfing_signal?.smurfing_score || 0);
        const behavioralScore = this.#extractBehavioralScore(detectionResult);
        const geoScore = this.geoRiskEvaluator.score(geolocation);

        const weights = {
            cycle_weight: this.#getWeight("score_weight_cycle", 0.35),
            smurfing_weight: this.#getWeight("score_weight_smurfing", 0.30),
            behavioral_weight: this.#getWeight("score_weight_behavioral", 0.20),
            geographic_weight: this.#getWeight("score_weight_geo", 0.15),
        };

        const normalizedGeoScore = (geoScore / 15) * 100;

        const composite =
            cycleScore * weights.cycle_weight +
            smurfingScore * weights.smurfing_weight +
            behavioralScore * weights.behavioral_weight +
            normalizedGeoScore * weights.geographic_weight;

        const riskScore = Math.max(0, Math.min(100, composite));
        const riskTier = this.#classifyTier(riskScore);

        const patternType = this.#inferPatternType(detectionResult);
        const alertDoc = {
            pattern_type: patternType,
            subject_account_id: detectionResult.subject_account_id,
            involved_accounts: this.#extractInvolvedAccounts(detectionResult),
            transaction_ids: this.#extractTransactionIds(detectionResult),
            risk_score: riskScore,
            risk_tier: riskTier,
            score_breakdown: {
                cycle_score: cycleScore,
                smurfing_score: smurfingScore,
                behavioral_score: behavioralScore,
                geographic_score: geoScore,
                ...weights,
            },
            cycle_detail: detectionResult.cycle_signals?.[0] || null,
            smurfing_detail: detectionResult.smurfing_signal || null,
            behavioral_detail: detectionResult.behavioral_signal || null,
        };

        const saved = await this.alertModel.create(alertDoc);
        const payload = saved.toObject ? saved.toObject() : saved;

        return payload;
    }

    #extractCycleScore(detectionResult) {
        if (!Array.isArray(detectionResult.cycle_signals) || detectionResult.cycle_signals.length === 0) {
            return 0;
        }

        return Math.max(...detectionResult.cycle_signals.map((signal) => Number(signal.cycle_score || 0)));
    }

    #extractBehavioralScore(detectionResult) {
        const anomalies = detectionResult.behavioral_signal?.anomalies || [];
        if (anomalies.length === 0) {
            return 0;
        }

        let score = 0;
        for (const anomaly of anomalies) {
            if (Number.isFinite(Number(anomaly.severity))) {
                score += Number(anomaly.severity);
                continue;
            }

            if (anomaly.anomalyType === "HIGH_VALUE_NEW_COUNTERPARTY") {
                score += 40;
            }
            if (anomaly.anomalyType === "FREQUENCY_SPIKE") {
                score += 35;
            }
            if (anomaly.anomalyType === "FREQUENCY_ELEVATION") {
                score += 20;
            }
        }

        return Math.min(100, score);
    }

    #classifyTier(score) {
        if (score >= 70) {
            return "HIGH";
        }
        if (score >= 40) {
            return "MEDIUM";
        }
        return "LOW";
    }

    #inferPatternType(detectionResult) {
        if (Array.isArray(detectionResult.cycle_signals) && detectionResult.cycle_signals.length > 0) {
            return "CIRCULAR_TRADING";
        }
        if (detectionResult.smurfing_signal) {
            return "SMURFING";
        }
        return "BEHAVIORAL_ANOMALY";
    }

    #extractInvolvedAccounts(detectionResult) {
        const ids = new Set();

        ids.add(detectionResult.subject_account_id);

        for (const signal of detectionResult.cycle_signals || []) {
            for (const id of signal.involved_accounts || []) {
                ids.add(id);
            }
        }

        if (detectionResult.smurfing_signal?.subject_account_id) {
            ids.add(detectionResult.smurfing_signal.subject_account_id);
        }

        return Array.from(ids).filter(Boolean);
    }

    #extractTransactionIds(detectionResult) {
        const ids = new Set();

        if (detectionResult.transaction_id) {
            ids.add(detectionResult.transaction_id);
        }

        for (const signal of detectionResult.cycle_signals || []) {
            for (const edge of signal.transaction_sequence || []) {
                if (edge.txId) {
                    ids.add(edge.txId);
                }
            }
        }

        for (const id of detectionResult.smurfing_signal?.transaction_ids || []) {
            ids.add(id);
        }

        return Array.from(ids);
    }

    #getWeight(key, fallback) {
        if (!this.thresholdConfig || typeof this.thresholdConfig.get !== "function") {
            return fallback;
        }

        const value = Number(this.thresholdConfig.get(key));
        if (!Number.isFinite(value)) {
            return fallback;
        }

        return value;
    }
}

module.exports = RiskScorer;
