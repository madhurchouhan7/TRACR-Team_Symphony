const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const scoreBreakdownSchema = new mongoose.Schema(
  {
    cycle_score: { type: Number, default: 0 },
    smurfing_score: { type: Number, default: 0 },
    behavioral_score: { type: Number, default: 0 },
    geographic_score: { type: Number, default: 0 },
    cycle_weight: { type: Number, default: 0.35 },
    smurfing_weight: { type: Number, default: 0.3 },
    behavioral_weight: { type: Number, default: 0.2 },
    geographic_weight: { type: Number, default: 0.15 },
  },
  { _id: false }
);

const alertSchema = new mongoose.Schema(
  {
    alert_id: {
      type: String,
      required: true,
      unique: true,
      default: () => randomUUID(),
      index: true,
    },
    pattern_type: {
      type: String,
      enum: ["CIRCULAR_TRADING", "SMURFING", "BEHAVIORAL_ANOMALY"],
      required: true,
      index: true,
    },
    subject_account_id: {
      type: String,
      required: true,
      index: true,
    },
    involved_accounts: {
      type: [String],
      default: [],
    },
    transaction_ids: {
      type: [String],
      default: [],
    },
    risk_score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },
    risk_tier: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      required: true,
      index: true,
    },
    score_breakdown: {
      type: scoreBreakdownSchema,
      required: true,
    },
    cycle_detail: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    smurfing_detail: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    behavioral_detail: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    xai_narrative: {
      type: String,
      default: null,
    },
    sar_draft_id: {
      type: String,
      default: null,
      index: true,
    },
    case_id: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

module.exports = mongoose.model("Alert", alertSchema);
