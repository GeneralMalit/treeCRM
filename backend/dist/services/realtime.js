"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserRoomName = getUserRoomName;
exports.getCaseRoomName = getCaseRoomName;
exports.getInternalRoomName = getInternalRoomName;
exports.initializeRealtime = initializeRealtime;
exports.emitCaseChatMessage = emitCaseChatMessage;
exports.emitInternalChatMessage = emitInternalChatMessage;
exports.emitNotification = emitNotification;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const roles_1 = require("../constants/roles");
const supabaseClient_1 = require("./supabaseClient");
let ioRef = null;
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function toSocketError(message) {
    const error = new Error(message);
    error.data = { message };
    return error;
}
function readTokenFromSocket(socket) {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.trim()) {
        return authToken.startsWith("Bearer ") ? authToken.slice("Bearer ".length) : authToken;
    }
    const headerToken = socket.handshake.headers.authorization;
    if (typeof headerToken === "string" && headerToken.trim().startsWith("Bearer ")) {
        return headerToken.slice("Bearer ".length).trim();
    }
    return null;
}
function parseRealtimeUser(rawToken) {
    if (!env_1.hasJwtSecret) {
        return null;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(rawToken, env_1.env.jwtSecret);
        if (typeof decoded === "string") {
            return null;
        }
        if (typeof decoded.sub !== "string" ||
            typeof decoded.email !== "string" ||
            !(0, roles_1.isRole)(decoded.role)) {
            return null;
        }
        return {
            sub: decoded.sub,
            email: decoded.email,
            role: decoded.role,
            name: typeof decoded.name === "string" ? decoded.name : undefined,
        };
    }
    catch {
        return null;
    }
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
function getUserRoomName(userId) {
    return `user:${userId}`;
}
function getCaseRoomName(caseId) {
    return `case:${caseId}`;
}
function getInternalRoomName(userA, userB) {
    const [left, right] = [userA, userB].sort((a, b) => a.localeCompare(b));
    return `internal:${left}:${right}`;
}
async function canJoinCaseRoom(user, caseId) {
    if (!supabaseClient_1.hasSupabaseAdmin || !supabaseClient_1.supabaseAdmin) {
        return false;
    }
    if (user.role === "Customer") {
        const customerResult = await supabaseClient_1.supabaseAdmin
            .from("customers")
            .select("id")
            .eq("user_id", user.sub)
            .maybeSingle();
        if (customerResult.error || !customerResult.data) {
            return false;
        }
        const caseResult = await supabaseClient_1.supabaseAdmin
            .from("cases")
            .select("id")
            .eq("id", caseId)
            .eq("customer_id", customerResult.data.id)
            .maybeSingle();
        return Boolean(caseResult.data && !caseResult.error);
    }
    if (user.role === "CSR") {
        const caseResult = await supabaseClient_1.supabaseAdmin
            .from("cases")
            .select("id")
            .eq("id", caseId)
            .eq("assigned_to", user.sub)
            .maybeSingle();
        return Boolean(caseResult.data && !caseResult.error);
    }
    return false;
}
async function canJoinInternalRoom(user, peerUserId) {
    if (!supabaseClient_1.hasSupabaseAdmin || !supabaseClient_1.supabaseAdmin) {
        return false;
    }
    if (peerUserId === user.sub) {
        return false;
    }
    const peerResult = await supabaseClient_1.supabaseAdmin
        .from("users")
        .select("id,role")
        .eq("id", peerUserId)
        .maybeSingle();
    if (peerResult.error || !peerResult.data || !(0, roles_1.isRole)(peerResult.data.role)) {
        return false;
    }
    return canUsersChatInternally(user.role, peerResult.data.role);
}
function callAck(callback, payload) {
    if (typeof callback === "function") {
        callback(payload);
    }
}
function toCaseRoomPayload(payload) {
    if (!isRecord(payload)) {
        return null;
    }
    const parsed = payload;
    if (typeof parsed.caseId !== "string" || !isUuid(parsed.caseId)) {
        return null;
    }
    return { caseId: parsed.caseId };
}
function toInternalRoomPayload(payload) {
    if (!isRecord(payload)) {
        return null;
    }
    const parsed = payload;
    if (typeof parsed.peerUserId !== "string" || !isUuid(parsed.peerUserId)) {
        return null;
    }
    return { peerUserId: parsed.peerUserId };
}
function getSocketUser(socket) {
    const user = socket.data.user;
    if (!isRecord(user)) {
        return null;
    }
    if (typeof user.sub !== "string" ||
        typeof user.email !== "string" ||
        !(0, roles_1.isRole)(user.role)) {
        return null;
    }
    return {
        sub: user.sub,
        email: user.email,
        role: user.role,
        name: typeof user.name === "string" ? user.name : undefined,
    };
}
function setupSocketAuth(io) {
    io.use((socket, next) => {
        if (!env_1.hasJwtSecret) {
            next(toSocketError("JWT_SECRET is required in backend/.env."));
            return;
        }
        const token = readTokenFromSocket(socket);
        if (!token) {
            next(toSocketError("Missing realtime auth token."));
            return;
        }
        const user = parseRealtimeUser(token);
        if (!user) {
            next(toSocketError("Invalid realtime auth token."));
            return;
        }
        socket.data.user = user;
        next();
    });
}
function setupSocketHandlers(io) {
    io.on("connection", (socket) => {
        const user = getSocketUser(socket);
        if (!user) {
            socket.disconnect(true);
            return;
        }
        socket.join(getUserRoomName(user.sub));
        socket.emit("connected", {
            message: "Socket.io connected to TreeCRM backend",
            user: {
                id: user.sub,
                email: user.email,
                role: user.role,
            },
        });
        socket.on("chat:join-case", async (payload, callback) => {
            const parsed = toCaseRoomPayload(payload);
            if (!parsed) {
                callAck(callback, { status: "error", message: "caseId must be a valid UUID." });
                return;
            }
            const allowed = await canJoinCaseRoom(user, parsed.caseId);
            if (!allowed) {
                callAck(callback, { status: "error", message: "You are not allowed to join this case room." });
                return;
            }
            const room = getCaseRoomName(parsed.caseId);
            socket.join(room);
            callAck(callback, { status: "ok", room });
        });
        socket.on("chat:leave-case", (payload, callback) => {
            const parsed = toCaseRoomPayload(payload);
            if (!parsed) {
                callAck(callback, { status: "error", message: "caseId must be a valid UUID." });
                return;
            }
            const room = getCaseRoomName(parsed.caseId);
            socket.leave(room);
            callAck(callback, { status: "ok", room });
        });
        socket.on("chat:join-internal", async (payload, callback) => {
            const parsed = toInternalRoomPayload(payload);
            if (!parsed) {
                callAck(callback, { status: "error", message: "peerUserId must be a valid UUID." });
                return;
            }
            const allowed = await canJoinInternalRoom(user, parsed.peerUserId);
            if (!allowed) {
                callAck(callback, { status: "error", message: "You are not allowed in this internal chat room." });
                return;
            }
            const room = getInternalRoomName(user.sub, parsed.peerUserId);
            socket.join(room);
            callAck(callback, { status: "ok", room });
        });
        socket.on("chat:leave-internal", (payload, callback) => {
            const parsed = toInternalRoomPayload(payload);
            if (!parsed) {
                callAck(callback, { status: "error", message: "peerUserId must be a valid UUID." });
                return;
            }
            const room = getInternalRoomName(user.sub, parsed.peerUserId);
            socket.leave(room);
            callAck(callback, { status: "ok", room });
        });
    });
}
function initializeRealtime(io) {
    ioRef = io;
    setupSocketAuth(io);
    setupSocketHandlers(io);
}
function emitCaseChatMessage(payload) {
    if (!ioRef) {
        return;
    }
    ioRef.to(getCaseRoomName(payload.caseId)).emit("chat:case:message", payload);
}
function emitInternalChatMessage(payload) {
    if (!ioRef) {
        return;
    }
    ioRef
        .to(getInternalRoomName(payload.senderId, payload.recipientId))
        .emit("chat:internal:message", payload);
}
function emitNotification(payload) {
    if (!ioRef) {
        return;
    }
    ioRef.to(getUserRoomName(payload.userId)).emit("notification:new", payload);
}
