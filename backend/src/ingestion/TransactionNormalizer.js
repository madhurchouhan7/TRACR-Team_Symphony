class TransactionNormalizer {
  constructor(logger = console) {
    this.logger = logger;
  }

  normalize(payload, thresholdConfig) {
    const currency = (payload.currency || "USD").toUpperCase();
    const amountOriginal = Number(payload.amount);
    const exchangeRates = this.#getExchangeRates(thresholdConfig);
    const rate = exchangeRates[currency];
    const currencyNormalized = Number.isFinite(rate) && rate > 0;

    if (!currencyNormalized) {
      this.logger.warn("currency_rate_missing", {
        currency,
        transaction_id: payload.transaction_id,
      });
    }

    return {
      transaction_id: payload.transaction_id,
      sender_account_id: payload.sender_account_id,
      receiver_account_id: payload.receiver_account_id,
      amount_usd: currencyNormalized ? amountOriginal * rate : amountOriginal,
      amount_original: amountOriginal,
      currency_original: currency,
      timestamp: new Date(payload.timestamp).toISOString(),
      transaction_type: payload.transaction_type,
      geolocation: {
        sender_country: payload.geolocation.sender_country,
        receiver_country: payload.geolocation.receiver_country,
      },
      channel: payload.channel,
      device_id: payload.device_id,
      is_synthetic: Boolean(payload.is_synthetic),
      pattern_tag: payload.pattern_tag || null,
      ingested_at: new Date(),
      schema_version: 1,
      currency_normalized: currencyNormalized,
    };
  }

  #getExchangeRates(thresholdConfig) {
    if (!thresholdConfig || typeof thresholdConfig.get !== "function") {
      return { USD: 1 };
    }

    const configured = thresholdConfig.get("exchange_rates");
    if (!configured || typeof configured !== "object") {
      return { USD: 1 };
    }

    return {
      USD: 1,
      ...configured,
    };
  }
}

module.exports = TransactionNormalizer;
