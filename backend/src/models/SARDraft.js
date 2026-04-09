const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const sarDraftSchema = new mongoose.Schema(
  {
    sar_id: {
      type: String,
      required: true,
      unique: true,
      default: () => randomUUID(),
      index: true,
    },
    alert_id: {
      type: String,
      required: true,
      index: true,
    },
    case_id: {
      type: String,
      default: null,
      index: true,
    },
    generated_by: {
      type: String,
      required: true,
      index: true,
    },
    gemini_request_id: {
      type: String,
      default: null,
      index: true,
    },
    generated_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    subject_summary: {
      type: String,
      default: "",
    },
    activity_narrative: {
      type: String,
      default: "",
    },
    transaction_timeline: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    risk_indicators: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    recommended_filing_category: {
      type: String,
      default: "",
    },
    is_partial: {
      type: Boolean,
      default: false,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model("SARDraft", sarDraftSchema);
