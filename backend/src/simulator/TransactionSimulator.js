const { randomUUID } = require("crypto");

const TX_TYPES = ["WIRE", "ACH", "CASH", "CRYPTO"];
const CHANNELS = ["MOBILE", "BRANCH", "ATM", "ONLINE"];
const COUNTRIES = ["US", "IN", "GB", "SG", "AE", "MX", "DE", "JP"];

class TransactionSimulator {
    constructor({
        ingestUrl = "http://localhost:3000/api/transactions/ingest",
        tps = 10,
        smurfingEnabled = true,
        circularEnabled = true,
        circularWindowHours = 72,
        logger = console,
    } = {}) {
        this.ingestUrl = ingestUrl;
        this.tps = Math.min(1000, Math.max(1, Number(tps) || 10));
        this.smurfingEnabled = smurfingEnabled;
        this.circularEnabled = circularEnabled;
        this.circularWindowHours = circularWindowHours;
        this.logger = logger;

        this.interval = null;
    }

    start() {
        const periodMs = Math.max(1, Math.floor(1000 / this.tps));
        this.interval = setInterval(() => {
            this.emitTick().catch((error) => {
                this.logger.error("simulator_tick_failed", { message: error.message });
            });
        }, periodMs);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async emitTick() {
        const tx = this.generateTransaction();
        await this.#postTransaction(tx);

        if (this.smurfingEnabled && Math.random() < 0.03) {
            const cluster = this.generateSmurfingCluster();
            for (const item of cluster) {
                await this.#postTransaction(item);
            }
        }

        if (this.circularEnabled && Math.random() < 0.02) {
            const chain = this.generateCircularChain();
            for (const item of chain) {
                await this.#postTransaction(item);
            }
        }
    }

    generateTransaction() {
        const amount = this.#sampleAmount();

        return {
            transaction_id: randomUUID(),
            sender_account_id: this.#accountId(),
            receiver_account_id: this.#accountId(),
            amount,
            currency: "USD",
            timestamp: new Date().toISOString(),
            transaction_type: this.#pick(TX_TYPES),
            geolocation: {
                sender_country: this.#pick(COUNTRIES),
                receiver_country: this.#pick(COUNTRIES),
            },
            channel: this.#pick(CHANNELS),
            device_id: this.#deviceId(),
            is_synthetic: true,
            pattern_tag: null,
        };
    }

    generateSmurfingCluster() {
        const count = this.#randInt(3, 15);
        const sender = this.#accountId();
        const receiverPool = Array.from({ length: this.#randInt(2, 6) }, () => this.#accountId());
        const start = Date.now();

        const cluster = [];
        for (let i = 0; i < count; i += 1) {
            let receiverId;
            if (i === 0) {
                receiverId = receiverPool[0];
            } else if (i === 1) {
                receiverId = receiverPool[1];
            } else {
                receiverId = this.#pick(receiverPool);
            }

            cluster.push({
                transaction_id: randomUUID(),
                sender_account_id: sender,
                receiver_account_id: receiverId,
                amount: this.#randInt(1000, 9999),
                currency: "USD",
                timestamp: new Date(start + this.#randInt(0, 60 * 60 * 1000)).toISOString(),
                transaction_type: this.#pick(TX_TYPES),
                geolocation: {
                    sender_country: this.#pick(COUNTRIES),
                    receiver_country: this.#pick(COUNTRIES),
                },
                channel: this.#pick(CHANNELS),
                device_id: this.#deviceId(),
                is_synthetic: true,
                pattern_tag: "SMURFING",
            });
        }

        return cluster;
    }

    generateCircularChain() {
        const length = this.#randInt(2, 6);
        const nodes = Array.from({ length }, () => this.#accountId());
        nodes.push(nodes[0]);

        const start = Date.now();
        const maxOffsetMs = this.circularWindowHours * 60 * 60 * 1000;

        const chain = [];
        for (let i = 0; i < length; i += 1) {
            chain.push({
                transaction_id: randomUUID(),
                sender_account_id: nodes[i],
                receiver_account_id: nodes[i + 1],
                amount: this.#randInt(500, 25000),
                currency: "USD",
                timestamp: new Date(start + this.#randInt(0, maxOffsetMs)).toISOString(),
                transaction_type: this.#pick(TX_TYPES),
                geolocation: {
                    sender_country: this.#pick(COUNTRIES),
                    receiver_country: this.#pick(COUNTRIES),
                },
                channel: this.#pick(CHANNELS),
                device_id: this.#deviceId(),
                is_synthetic: true,
                pattern_tag: "CIRCULAR_TRADING",
            });
        }

        return chain;
    }

    async #postTransaction(tx) {
        const response = await fetch(this.ingestUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tx),
        });

        if (!response.ok) {
            this.logger.warn("simulator_post_failed", {
                transaction_id: tx.transaction_id,
                status: response.status,
            });
        }
    }

    #sampleAmount() {
        if (Math.random() < 0.8) {
            return this.#randFloat(10, 4999);
        }
        return this.#randFloat(5000, 75000);
    }

    #accountId() {
        return `ACC-${this.#randInt(100000, 999999)}`;
    }

    #deviceId() {
        return `DEV-${this.#randInt(100000, 999999)}`;
    }

    #pick(values) {
        return values[this.#randInt(0, values.length - 1)];
    }

    #randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    #randFloat(min, max) {
        return Number((Math.random() * (max - min) + min).toFixed(2));
    }
}

module.exports = TransactionSimulator;
