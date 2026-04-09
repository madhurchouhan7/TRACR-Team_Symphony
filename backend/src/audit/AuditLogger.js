const AuditLog = require("../models/AuditLog");

class AuditLogger {
    constructor({ auditLogModel = AuditLog, logger = console } = {}) {
        this.auditLogModel = auditLogModel;
        this.logger = logger;
    }

    async log({
        userId,
        userRole,
        actionType,
        resourceType,
        resourceId,
        outcome,
        metadata = {},
        ipAddress = null,
    }) {
        const doc = await this.auditLogModel.create({
            user_id: userId,
            user_role: userRole,
            action_type: actionType,
            resource_type: resourceType,
            resource_id: resourceId,
            action_timestamp: new Date(),
            outcome,
            metadata,
            ip_address: ipAddress,
        });

        return doc.toObject ? doc.toObject() : doc;
    }
}

module.exports = AuditLogger;
