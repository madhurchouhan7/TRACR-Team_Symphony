const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const auditLogSchema = new mongoose.Schema(
    {
        log_id: {
            type: String,
            required: true,
            unique: true,
            default: () => randomUUID(),
            index: true,
        },
        user_id: {
            type: String,
            required: true,
        },
        user_role: {
            type: String,
            required: true,
        },
        action_type: {
            type: String,
            required: true,
        },
        resource_type: {
            type: String,
            required: true,
        },
        resource_id: {
            type: String,
            required: true,
        },
        action_timestamp: {
            type: Date,
            default: Date.now,
        },
        outcome: {
            type: String,
            enum: ["SUCCESS", "FAILURE"],
            required: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        ip_address: {
            type: String,
            default: null,
        },
    },
    {
        versionKey: false,
    }
);

auditLogSchema.index({ user_id: 1 });
auditLogSchema.index({ action_timestamp: -1 });
auditLogSchema.index({ action_type: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
