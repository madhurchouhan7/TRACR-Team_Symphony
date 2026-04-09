const DEFAULT_FATF_HIGH_RISK_JURISDICTIONS = [
    "IR",
    "KP",
    "MM",
];

class GeoRiskEvaluator {
    constructor({ thresholdConfig = null } = {}) {
        this.thresholdConfig = thresholdConfig;
    }

    score(geolocation) {
        const fatfList = this.#getFatfList();
        const sender = String(geolocation?.sender_country || "").toUpperCase();
        const receiver = String(geolocation?.receiver_country || "").toUpperCase();

        if (fatfList.has(sender) || fatfList.has(receiver)) {
            return 15;
        }

        return 0;
    }

    #getFatfList() {
        if (!this.thresholdConfig || typeof this.thresholdConfig.get !== "function") {
            return new Set(DEFAULT_FATF_HIGH_RISK_JURISDICTIONS);
        }

        const configured = this.thresholdConfig.get("fatf_high_risk_jurisdictions");
        if (!Array.isArray(configured) || configured.length === 0) {
            return new Set(DEFAULT_FATF_HIGH_RISK_JURISDICTIONS);
        }

        return new Set(configured.map((item) => String(item).toUpperCase()));
    }
}

module.exports = GeoRiskEvaluator;
