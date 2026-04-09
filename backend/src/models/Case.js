const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const caseStateHistorySchema = new mongoose.Schema(
  {
    from_state: { type: String, default: null },
    to_state: {
      type: String,
      enum: [
        "OPEN",
        "UNDER_REVIEW",
        "ESCALATED",
        "CLOSED_SAR_FILED",
        "CLOSED_DISMISSED",
      ],
      required: true,
    },
    reason_code: { type: String, required: true },
    changed_by: { type: String, required: true },
    changed_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const caseNoteSchema = new mongoose.Schema(
  {
    author_user_id: { type: String, required: true },
    note: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const caseSchema = new mongoose.Schema(
  {
    case_id: {
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
    subject_account_id: {
      type: String,
      required: true,
      index: true,
    },
    state: {
      type: String,
      enum: [
        "OPEN",
        "UNDER_REVIEW",
        "ESCALATED",
        "CLOSED_SAR_FILED",
        "CLOSED_DISMISSED",
      ],
      default: "OPEN",
      index: true,
    },
    state_history: {
      type: [caseStateHistorySchema],
      default: [],
    },
    notes: {
      type: [caseNoteSchema],
      default: [],
    },
    sar_draft_id: {
      type: String,
      default: null,
      index: true,
    },
    assigned_to: {
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

module.exports = mongoose.model("Case", caseSchema);
