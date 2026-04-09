const SystemConfig = require("../models/SystemConfig");

const DEFAULT_CONFIGS = [
    {
        config_key: "ctr_threshold",
        value: 10000,
        default_value: 10000,
        valid_range: { min: 1000, max: 100000 },
        description: "Structuring detection CTR threshold in USD",
    },
    {
        config_key: "rolling_window_hours",
        value: 24,
        default_value: 24,
        valid_range: { min: 1, max: 168 },
        description: "Rolling window for smurfing aggregation",
    },
    {
        config_key: "cycle_max_length",
        value: 6,
        default_value: 6,
        valid_range: { min: 2, max: 12 },
        description: "Maximum DFS cycle length",
    },
    {
        config_key: "cycle_time_window_hours",
        value: 72,
        default_value: 72,
        valid_range: { min: 1, max: 720 },
        description: "Maximum cycle duration window",
    },
    {
        config_key: "cycle_relaxed_time_window_hours",
        value: 336,
        default_value: 336,
        valid_range: { min: 24, max: 1440 },
        description: "Relaxed cycle window for slow-burn circular movement detection",
    },
    {
        config_key: "cycle_detection_time_budget_ms",
        value: 1500,
        default_value: 1500,
        valid_range: { min: 200, max: 10000 },
        description: "Cycle DFS time budget in milliseconds before bounded cutoff",
    },
    {
        config_key: "smurfing_tx_count_threshold",
        value: 3,
        default_value: 3,
        valid_range: { min: 2, max: 50 },
        description: "Minimum transaction count for smurfing pattern",
    },
    {
        config_key: "smurfing_below_threshold_ratio_min",
        value: 0.7,
        default_value: 0.7,
        valid_range: { min: 0.5, max: 1 },
        description: "Minimum ratio of sub-CTR transactions in a suspicious smurfing window",
    },
    {
        config_key: "score_weight_cycle",
        value: 0.35,
        default_value: 0.35,
        valid_range: { min: 0, max: 1 },
        description: "Risk score cycle component weight",
    },
    {
        config_key: "score_weight_smurfing",
        value: 0.30,
        default_value: 0.30,
        valid_range: { min: 0, max: 1 },
        description: "Risk score smurfing component weight",
    },
    {
        config_key: "score_weight_behavioral",
        value: 0.20,
        default_value: 0.20,
        valid_range: { min: 0, max: 1 },
        description: "Risk score behavioral component weight",
    },
    {
        config_key: "score_weight_geo",
        value: 0.15,
        default_value: 0.15,
        valid_range: { min: 0, max: 1 },
        description: "Risk score geographic component weight",
    },
];

async function seedDefaultConfig({ systemConfigModel = SystemConfig, logger = console } = {}) {
    const existing = await systemConfigModel.find({}, { config_key: 1, _id: 0 }).lean();
    const existingKeys = new Set(existing.map((item) => item.config_key));

    const missingDefaults = DEFAULT_CONFIGS.filter((config) => !existingKeys.has(config.config_key));
    if (missingDefaults.length === 0) {
        return;
    }

    await systemConfigModel.insertMany(missingDefaults);
    logger.info("system_config_seeded", { count: missingDefaults.length });
}

module.exports = {
    seedDefaultConfig,
    DEFAULT_CONFIGS,
};
