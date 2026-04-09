const eventBus = require("../events/eventBus");
const Transaction = require("../models/Transaction");

class TransactionRepository {
  constructor({ model = Transaction, emitter = eventBus, logger = console } = {}) {
    this.model = model;
    this.emitter = emitter;
    this.logger = logger;
  }

  async save(normalizedTx) {
    try {
      return await this.#createAndEmit(normalizedTx);
    } catch (error) {
      this.logger.warn("transaction_save_retry", {
        transaction_id: normalizedTx.transaction_id,
        reason: error.message,
      });

      await this.#sleep(100);
      return this.#createAndEmit(normalizedTx);
    }
  }

  async #createAndEmit(normalizedTx) {
    const saved = await this.model.create(normalizedTx);
    const payload = saved.toObject ? saved.toObject() : saved;
    this.emitter.emit("transaction:saved", payload);
    return payload;
  }

  #sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = TransactionRepository;
