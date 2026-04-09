const SystemConfig = require("../models/SystemConfig");

class ThresholdConfig {
    constructor({ systemConfigModel = SystemConfig, logger = console } = {}) {
        this.systemConfigModel = systemConfigModel;
        this.logger = logger;
        this.cache = new Map();
    }

    async initialize() {
        await this.reload();
    }

    async reload() {
        const configs = await this.systemConfigModel.find({}).lean();
        this.cache.clear();

        for (const config of configs) {
            this.cache.set(config.config_key, config.value);
        }

        this.logger.info("threshold_config_reloaded", {
            keys_loaded: this.cache.size,
        });
    }

    get(key, fallback = null) {
        if (!this.cache.has(key)) {
            return fallback;
        }
        return this.cache.get(key);
    }
}

const thresholdConfig = new ThresholdConfig();

module.exports = {
    ThresholdConfig,
    thresholdConfig,
};
