"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeeChatRouter = void 0;
const express_1 = __importDefault(require("express"));
const roles_1 = require("../constants/roles");
const employeeChatLogic_1 = require("../domain/employeeChatLogic");
const requireAuth_1 = require("../middleware/requireAuth");
const requireRole_1 = require("../middleware/requireRole");
const notificationService_1 = require("../services/notificationService");
const realtime_1 = require("../services/realtime");
const supabaseClient_1 = require("../services/supabaseClient");
const MESSAGE_TYPE_VALUES = ["text", "internal_note", "system"];
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isMessageType(value) {
    return (typeof value === "string" && MESSAGE_TYPE_VALUES.includes(value));
}
function getDisplayName(user) {
    if (typeof user.name === "string" && user.name.trim()) {
        return user.name.trim();
    }
    return user.email;
}
function ensureSupabase() {
    if (!supabaseClient_1.hasSupabaseAdmin || !supabaseClient_1.supabaseAdmin) {
        return null;
    }
    return supabaseClient_1.supabaseAdmin;
}
function toUserRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.email === "string" &&
            (typeof row.name === "string" || row.name === null) &&
            typeof row.created_at === "string" &&
            (0, roles_1.isRole)(row.role));
    })
        .map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name ?? null,
        role: row.role,
        created_at: row.created_at,
    }));
}
function toCaseRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.customer_id === "string" &&
            (typeof row.assigned_to === "string" || row.assigned_to === null) &&
            typeof row.title === "string");
    })
        .map((row) => ({
        id: row.id,
        customer_id: row.customer_id,
        assigned_to: row.assigned_to ?? null,
        title: row.title,
    }));
}
function toCustomerRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => typeof row.id === "string" && typeof row.user_id === "string")
        .map((row) => ({
        id: row.id,
        user_id: row.user_id,
    }));
}
function toCaseMessageRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.case_id === "string" &&
            (typeof row.sender_id === "string" || row.sender_id === null) &&
            (0, roles_1.isRole)(row.sender_role) &&
            isMessageType(row.message_type) &&
            typeof row.message_text === "string" &&
            typeof row.created_at === "string");
    })
        .map((row) => ({
        id: row.id,
        case_id: row.case_id,
        sender_id: row.sender_id ?? null,
        sender_role: row.sender_role,
        message_type: row.message_type,
        message_text: row.message_text,
        created_at: row.created_at,
    }));
}
function toInternalMessageRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.sender_id === "string" &&
            typeof row.recipient_id === "string" &&
            typeof row.message_text === "string" &&
            typeof row.created_at === "string");
    })
        .map((row) => ({
        id: row.id,
        sender_id: row.sender_id,
        recipient_id: row.recipient_id,
        message_text: row.message_text,
        created_at: row.created_at,
    }));
}
function getRoleSortWeight(role) {
    switch (role) {
        case "Executive":
            return 1;
        case "Manager":
            return 2;
        case "CSR":
            return 3;
        case "Admin":
            return 4;
        case "Customer":
            return 5;
        default:
            return 99;
    }
}
const router = express_1.default.Router();
router.get("/employee/cases/:caseId/messages", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee chat operations.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const caseId = (0, employeeChatLogic_1.parseUuidParam)(req.params.caseId, "caseId");
    if ("error" in caseId) {
        res.status(400).json({
            status: "error",
            message: caseId.error,
        });
        return;
    }
    const caseResult = await client
        .from("cases")
        .select("id,customer_id,assigned_to,title")
        .eq("id", caseId.data)
        .maybeSingle();
    if (caseResult.error) {
        res.status(500).json({
            status: "error",
            message: caseResult.error.message,
        });
        return;
    }
    const parsedCase = caseResult.data ? toCaseRows([caseResult.data])[0] : null;
    if (!parsedCase) {
        res.status(404).json({
            status: "error",
            message: "Case not found.",
        });
        return;
    }
    if (parsedCase.assigned_to !== viewer.sub) {
        res.status(403).json({
            status: "error",
            message: "You can only access chat messages for cases assigned to your account.",
        });
        return;
    }
    const [customerResult, messagesResult] = await Promise.all([
        client.from("customers").select("id,user_id").eq("id", parsedCase.customer_id).maybeSingle(),
        client
            .from("messages")
            .select("id,case_id,sender_id,sender_role,message_type,message_text,created_at")
            .eq("case_id", parsedCase.id)
            .eq("message_type", "text")
            .order("created_at", { ascending: true }),
    ]);
    if (customerResult.error || messagesResult.error) {
        res.status(500).json({
            status: "error",
            message: customerResult.error?.message ??
                messagesResult.error?.message ??
                "Failed to load case chat messages.",
        });
        return;
    }
    const customer = customerResult.data ? toCustomerRows([customerResult.data])[0] : null;
    if (!customer) {
        res.status(404).json({
            status: "error",
            message: "Customer profile for this case was not found.",
        });
        return;
    }
    const messages = toCaseMessageRows((messagesResult.data ?? []));
    const relatedUserIds = Array.from(new Set([viewer.sub, customer.user_id, ...messages.map((message) => message.sender_id)].filter((value) => typeof value === "string")));
    const usersById = new Map();
    if (relatedUserIds.length > 0) {
        const usersResult = await client
            .from("users")
            .select("id,email,name,role,created_at")
            .in("id", relatedUserIds);
        if (usersResult.error) {
            res.status(500).json({
                status: "error",
                message: usersResult.error.message,
            });
            return;
        }
        for (const user of toUserRows((usersResult.data ?? []))) {
            usersById.set(user.id, user);
        }
    }
    const items = messages.map((message) => {
        const sender = message.sender_id ? usersById.get(message.sender_id) : undefined;
        return {
            id: message.id,
            caseId: message.case_id,
            senderId: message.sender_id,
            senderRole: message.sender_role,
            senderName: message.sender_id === viewer.sub
                ? "You"
                : sender?.name || sender?.email || message.sender_role,
            messageText: message.message_text,
            createdAt: message.created_at,
            isCustomer: message.sender_role === "Customer",
            isSelf: message.sender_id === viewer.sub,
        };
    });
    res.json({
        status: "ok",
        data: {
            case: {
                id: parsedCase.id,
                title: parsedCase.title,
            },
            messages: items,
        },
    });
});
router.post("/employee/cases/:caseId/messages", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee chat operations.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const caseId = (0, employeeChatLogic_1.parseUuidParam)(req.params.caseId, "caseId");
    if ("error" in caseId) {
        res.status(400).json({
            status: "error",
            message: caseId.error,
        });
        return;
    }
    const parsedBody = (0, employeeChatLogic_1.parseMessageBody)(req.body);
    if ("error" in parsedBody) {
        res.status(400).json({
            status: "error",
            message: parsedBody.error,
        });
        return;
    }
    const caseResult = await client
        .from("cases")
        .select("id,customer_id,assigned_to,title")
        .eq("id", caseId.data)
        .maybeSingle();
    if (caseResult.error) {
        res.status(500).json({
            status: "error",
            message: caseResult.error.message,
        });
        return;
    }
    const parsedCase = caseResult.data ? toCaseRows([caseResult.data])[0] : null;
    if (!parsedCase) {
        res.status(404).json({
            status: "error",
            message: "Case not found.",
        });
        return;
    }
    if (parsedCase.assigned_to !== viewer.sub) {
        res.status(403).json({
            status: "error",
            message: "You can only send chat messages for cases assigned to your account.",
        });
        return;
    }
    const [customerResult, messageInsertResult] = await Promise.all([
        client.from("customers").select("id,user_id").eq("id", parsedCase.customer_id).maybeSingle(),
        client
            .from("messages")
            .insert({
            case_id: parsedCase.id,
            sender_id: viewer.sub,
            sender_role: "CSR",
            message_type: "text",
            message_text: parsedBody.data.messageText,
        })
            .select("id,case_id,sender_id,sender_role,message_type,message_text,created_at")
            .single(),
    ]);
    if (customerResult.error || messageInsertResult.error) {
        res.status(500).json({
            status: "error",
            message: customerResult.error?.message ??
                messageInsertResult.error?.message ??
                "Failed to send case message.",
        });
        return;
    }
    const customer = customerResult.data ? toCustomerRows([customerResult.data])[0] : null;
    const parsedMessage = toCaseMessageRows([messageInsertResult.data])[0];
    if (!customer || !parsedMessage) {
        res.status(500).json({
            status: "error",
            message: "Failed to parse created case message payload.",
        });
        return;
    }
    await client
        .from("cases")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", parsedCase.id)
        .eq("assigned_to", viewer.sub);
    const senderName = getDisplayName({ name: viewer.name, email: viewer.email });
    (0, realtime_1.emitCaseChatMessage)({
        id: parsedMessage.id,
        caseId: parsedMessage.case_id,
        senderId: parsedMessage.sender_id,
        senderRole: parsedMessage.sender_role,
        senderName,
        messageText: parsedMessage.message_text,
        createdAt: parsedMessage.created_at,
        isCustomer: false,
    });
    if (customer.user_id !== viewer.sub) {
        await (0, notificationService_1.createNotification)({
            userId: customer.user_id,
            type: "case_message",
            message: `New support reply on "${parsedCase.title}".`,
        });
    }
    res.status(201).json({
        status: "ok",
        data: {
            message: {
                id: parsedMessage.id,
                caseId: parsedMessage.case_id,
                senderId: parsedMessage.sender_id,
                senderRole: parsedMessage.sender_role,
                senderName: "You",
                messageText: parsedMessage.message_text,
                createdAt: parsedMessage.created_at,
                isCustomer: false,
                isSelf: true,
            },
        },
    });
});
router.get("/employee/internal-chat/contacts", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR", "Manager", "Executive", "Admin"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee chat operations.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const allowedRoles = (0, employeeChatLogic_1.getAllowedInternalPeerRoles)(viewer.role);
    if (allowedRoles.length === 0) {
        res.status(403).json({
            status: "error",
            message: "Your role is not allowed to use internal employee chat.",
        });
        return;
    }
    const usersResult = await client
        .from("users")
        .select("id,email,name,role,created_at")
        .neq("id", viewer.sub)
        .in("role", allowedRoles);
    if (usersResult.error) {
        res.status(500).json({
            status: "error",
            message: usersResult.error.message,
        });
        return;
    }
    const contacts = toUserRows((usersResult.data ?? []))
        .sort((a, b) => {
        const byRole = getRoleSortWeight(a.role) - getRoleSortWeight(b.role);
        if (byRole !== 0) {
            return byRole;
        }
        return (a.name ?? a.email).localeCompare(b.name ?? b.email);
    })
        .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
    }));
    res.json({
        status: "ok",
        data: {
            contacts,
        },
    });
});
router.get("/employee/internal-chat/:peerUserId/messages", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR", "Manager", "Executive", "Admin"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee chat operations.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const peerUserId = (0, employeeChatLogic_1.parseUuidParam)(req.params.peerUserId, "peerUserId");
    if ("error" in peerUserId) {
        res.status(400).json({
            status: "error",
            message: peerUserId.error,
        });
        return;
    }
    if (peerUserId.data === viewer.sub) {
        res.status(400).json({
            status: "error",
            message: "peerUserId cannot be the same as the authenticated user.",
        });
        return;
    }
    const peerResult = await client
        .from("users")
        .select("id,email,name,role,created_at")
        .eq("id", peerUserId.data)
        .maybeSingle();
    if (peerResult.error) {
        res.status(500).json({
            status: "error",
            message: peerResult.error.message,
        });
        return;
    }
    const peer = peerResult.data ? toUserRows([peerResult.data])[0] : null;
    if (!peer) {
        res.status(404).json({
            status: "error",
            message: "Internal chat peer was not found.",
        });
        return;
    }
    if (!(0, employeeChatLogic_1.canUsersChatInternally)(viewer.role, peer.role)) {
        res.status(403).json({
            status: "error",
            message: `Internal chat is not allowed between ${viewer.role} and ${peer.role}.`,
        });
        return;
    }
    const conversationFilter = `and(sender_id.eq.${viewer.sub},recipient_id.eq.${peer.id}),and(sender_id.eq.${peer.id},recipient_id.eq.${viewer.sub})`;
    const messagesResult = await client
        .from("internal_messages")
        .select("id,sender_id,recipient_id,message_text,created_at")
        .or(conversationFilter)
        .order("created_at", { ascending: true });
    if (messagesResult.error) {
        res.status(500).json({
            status: "error",
            message: messagesResult.error.message,
        });
        return;
    }
    const viewerName = getDisplayName({ name: viewer.name, email: viewer.email });
    const peerName = getDisplayName({ name: peer.name, email: peer.email });
    const messages = toInternalMessageRows((messagesResult.data ?? [])).map((message) => {
        const isSelf = message.sender_id === viewer.sub;
        return {
            id: message.id,
            senderId: message.sender_id,
            senderRole: isSelf ? viewer.role : peer.role,
            senderName: isSelf ? "You" : peerName,
            recipientId: message.recipient_id,
            recipientRole: isSelf ? peer.role : viewer.role,
            recipientName: isSelf ? peerName : viewerName,
            messageText: message.message_text,
            createdAt: message.created_at,
            isSelf,
        };
    });
    res.json({
        status: "ok",
        data: {
            peer: {
                id: peer.id,
                name: peer.name,
                email: peer.email,
                role: peer.role,
            },
            messages,
        },
    });
});
router.post("/employee/internal-chat/:peerUserId/messages", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR", "Manager", "Executive", "Admin"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee chat operations.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const peerUserId = (0, employeeChatLogic_1.parseUuidParam)(req.params.peerUserId, "peerUserId");
    if ("error" in peerUserId) {
        res.status(400).json({
            status: "error",
            message: peerUserId.error,
        });
        return;
    }
    if (peerUserId.data === viewer.sub) {
        res.status(400).json({
            status: "error",
            message: "peerUserId cannot be the same as the authenticated user.",
        });
        return;
    }
    const parsedBody = (0, employeeChatLogic_1.parseMessageBody)(req.body);
    if ("error" in parsedBody) {
        res.status(400).json({
            status: "error",
            message: parsedBody.error,
        });
        return;
    }
    const peerResult = await client
        .from("users")
        .select("id,email,name,role,created_at")
        .eq("id", peerUserId.data)
        .maybeSingle();
    if (peerResult.error) {
        res.status(500).json({
            status: "error",
            message: peerResult.error.message,
        });
        return;
    }
    const peer = peerResult.data ? toUserRows([peerResult.data])[0] : null;
    if (!peer) {
        res.status(404).json({
            status: "error",
            message: "Internal chat peer was not found.",
        });
        return;
    }
    if (!(0, employeeChatLogic_1.canUsersChatInternally)(viewer.role, peer.role)) {
        res.status(403).json({
            status: "error",
            message: `Internal chat is not allowed between ${viewer.role} and ${peer.role}.`,
        });
        return;
    }
    const insertResult = await client
        .from("internal_messages")
        .insert({
        sender_id: viewer.sub,
        recipient_id: peer.id,
        message_text: parsedBody.data.messageText,
    })
        .select("id,sender_id,recipient_id,message_text,created_at")
        .single();
    if (insertResult.error) {
        res.status(500).json({
            status: "error",
            message: insertResult.error.message,
        });
        return;
    }
    const parsedMessage = toInternalMessageRows([insertResult.data])[0];
    if (!parsedMessage) {
        res.status(500).json({
            status: "error",
            message: "Failed to parse created internal chat message payload.",
        });
        return;
    }
    const senderName = getDisplayName({ name: viewer.name, email: viewer.email });
    const peerName = getDisplayName({ name: peer.name, email: peer.email });
    (0, realtime_1.emitInternalChatMessage)({
        id: parsedMessage.id,
        senderId: parsedMessage.sender_id,
        senderRole: viewer.role,
        senderName,
        recipientId: parsedMessage.recipient_id,
        recipientRole: peer.role,
        recipientName: peerName,
        messageText: parsedMessage.message_text,
        createdAt: parsedMessage.created_at,
    });
    await (0, notificationService_1.createNotification)({
        userId: peer.id,
        type: "internal_message",
        message: `New internal message from ${senderName}.`,
    });
    res.status(201).json({
        status: "ok",
        data: {
            message: {
                id: parsedMessage.id,
                senderId: parsedMessage.sender_id,
                senderRole: viewer.role,
                senderName: "You",
                recipientId: parsedMessage.recipient_id,
                recipientRole: peer.role,
                recipientName: peerName,
                messageText: parsedMessage.message_text,
                createdAt: parsedMessage.created_at,
                isSelf: true,
            },
        },
    });
});
exports.employeeChatRouter = router;
