const Account = require("../models/Account");
const Transaction = require("../models/Transaction");

const POPULATION_MEAN_DAILY_FREQ = 3;
const POPULATION_STDDEV_DAILY_FREQ = 1.5;

class BehavioralProfiler {
    constructor({ accountModel = Account, transactionModel = Transaction, logger = console } = {}) {
        this.accountModel = accountModel;
        this.transactionModel = transactionModel;
        this.logger = logger;
    }

    async initializeBaseline(accountId) {
        const existing = await this.accountModel.findOne({ account_id: accountId }).lean();
        if (existing) {
            return existing;
        }

        const now = new Date();
        await this.accountModel.create({
            account_id: accountId,
            first_seen: now,
            last_seen: now,
            total_inbound_usd: 0,
            total_outbound_usd: 0,
            transaction_count: 0,
            baseline: {
                daily_freq_mean: null,
                daily_freq_stddev: null,
                amount_mean: null,
                amount_stddev: null,
                amount_p90: null,
                known_counterparties: [],
                type_distribution: {},
                channel_distribution: {},
                geo_distribution: {},
                history_days: 0,
                low_confidence: true,
            },
        });

        return this.accountModel.findOne({ account_id: accountId }).lean();
    }

    async updateBaseline(accountId) {
        const now = new Date();
        const windowStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        const txs = await this.transactionModel
            .find({
                sender_account_id: accountId,
                timestamp: { $gte: windowStart },
            })
            .sort({ timestamp: 1 })
            .lean();

        if (txs.length === 0) {
            await this.accountModel.updateOne(
                { account_id: accountId },
                {
                    $set: {
                        "baseline.history_days": 0,
                        "baseline.low_confidence": true,
                    },
                    $setOnInsert: {
                        account_id: accountId,
                        first_seen: now,
                    },
                },
                { upsert: true }
            );
            return this.accountModel.findOne({ account_id: accountId }).lean();
        }

        const amounts = txs.map((tx) => Number(tx.amount_usd || 0));
        const amountMean = this.#mean(amounts);
        const amountStddev = this.#stddev(amounts, amountMean);
        const amountP90 = this.#percentile(amounts, 0.9);

        const dayBuckets = new Map();
        for (const tx of txs) {
            const dayKey = new Date(tx.timestamp).toISOString().slice(0, 10);
            dayBuckets.set(dayKey, (dayBuckets.get(dayKey) || 0) + 1);
        }
        const dailyCounts = Array.from(dayBuckets.values());
        const dailyFreqMean = this.#mean(dailyCounts);
        const dailyFreqStddev = this.#stddev(dailyCounts, dailyFreqMean);

        const knownCounterparties = Array.from(new Set(txs.map((tx) => tx.receiver_account_id)));
        const typeDistribution = this.#distribution(txs.map((tx) => tx.transaction_type));
        const channelDistribution = this.#distribution(txs.map((tx) => tx.channel));
        const geoDistribution = this.#distribution(
            txs.map((tx) => tx.geolocation?.receiver_country).filter(Boolean)
        );

        const firstSeen = new Date(txs[0].timestamp);
        const historyDays = Math.max(1, Math.ceil((now.getTime() - firstSeen.getTime()) / (24 * 60 * 60 * 1000)));
        const lowConfidence = historyDays < 30;

        await this.accountModel.updateOne(
            { account_id: accountId },
            {
                $set: {
                    last_seen: now,
                    transaction_count: txs.length,
                    "baseline.daily_freq_mean": dailyFreqMean,
                    "baseline.daily_freq_stddev": dailyFreqStddev,
                    "baseline.amount_mean": amountMean,
                    "baseline.amount_stddev": amountStddev,
                    "baseline.amount_p90": amountP90,
                    "baseline.known_counterparties": knownCounterparties,
                    "baseline.type_distribution": typeDistribution,
                    "baseline.channel_distribution": channelDistribution,
                    "baseline.geo_distribution": geoDistribution,
                    "baseline.history_days": historyDays,
                    "baseline.low_confidence": lowConfidence,
                },
                $setOnInsert: {
                    account_id: accountId,
                    first_seen: firstSeen,
                },
            },
            { upsert: true }
        );

        return this.accountModel.findOne({ account_id: accountId }).lean();
    }

    async scoreAnomaly(tx, account) {
        const baseline = account?.baseline || {};
        const historyDays = Number(baseline.history_days || 0);

        const amountP90 = Number(baseline.amount_p90 || 0);
        const amountMean = Number(baseline.amount_mean || 0);
        const amountStddev = Number(baseline.amount_stddev || 0);
        const knownCounterparties = new Set(baseline.known_counterparties || []);

        const anomalies = [];

        const amountThreshold = this.#resolveHighValueThreshold({
            amountP90,
            amountMean,
            amountStddev,
            historyDays,
        });

        const isNewCounterparty = !knownCounterparties.has(tx.receiver_account_id);
        const isHighValue = Number(tx.amount_usd) > amountThreshold;

        if (amountP90 > 0 && isHighValue && isNewCounterparty) {
            anomalies.push({
                anomalyType: "HIGH_VALUE_NEW_COUNTERPARTY",
                observedValue: Number(tx.amount_usd),
                baselineThreshold: amountThreshold,
                severity: this.#clamp(Number(tx.amount_usd) / Math.max(1, amountThreshold), 1, 2.5) * 30,
            });
        }

        const frequency24h = await this.#countLast24Hours(tx.sender_account_id, tx.timestamp);
        const mean = historyDays < 30
            ? POPULATION_MEAN_DAILY_FREQ
            : Number(baseline.daily_freq_mean || POPULATION_MEAN_DAILY_FREQ);

        const stddev = historyDays < 30
            ? POPULATION_STDDEV_DAILY_FREQ
            : Number(baseline.daily_freq_stddev || POPULATION_STDDEV_DAILY_FREQ);

        const safeStddev = stddev > 0 ? stddev : POPULATION_STDDEV_DAILY_FREQ;
        const z = (frequency24h - mean) / safeStddev;

        if (z > 3) {
            anomalies.push({
                anomalyType: "FREQUENCY_SPIKE",
                observedValue: frequency24h,
                baselineMean: mean,
                baselineStddev: safeStddev,
                deviationSigma: z,
                severity: this.#clamp(z, 3, 8) * 12,
            });
        } else if (z > 2.3) {
            anomalies.push({
                anomalyType: "FREQUENCY_ELEVATION",
                observedValue: frequency24h,
                baselineMean: mean,
                baselineStddev: safeStddev,
                deviationSigma: z,
                severity: this.#clamp(z, 2.3, 3) * 20,
            });
        }

        if (anomalies.length === 0) {
            return null;
        }

        return {
            subject_account_id: tx.sender_account_id,
            anomalies,
            low_confidence: historyDays < 30,
        };
    }

    #resolveHighValueThreshold({ amountP90, amountMean, amountStddev, historyDays }) {
        if (amountP90 > 0) {
            return amountP90;
        }

        if (historyDays >= 14 && amountMean > 0) {
            const derived = amountMean + Math.max(0, amountStddev) * 2;
            return derived > 0 ? derived : Number.POSITIVE_INFINITY;
        }

        return Number.POSITIVE_INFINITY;
    }

    #clamp(value, min, max) {
        return Math.max(min, Math.min(max, Number(value) || 0));
    }

    async #countLast24Hours(accountId, timestamp) {
        const end = new Date(timestamp);
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

        return this.transactionModel.countDocuments({
            sender_account_id: accountId,
            timestamp: { $gte: start, $lte: end },
        });
    }

    #mean(values) {
        if (values.length === 0) {
            return 0;
        }
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    #stddev(values, mean) {
        if (values.length === 0) {
            return 0;
        }

        const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
        return Math.sqrt(variance);
    }

    #percentile(values, p) {
        if (values.length === 0) {
            return 0;
        }

        const sorted = [...values].sort((a, b) => a - b);
        const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
        return sorted[idx];
    }

    #distribution(values) {
        if (values.length === 0) {
            return {};
        }

        const counts = {};
        for (const value of values) {
            counts[value] = (counts[value] || 0) + 1;
        }

        const total = values.length;
        const distribution = {};
        for (const key of Object.keys(counts)) {
            distribution[key] = counts[key] / total;
        }

        return distribution;
    }
}

module.exports = {
    BehavioralProfiler,
    POPULATION_MEAN_DAILY_FREQ,
    POPULATION_STDDEV_DAILY_FREQ,
};
