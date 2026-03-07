"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
const supabaseClient_1 = require("./supabaseClient");
const realtime_1 = require("./realtime");
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function toNotificationRow(value) {
    if (!isRecord(value)) {
        return null;
    }
    if (typeof value.id !== "string" ||
        typeof value.user_id !== "string" ||
        typeof value.type !== "string" ||
        typeof value.message !== "string" ||
        typeof value.read !== "boolean" ||
        typeof value.created_at !== "string") {
        return null;
    }
    return {
        id: value.id,
        user_id: value.user_id,
        type: value.type,
        message: value.message,
        read: value.read,
        created_at: value.created_at,
    };
}
async function createNotification(input) {
    if (!supabaseClient_1.hasSupabaseAdmin || !supabaseClient_1.supabaseAdmin) {
        return null;
    }
    const insertResult = await supabaseClient_1.supabaseAdmin
        .from("notifications")
        .insert({
        user_id: input.userId,
        type: input.type,
        message: input.message,
        read: false,
    })
        .select("id,user_id,type,message,read,created_at")
        .single();
    if (insertResult.error) {
        console.warn("Failed to create notification:", insertResult.error.message);
        return null;
    }
    const notification = toNotificationRow(insertResult.data);
    if (!notification) {
        return null;
    }
    (0, realtime_1.emitNotification)({
        id: notification.id,
        userId: notification.user_id,
        type: notification.type,
        message: notification.message,
        read: notification.read,
        createdAt: notification.created_at,
    });
    return notification;
}
