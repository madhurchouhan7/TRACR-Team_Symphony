const mongoose = require("mongoose");

const validRangeSchema = new mongoose.Schema(
  {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    allowed_values: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const systemConfigSchema = new mongoose.Schema(
  {
    config_key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    default_value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    valid_range: {
      type: validRangeSchema,
      default: () => ({}),
    },
    description: {
      type: String,
      default: "",
    },
    updated_by: {
      type: String,
      default: null,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model("SystemConfig", systemConfigSchema);
