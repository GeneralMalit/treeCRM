"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerPortalRouter = void 0;
const express_1 = __importDefault(require("express"));
const requireAuth_1 = require("../middleware/requireAuth");
const requireRole_1 = require("../middleware/requireRole");
const notificationService_1 = require("../services/notificationService");
const realtime_1 = require("../services/realtime");
const systemSettings_1 = require("../services/systemSettings");
const supabaseClient_1 = require("../services/supabaseClient");
const STATUS_VALUES = ["Open", "In Progress", "Resolved", "Dropped"];
const PRIORITY_VALUES = ["High", "Medium", "Low"];
const MESSAGE_TYPE_VALUES = ["text", "internal_note", "system"];
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function isRole(value) {
    return (typeof value === "string" &&
        ["CSR", "Manager", "Executive", "Admin", "Customer"].includes(value));
}
function isCaseStatus(value) {
    return typeof value === "string" && STATUS_VALUES.includes(value);
}
function isCasePriority(value) {
    return typeof value === "string" && PRIORITY_VALUES.includes(value);
}
function isMessageType(value) {
    return (typeof value === "string" && MESSAGE_TYPE_VALUES.includes(value));
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
function getDisplayName(user) {
    if (typeof user.name === "string" && user.name.trim()) {
        return user.name.trim();
    }
    return user.email;
}
function toUserRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.email === "string" &&
            (typeof row.name === "string" || row.name === null) &&
            typeof row.created_at === "string" &&
            isRole(row.role));
    })
        .map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name ?? null,
        role: row.role,
        created_at: row.created_at,
    }));
}
function toCustomerRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.user_id === "string" &&
            typeof row.company === "string" &&
            typeof row.created_at === "string" &&
            isRecord(row.contact_info));
    })
        .map((row) => ({
        id: row.id,
        user_id: row.user_id,
        company: row.company,
        contact_info: row.contact_info,
        created_at: row.created_at,
    }));
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
function toCaseRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.customer_id === "string" &&
            (typeof row.assigned_to === "string" || row.assigned_to === null) &&
            typeof row.title === "string" &&
            typeof row.description === "string" &&
            typeof row.created_at === "string" &&
            typeof row.updated_at === "string" &&
            (typeof row.customer_satisfaction_rating === "number" ||
                row.customer_satisfaction_rating === null ||
                typeof row.customer_satisfaction_rating === "undefined") &&
            (typeof row.customer_satisfaction_submitted_at === "string" ||
                row.customer_satisfaction_submitted_at === null ||
                typeof row.customer_satisfaction_submitted_at === "undefined") &&
            isCaseStatus(row.status) &&
            isCasePriority(row.priority));
    })
        .map((row) => {
        const parsedRating = typeof row.customer_satisfaction_rating === "number"
            ? Math.round(row.customer_satisfaction_rating)
            : null;
        return {
            id: row.id,
            customer_id: row.customer_id,
            assigned_to: row.assigned_to ?? null,
            title: row.title,
            description: row.description,
            status: row.status,
            priority: row.priority,
            category: typeof row.category === "string" && row.category.trim() ? row.category : "General",
            attachments: normalizeAttachmentList(row.attachments),
            customer_satisfaction_rating: parsedRating !== null && parsedRating >= 1 && parsedRating <= 5 ? parsedRating : null,
            customer_satisfaction_submitted_at: typeof row.customer_satisfaction_submitted_at === "string"
                ? row.customer_satisfaction_submitted_at
                : null,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    });
}
function toMessageRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.case_id === "string" &&
            (typeof row.sender_id === "string" || row.sender_id === null) &&
            isRole(row.sender_role) &&
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
function ensureSupabase() {
    if (!supabaseClient_1.hasSupabaseAdmin || !supabaseClient_1.supabaseAdmin) {
        return null;
    }
    return supabaseClient_1.supabaseAdmin;
}
async function ensureCustomerProfile(viewer) {
    const client = ensureSupabase();
    if (!client) {
        return {
            error: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for customer portal operations.",
        };
    }
    const existingResult = await client
        .from("customers")
        .select("id,user_id,company,contact_info,created_at")
        .eq("user_id", viewer.sub)
        .maybeSingle();
    if (existingResult.error) {
        return { error: existingResult.error.message };
    }
    if (existingResult.data) {
        const parsed = toCustomerRows([existingResult.data])[0];
        if (!parsed) {
            return { error: "Failed to parse existing customer profile." };
        }
        return { data: parsed };
    }
    const derivedCompanyName = viewer.name?.trim() || viewer.email.split("@")[0]?.trim() || `Customer-${viewer.sub.slice(0, 8)}`;
    const createResult = await client
        .from("customers")
        .insert({
        user_id: viewer.sub,
        company: derivedCompanyName,
        contact_info: {
            email: viewer.email,
        },
    })
        .select("id,user_id,company,contact_info,created_at")
        .single();
    if (createResult.error) {
        const retryResult = await client
            .from("customers")
            .select("id,user_id,company,contact_info,created_at")
            .eq("user_id", viewer.sub)
            .maybeSingle();
        if (retryResult.error || !retryResult.data) {
            return { error: createResult.error.message };
        }
        const parsedRetry = toCustomerRows([retryResult.data])[0];
        if (!parsedRetry) {
            return { error: "Failed to parse customer profile after retry." };
        }
        return { data: parsedRetry };
    }
    const parsedCreate = toCustomerRows([createResult.data])[0];
    if (!parsedCreate) {
        return { error: "Failed to parse created customer profile." };
    }
    return { data: parsedCreate };
}
async function chooseCsrAssignee() {
    const client = ensureSupabase();
    if (!client) {
        return {
            error: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for customer portal operations.",
        };
    }
    const csrUsersResult = await client
        .from("users")
        .select("id,email,name,role,created_at")
        .eq("role", "CSR")
        .order("created_at", { ascending: true });
    if (csrUsersResult.error) {
        return { error: csrUsersResult.error.message };
    }
    const csrUsers = toUserRows((csrUsersResult.data ?? []));
    if (csrUsers.length === 0) {
        return { error: "No CSR users are available for ticket assignment." };
    }
    const csrIds = csrUsers.map((row) => row.id);
    const caseLoadResult = await client
        .from("cases")
        .select("assigned_to,status")
        .in("assigned_to", csrIds)
        .in("status", ["Open", "In Progress"]);
    if (caseLoadResult.error) {
        return { error: caseLoadResult.error.message };
    }
    const activeCounts = new Map();
    for (const csrUser of csrUsers) {
        activeCounts.set(csrUser.id, 0);
    }
    for (const row of caseLoadResult.data ?? []) {
        if (!isRecord(row)) {
            continue;
        }
        if (typeof row.assigned_to !== "string" || !activeCounts.has(row.assigned_to)) {
            continue;
        }
        const currentCount = activeCounts.get(row.assigned_to) ?? 0;
        activeCounts.set(row.assigned_to, currentCount + 1);
    }
    const [selectedUser] = [...csrUsers].sort((a, b) => {
        const countA = activeCounts.get(a.id) ?? 0;
        const countB = activeCounts.get(b.id) ?? 0;
        if (countA !== countB) {
            return countA - countB;
        }
        const createdAtCompare = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (createdAtCompare !== 0) {
            return createdAtCompare;
        }
        return a.email.localeCompare(b.email);
    });
    if (!selectedUser) {
        return { error: "No CSR users are available for ticket assignment." };
    }
    return { data: selectedUser };
}
async function fetchCustomerCase(caseId, customerId) {
    const client = ensureSupabase();
    if (!client) {
        return {
            error: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for customer portal operations.",
        };
    }
    const result = await client
        .from("cases")
        .select("id,customer_id,assigned_to,title,description,status,priority,category,attachments,customer_satisfaction_rating,customer_satisfaction_submitted_at,created_at,updated_at")
        .eq("id", caseId)
        .eq("customer_id", customerId)
        .maybeSingle();
    if (result.error) {
        return { error: result.error.message };
    }
    if (!result.data) {
        return { data: null };
    }
    const parsed = toCaseRows([result.data])[0];
    if (!parsed) {
        return { error: "Failed to parse case payload." };
    }
    return { data: parsed };
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
const router = express_1.default.Router();
router.use(requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("Customer"));
router.get("/portal/tickets", async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for customer portal operations.",
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
    const customerResult = await ensureCustomerProfile(viewer);
    if ("error" in customerResult) {
        res.status(500).json({
            status: "error",
            message: customerResult.error,
        });
        return;
    }
    const ticketsResult = await client
        .from("cases")
        .select("id,customer_id,assigned_to,title,description,status,priority,category,attachments,customer_satisfaction_rating,customer_satisfaction_submitted_at,created_at,updated_at")
        .eq("customer_id", customerResult.data.id)
        .order("updated_at", { ascending: false });
    if (ticketsResult.error) {
        res.status(500).json({
            status: "error",
            message: ticketsResult.error.message,
        });
        return;
    }
    const ticketRows = toCaseRows((ticketsResult.data ?? []));
    const assignedEmployeeIds = Array.from(new Set(ticketRows
        .map((ticket) => ticket.assigned_to)
        .filter((assignedTo) => typeof assignedTo === "string")));
    const assignedUsersMap = new Map();
    if (assignedEmployeeIds.length > 0) {
        const usersResult = await client
            .from("users")
            .select("id,email,name,role,created_at")
            .in("id", assignedEmployeeIds);
        if (usersResult.error) {
            res.status(500).json({
                status: "error",
                message: usersResult.error.message,
            });
            return;
        }
        for (const user of toUserRows((usersResult.data ?? []))) {
            assignedUsersMap.set(user.id, user);
        }
    }
    const data = ticketRows.map((ticket) => {
        const assignedUser = ticket.assigned_to ? assignedUsersMap.get(ticket.assigned_to) ?? null : null;
        return mapTicketSummary(ticket, assignedUser);
    });
    res.json({
        status: "ok",
        data: {
            customer: {
                id: customerResult.data.id,
                company: customerResult.data.company,
            },
            tickets: data,
        },
    });
});
router.post("/portal/tickets", async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for customer portal operations.",
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
    const parsedBody = parseTicketCreateBody(req.body);
    if ("error" in parsedBody) {
        res.status(400).json({
            status: "error",
            message: parsedBody.error,
        });
        return;
    }
    const customerResult = await ensureCustomerProfile(viewer);
    if ("error" in customerResult) {
        res.status(500).json({
            status: "error",
            message: customerResult.error,
        });
        return;
    }
    const assigneeResult = await chooseCsrAssignee();
    if ("error" in assigneeResult) {
        res.status(503).json({
            status: "error",
            message: assigneeResult.error,
        });
        return;
    }
    const systemSettings = await (0, systemSettings_1.getSystemSettings)();
    const caseInsertResult = await client
        .from("cases")
        .insert({
        customer_id: customerResult.data.id,
        assigned_to: assigneeResult.data.id,
        title: parsedBody.data.subject,
        description: parsedBody.data.description,
        category: parsedBody.data.category,
        attachments: parsedBody.data.attachments,
        status: "Open",
        priority: systemSettings.defaultCasePriority,
    })
        .select("id,customer_id,assigned_to,title,description,status,priority,category,attachments,customer_satisfaction_rating,customer_satisfaction_submitted_at,created_at,updated_at")
        .single();
    if (caseInsertResult.error) {
        res.status(400).json({
            status: "error",
            message: caseInsertResult.error.message,
        });
        return;
    }
    const parsedCase = toCaseRows([caseInsertResult.data])[0];
    if (!parsedCase) {
        res.status(500).json({
            status: "error",
            message: "Failed to parse created ticket payload.",
        });
        return;
    }
    const messageInserts = [
        {
            case_id: parsedCase.id,
            sender_id: null,
            sender_role: "Customer",
            message_type: "system",
            message_text: `Ticket created in category "${parsedBody.data.category}" and assigned to support.`,
        },
    ];
    if (parsedBody.data.description.trim()) {
        messageInserts.push({
            case_id: parsedCase.id,
            sender_id: viewer.sub,
            sender_role: "Customer",
            message_type: "text",
            message_text: parsedBody.data.description,
        });
    }
    const messageInsertResult = await client.from("messages").insert(messageInserts);
    if (messageInsertResult.error) {
        res.status(500).json({
            status: "error",
            message: messageInsertResult.error.message,
        });
        return;
    }
    res.status(201).json({
        status: "ok",
        data: {
            ticket: mapTicketSummary(parsedCase, assigneeResult.data),
        },
    });
});
router.get("/portal/tickets/:caseId", async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for customer portal operations.",
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
    const caseId = parseUuidParam(req.params.caseId, "caseId");
    if ("error" in caseId) {
        res.status(400).json({
            status: "error",
            message: caseId.error,
        });
        return;
    }
    const customerResult = await ensureCustomerProfile(viewer);
    if ("error" in customerResult) {
        res.status(500).json({
            status: "error",
            message: customerResult.error,
        });
        return;
    }
    const caseResult = await fetchCustomerCase(caseId.data, customerResult.data.id);
    if ("error" in caseResult) {
        res.status(500).json({
            status: "error",
            message: caseResult.error,
        });
        return;
    }
    if (!caseResult.data) {
        res.status(404).json({
            status: "error",
            message: "Ticket not found.",
        });
        return;
    }
    const messagesResult = await client
        .from("messages")
        .select("id,case_id,sender_id,sender_role,message_type,message_text,created_at")
        .eq("case_id", caseResult.data.id)
        .in("message_type", ["text", "system"])
        .order("created_at", { ascending: true });
    if (messagesResult.error) {
        res.status(500).json({
            status: "error",
            message: messagesResult.error.message,
        });
        return;
    }
    const messages = toMessageRows((messagesResult.data ?? []));
    const relatedUserIds = Array.from(new Set([
        caseResult.data.assigned_to,
        ...messages.map((message) => message.sender_id),
    ].filter((userId) => typeof userId === "string")));
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
    const assignedEmployee = caseResult.data.assigned_to
        ? usersById.get(caseResult.data.assigned_to) ?? null
        : null;
    const messageItems = messages
        .filter((message) => message.message_type === "text")
        .map((message) => {
        const sender = message.sender_id ? usersById.get(message.sender_id) : undefined;
        return {
            id: message.id,
            senderId: message.sender_id,
            senderRole: message.sender_role,
            senderName: message.sender_role === "Customer"
                ? "You"
                : sender?.name || sender?.email || message.sender_role,
            messageText: message.message_text,
            createdAt: message.created_at,
            isCustomer: message.sender_role === "Customer",
        };
    });
    const timeline = buildTimeline(caseResult.data, messages);
    res.json({
        status: "ok",
        data: {
            ticket: {
                ...mapTicketSummary(caseResult.data, assignedEmployee),
                description: caseResult.data.description,
                attachments: caseResult.data.attachments,
            },
            timeline,
            messages: messageItems,
        },
    });
});
router.post("/portal/tickets/:caseId/customer-satisfaction", async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for customer portal operations.",
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
    const caseId = parseUuidParam(req.params.caseId, "caseId");
    if ("error" in caseId) {
        res.status(400).json({
            status: "error",
            message: caseId.error,
        });
        return;
    }
    const parsedBody = parseCustomerSatisfactionBody(req.body);
    if ("error" in parsedBody) {
        res.status(400).json({
            status: "error",
            message: parsedBody.error,
        });
        return;
    }
    const customerResult = await ensureCustomerProfile(viewer);
    if ("error" in customerResult) {
        res.status(500).json({
            status: "error",
            message: customerResult.error,
        });
        return;
    }
    const caseResult = await fetchCustomerCase(caseId.data, customerResult.data.id);
    if ("error" in caseResult) {
        res.status(500).json({
            status: "error",
            message: caseResult.error,
        });
        return;
    }
    if (!caseResult.data) {
        res.status(404).json({
            status: "error",
            message: "Ticket not found.",
        });
        return;
    }
    if (caseResult.data.status !== "Resolved") {
        res.status(409).json({
            status: "error",
            message: "Customer satisfaction can only be submitted after a ticket is resolved.",
        });
        return;
    }
    if (caseResult.data.customer_satisfaction_rating !== null) {
        res.status(409).json({
            status: "error",
            message: "Customer satisfaction has already been submitted for this ticket.",
        });
        return;
    }
    const submittedAt = new Date().toISOString();
    const caseUpdateResult = await client
        .from("cases")
        .update({
        customer_satisfaction_rating: parsedBody.data.rating,
        customer_satisfaction_submitted_at: submittedAt,
    })
        .eq("id", caseResult.data.id)
        .eq("customer_id", customerResult.data.id)
        .is("customer_satisfaction_rating", null)
        .select("id,customer_id,assigned_to,title,description,status,priority,category,attachments,customer_satisfaction_rating,customer_satisfaction_submitted_at,created_at,updated_at")
        .maybeSingle();
    if (caseUpdateResult.error) {
        res.status(400).json({
            status: "error",
            message: caseUpdateResult.error.message,
        });
        return;
    }
    const updatedCase = caseUpdateResult.data ? toCaseRows([caseUpdateResult.data])[0] : null;
    if (!updatedCase) {
        res.status(409).json({
            status: "error",
            message: "Customer satisfaction was already submitted for this ticket.",
        });
        return;
    }
    await client.from("messages").insert({
        case_id: updatedCase.id,
        sender_id: viewer.sub,
        sender_role: "Customer",
        message_type: "system",
        message_text: `Customer satisfaction submitted: ${parsedBody.data.rating}/5.`,
    });
    if (updatedCase.assigned_to && updatedCase.assigned_to !== viewer.sub) {
        await (0, notificationService_1.createNotification)({
            userId: updatedCase.assigned_to,
            type: "case_customer_satisfaction",
            message: `A customer submitted a ${parsedBody.data.rating}/5 satisfaction rating for "${updatedCase.title}".`,
        });
    }
    res.status(201).json({
        status: "ok",
        data: {
            ticketId: updatedCase.id,
            rating: updatedCase.customer_satisfaction_rating,
            submittedAt: updatedCase.customer_satisfaction_submitted_at,
        },
    });
});
router.post("/portal/tickets/:caseId/messages", async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for customer portal operations.",
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
    const caseId = parseUuidParam(req.params.caseId, "caseId");
    if ("error" in caseId) {
        res.status(400).json({
            status: "error",
            message: caseId.error,
        });
        return;
    }
    const parsedBody = parseCreateMessageBody(req.body);
    if ("error" in parsedBody) {
        res.status(400).json({
            status: "error",
            message: parsedBody.error,
        });
        return;
    }
    const customerResult = await ensureCustomerProfile(viewer);
    if ("error" in customerResult) {
        res.status(500).json({
            status: "error",
            message: customerResult.error,
        });
        return;
    }
    const caseResult = await fetchCustomerCase(caseId.data, customerResult.data.id);
    if ("error" in caseResult) {
        res.status(500).json({
            status: "error",
            message: caseResult.error,
        });
        return;
    }
    if (!caseResult.data) {
        res.status(404).json({
            status: "error",
            message: "Ticket not found.",
        });
        return;
    }
    const messageInsertResult = await client
        .from("messages")
        .insert({
        case_id: caseId.data,
        sender_id: viewer.sub,
        sender_role: "Customer",
        message_type: "text",
        message_text: parsedBody.data.messageText,
    })
        .select("id,case_id,sender_id,sender_role,message_type,message_text,created_at")
        .single();
    if (messageInsertResult.error) {
        res.status(400).json({
            status: "error",
            message: messageInsertResult.error.message,
        });
        return;
    }
    await client
        .from("cases")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", caseId.data)
        .eq("customer_id", customerResult.data.id);
    const parsedMessage = toMessageRows([messageInsertResult.data])[0];
    if (!parsedMessage) {
        res.status(500).json({
            status: "error",
            message: "Failed to parse created message payload.",
        });
        return;
    }
    const senderName = getDisplayName({ name: viewer.name, email: viewer.email });
    (0, realtime_1.emitCaseChatMessage)({
        id: parsedMessage.id,
        caseId: parsedMessage.case_id,
        senderId: parsedMessage.sender_id,
        senderRole: parsedMessage.sender_role,
        senderName,
        messageText: parsedMessage.message_text,
        createdAt: parsedMessage.created_at,
        isCustomer: true,
    });
    if (caseResult.data.assigned_to && caseResult.data.assigned_to !== viewer.sub) {
        await (0, notificationService_1.createNotification)({
            userId: caseResult.data.assigned_to,
            type: "case_message",
            message: `New customer message on "${caseResult.data.title}".`,
        });
    }
    res.status(201).json({
        status: "ok",
        data: {
            message: {
                id: parsedMessage.id,
                senderId: parsedMessage.sender_id,
                senderRole: parsedMessage.sender_role,
                senderName: "You",
                messageText: parsedMessage.message_text,
                createdAt: parsedMessage.created_at,
                isCustomer: true,
            },
        },
    });
});
exports.customerPortalRouter = router;
