"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecord = isRecord;
exports.isUuid = isUuid;
exports.parseUuidParam = parseUuidParam;
exports.parseStringField = parseStringField;
exports.parseAttachments = parseAttachments;
exports.parseTicketCreateBody = parseTicketCreateBody;
exports.parseCreateMessageBody = parseCreateMessageBody;
exports.parseCustomerSatisfactionBody = parseCustomerSatisfactionBody;
exports.normalizeAttachmentList = normalizeAttachmentList;
exports.mapTicketSummary = mapTicketSummary;
exports.buildTimeline = buildTimeline;
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function parseUuidParam(raw, fieldName) {
    if (typeof raw !== "string" || !isUuid(raw)) {
        return { error: `${fieldName} must be a valid UUID.` };
    }
    return { data: raw };
}
function parseStringField(value, fieldName, options) {
    const required = options?.required ?? true;
    const allowEmpty = options?.allowEmpty ?? false;
    const maxLength = options?.maxLength;
    if (typeof value === "undefined" || value === null) {
        return required ? { error: `${fieldName} is required.` } : { data: undefined };
    }
    if (typeof value !== "string") {
        return { error: `${fieldName} must be a string.` };
    }
    const normalized = value.trim();
    if (!allowEmpty && !normalized) {
        return { error: `${fieldName} cannot be empty.` };
    }
    if (typeof maxLength === "number" && normalized.length > maxLength) {
        return { error: `${fieldName} must be at most ${maxLength} characters.` };
    }
    return { data: normalized };
}
function parseAttachments(value) {
    if (typeof value === "undefined" || value === null) {
        return { data: [] };
    }
    if (!Array.isArray(value)) {
        return { error: "attachments must be an array of non-empty strings." };
    }
    const normalized = value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    if (normalized.length !== value.length) {
        return { error: "attachments must only contain non-empty string values." };
    }
    if (normalized.length > 10) {
        return { error: "attachments may contain at most 10 items." };
    }
    return { data: normalized };
}
function parseTicketCreateBody(body) {
    if (!isRecord(body)) {
        return { error: "Request body must be a JSON object." };
    }
    const subject = parseStringField(body.subject, "subject", { maxLength: 200 });
    if ("error" in subject) {
        return subject;
    }
    const description = parseStringField(body.description, "description", { maxLength: 4000 });
    if ("error" in description) {
        return description;
    }
    const category = parseStringField(body.category, "category", { maxLength: 80 });
    if ("error" in category) {
        return category;
    }
    const attachments = parseAttachments(body.attachments);
    if ("error" in attachments) {
        return attachments;
    }
    return {
        data: {
            subject: subject.data,
            description: description.data,
            category: category.data,
            attachments: attachments.data,
        },
    };
}
function parseCreateMessageBody(body) {
    if (!isRecord(body)) {
        return { error: "Request body must be a JSON object." };
    }
    const messageText = parseStringField(body.messageText, "messageText", { maxLength: 4000 });
    if ("error" in messageText) {
        return messageText;
    }
    return { data: { messageText: messageText.data } };
}
function parseCustomerSatisfactionBody(body) {
    if (!isRecord(body)) {
        return { error: "Request body must be a JSON object." };
    }
    if (typeof body.rating !== "number" || !Number.isFinite(body.rating)) {
        return { error: "rating must be a number between 1 and 5." };
    }
    const rating = Math.round(body.rating);
    if (rating < 1 || rating > 5) {
        return { error: "rating must be between 1 and 5." };
    }
    return { data: { rating } };
}
function normalizeAttachmentList(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}
function mapTicketSummary(caseItem, assignedEmployee) {
    return {
        id: caseItem.id,
        subject: caseItem.title,
        status: caseItem.status,
        priority: caseItem.priority,
        category: caseItem.category,
        attachmentCount: caseItem.attachments.length,
        customerSatisfactionRating: caseItem.customer_satisfaction_rating,
        customerSatisfactionSubmittedAt: caseItem.customer_satisfaction_submitted_at,
        canSubmitCustomerSatisfaction: caseItem.status === "Resolved" && caseItem.customer_satisfaction_rating === null,
        createdAt: caseItem.created_at,
        updatedAt: caseItem.updated_at,
        assignedEmployee: assignedEmployee
            ? {
                id: assignedEmployee.id,
                name: assignedEmployee.name,
                email: assignedEmployee.email,
                role: assignedEmployee.role,
            }
            : null,
    };
}
function buildTimeline(caseItem, messages) {
    const events = [
        {
            id: `created:${caseItem.id}`,
            type: "created",
            label: "Ticket created",
            createdAt: caseItem.created_at,
        },
    ];
    if (caseItem.assigned_to) {
        events.push({
            id: `assigned:${caseItem.id}`,
            type: "status",
            label: "Assigned to a support agent",
            createdAt: caseItem.created_at,
        });
    }
    const systemMessages = messages.filter((message) => message.message_type === "system");
    if (systemMessages.length > 0) {
        events.push(...systemMessages.map((message) => ({
            id: `system:${message.id}`,
            type: "system",
            label: message.message_text,
            createdAt: message.created_at,
        })));
    }
    else if (caseItem.status !== "Open" || caseItem.updated_at !== caseItem.created_at) {
        events.push({
            id: `status:${caseItem.id}`,
            type: "status",
            label: `Status updated to ${caseItem.status}`,
            createdAt: caseItem.updated_at,
        });
    }
    return events.sort((a, b) => {
        const byTime = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (byTime !== 0) {
            return byTime;
        }
        return a.id.localeCompare(b.id);
    });
}
