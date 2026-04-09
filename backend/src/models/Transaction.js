const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const transactionSchema = new mongoose.Schema(
  {
    transaction_id: {
      type: String,
      required: true,
      unique: true,
      default: () => randomUUID(),
      index: true,
    },
    sender_account_id: {
      type: String,
      required: true,
      index: true,
    },
    receiver_account_id: {
      type: String,
      required: true,
      index: true,
    },
    amount_usd: {
      type: Number,
      required: true,
      min: 0,
    },
    amount_original: {
      type: Number,
      required: true,
      min: 0,
    },
    currency_normalized: {
      type: Boolean,
      default: true,
    },
    currency_original: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      default: "USD",
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    transaction_type: {
      type: String,
      enum: ["WIRE", "ACH", "CASH", "CRYPTO"],
      required: true,
    },
    geolocation: {
      sender_country: {
        type: String,
        required: true,
        uppercase: true,
        match: /^[A-Z]{2}$/,
      },
      receiver_country: {
        type: String,
        required: true,
        uppercase: true,
        match: /^[A-Z]{2}$/,
      },
    },
    channel: {
      type: String,
      enum: ["MOBILE", "BRANCH", "ATM", "ONLINE"],
      required: true,
    },
    device_id: {
      type: String,
      required: true,
      trim: true,
    },
    is_synthetic: {
      type: Boolean,
      default: false,
    },
    pattern_tag: {
      type: String,
      enum: ["SMURFING", "CIRCULAR_TRADING", null],
      default: null,
    },
    ingested_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    schema_version: {
      type: Number,
      default: 1,
    },
  },
  {
    versionKey: false,
  }
);

transactionSchema.index({ sender_account_id: 1, timestamp: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
