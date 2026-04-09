const mongoose = require("mongoose");

const accountBaselineSchema = new mongoose.Schema(
  {
    daily_freq_mean: { type: Number, default: null },
    daily_freq_stddev: { type: Number, default: null },
    amount_mean: { type: Number, default: null },
    amount_stddev: { type: Number, default: null },
    amount_p90: { type: Number, default: null },
    known_counterparties: { type: [String], default: [] },
    type_distribution: { type: Map, of: Number, default: {} },
    channel_distribution: { type: Map, of: Number, default: {} },
    geo_distribution: { type: Map, of: Number, default: {} },
    history_days: { type: Number, default: 0, min: 0 },
    low_confidence: { type: Boolean, default: true },
  },
  { _id: false }
);

const accountSchema = new mongoose.Schema(
  {
    account_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    total_inbound_usd: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_outbound_usd: {
      type: Number,
      default: 0,
      min: 0,
    },
    transaction_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    first_seen: {
      type: Date,
      default: Date.now,
    },
    last_seen: {
      type: Date,
      default: Date.now,
      index: true,
    },
    baseline: {
      type: accountBaselineSchema,
      default: () => ({}),
    },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

module.exports = mongoose.model("Account", accountSchema);
