"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecord = isRecord;
exports.isUuid = isUuid;
exports.parseUuidParam = parseUuidParam;
exports.parseMessageBody = parseMessageBody;
exports.getAllowedInternalPeerRoles = getAllowedInternalPeerRoles;
exports.canUsersChatInternally = canUsersChatInternally;
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
function parseMessageBody(body) {
    if (!isRecord(body)) {
        return { error: "Request body must be a JSON object." };
    }
    if (typeof body.messageText !== "string") {
        return { error: "messageText must be a string." };
    }
    const messageText = body.messageText.trim();
    if (!messageText) {
        return { error: "messageText cannot be empty." };
    }
    if (messageText.length > 4000) {
        return { error: "messageText must be at most 4000 characters." };
    }
    return { data: { messageText } };
}
function getAllowedInternalPeerRoles(role) {
    switch (role) {
        case "CSR":
            return ["Manager", "Executive", "Admin"];
        case "Manager":
            return ["CSR", "Executive", "Admin"];
        case "Executive":
            return ["CSR", "Manager", "Admin"];
        case "Admin":
            return ["CSR", "Manager", "Executive", "Admin"];
        case "Customer":
            return [];
        default:
            return [];
    }
}
function canUsersChatInternally(roleA, roleB) {
    return getAllowedInternalPeerRoles(roleA).includes(roleB) && getAllowedInternalPeerRoles(roleB).includes(roleA);
}
