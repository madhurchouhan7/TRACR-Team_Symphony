const { randomUUID } = require("crypto");

function makeValidTransaction(overrides = {}) {
    return {
        transaction_id: randomUUID(),
        sender_account_id: "ACC-100001",
        receiver_account_id: "ACC-100002",
        amount: 2500,
        currency: "USD",
        timestamp: new Date().toISOString(),
        transaction_type: "WIRE",
        geolocation: {
            sender_country: "US",
            receiver_country: "GB",
        },
        channel: "ONLINE",
        device_id: "DEV-100001",
        is_synthetic: true,
        pattern_tag: null,
        ...overrides,
    };
}

function makeStoredTransaction(overrides = {}) {
    const tx = makeValidTransaction(overrides);
    return {
        transaction_id: tx.transaction_id,
        sender_account_id: tx.sender_account_id,
        receiver_account_id: tx.receiver_account_id,
        amount_usd: tx.amount,
        amount_original: tx.amount,
        currency_original: tx.currency,
        timestamp: tx.timestamp,
        transaction_type: tx.transaction_type,
        geolocation: tx.geolocation,
        channel: tx.channel,
        device_id: tx.device_id,
        is_synthetic: tx.is_synthetic,
        pattern_tag: tx.pattern_tag,
        ingested_at: new Date(),
        schema_version: 1,
    };
}

module.exports = {
    makeValidTransaction,
    makeStoredTransaction,
};
