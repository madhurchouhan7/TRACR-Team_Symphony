const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const transactionSchema = require("./transactionSchema");

class TransactionValidator {
  constructor(logger = console) {
    this.logger = logger;
    this.ajv = new Ajv({ allErrors: true, strict: false, useDefaults: true });
    addFormats(this.ajv);
    this.validateFn = this.ajv.compile(transactionSchema);
  }

  validate(payload) {
    const valid = this.validateFn(payload);

    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors = (this.validateFn.errors || []).map((error) => ({
      path: error.instancePath || "/",
      code: error.keyword,
      message: error.message || "validation_error",
    }));

    this.logger.error("transaction_validation_failed", {
      reason_code: "SCHEMA_VALIDATION_FAILED",
      errors,
      payload,
    });

    return { valid: false, errors };
  }
}

module.exports = TransactionValidator;
